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

  async translate(text: string, targetLanguage: string, context?: string): Promise<string> {
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
      // Low temperature for faithful, reproducible rendering of short chat
      // utterances; lower temp raises MT quality / cuts hallucinations, esp. for
      // Chinese (Peng et al. arxiv 2303.13780; "Hot or Cold?" arxiv 2506.07295).
      // 0.3 keeps a little casual-chat variety; drop toward 0.1 if faithfulness regresses.
      temperature: 0.3,
      messages: [
        { role: "system", content: this.buildSystemPrompt(targetLanguage, context) },
        { role: "user", content: text },
      ],
    });

    const translated = completion.choices[0]?.message?.content?.trim();
    if (!translated) {
      throw new Error("Translation returned empty content");
    }
    return translated;
  }

  // Single-chunk, output-only plain-text completion per the active interaction
  // model (docs/greenfield/2026-06-22-interaction-model.md §1) — avoids the JSON
  // "format tax" (arxiv 2408.02442). Transcreation persona (be the speaker, not a
  // translator) kills translationese and literal culture-loaded renderings; the
  // "do not add/drop meaning" rule bounds that freedom against unfaithfulness.
  // @see docs/research/2026-06-23-translation-quality-evidence.md (full evidence table)
  // @see https://aclanthology.org/2025.acl-long.630/ (Lost in Literalism, ACL 2025)
  // @see https://aclanthology.org/2024.eamt-2.29.pdf (Cultural Transcreation, Unbabel EAMT 2024)
  // @see https://github.com/aimoda/telegram-auto-translate (same-class production userbot)
  private buildSystemPrompt(targetLanguage: string, context?: string): string {
    const lines = [
      "You are a native speaker of the target language doing transcreation, not word-for-word translation.",
      `You are NOT a translator; you ARE the speaker, expressing the user's message as you'd naturally say it in: ${targetLanguage}.`,
      "Core principles:",
      "- Recreate the meaning, feeling, and energy — never translate word-for-word.",
      "- Write what you'd actually text to a friend in this situation; casual stays casual, formal stays formal.",
      "- Adapt idioms, slang, and culture-loaded terms to natural target-language equivalents (a joke should land, not be explained). If a literal rendering sounds \"translated\", rewrite it completely.",
      "- Mirror the original register; for languages with formal/informal distinctions, match the conversation.",
      "Rules:",
      "- Output ONLY the message. No explanations, no quotes, no preamble.",
      "- Do not answer or react to the content; only express it in the target language.",
      "- Do not add or drop meaning that is not in the source.",
      "- Keep emoji, @mentions, #hashtags, URLs, and code unchanged.",
    ];
    if (context?.trim()) {
      lines.push(
        "Conversation so far (most recent last; '(YOU)' marks the speaker, '>>> REPLYING TO'",
        "marks the message being replied to). Use it to resolve pronouns, register, and",
        "ambiguity, and to match how participants speak — but express ONLY the user's",
        "message, never translate this context:",
        context.trim(),
      );
    }
    return lines.join("\n");
  }
}
