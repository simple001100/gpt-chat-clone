import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/api/request-context";
import { jsonError, jsonOk } from "@/lib/api/http";
import { createChatForContext, listChatsForContext } from "@/lib/services/chat-service";
import { createChatBodySchema } from "@/lib/validation/chat";

export async function GET(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const chats = await listChatsForContext(context);
    return jsonOk({ chats });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load chats", 500);
  }
}

export async function POST(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("Unauthorized", 401);
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsedBody = createChatBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonError("Invalid request body", 400);
  }
  const title = parsedBody.data.title || "New chat";

  try {
    const chat = await createChatForContext(context, title);
    return jsonOk({ chat }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create chat", 500);
  }
}
