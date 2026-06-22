import OpenAI from "openai";
import { createLogger, preview } from "../logger";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

const log = createLogger("translation");

export class TranslationService {
  private client: OpenAI | null = null;

  constructor() {
    if (!process.env.OAI_API_KEY) {
      log.warn("not configured: OAI_API_KEY is missing");
      return;
    }
    this.client = new OpenAI({
      baseURL: process.env.OAI_BASE_URL || DEFAULT_BASE_URL,
      apiKey: process.env.OAI_API_KEY,
    });
  }

  isServiceConfigured(): boolean {
    return this.client !== null;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    if (!this.client) {
      throw new Error("Translation service is not properly configured. Please check your API key and settings.");
    }
    if (!text?.trim()) {
      throw new Error("Translation text cannot be empty");
    }
    if (!targetLanguage?.trim()) {
      throw new Error("Target language cannot be empty");
    }

    const model = process.env.OAI_MODEL || DEFAULT_MODEL;
    log.debug(`[${model}] prompt: ${preview(text)}`);

    const completion = await this.client.chat.completions.create({
      model,
      temperature: 1.0,
      messages: [
        { role: "system", content: this.buildSystemPrompt(targetLanguage) },
        { role: "user", content: text },
      ],
    });

    const translated = completion.choices[0]?.message?.content?.trim();
    if (!translated) {
      throw new Error("Translation returned empty content");
    }
    return translated;
  }

  // @see docs/greenfield research packet — decouple reasoning from formatting:
  // plain-text completion avoids the JSON "format tax" (arxiv 2408.02442).
  // Region-specific target + output-only instruction per Andrew Ng translation-agent.
  private buildSystemPrompt(targetLanguage: string): string {
    return [
      "You are a professional translator for casual, spoken-style online chat.",
      `Translate the user's message into: ${targetLanguage}.`,
      "Rules:",
      "- Output ONLY the translation. No explanations, no quotes, no preamble.",
      "- Do not answer or react to the content; only translate it.",
      "- Preserve the original tone, register, and intent; render idioms naturally.",
      "- Keep emoji, @mentions, #hashtags, URLs, and code unchanged.",
    ].join("\n");
  }
}
