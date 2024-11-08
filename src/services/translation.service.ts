import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { Translation, translationSchema } from "../schemas/translation.schema";

export class TranslationService {
  private instructor: ReturnType<typeof Instructor>;
  private isConfigured: boolean = false;

  constructor() {
    if (!process.env.OAI_API_KEY) {
      console.warn("⚠️ Translation service is not configured: OAI_API_KEY is missing");
      return;
    }
    if (process.env.OAI_BASE_URL !== "https://api.openai.com/v1") {
      console.warn("You are using a custom OpenAI API base URL, please make sure you know what you are doing.");
    }
    try {
      const client = new OpenAI({
        baseURL: process.env.OAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.OAI_API_KEY,
      });

      this.instructor = Instructor({
        client,
        mode: "JSON",
      });
      
      this.isConfigured = true;
    } catch (error) {
      console.error("❌ Failed to initialize translation service:", error);
      this.isConfigured = false;
    }
  }

  async translate(text: string, targetLanguage: string): Promise<Translation> {
    if (!this.isConfigured) {
      throw new Error("Translation service is not properly configured. Please check your API key and settings.");
    }

    if (!text?.trim()) {
      throw new Error("Translation text cannot be empty");
    }

    // 如果以 tl 开头，删除 tl
    if (text.startsWith("tl")) {
      text = text.slice(2);
    }
    
    if (!targetLanguage?.trim()) {
      throw new Error("Target language cannot be empty");
    }

    const prompt = this.createTranslationPrompt(text, targetLanguage);
    const used_model = process.env.OAI_MODEL || "gpt-4o-mini";
    console.log(`[Translation] [${used_model}] [Prompt] ${text}`);
    try {
      const translation = await this.instructor.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: used_model,
        response_model: {
          schema: translationSchema,
          name: "Translation",
        },
        max_retries: 4,
      });
      return translation;
    } catch (error) {
      console.error("Translation failed:", error);
      throw new Error("Failed to perform translation. Please try again later.");
    }
  }

  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  private createTranslationPrompt(text: string, targetLanguage: string): string {
    return `
# 请将以下原文文本翻译成 ${targetLanguage} 
[场景]网上聊天/口语
[要求]不要尝试回答问题，只提供信达雅的翻译结果，无需解释
[原文] 
${text}
---
`;
  }
} 