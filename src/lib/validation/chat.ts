import { z } from "zod";

export const createChatBodySchema = z.object({
  title: z.string().trim().min(1).optional(),
});

export const updateChatBodySchema = z.object({
  title: z.string().trim().min(1),
});

