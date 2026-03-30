import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File),
});

export const uploadFileResponseSchema = z.object({
  file: z.object({
    bucket: z.enum(["chat-images", "chat-documents"]),
    path: z.string().min(1),
    fileName: z.string().min(1),
    fileType: z.string().min(1),
    fileSize: z.number().int().nonnegative(),
    fileUrl: z.string().url(),
  }),
});

