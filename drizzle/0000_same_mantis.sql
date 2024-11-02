CREATE TABLE `chat_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chatId` integer NOT NULL,
	`enabledTranslate` integer NOT NULL,
	`targetLanguage` text NOT NULL
);
