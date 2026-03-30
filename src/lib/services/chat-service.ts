import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RequestContext } from "@/lib/api/request-context";
import type { DbInsert, DbUpdate } from "@/lib/supabase/types";

export async function listChatsForContext(context: RequestContext) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("chats")
    .select("id,title,created_at,updated_at,last_message_at")
    .order("updated_at", { ascending: false });
  query =
    context.kind === "auth"
      ? query.eq("user_id", context.userId)
      : query.eq("anonymous_id", context.anonymousId);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createChatForContext(context: RequestContext, title: string) {
  const supabase = createSupabaseAdminClient();
  const payload: DbInsert<"chats"> =
    context.kind === "auth"
      ? { title, user_id: context.userId }
      : { title, anonymous_id: context.anonymousId };

  const { data, error } = await supabase
    .from("chats")
    .insert(payload)
    .select("id,title,created_at,updated_at,last_message_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function ensureOwnedChat(context: RequestContext, chatId: string) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("chats").select("id,title").eq("id", chatId);
  query =
    context.kind === "auth"
      ? query.eq("user_id", context.userId)
      : query.eq("anonymous_id", context.anonymousId);
  const { data, error } = await query.single();
  if (error || !data) {
    return null;
  }
  return data;
}

export async function updateChatTitle(chatId: string, title: string) {
  const supabase = createSupabaseAdminClient();
  const payload: DbUpdate<"chats"> = { title, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("chats")
    .update(payload)
    .eq("id", chatId)
    .select("id,title,created_at,updated_at,last_message_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function deleteChat(chatId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) {
    throw new Error(error.message);
  }
}
