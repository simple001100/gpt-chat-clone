"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthForm } from "@/features/chat/auth-form";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  pending?: boolean;
};

export function AuthDialog({
  open,
  onOpenChange,
  onSignIn,
  onSignUp,
  pending = false,
}: AuthDialogProps) {
  const t = useTranslations("auth");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-xl data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{t("title")}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                type="button"
                aria-label={t("close")}
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <AuthForm
            pending={pending}
            onSignIn={onSignIn}
            onSignUp={onSignUp}
            onSignedIn={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
