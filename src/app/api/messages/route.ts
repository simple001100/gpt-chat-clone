import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/api/request-context";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  applyAnonymousLimit,
  autoRenameChatIfNeeded,
  createAssistantMessageDraft,
  createUserMessage,
  generateAssistantReply,
  listMessagesForChat,
  loadHistory,
  normalizeAttachments,
  touchChat,
  updateAssistantMessage,
} from "@/lib/services/message-service";
import { ensureOwnedChat } from "@/lib/services/chat-service";
import {
  type ContextDocumentInput,
  enqueueSse,
  messagePostBodySchema,
  messageQuerySchema,
  sseAssistantMessageSchema,
  sseDoneSchema,
  sseErrorSchema,
  sseTokenSchema,
  sseUserMessageSchema,
} from "@/lib/validation/messages";
import type { ChatRole } from "@/types/chat";

function normalizeContextDocuments(input: ContextDocumentInput[]): ContextDocumentInput[] {
  const docs = input;

  const maxTotalChars = 20_000;
  let totalChars = 0;
  const normalized: ContextDocumentInput[] = [];

  for (const doc of docs) {
    if (totalChars >= maxTotalChars) break;
    const remaining = maxTotalChars - totalChars;
    const content = doc.content.slice(0, remaining).trim();
    if (!content) continue;
    normalized.push({
      fileName: doc.fileName,
      content,
      tokenEstimate: Math.ceil(content.length / 4),
    });
    totalChars += content.length;
  }

  return normalized;
}

function mergeContextIntoHistory(
  history: Array<{ role: ChatRole; content: string }>,
  docs: ContextDocumentInput[],
) {
  if (docs.length === 0) {
    return history;
  }

  const contextBlock = docs
    .map(
      (doc, index) =>
        `[Document ${index + 1}: ${doc.fileName}]\n${doc.content}`,
    )
    .join("\n\n");

  return [
    {
      role: "system" as const,
      content:
        "Используй контекст из документов ниже как дополнительный источник. Если вопрос не связан с документами — отвечай по общим знаниям.\n\n" +
        contextBlock,
    },
    ...history,
  ];
}

export async function GET(req: NextRequest) {
  const queryParsed = messageQuerySchema.safeParse({
    chat_id: req.nextUrl.searchParams.get("chat_id"),
    before: req.nextUrl.searchParams.get("before") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!queryParsed.success) {
    return jsonError("chat_id is required", 400);
  }
  const { chat_id: chatId, before, limit } = queryParsed.data;

  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const page = await listMessagesForChat(context, chatId, { before, limit });
    if (!page) {
      return jsonError("Chat not found", 404);
    }
    return jsonOk(page);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load messages", 500);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.json().catch(() => null);
  const bodyParsed = messagePostBodySchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return jsonError("chatId and content are required", 400);
  }
  const body = bodyParsed.data;
  const chatId = body.chatId;
  const content = body.content;
  const attachments = normalizeAttachments(body.attachments);
  const contextDocuments = normalizeContextDocuments(body.contextDocuments ?? []);

  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("Unauthorized", 401);
  }

  const chat = await ensureOwnedChat(context, chatId);
  if (!chat) {
    return jsonError("Chat not found", 404);
  }

  try {
    const limit = await applyAnonymousLimit(context);
    if (!limit.allowed) {
      return jsonError("Anonymous question limit reached (3/day)", 429);
    }

    const userMessage = await createUserMessage(chatId, content, attachments);
    await touchChat(chatId);

    const encoder = new TextEncoder();
    const requestedModel = body.model?.trim();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = "";
        let usedModel = requestedModel || "gemini";
        let assistantMessageId = "";

        try {
          const assistantMessage = await createAssistantMessageDraft(chatId);
          assistantMessageId = assistantMessage.id;

          // Send UI-visible messages immediately, before LLM prep.
          enqueueSse(controller, encoder, "user_message", sseUserMessageSchema, {
            message: userMessage,
          });
          enqueueSse(
            controller,
            encoder,
            "assistant_message",
            sseAssistantMessageSchema,
            { message: assistantMessage },
          );

          const rawHistory = await loadHistory(chatId);
          const history = rawHistory.filter((item) => item.content.trim().length > 0);
          const historyWithContext = mergeContextIntoHistory(history, contextDocuments);

          const result = await generateAssistantReply(
            historyWithContext,
            (token) => {
              assistantText += token;
              enqueueSse(controller, encoder, "token", sseTokenSchema, {
                token,
                messageId: assistantMessage.id,
              });
            },
            requestedModel,
          );
          assistantText = result.text;
          usedModel = result.model;

          await updateAssistantMessage(assistantMessage.id, assistantText, usedModel);
          await autoRenameChatIfNeeded(chatId, [
            ...history,
            { role: "assistant", content: assistantText },
          ]);
          await touchChat(chatId);

          enqueueSse(controller, encoder, "done", sseDoneSchema, {
            messageId: assistantMessage.id,
            model: usedModel,
          });
          controller.close();
        } catch (error) {
          if (assistantMessageId) {
            try {
              await updateAssistantMessage(
                assistantMessageId,
                assistantText,
                usedModel,
              );
            } catch {
              // Keep original error handling path.
            }
          }

          const message = error instanceof Error ? error.message : "Streaming failed";
          enqueueSse(controller, encoder, "error", sseErrorSchema, { message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to prepare message",
      500,
    );
  }
}
