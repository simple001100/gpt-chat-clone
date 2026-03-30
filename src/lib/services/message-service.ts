import { getGeminiDefaultModel } from "@/lib/env";
import type { RequestContext } from "@/lib/api/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateGeminiChatTitle,
  streamGeminiResponse,
} from "@/lib/llm/gemini";
import { ensureOwnedChat } from "@/lib/services/chat-service";
import type { DbInsert, DbRow } from "@/lib/supabase/types";
import type { ChatRole } from "@/types/chat";

type IncomingAttachment = {
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
};

type AttachmentRow = DbRow<"attachments">;
type MessageRow = DbRow<"messages">;

type MessageAttachmentDTO = Pick<
  AttachmentRow,
  "id" | "file_name" | "file_type" | "file_url" | "file_size"
>;

type MessageWithAttachmentsDTO = Pick<
  MessageRow,
  "id" | "chat_id" | "role" | "content" | "created_at"
> & {
  attachments: MessageAttachmentDTO[];
};

const DEFAULT_CHAT_TITLES = new Set(["Новый чат", "New chat"]);

function isChatRole(value: string): value is ChatRole {
  return value === "user" || value === "assistant" || value === "system";
}

function normalizeAttachmentDtos(input: unknown): MessageAttachmentDTO[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const mapped: MessageAttachmentDTO[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id === "string" &&
      typeof row.file_name === "string" &&
      typeof row.file_type === "string" &&
      typeof row.file_url === "string" &&
      typeof row.file_size === "number"
    ) {
      mapped.push({
        id: row.id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_url: row.file_url,
        file_size: row.file_size,
      });
    }
  }

  return mapped;
}

function toMessageWithAttachmentsDto(
  row: Pick<MessageRow, "id" | "chat_id" | "role" | "content" | "created_at"> & {
    attachments?: unknown;
  },
): MessageWithAttachmentsDTO {
  return {
    id: row.id,
    chat_id: row.chat_id,
    role: isChatRole(row.role) ? row.role : "assistant",
    content: row.content,
    created_at: row.created_at,
    attachments: normalizeAttachmentDtos(row.attachments),
  };
}

export function normalizeAttachments(input: unknown): IncomingAttachment[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized: IncomingAttachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.fileName === "string" &&
      typeof row.fileType === "string" &&
      typeof row.fileUrl === "string" &&
      typeof row.fileSize === "number"
    ) {
      normalized.push({
        fileName: row.fileName,
        fileType: row.fileType,
        fileUrl: row.fileUrl,
        fileSize: row.fileSize,
      });
    }
  }

  return normalized;
}

export async function listMessagesForChat(
  context: RequestContext,
  chatId: string,
  options?: { before?: string; limit?: number },
) {
  const owned = await ensureOwnedChat(context, chatId);
  if (!owned) {
    return null;
  }

  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("messages")
    .select(
      "id,chat_id,role,content,created_at,attachments(id,file_name,file_type,file_url,file_size)",
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) =>
    toMessageWithAttachmentsDto({
      id: row.id,
      chat_id: row.chat_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      attachments: row.attachments,
    }),
  );
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const messages = [...pageRows].reverse();
  const nextCursor = hasMore ? messages[0]?.created_at ?? null : null;

  return { messages, hasMore, nextCursor };
}

export async function applyAnonymousLimit(context: RequestContext) {
  if (context.kind !== "anonymous") {
    return { allowed: true };
  }

  const supabase = createSupabaseAdminClient();
  const { data: allowed, error: allowedError } = await supabase.rpc(
    "check_anonymous_limit",
    {
      p_fingerprint: context.fingerprint,
    },
  );
  if (allowedError) {
    throw new Error(allowedError.message);
  }
  if (!allowed) {
    return { allowed: false };
  }

  const { error: incrementError } = await supabase.rpc(
    "increment_anonymous_questions",
    {
      p_fingerprint: context.fingerprint,
    },
  );
  if (incrementError) {
    throw new Error(incrementError.message);
  }
  return { allowed: true };
}

export async function createUserMessage(
  chatId: string,
  content: string,
  attachments: IncomingAttachment[],
) {
  const supabase = createSupabaseAdminClient();
  const messagePayload: DbInsert<"messages"> = {
    chat_id: chatId,
    role: "user",
    content,
  };
  const { data, error } = await supabase
    .from("messages")
    .insert(messagePayload)
    .select("id,role,content,created_at")
    .single();
  if (error) {
    throw new Error(error.message);
  }

  let createdAttachments: MessageAttachmentDTO[] | undefined;

  if (attachments.length > 0) {
    const payload: DbInsert<"attachments">[] = attachments.map((item) => ({
      message_id: data.id,
      file_name: item.fileName,
      file_type: item.fileType,
      file_size: item.fileSize,
      file_url: item.fileUrl,
    }));
    const { data: insertedAttachments, error: insertAttachmentsError } =
      await supabase
        .from("attachments")
        .insert(payload)
        .select("id,file_name,file_type,file_url,file_size");
    if (insertAttachmentsError) {
      throw new Error(insertAttachmentsError.message);
    }
    createdAttachments = normalizeAttachmentDtos(insertedAttachments);
  }

  return {
    id: data.id,
    role: isChatRole(data.role) ? data.role : "user",
    content: data.content,
    created_at: data.created_at,
    attachments: createdAttachments,
  };
}

export async function touchChat(chatId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadHistory(chatId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role,content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }
  const history: Array<{ role: ChatRole; content: string }> = [];
  for (const item of data ?? []) {
    if (!isChatRole(item.role)) continue;
    history.push({ role: item.role, content: item.content });
  }
  return history;
}

export async function generateAssistantReply(
  history: Array<{ role: ChatRole; content: string }>,
  onToken: (token: string) => void,
  requestedModel?: string,
) {
  const model = requestedModel?.trim() || getGeminiDefaultModel();
  return streamGeminiResponse(history, { onToken }, model);
}

export async function createAssistantMessage(
  chatId: string,
  content: string,
  model: string,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "assistant",
    content,
    model,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function createAssistantMessageDraft(chatId: string) {
  const supabase = createSupabaseAdminClient();
  const payload: DbInsert<"messages"> = {
    chat_id: chatId,
    role: "assistant",
    content: "",
  };
  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id,role,content,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    role: isChatRole(data.role) ? data.role : "assistant",
    content: data.content,
    created_at: data.created_at,
  };
}

export async function updateAssistantMessage(
  messageId: string,
  content: string,
  model: string,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("messages")
    .update({
      content,
      model,
    })
    .eq("id", messageId);

  if (error) {
    throw new Error(error.message);
  }
}

function sanitizeTitle(raw: string) {
  return raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim()
    .slice(0, 70);
}

function fallbackTitleFromHistory(
  history: Array<{ role: ChatRole; content: string }>,
) {
  const firstUser =
    history.find((item) => item.role === "user")?.content.trim() ?? "";
  if (!firstUser) {
    return "New chat";
  }
  const cleaned = firstUser.replace(/\s+/g, " ").trim();
  return cleaned.length > 55 ? `${cleaned.slice(0, 55).trim()}...` : cleaned;
}

export async function autoRenameChatIfNeeded(
  chatId: string,
  history: Array<{ role: ChatRole; content: string }>,
) {
  if (history.length === 0) return;

  const supabase = createSupabaseAdminClient();
  const { data: chatRow, error: chatError } = await supabase
    .from("chats")
    .select("title")
    .eq("id", chatId)
    .single();

  if (chatError || !chatRow) {
    throw new Error(
      chatError?.message ?? "Chat not found for title generation",
    );
  }

  if (chatRow.title && !DEFAULT_CHAT_TITLES.has(chatRow.title)) {
    return;
  }

  let nextTitle = fallbackTitleFromHistory(history);
  try {
    const generated = await generateGeminiChatTitle(
      history.map((item) => ({ role: item.role, content: item.content })),
      "gemini-2.5-flash",
    );
    const sanitized = sanitizeTitle(generated);
    if (sanitized) {
      nextTitle = sanitized;
    }
  } catch {
    // Keep fallback title when model generation is unavailable.
  }

  if (!nextTitle || DEFAULT_CHAT_TITLES.has(nextTitle)) {
    return;
  }

  const { error: updateError } = await supabase
    .from("chats")
    .update({ title: nextTitle, updated_at: new Date().toISOString() })
    .eq("id", chatId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
