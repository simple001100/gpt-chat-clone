"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/features/chat/auth-dialog";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ErrorDialog } from "@/features/chat/error-dialog";
import { ChatHeader } from "@/features/chat/chat-header";
import { ChatSidebar } from "@/features/chat/chat-sidebar";
import { toUserErrorMessage } from "@/features/chat/error-utils";
import { MessageList } from "@/features/chat/message-list";
import {
  publishChatRealtimeEvent,
  subscribeChatRealtimeEvents,
} from "@/features/chat/realtime";
import {
  createChat,
  fetchChats,
  fetchMessages,
  type MessagesPage,
  parseContextDocument,
  readSession,
  signIn,
  signOut,
  signUp,
  streamReply,
  uploadFile,
} from "@/features/chat/client";
import type { ContextDocument, UploadedFile } from "@/features/chat/types";

function withFileMarker(content: string, documents: ContextDocument[]) {
  if (!documents.length) {
    return content;
  }

  if (documents.length === 1) {
    return `${content}\n\n📎 Файл: ${documents[0].fileName}`;
  }

  const fileLines = documents
    .map((document) => `- ${document.fileName}`)
    .join("\n");
  return `${content}\n\n📎 Файлы:\n${fileLines}`;
}

export function ChatApp() {
  const tApp = useTranslations("app");
  const tSidebar = useTranslations("sidebar");
  const tErrors = useTranslations("errors");
  const queryClient = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<ContextDocument[]>(
    [],
  );

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: readSession,
  });

  const accessToken = sessionQuery.data?.accessToken;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 1023px)");
    const applyByViewport = () => {
      setIsSidebarCollapsed(media.matches);
    };

    applyByViewport();
    media.addEventListener("change", applyByViewport);
    return () => media.removeEventListener("change", applyByViewport);
  }, []);

  const chatsQuery = useQuery({
    queryKey: ["chats", accessToken ?? "anonymous"],
    queryFn: () => fetchChats(accessToken),
  });

  const selectedChatId = activeChatId ?? chatsQuery.data?.[0]?.id ?? null;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", selectedChatId, accessToken ?? "anonymous"],
    enabled: Boolean(selectedChatId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchMessages({
        chatId: selectedChatId!,
        accessToken,
        before: pageParam,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : null,
  });

  useEffect(() => {
    return subscribeChatRealtimeEvents(async (event) => {
      await queryClient.invalidateQueries({ queryKey: ["chats"] });

      if (event.type === "message_created") {
        await queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "messages" &&
            query.queryKey[1] === event.chatId,
        });
      }
    });
  }, [queryClient]);

  const updateMessagesCache = (
    chatId: string,
    updater: (
      previous: InfiniteData<MessagesPage, string | null> | undefined,
    ) => InfiniteData<MessagesPage, string | null> | undefined,
  ) => {
    const queryKey = ["messages", chatId, accessToken ?? "anonymous"] as const;
    queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(
      queryKey,
      updater,
    );
  };

  const createChatMutation = useMutation({
    mutationFn: () => createChat(accessToken, tApp("newChat")),
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setActiveChatId(chat.id);
      publishChatRealtimeEvent({ type: "chat_created", chatId: chat.id });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, accessToken),
  });

  const sendMutation = useMutation({
    mutationFn: async ({
      chatId,
      content,
      attachments,
      contextDocuments,
      model,
    }: {
      chatId: string;
      content: string;
      attachments: UploadedFile[];
      contextDocuments: ContextDocument[];
      model?: string;
    }) => {
      await streamReply(
        { chatId, content, attachments, contextDocuments, model, accessToken },
        {
          onUserMessage: (message) => {
            updateMessagesCache(chatId, (prev) => {
              if (!prev || prev.pages.length === 0) {
                return {
                  pageParams: [null],
                  pages: [
                    { messages: [message], hasMore: false, nextCursor: null },
                  ],
                };
              }

              const [latestPage, ...otherPages] = prev.pages;
              return {
                ...prev,
                pages: [
                  {
                    ...latestPage,
                    messages: [...latestPage.messages, message],
                  },
                  ...otherPages,
                ],
              };
            });
          },
          onAssistantMessage: (message) => {
            updateMessagesCache(chatId, (prev) => {
              if (!prev || prev.pages.length === 0) {
                return {
                  pageParams: [null],
                  pages: [
                    { messages: [message], hasMore: false, nextCursor: null },
                  ],
                };
              }

              const [latestPage, ...otherPages] = prev.pages;
              return {
                ...prev,
                pages: [
                  {
                    ...latestPage,
                    messages: [...latestPage.messages, message],
                  },
                  ...otherPages,
                ],
              };
            });
          },
          onToken: ({ token, messageId }) => {
            updateMessagesCache(chatId, (prev) => {
              if (!prev) {
                return prev;
              }
              return {
                ...prev,
                pages: prev.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((message) =>
                    message.id === messageId
                      ? { ...message, content: `${message.content}${token}` }
                      : message,
                  ),
                })),
              };
            });
          },
        },
      );
    },
    onSuccess: async (_, variables) => {
      setPendingFiles([]);
      setPendingDocuments([]);
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      publishChatRealtimeEvent({
        type: "message_created",
        chatId: variables.chatId,
      });
    },
    onError: async (_error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["messages", variables.chatId, accessToken ?? "anonymous"],
      });
    },
  });

  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
    onSuccess: async () => {
      setError(null);
      setActiveChatId(null);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      await queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const signUpMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signUp(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      setActiveChatId(null);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      await queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const mergedMessages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    return [...pages].reverse().flatMap((page) => page.messages);
  }, [messagesQuery.data]);
  const errorMessages = useMemo(
    () => ({
      fallback: tErrors("fallback"),
      anonymousLimit: tErrors("anonymousLimit"),
      quota: tErrors("quota"),
      fileTooLarge: tErrors("fileTooLarge"),
      chatNotFound: tErrors("chatNotFound"),
      unauthorized: tErrors("unauthorized"),
      network: tErrors("network"),
    }),
    [tErrors],
  );
  const activeChatTitle =
    chatsQuery.data?.find((chat) => chat.id === selectedChatId)?.title ??
    tApp("newChat");

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {isSidebarCollapsed && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={tSidebar("expand")}
          onClick={() => setIsSidebarCollapsed(false)}
          className="fixed left-3 top-3 z-30 lg:hidden"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}
      {!isSidebarCollapsed && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          aria-label={tSidebar("collapse")}
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}
      <ChatSidebar
        chats={chatsQuery.data ?? []}
        selectedChatId={selectedChatId}
        onSelectChat={(chatId) => {
          setActiveChatId(chatId);
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 1023px)").matches
          ) {
            setIsSidebarCollapsed(true);
          }
        }}
        onCreateChat={() => createChatMutation.mutate()}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
        createPending={createChatMutation.isPending}
      />

      <main className="flex-1 flex flex-col">
        <ChatHeader
          activeChatTitle={activeChatTitle}
          email={sessionQuery.data?.email ?? null}
          onOpenAuth={() => setAuthOpen(true)}
          onLogout={() => signOutMutation.mutate()}
          logoutPending={signOutMutation.isPending}
        />
        <MessageList
          key={selectedChatId ?? "no-chat"}
          messages={mergedMessages}
          hasActiveChat={Boolean(selectedChatId)}
          historyLoading={Boolean(selectedChatId) && messagesQuery.isPending}
          loadingOlderHistory={messagesQuery.isFetchingNextPage}
          hasMoreHistory={Boolean(messagesQuery.hasNextPage)}
          onLoadOlder={() => {
            if (
              !messagesQuery.hasNextPage ||
              messagesQuery.isFetchingNextPage
            ) {
              return;
            }
            messagesQuery.fetchNextPage();
          }}
        />

        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          files={pendingFiles}
          onRemoveFile={(path) => {
            setPendingFiles((prev) =>
              prev.filter((item) => item.path !== path),
            );
          }}
          documents={pendingDocuments}
          onRemoveDocument={(id) => {
            setPendingDocuments((prev) =>
              prev.filter((item) => item.id !== id),
            );
          }}
          onDocumentInput={async (files) => {
            for (const file of files) {
              try {
                const document = await parseContextDocument(file, accessToken);
                setPendingDocuments((prev) => [...prev, document]);
              } catch (parseError) {
                setError(
                  toUserErrorMessage(
                    parseError,
                    errorMessages,
                    tErrors("parseDocumentFallback"),
                  ),
                );
              }
            }
          }}
          onSubmit={async () => {
            setError(null);
            try {
              const content = draft.trim();
              if (!content) return;

              const attachmentsToSend = [...pendingFiles];
              const documentsToSend = [...pendingDocuments];
              const contentWithFileMarker = withFileMarker(
                content,
                documentsToSend,
              );

              setDraft("");
              setPendingFiles([]);
              setPendingDocuments([]);

              let chatId = selectedChatId;
              if (!chatId) {
                chatId = await createChatMutation
                  .mutateAsync()
                  .then((chat) => chat.id);
              }
              if (!chatId) {
                throw new Error(tErrors("chatIdResolveFallback"));
              }
              await sendMutation.mutateAsync({
                chatId,
                content: contentWithFileMarker,
                attachments: attachmentsToSend,
                contextDocuments: documentsToSend,
              });
            } catch (submitError) {
              setError(
                toUserErrorMessage(
                  submitError,
                  errorMessages,
                  tErrors("sendMessageFallback"),
                ),
              );
            }
          }}
          pending={
            sendMutation.isPending ||
            createChatMutation.isPending ||
            uploadMutation.isPending
          }
        />
      </main>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        pending={signInMutation.isPending || signUpMutation.isPending}
        onSignIn={(email, password) =>
          signInMutation.mutateAsync({ email, password }).then(() => undefined)
        }
        onSignUp={(email, password) =>
          signUpMutation.mutateAsync({ email, password }).then(() => undefined)
        }
      />

      <ErrorDialog
        open={Boolean(error)}
        message={error ?? ""}
        onOpenChange={(open) => {
          if (!open) {
            setError(null);
          }
        }}
      />
    </div>
  );
}
