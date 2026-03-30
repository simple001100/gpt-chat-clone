"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ContextDocument, UploadedFile } from "@/features/chat/types";

type ChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  files: UploadedFile[];
  onRemoveFile: (path: string) => void;
  documents: ContextDocument[];
  onRemoveDocument: (id: string) => void;
  onDocumentInput: (files: File[]) => Promise<void>;
  onSubmit: () => Promise<void>;
  pending?: boolean;
};

export function ChatComposer({
  draft,
  onDraftChange,
  files,
  onRemoveFile,
  documents,
  onRemoveDocument,
  onDocumentInput,
  onSubmit,
  pending = false,
}: ChatComposerProps) {
  const t = useTranslations("composer");

  return (
    <form
      className="border-t border-border p-4 flex flex-col gap-3 bg-background/95"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit();
      }}
    >
      {!!files.length && (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <div
              key={file.path}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
            >
              <span className="max-w-48 truncate">{file.fileName}</span>
              <button
                type="button"
                className="text-destructive"
                onClick={() => onRemoveFile(file.path)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      {!!documents.length && (
        <div className="flex flex-wrap gap-2">
          {documents.map((document) => (
            <div
              key={document.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
            >
              <span className="max-w-56 truncate">
                {document.fileName} ({document.tokenEstimate} {t("tokenShort")})
              </span>
              <button
                type="button"
                className="text-destructive"
                onClick={() => onRemoveDocument(document.id)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-ring focus:outline-none"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={t("placeholder")}
        />
        <Button asChild variant="outline" size="lg" className="min-w-20">
          <label className="cursor-pointer">
            {t("file")}
            <input
              className="hidden"
              type="file"
              accept=".txt,.md,.doc,.docx,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              onChange={async (event) => {
                const input = event.currentTarget;
                const selected = Array.from(event.target.files ?? []);
                if (selected.length > 0) {
                  await onDocumentInput(selected);
                }
                input.value = "";
              }}
            />
          </label>
        </Button>
        <Button type="submit" size="lg" className="min-w-28" disabled={pending}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
