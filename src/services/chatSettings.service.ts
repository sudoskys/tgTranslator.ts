import { eq } from "drizzle-orm";
import { chatSettings } from "../db/schema";
import { ChatSettings, chatSettingsSchema } from "../schemas/chatSettings.schema";
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const db = drizzle(process.env.DB_FILE_NAME || 'file:group.db');

export class ChatSettingsService {
  async initializeDatabase(): Promise<void> {
    try {
      await migrate(db, { migrationsFolder: './drizzle' });
      console.log('数据库检查迁移完成');
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }
  }

  async getSettings(chatId: number): Promise<ChatSettings | null> {
    const result = await db
      .select()
      .from(chatSettings)
      .where(eq(chatSettings.chatId, chatId))
      .limit(1);
    
    return result[0] || null;
  }

  async upsertSettings(data: Partial<Omit<ChatSettings, "id">> & { chatId: number }): Promise<ChatSettings> {
    const existing = await this.getSettings(data.chatId);
    
    if (existing) {
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
      const defaultSettings = {
        chatId: data.chatId,
        enabledTranslate: 0,  // 默认禁用翻译
        targetLanguage: 'In Fluent English With Internet Style'  // 默认目标语言
      };

      const newData = {
        ...defaultSettings,
        ...data
      };

      const validated = chatSettingsSchema.parse(newData);
      
      const [created] = await db
        .insert(chatSettings)
        .values(validated as any)
        .returning();
      
      return created;
    }
  }

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