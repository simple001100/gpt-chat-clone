"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type AuthFormProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignedIn: () => void;
  pending?: boolean;
};

export function AuthForm({
  onSignIn,
  onSignUp,
  onSignedIn,
  pending = false,
}: AuthFormProps) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>("");

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none"
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none"
        placeholder={t("passwordPlaceholder")}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <p className="min-h-5 text-sm text-destructive">{message || " "}</p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={async () => {
            setMessage("");
            try {
              await onSignIn(email.trim(), password);
              onSignedIn();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : t("signInError"));
            }
          }}
        >
          {t("signIn")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={async () => {
            setMessage("");
            try {
              await onSignUp(email.trim(), password);
              setMessage(t("signupConfirm"));
            } catch (e) {
              setMessage(e instanceof Error ? e.message : t("signUpError"));
            }
          }}
        >
          {t("signUp")}
        </Button>
      </div>
    </div>
  );
}
