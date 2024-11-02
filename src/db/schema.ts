import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatSettings = sqliteTable("chat_settings", {
  id: int().primaryKey({ autoIncrement: true }),
  chatId: int().notNull(),
  enabledTranslate: int().notNull(),
  targetLanguage: text().notNull(),
});
