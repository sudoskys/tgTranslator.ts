import { z } from "zod";

export const chatSettingsSchema = z.object({
  id: z.number().optional(),
  chatId: z.number(),
  enabledTranslate: z.number(),
  targetLanguage: z.string().min(1).max(100),
});

export type ChatSettings = z.infer<typeof chatSettingsSchema>; 