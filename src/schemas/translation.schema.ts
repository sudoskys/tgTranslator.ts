import { z } from "zod";

export const translationSchema = z.object({
  translatedText: z.string(),
  detectedLanguage: z.string().optional(),
});

export type Translation = z.infer<typeof translationSchema>; 