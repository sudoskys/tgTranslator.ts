import { Dispatcher, filters, MessageContext, PropagationAction } from "@mtcute/dispatcher";
import { TelegramClient } from "@mtcute/node";
import "dotenv/config";
import { ChatSettingsService } from "./services/chatSettings.service";
import { TranslationService } from "./services/translation.service";

const DEFAULT_TARGET_LANGUAGE = "In Fluent English With Internet Style";

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
      console.error("删除消息失败:", error);
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
  console.log("命令：活动测试");
  const chatId = msg.chat.id;
  console.log(`[Ping] [${msg.sender.id}]`);
  deleteCommandLater(msg);
  await msg.replyText(`Chat ID: ${chatId}`);
  return PropagationAction.Stop;
};

const localCommand = async (msg: MessageContext) => {
  console.log("命令：翻译对齐");
  const chatId = msg.chat.id;
  console.log(`[Local] [${msg.sender.id}]`);

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
    console.error("翻译失败:", error);
    await msg.replyText(`Now ${nextEnabledTranslate == 1 ? "enabled" : "disabled"} translate`);
  }
  return PropagationAction.Stop;
};

const useCommand = async (msg: MessageContext) => {
  console.log("命令：设置目标语言");
  const chatId = msg.chat.id;
  console.log(`[Lang] [${msg.sender.id}]`);

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
    console.log("翻译结果:", translated);
    await msg.replyText(translated);
    deleteCommandLater(msg);
  } catch (error) {
    console.error("设置消息翻译失败:", error);
    await msg.replyText("Mistake!");
  }
  return PropagationAction.Stop;
};

const showCommand = async (msg: MessageContext) => {
  console.log("命令：显示当前设置");
  const chatId = msg.chat.id;
  console.log(`[Show] [${msg.sender.id}]`);

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
  console.log(`[Tl] [${msg.sender.id}]`);

  if (!translationService.isServiceConfigured()) {
    console.warn("翻译服务未正确配置，某些功能可能无法使用");
    return;
  }

  const source = msg.match?.[1]?.trim() ?? "";
  if (!source) {
    return;
  }

  const settings = await chatSettingsService.getSettings(chatId);
  if (!settings || settings.enabledTranslate !== 1) {
    console.log("未启用翻译");
    return;
  }

  try {
    const translated = await translationService.translate(source, settings.targetLanguage || DEFAULT_TARGET_LANGUAGE);
    console.log("翻译结果:", translated);
    if (translated && translated !== msg.text) {
      console.log(`编辑消息 [${chatId}] [${msg.id}]`);
      await msg.edit({ text: translated });
    }
  } catch (error) {
    console.error(`翻译或编辑失败 [${chatId}] [${msg.id}]: ${error}`);
  }
};

const main = async () => {
  const tg = new TelegramClient({
    apiId: readApiId(),
    apiHash: readRequiredEnv("TELEGRAM_API_HASH"),
    storage: process.env.TELEGRAM_SESSION_FILE || "mtcute.session",
  });

  await chatSettingsService.initializeDatabase();
  console.log("数据库初始化成功");

  const dp = Dispatcher.for(tg);
  const ownTextMessage = filters.and(filters.me, filters.text);
  const prefixes = ["/", ","];
  // `tl` 后跟空格再接文本，或单独的 `tl`（配合回复使用）；不误伤 `tldr` 这类词。
  const tlMessage = filters.and(ownTextMessage, filters.regex(/^tl(?:\s([\s\S]*))?$/i));

  dp.onError((error) => {
    console.error("Telegram handler failed:", error);
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
  console.log(`Bot started with user ${self.id}`);
};

main().catch((error) => {
  console.error("启动失败:", error);
  process.exitCode = 1;
});
