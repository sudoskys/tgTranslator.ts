import { eq } from "drizzle-orm";
import { chatSettings } from "../db/schema";
import { ChatSettings, chatSettingsSchema } from "../schemas/chatSettings.schema";
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';

const db = drizzle(process.env.DB_FILE_NAME || 'group.sqlite');

export class ChatSettingsService {
  // 获取设置
  async getSettings(chatId: number): Promise<ChatSettings | null> {
    const result = await db
      .select()
      .from(chatSettings)
      .where(eq(chatSettings.chatId, chatId))
      .limit(1);
    
    return result[0] || null;
  }

  // 创建或更新设置（乐观更新）
  async upsertSettings(data: Partial<Omit<ChatSettings, "id">> & { chatId: number }): Promise<ChatSettings> {
    const existing = await this.getSettings(data.chatId);
    
    if (existing) {
      // 更新：只更新提供的字段
      const [updated] = await db
        .update(chatSettings)
        .set({
          ...existing,
          ...data
        })
        .where(eq(chatSettings.chatId, data.chatId))
        .returning();
      
      return updated;
    } else {
      // 创建：使用默认值
      const defaultSettings = {
        chatId: data.chatId,
        enabledTranslate: 0,  // 默认禁用翻译
        targetLanguage: 'In Fluent English With Internet Style'  // 默认目标语言
      };

      const newData = {
        ...defaultSettings,
        ...data
      };

      // 验证完整数据
      const validated = chatSettingsSchema.parse(newData);
      
      const [created] = await db
        .insert(chatSettings)
        .values(validated as any)
        .returning();
      
      return created;
    }
  }

  // 更新翻译开关
  async updateTranslateEnabled(chatId: number, enabled: boolean): Promise<ChatSettings> {
    const [updated] = await db
      .update(chatSettings)
      .set({
        enabledTranslate: enabled ? 1 : 0
      })
      .where(eq(chatSettings.chatId, chatId))
      .returning();
    
    if (!updated) {
      throw new Error(`No settings found for chat ${chatId}`);
    }
    
    return updated;
  }

  // 更新目标语言
  async updateTargetLanguage(chatId: number, language: string): Promise<ChatSettings> {
    const validated = chatSettingsSchema.shape.targetLanguage.parse(language);
    
    const [updated] = await db
      .update(chatSettings)
      .set({
        targetLanguage: validated
      })
      .where(eq(chatSettings.chatId, chatId))
      .returning();
    
    if (!updated) {
      throw new Error(`No settings found for chat ${chatId}`);
    }
    
    return updated;
  }
} 