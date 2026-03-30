"use client";

import { PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ChatItem } from "@/features/chat/types";

type ChatSidebarProps = {
  chats: ChatItem[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  onCreateChat: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  createPending?: boolean;
};

export function ChatSidebar({
  chats,
  selectedChatId,
  onSelectChat,
  onCreateChat,
  isCollapsed,
  onToggleCollapsed,
  createPending = false,
}: ChatSidebarProps) {
  const tApp = useTranslations("app");
  const tSidebar = useTranslations("sidebar");

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-border bg-card/95 p-3 backdrop-blur-sm transition-transform duration-200 lg:static lg:inset-auto lg:bg-card/50 lg:backdrop-blur-0 lg:transition-[width] lg:duration-300 lg:ease-in-out overflow-hidden ${
        isCollapsed
          ? "-translate-x-full lg:translate-x-0 lg:w-16"
          : "translate-x-0 w-72 lg:w-72"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <p
            className={`text-sm font-medium text-foreground transition-[opacity,transform] duration-200 ${
              isCollapsed
                ? "pointer-events-none absolute -translate-x-1 opacity-0"
                : "translate-x-0 opacity-100"
            }`}
          >
            {tApp("name")}
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isCollapsed ? tSidebar("expand") : tSidebar("collapse")}
            onClick={onToggleCollapsed}
          >
            <PanelLeft
              className={`h-4 w-4 ${isCollapsed ? "rotate-180" : ""}`}
            />
          </Button>
        </div>

        <div
          className={`grid flex-1 gap-3 transition-[opacity,transform] duration-200 ${
            isCollapsed
              ? "pointer-events-none translate-x-2 opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <Button onClick={onCreateChat} disabled={createPending}>
            {tApp("newChat")}
          </Button>

          <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
            {chats.map((chat) => {
              const selected = selectedChatId === chat.id;
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    selected
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted"
                  }`}
                >
                  {chat.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
