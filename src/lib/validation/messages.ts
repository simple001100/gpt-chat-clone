import { z } from "zod";

export const messageQuerySchema = z.object({
  chat_id: z.string().trim().min(1),
  before: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const messageAttachmentSchema = z.object({
  fileName: z.string().trim().min(1),
  fileType: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
  fileSize: z.number().int().min(0),
});

export const contextDocumentSchema = z.object({
  fileName: z.string().trim().min(1),
  content: z.string(),
  tokenEstimate: z.number().int().min(0),
});

export const messagePostBodySchema = z.object({
  chatId: z.string().trim().min(1),
  content: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  attachments: z.array(messageAttachmentSchema).optional(),
  contextDocuments: z.array(contextDocumentSchema).optional(),
});

export const sseUserMessageSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.string(),
    content: z.string(),
    created_at: z.string(),
    attachments: z
      .array(
        z.object({
          id: z.string(),
          file_name: z.string(),
          file_type: z.string(),
          file_url: z.string(),
          file_size: z.number(),
        }),
      )
      .optional(),
  }),
});

export const sseAssistantMessageSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.string(),
    content: z.string(),
    created_at: z.string(),
  }),
});

export const sseTokenSchema = z.object({
  token: z.string(),
  messageId: z.string(),
});

export const sseDoneSchema = z.object({
  messageId: z.string(),
  model: z.string(),
});

export const sseErrorSchema = z.object({
  message: z.string(),
});

export type ContextDocumentInput = z.infer<typeof contextDocumentSchema>;

export function enqueueSse<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: string,
  schema: z.ZodType<T>,
  payload: T,
) {
  const validated = schema.parse(payload);
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(validated)}\n\n`),
  );
}

