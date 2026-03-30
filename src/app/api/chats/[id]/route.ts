import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/api/request-context";
import { jsonError, jsonOk } from "@/lib/api/http";
import { deleteChat, ensureOwnedChat, updateChatTitle } from "@/lib/services/chat-service";
import { updateChatBodySchema } from "@/lib/validation/chat";

type Params = {
  params: Promise<{ id: string }>;
};

async function resolveOwnedChatId(req: NextRequest, id: string) {
  const context = await getRequestContext(req);
  if (!context) {
    return { error: jsonError("Unauthorized", 401), context: null };
  }

  const chat = await ensureOwnedChat(context, id);
  if (!chat) {
    return { error: jsonError("Chat not found", 404), context: null };
  }

  return { error: null, context };
}

export async function PUT(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const ownership = await resolveOwnedChatId(req, id);
  if (ownership.error) {
    return ownership.error;
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsedBody = updateChatBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonError("Title is required", 400);
  }
  const { title } = parsedBody.data;

  try {
    const chat = await updateChatTitle(id, title);
    return jsonOk({ chat });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to update chat", 500);
  }
}

export async function DELETE(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const ownership = await resolveOwnedChatId(req, id);
  if (ownership.error) {
    return ownership.error;
  }

  try {
    await deleteChat(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete chat", 500);
  }
}
