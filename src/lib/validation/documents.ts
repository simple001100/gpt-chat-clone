import { z } from "zod";

export const parseFormSchema = z.object({
  file: z.instanceof(File),
});

export const parseDocumentResponseSchema = z.object({
  document: z.object({
    id: z.string().uuid(),
    fileName: z.string().min(1),
    fileType: z.string().min(1),
    content: z.string().min(1),
    tokenEstimate: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
});

