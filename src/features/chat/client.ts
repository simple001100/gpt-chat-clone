"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ChatItem,
  ChatMessage,
  ContextDocument,
  SessionInfo,
  UploadedFile,
} from "@/features/chat/types";

const ANON_FINGERPRINT_KEY = "anon_fingerprint_v1";
const DEFAULT_MESSAGES_PAGE_SIZE = 30;

export type MessagesPage = {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

function getAnonFingerprint() {
  if (typeof window === "undefined") {
    return "";
  }

  const saved = window.localStorage.getItem(ANON_FINGERPRINT_KEY);
  if (saved) {
    return saved;
  }

  const generated = `${crypto.randomUUID()}-${navigator.userAgent}`;
  window.localStorage.setItem(ANON_FINGERPRINT_KEY, generated);
  return generated;
}

function buildJsonHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-anon-fingerprint": getAnonFingerprint(),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function buildFormHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    "x-anon-fingerprint": getAnonFingerprint(),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function readSession(): Promise<SessionInfo | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  const accessToken = data.session?.access_token;
  const email = data.session?.user?.email;
  if (!accessToken || !email) {
    return null;
  }
  return { accessToken, email };
}

export async function signIn(email: string, password: string) {
  const response = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const json = (await response
    .json()
    .catch(() => ({ error: "Sign in failed" }))) as {
    error?: string;
    session?: {
      accessToken: string;
      refreshToken: string;
    };
  };

  if (!response.ok || !json.session) {
    throw new Error(json.error ?? "Sign in failed");
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.setSession({
    access_token: json.session.accessToken,
    refresh_token: json.session.refreshToken,
  });

  if (error) {
    throw new Error("Signed in, but failed to initialize local session");
  }
}

export async function signUp(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchChats(accessToken?: string) {
  const response = await fetch("/api/chats", {
    headers: buildJsonHeaders(accessToken),
  });
  const json = (await response.json()) as {
    chats?: ChatItem[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error ?? "Failed to load chats");
  }
  return json.chats ?? [];
}

export async function createChat(accessToken?: string, title?: string) {
  const response = await fetch("/api/chats", {
    method: "POST",
    headers: buildJsonHeaders(accessToken),
    body: JSON.stringify({ title: title?.trim() || "New chat" }),
  });
  const json = (await response.json()) as { chat?: ChatItem; error?: string };
  if (!response.ok || !json.chat) {
    throw new Error(json.error ?? "Failed to create chat");
  }
  return json.chat;
}

export async function fetchMessages(params: {
  chatId: string;
  accessToken?: string;
  before?: string | null;
  limit?: number;
}) {
  const search = new URLSearchParams({ chat_id: params.chatId });
  if (params.before) {
    search.set("before", params.before);
  }
  search.set("limit", String(params.limit ?? DEFAULT_MESSAGES_PAGE_SIZE));

  const response = await fetch(`/api/messages?${search.toString()}`, {
    headers: buildJsonHeaders(params.accessToken),
  });
  const json = (await response.json()) as {
    messages?: ChatMessage[];
    hasMore?: boolean;
    nextCursor?: string | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error ?? "Failed to load messages");
  }
  return {
    messages: json.messages ?? [],
    hasMore: Boolean(json.hasMore),
    nextCursor: json.nextCursor ?? null,
  } as MessagesPage;
}

export async function uploadFile(file: File, accessToken?: string) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    headers: buildFormHeaders(accessToken),
    body: form,
  });
  const json = (await response.json()) as {
    file?: UploadedFile;
    error?: string;
  };
  if (!response.ok || !json.file) {
    throw new Error(json.error ?? "Failed to upload file");
  }
  return json.file;
}

export async function parseContextDocument(file: File, accessToken?: string) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/documents/parse", {
    method: "POST",
    headers: buildFormHeaders(accessToken),
    body: form,
  });
  const json = (await response
    .json()
    .catch(() => ({ error: "Document parse failed" }))) as {
    error?: string;
    document?: ContextDocument;
  };

  if (!response.ok || !json.document) {
    throw new Error(json.error ?? "Failed to parse document");
  }

  return json.document;
}

export async function streamReply(
  params: {
    chatId: string;
    content: string;
    attachments: UploadedFile[];
    contextDocuments?: ContextDocument[];
    model?: string;
    accessToken?: string;
  },
  callbacks: {
    onUserMessage?: (message: ChatMessage) => void;
    onAssistantMessage?: (message: ChatMessage) => void;
    onToken?: (payload: { token: string; messageId: string }) => void;
  },
) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: buildJsonHeaders(params.accessToken),
    body: JSON.stringify({
      chatId: params.chatId,
      content: params.content,
      model: params.model,
      contextDocuments: params.contextDocuments ?? [],
      attachments: params.attachments.map((item) => ({
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSize,
        fileUrl: item.fileUrl,
      })),
    }),
  });

  if (!response.ok) {
    const json = (await response
      .json()
      .catch(() => ({ error: "Request failed" }))) as {
      error?: string;
    };
    throw new Error(json.error ?? "Failed to send message");
  }

  if (!response.body) {
    throw new Error("Missing stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      const lines = eventBlock.split("\n");
      let eventName = "message";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data += line.slice(5).trim();
        }
      }

      if (!data) continue;
      const parsed = JSON.parse(data) as {
        token?: string;
        messageId?: string;
        message?: unknown;
      };
      if (
        eventName === "user_message" &&
        parsed.message &&
        typeof parsed.message === "object"
      ) {
        callbacks.onUserMessage?.(parsed.message as ChatMessage);
      }
      if (
        eventName === "assistant_message" &&
        parsed.message &&
        typeof parsed.message === "object"
      ) {
        callbacks.onAssistantMessage?.(parsed.message as ChatMessage);
      }
      if (eventName === "token" && parsed.token && parsed.messageId) {
        callbacks.onToken?.({
          token: parsed.token,
          messageId: parsed.messageId,
        });
      }
      if (eventName === "error") {
        const message =
          typeof parsed.message === "string" ? parsed.message : "Streaming error";
        throw new Error(message);
      }
    }
  }
}
