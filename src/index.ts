import { Dispatcher, filters, MessageContext, PropagationAction } from "@mtcute/dispatcher";
import { TelegramClient } from "@mtcute/node";
import "dotenv/config";
import { createLogger, preview } from "./logger";
import { ChatSettingsService } from "./services/chatSettings.service";
import { TranslationService } from "./services/translation.service";

const DEFAULT_TARGET_LANGUAGE = "In Fluent English With Internet Style";

const log = createLogger("bot");

const chatSettingsService = new ChatSettingsService();
const translationService = new TranslationService();

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const readApiId = (): number => {
  const value = Number(readRequiredEnv("TELEGRAM_API_ID"));
  if (!Number.isInteger(value)) {
    throw new Error("TELEGRAM_API_ID must be an integer");
  }
  return value;
};

const deleteCommandLater = (msg: MessageContext): void => {
  setTimeout(() => {
    msg.delete().catch((error) => {
      log.warn("delete command message failed", error);
    });
  }, 3000);
};

const getTargetFromMessage = async (msg: MessageContext): Promise<string> => {
  const commandArgs = "command" in msg && Array.isArray(msg.command) ? msg.command.slice(1) : [];
  const targetLanguage = commandArgs[0];

  if (targetLanguage && targetLanguage.length !== 0) {
    return targetLanguage;
  }

  if (msg.text.length !== 0) {
    const legacyTargetLanguage = msg.text.split(" ")[1];
    if (legacyTargetLanguage && legacyTargetLanguage.length !== 0) {
      return legacyTargetLanguage;
    }
  }

  const replyToMessage = await msg.getReplyTo();
  if (replyToMessage?.text) {
    return `Used Language of "${replyToMessage.text}"`;
  }

  return `Used Language of "${msg.chat.displayName}"`;
};

const pingCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`ping from ${msg.sender.id} in chat ${chatId}`);
  deleteCommandLater(msg);
  await msg.replyText(`Chat ID: ${chatId}`);
  return PropagationAction.Stop;
};

const localCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`local toggle from ${msg.sender.id} in chat ${chatId}`);

  const settings = await chatSettingsService.getSettings(chatId);
  let nextEnabledTranslate = 1;
  if (settings?.enabledTranslate != 0) {
    nextEnabledTranslate = 0;
  }

  await chatSettingsService.upsertSettings({
    chatId,
    enabledTranslate: nextEnabledTranslate,
    targetLanguage: settings?.targetLanguage || DEFAULT_TARGET_LANGUAGE,
  });

  deleteCommandLater(msg);

  try {
    const translated = await translationService.translate(
      `我为你配置了 ${nextEnabledTranslate == 1 ? "enabled" : "disabled"} 翻译`,
      settings?.targetLanguage || DEFAULT_TARGET_LANGUAGE,
    );
    await msg.replyText(translated);
  } catch (error) {
    log.error("local confirmation translate failed", error);
    await msg.replyText(`Now ${nextEnabledTranslate == 1 ? "enabled" : "disabled"} translate`);
  }
  return PropagationAction.Stop;
};

const useCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`set language from ${msg.sender.id} in chat ${chatId}`);

  const targetLanguage = await getTargetFromMessage(msg);

  await chatSettingsService.upsertSettings({
    chatId,
    enabledTranslate: 1,
    targetLanguage: targetLanguage || DEFAULT_TARGET_LANGUAGE,
  });

  if (!translationService.isServiceConfigured()) {
    await msg.replyText(`I configured translation to ${targetLanguage}, but service is not configured`);
    return PropagationAction.Stop;
  }

  try {
    const translated = await translationService.translate(
      `你好，我会使用 ${targetLanguage} 和你进行无障碍辅助交流`, // 不允许修改
      targetLanguage,
    );
    log.debug(`use confirmation translated: ${preview(translated)}`);
    await msg.replyText(translated);
    deleteCommandLater(msg);
  } catch (error) {
    log.error("use confirmation translate failed", error);
    await msg.replyText("Mistake!");
  }
  return PropagationAction.Stop;
};

const showCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`show settings from ${msg.sender.id} in chat ${chatId}`);

  const settings = await chatSettingsService.getSettings(chatId);
  if (!settings) {
    await msg.replyText("未找到设置");
    return PropagationAction.Stop;
  }

  deleteCommandLater(msg);
  await msg.replyText(`Translation enabled: ${settings.enabledTranslate ? "Yes" : "No"}\nTarget language: ${settings.targetLanguage}`);
  return PropagationAction.Stop;
};

// `tl <文本>` 把这条 `tl` 消息原地编辑成 `<文本>` 的译文。
const translateHandler = async (msg: MessageContext & { match?: RegExpMatchArray }) => {
  const chatId = msg.chat.id;

  if (!translationService.isServiceConfigured()) {
    log.warn("translation service not configured; skipping");
    return;
  }

  const source = msg.match?.[1]?.trim() ?? "";
  if (!source) {
    return;
  }

  const settings = await chatSettingsService.getSettings(chatId);
  if (!settings || settings.enabledTranslate !== 1) {
    log.debug(`translate disabled for chat ${chatId}`);
    return;
  }

  log.info(`tl request in chat ${chatId} msg ${msg.id}: ${preview(source)}`);
  try {
    const translated = await translationService.translate(source, settings.targetLanguage || DEFAULT_TARGET_LANGUAGE);
    log.debug(`translated: ${preview(translated)}`);
    if (translated && translated !== msg.text) {
      await msg.edit({ text: translated });
      log.info(`edited chat ${chatId} msg ${msg.id}`);
    }
  } catch (error) {
    log.error(`translate or edit failed [chat ${chatId}] [msg ${msg.id}]`, error);
  }
};

const main = async () => {
  const tg = new TelegramClient({
    apiId: readApiId(),
    apiHash: readRequiredEnv("TELEGRAM_API_HASH"),
    storage: process.env.TELEGRAM_SESSION_FILE || "mtcute.session",
  });

  await chatSettingsService.initializeDatabase();
  log.info("database initialized");

  const dp = Dispatcher.for(tg);
  const ownTextMessage = filters.and(filters.me, filters.text);
  const prefixes = ["/", ","];
  // 匹配 `tl <文本>`，捕获 `tl ` 之后的内容；`\s` 边界避免误伤 `tldr` 这类词。
  const tlMessage = filters.and(ownTextMessage, filters.regex(/^tl(?:\s([\s\S]*))?$/i));

  dp.onError((error) => {
    log.error("telegram handler failed", error);
    return true;
  });

  dp.onNewMessage(filters.and(ownTextMessage, filters.command("ping")), pingCommand);
  dp.onNewMessage(filters.and(ownTextMessage, filters.command("local", { prefixes })), localCommand);
  dp.onNewMessage(filters.and(ownTextMessage, filters.command("use", { prefixes })), useCommand);
  dp.onNewMessage(filters.and(ownTextMessage, filters.command("show", { prefixes })), showCommand);
  dp.onNewMessage(tlMessage, translateHandler);
  dp.onEditMessage(tlMessage, translateHandler);

  const self = await tg.start({
    phone: () => tg.input("Phone > "),
    code: () => tg.input("Code > "),
    password: () => tg.input("Password > "),
  });
  log.info(`bot started as user ${self.id}`);
};

main().catch((error) => {
  log.error("startup failed", error);
  process.exitCode = 1;
});
