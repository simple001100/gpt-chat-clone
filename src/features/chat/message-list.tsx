"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
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
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <p className="text-sm text-muted-foreground">{t("createChatPrompt")}</p>
      </div>
    );
  }

  if (historyLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-2xl gap-3">
          <div className="h-3 w-48 rounded-full bg-muted-foreground/25 animate-pulse" />
          <div className="h-3 w-64 rounded-full bg-muted-foreground/20 animate-pulse [animation-delay:120ms]" />
          <div className="h-3 w-40 rounded-full bg-muted-foreground/20 animate-pulse [animation-delay:240ms]" />
          <p className="text-xs text-muted-foreground">{t("historyLoading")}</p>
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
                message.content
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
