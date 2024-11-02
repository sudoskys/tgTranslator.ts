import { z } from "zod";

/**
 * 翻译
 */
export const translationSchema = z.object({
  translatedText: z.string(),
});

export type Translation = z.infer<typeof translationSchema>; 