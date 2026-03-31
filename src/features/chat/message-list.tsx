"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/features/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
  hasActiveChat: boolean;
  historyLoading?: boolean;
  loadingOlderHistory?: boolean;
  hasMoreHistory?: boolean;
  onLoadOlder?: () => void;
};

export function MessageList({
  messages,
  hasActiveChat,
  historyLoading = false,
  loadingOlderHistory = false,
  hasMoreHistory = false,
  onLoadOlder,
}: MessageListProps) {
  const t = useTranslations("messageList");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const isPrependingRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const loadedLengthRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isPrependingRef.current) {
      const delta = container.scrollHeight - previousScrollHeightRef.current;
      container.scrollTop += delta;
      isPrependingRef.current = false;
      loadedLengthRef.current = messages.length;
      return;
    }

    const appendedAtBottom = messages.length > loadedLengthRef.current;
    loadedLengthRef.current = messages.length;
    if (appendedAtBottom && shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [messages]);

  if (!hasActiveChat) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
          <p className="text-6xl leading-none">✨</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            {t("emptyTitle")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("createChatPrompt")}</p>
        </div>
      </div>
    );
  }

  if (historyLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-2xl items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>...</span>
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            {t("emptyTitle")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={(event) => {
        const target = event.currentTarget;
        const distanceToBottom =
          target.scrollHeight - target.scrollTop - target.clientHeight;
        shouldAutoScrollRef.current = distanceToBottom < 120;

        if (
          target.scrollTop < 120 &&
          hasMoreHistory &&
          !loadingOlderHistory &&
          onLoadOlder
        ) {
          previousScrollHeightRef.current = target.scrollHeight;
          isPrependingRef.current = true;
          onLoadOlder();
        }
      }}
      className="flex-1 overflow-y-auto p-6 space-y-4"
    >
      {messages.map((message) => {
        const isUser = message.role === "user";
        const isAssistantLoading =
          message.role === "assistant" && message.content.trim().length === 0;

        return (
          <div
            key={message.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`w-fit max-w-[min(100%,48rem)] rounded-2xl px-4 py-3 whitespace-pre-wrap break-words transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-1 ${
                isUser ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {isAssistantLoading ? (
                <div className="grid gap-2">
                  <div className="h-2.5 w-28 rounded-full bg-muted-foreground/25 animate-pulse" />
                  <div className="h-2.5 w-40 rounded-full bg-muted-foreground/20 animate-pulse [animation-delay:120ms]" />
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc pl-5 marker:text-current">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal pl-5 marker:text-current">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children, className }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="rounded bg-black/10 px-1 py-0.5 text-[0.92em] dark:bg-white/10">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="block overflow-x-auto rounded-xl bg-black/10 p-3 text-xs dark:bg-white/10">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <pre className="mb-2 mt-2">{children}</pre>,
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-current/60 underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="mb-2 border-l-2 border-current/40 pl-3 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
              {!!message.attachments?.length && (
                <div className="mt-3 grid gap-2">
                  {message.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline decoration-muted-foreground/60 underline-offset-2"
                    >
                      {attachment.file_name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
