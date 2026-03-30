"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type ChatHeaderProps = {
  activeChatTitle: string;
  email: string | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  logoutPending?: boolean;
};

export function ChatHeader({
  activeChatTitle,
  email,
  onOpenAuth,
  onLogout,
  logoutPending = false,
}: ChatHeaderProps) {
  const t = useTranslations("header");

  return (
    <header className="h-14 border-b border-border px-4 flex items-center justify-end bg-background/90 backdrop-blur-sm">
      <p className="flex-1 truncate text-sm text-muted-foreground text-center p-10 text-ellipsis overflow-hidden">
        {activeChatTitle}
      </p>
      {email ? (
        <div className="flex items-center gap-2">
          <span className="max-w-52 truncate text-xs text-muted-foreground">
            {email}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-w-20 justify-center"
            onClick={onLogout}
            disabled={logoutPending}
          >
            {t("signOut")}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="min-w-20 justify-center"
          onClick={onOpenAuth}
        >
          {t("signIn")}
        </Button>
      )}
    </header>
  );
}
