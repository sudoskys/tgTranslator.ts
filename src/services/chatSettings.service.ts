import { eq } from "drizzle-orm";
import { chatSettings } from "../db/schema";
import { ChatSettings, chatSettingsSchema } from "../schemas/chatSettings.schema";
import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createLogger } from "../logger";

const db = drizzle(process.env.DB_FILE_NAME || "file:group.db");

const log = createLogger("db");

export class ChatSettingsService {
  async initializeDatabase(): Promise<void> {
    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      log.info("migrations checked");
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("already exists"))) {
        throw error;
      }
    }
  }

  async getSettings(chatId: number): Promise<ChatSettings | null> {
    const result = await db.select().from(chatSettings).where(eq(chatSettings.chatId, chatId)).limit(1);

    return result[0] || null;
  }

  async upsertSettings(data: Partial<Omit<ChatSettings, "id">> & { chatId: number }): Promise<ChatSettings> {
    const existing = await this.getSettings(data.chatId);

    if (existing) {
      const [updated] = await db
        .update(chatSettings)
        .set({
          ...existing,
          ...data,
        })
        .where(eq(chatSettings.chatId, data.chatId))
        .returning();

      return updated;
    }

    const defaultSettings = {
      chatId: data.chatId,
      enabledTranslate: 0,
      targetLanguage: "In Fluent English With Internet Style",
    };

    const newData = {
      ...defaultSettings,
      ...data,
    };

    const validated = chatSettingsSchema.parse(newData);

    const [created] = await db.insert(chatSettings).values(validated).returning();

    return created;
  }
}
