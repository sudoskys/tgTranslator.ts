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

// `use <lang>` 之后的全部内容即目标语言；mtcute 已把命令拆进 `msg.command`。
const getTargetFromMessage = (msg: MessageContext): string | null => {
  const commandArgs = "command" in msg && Array.isArray(msg.command) ? msg.command.slice(1) : [];
  const targetLanguage = commandArgs.join(" ").trim();
  return targetLanguage.length !== 0 ? targetLanguage : null;
};

const editCommand = async (msg: MessageContext, text: string): Promise<void> => {
  await msg.edit({ text });
};

const pingCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`ping from ${msg.sender.id} in chat ${chatId}`);
  await editCommand(msg, `Chat ID: ${chatId}`);
  return PropagationAction.Stop;
};

const setEnabledCommand = (enabled: boolean) => async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`set translate ${enabled ? "on" : "off"} from ${msg.sender.id} in chat ${chatId}`);

  const settings = await chatSettingsService.getSettings(chatId);
  const targetLanguage = settings?.targetLanguage || DEFAULT_TARGET_LANGUAGE;

  await chatSettingsService.upsertSettings({
    chatId,
    enabledTranslate: enabled ? 1 : 0,
    targetLanguage,
  });

  await editCommand(msg, `Translation ${enabled ? "enabled" : "disabled"}.`);
  return PropagationAction.Stop;
};

const useCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`set language from ${msg.sender.id} in chat ${chatId}`);

  const targetLanguage = getTargetFromMessage(msg);
  if (!targetLanguage) {
    await editCommand(msg, "Usage: /use <target language>, e.g. /use Japanese");
    return PropagationAction.Stop;
  }

  await chatSettingsService.upsertSettings({
    chatId,
    enabledTranslate: 1,
    targetLanguage,
  });

  if (!translationService.isServiceConfigured()) {
    await editCommand(msg, `Translation target set to ${targetLanguage}, but the service is not configured.`);
    return PropagationAction.Stop;
  }

  try {
    // 翻译一句端庄得体的状态提示:既验证 API 通,又给对方看一眼该语言的样例,但不打招呼。
    const translated = await translationService.translate(
      "翻译已经准备就绪，接下来我们可以顺畅地交流了。",
      targetLanguage,
    );
    log.debug(`use confirmation translated: ${preview(translated)}`);
    await editCommand(msg, translated);
  } catch (error) {
    log.error("use confirmation translate failed", error);
    await editCommand(msg, "Translation target was saved, but the confirmation translation failed.");
  }
  return PropagationAction.Stop;
};

const showCommand = async (msg: MessageContext) => {
  const chatId = msg.chat.id;
  log.info(`show settings from ${msg.sender.id} in chat ${chatId}`);

  const settings = await chatSettingsService.getSettings(chatId);
  if (!settings) {
    await editCommand(msg, "未找到设置");
    return PropagationAction.Stop;
  }

  await editCommand(msg, `Translation enabled: ${settings.enabledTranslate ? "Yes" : "No"}\nTarget language: ${settings.targetLanguage}`);
  return PropagationAction.Stop;
};

// 统一的会话上下文：最近 N 条消息 + 高亮被回复的那条，供翻译消歧（代词/语域/指代）。
// reply-to 只是最近窗口里被高亮的一条，不是单独路径。@see greenfield §1a。
const CONTEXT_MESSAGE_COUNT = 7;

const formatContextLine = (sender: string, text: string, isReply: boolean, isOutgoing: boolean): string => {
  if (isReply) return `>>> REPLYING TO [${sender}]: ${text}`;
  return `${isOutgoing ? "(YOU) " : ""}[${sender}]: ${text}`;
};

const buildConversationContext = async (msg: MessageContext): Promise<string | undefined> => {
  // 被回复消息的 id 从消息自身读取，不发 RPC；reply-to 多半就在最近窗口内。
  const replyToId = msg.replyToMessage?.id ?? null;

  let history;
  try {
    // getHistory 默认最新在前；多取一条以便排除当前 tl 消息，再反转成时间正序。
    history = await msg.client.getHistory(msg.chat, { limit: CONTEXT_MESSAGE_COUNT + 1 });
  } catch (error) {
    log.warn("fetch history context failed", error);
    return undefined;
  }

  const recent = history
    .filter((m) => m.id !== msg.id && m.text)
    .slice(0, CONTEXT_MESSAGE_COUNT)
    .reverse();

  const lines = recent.map((m) => formatContextLine(m.sender.displayName, m.text, m.id === replyToId, m.isOutgoing));

  // 仅当被回复的是窗口外的较早消息时，才补一次 RPC 取回并置顶高亮。
  if (replyToId !== null && !recent.some((m) => m.id === replyToId)) {
    try {
      const reply = await msg.getReplyTo();
      if (reply?.text) {
        lines.unshift(formatContextLine(reply.sender.displayName, reply.text, true, reply.isOutgoing), "");
      }
    } catch (error) {
      log.warn("fetch out-of-window reply failed", error);
    }
  }

  const context = lines.length ? lines.join("\n") : undefined;
  // 元信息走 info 便于观察上下文是否组装；内容经 preview 脱敏（info 仅显字符数，debug 显全文）。
  log.info(`context: ${recent.length} msgs${replyToId !== null ? " (reply-aware)" : ""}, ${preview(context)}`);
  return context;
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

  // Context-aware: feed recent conversation (incl. reply-to) so the model can
  // resolve pronouns, register, and ambiguity in casual chat. @see greenfield §1a.
  const context = await buildConversationContext(msg);

  log.info(`tl request in chat ${chatId} msg ${msg.id}: ${preview(source)}`);
  try {
    const translated = await translationService.translate(source, settings.targetLanguage || DEFAULT_TARGET_LANGUAGE, context);
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
  const prefixes = ["/", ",", "，"];
  // 匹配 `tl <文本>`，捕获 `tl ` 之后的内容；`\s` 边界避免误伤 `tldr` 这类词。
  const tlMessage = filters.and(ownTextMessage, filters.regex(/^tl(?:\s([\s\S]*))?$/i));

  dp.onError((error) => {
    log.error("telegram handler failed", error);
    return true;
  });

  dp.onNewMessage(filters.and(ownTextMessage, filters.command("ping", { prefixes })), pingCommand);
  dp.onNewMessage(filters.and(ownTextMessage, filters.command("on", { prefixes })), setEnabledCommand(true));
  dp.onNewMessage(filters.and(ownTextMessage, filters.command("off", { prefixes })), setEnabledCommand(false));
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
