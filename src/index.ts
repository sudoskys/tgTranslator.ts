import { Raw, Snake } from "tgsnake";
import { ChatSettingsService } from "./services/chatSettings.service";
import { TranslationService } from "./services/translation.service";
import { Combine, FilterQuery, TypeUpdateExtended } from "tgsnake/lib/src/Context";
import { Message } from "tgsnake/lib/src/TL/Messages";
import { ContextUpdate } from "tgsnake/lib/src/TL/Updates";

const client = new Snake();
const chatSettingsService = new ChatSettingsService();
const translationService = new TranslationService();

let myId: bigint | null = null;

// 判断是否不是自己
const notMe = (id: bigint) => {
  return id !== myId;
};

// 身份验证
client.use(async (ctx, next) => {
  const fromId = ctx.message?.from?.id || ctx.message?.senderChat?.id;
  if (fromId && notMe(BigInt(Number(fromId)))) {
    return undefined;
  }
  return next();
});

// 巴别塔翻译
client.cmd('ping', async (ctx) => {
  console.log("命令：活动测试");
  // 获取 chatId
  const chatId = Number(ctx.message?.chat?.id);

  // 获取发信人
  const fromId = Number(ctx.message?.from?.id) || Number(ctx.message?.senderChat?.id);

  // 获取消息Id
  const messageId = ctx.message?.id;

  // 判断是否存在消息Id
  if (!messageId || !chatId || !fromId) {
    console.log("参数不完整");
    console.log(`消息格式: ${ctx.message}`);
    return undefined;
  }

  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Ping] [${fromId}]`);
    return undefined;
  }

  // 删除原命令消息
  try {
    setTimeout(async () => {
      await ctx.api.deleteMessage(chatId.toString(), messageId);
    }, 3000);
  } catch (error) {
    console.error("删除消息失败:", error);
  }
  return ctx.message.reply(`Chat ID: ${chatId}`);
});

const localCommand = async (ctx: Combine<Combine<FilterQuery<TypeUpdateExtended<Message, "text">, "message">, ContextUpdate>, {}>) => {
  console.log("命令：翻译对齐");
  // 获取 chatId
  const chatId = Number(ctx.message?.chat?.id);

  // 获取发信人
  const fromId = Number(ctx.message?.from?.id) || Number(ctx.message?.senderChat?.id);

  // 获取消息Id
  const messageId = ctx.message?.id;

  // 判断是否存在消息Id
  if (!messageId || !chatId || !fromId) {
    console.log("参数不完整");
    console.log(`消息格式: ${ctx.message}`);
    return undefined;
  }

  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Local] [${fromId}]`);
    return undefined;
  }

  // 读取设置
  const settings = await chatSettingsService.getSettings(chatId);
  let nextEnabledTranslate = 1;
  if (settings?.enabledTranslate != 0) {
    nextEnabledTranslate = 0;
  }

  // 更新设置
  await chatSettingsService.upsertSettings({
    chatId: chatId,
    enabledTranslate: nextEnabledTranslate,
    targetLanguage: settings?.targetLanguage || 'In Fluent English With Internet Style'
  });
  let nextMessage = '';

  // 删除原命令消息
  try {
    setTimeout(async () => {
      await ctx.api.deleteMessage(chatId.toString(), messageId);
    }, 3000);
  } catch (error) {
    console.error("删除消息失败:", error);
  }

  // 翻译
  try {
    const translation = await translationService.translate(
      `我为你配置了 ${nextEnabledTranslate == 1 ? 'enabled' : 'disabled'} 翻译`,
      settings?.targetLanguage || 'In Fluent English With Internet Style'
    );
    nextMessage = translation.translatedText;
  } catch (error) {
    console.error("翻译失败:", error);
    nextMessage = `Now ${nextEnabledTranslate == 1 ? 'enabled' : 'disabled'} translate`;
  }
  // 发消息表明自己已经启用
  return ctx.message.reply(nextMessage);
}


const useCommand = async (ctx: Combine<Combine<FilterQuery<TypeUpdateExtended<Message, "text">, "message">, ContextUpdate>, {}>) => {
  console.log("命令：设置目标语言");
  // 获取 chatId
  const chatId = Number(ctx.message?.chat?.id);

  // 获取发信人
  const fromId = Number(ctx.message?.from?.id) || Number(ctx.message?.senderChat?.id);

  // 判断是否存在发信人或消息
  const messageId = ctx.message?.id;
  if (!messageId || !chatId || !fromId) {
    console.log("参数不完整");
    console.log(`消息格式: ${ctx.message}`);
    return undefined;
  }

  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Lang] [${fromId}]`);
    return undefined;
  }

  // 获得文本内容
  const text = ctx.message.text || '';

  // 如果没有文本内容，则设置为当前群组的目标语言
  let targetLanguage = 'In Fluent English With Internet Style';
  if (text.length != 0) {
    targetLanguage = text.split(' ')[1];
  }

  // 如果目标语言为空，则设置为当前群组的目标语言
  if (!targetLanguage || targetLanguage.length == 0) {
    if (ctx.message.replyToMessage && ctx.message.replyToMessage.text) {
      targetLanguage = `Used Language of "${ctx.message.replyToMessage.text}"`;
    } else {
      targetLanguage = `Used Language of "${ctx.message.chat.title || ctx.message.chat.bio}"`;
    }
  }

  // 更新设置
  await chatSettingsService.upsertSettings({
    chatId: chatId,
    enabledTranslate: 1,
    targetLanguage: targetLanguage || 'In Fluent English With Internet Style'
  });

  // 检查服务
  if (!translationService.isServiceConfigured()) {
    return ctx.message.reply(`I configured translation to ${targetLanguage}, but service is not configured`);
  }

  // 删除原命令消息
  try {
    setTimeout(async () => {
      await ctx.api.deleteMessage(chatId.toString(), messageId);
    }, 3000);
  } catch (error) {
    console.error("删除消息失败:", error);
  }

  // 当场翻译消息表示
  try {
    const translation = await translationService.translate(
      `你好，我会使用 ${targetLanguage} 和你进行无障碍辅助交流`, // 不允许修改
      targetLanguage
    );
    console.log("翻译结果:", translation.translatedText);
    return ctx.message.reply(translation.translatedText);
  } catch (error) {
    console.error("设置消息翻译失败:", error);
    return ctx.message.reply(`Mistake!`);
  }
}

const showCommand = async (ctx: Combine<Combine<FilterQuery<TypeUpdateExtended<Message, "text">, "message">, ContextUpdate>, {}>) => {
  console.log("命令：显示当前设置");
  // 获取 chatId
  const chatId = Number(ctx.message?.chat?.id);

  // 获取发信人
  const fromId = Number(ctx.message?.from?.id) || Number(ctx.message?.senderChat?.id);

  // 判断是否存在消息Id
  const messageId = ctx.message?.id;

  // 判断是否存在消息Id
  if (!messageId || !chatId || !fromId) {
    console.log("参数不完整");
    console.log(`消息格式: ${ctx.message}`);
    return undefined;
  }

  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Show] [${fromId}]`);
    return undefined;
  }

  // 读取设置
  const settings = await chatSettingsService.getSettings(chatId);
  if (!settings) {
    return ctx.message.reply("未找到设置");
  }

  // 删除原命令消息
  try {
    setTimeout(async () => {
      await ctx.api.deleteMessage(chatId.toString(), messageId);
    }, 3000);
  } catch (error) {
    console.error("删除消息失败:", error);
  }
  // Show settings
  return ctx.message.reply(`Translation enabled: ${settings.enabledTranslate ? 'Yes' : 'No'}\nTarget language: ${settings.targetLanguage}`);
};

// 设置群组的目标语言
client.cmd('show', async (ctx) => {
  await useCommand(ctx);
});

// 设置群组的目标语言
client.cmd('use', async (ctx) => {
  await useCommand(ctx);
});

// 启用翻译对齐
client.cmd('local', async (ctx) => {
  await localCommand(ctx);
});

// 使用 show 命令查看当前群组的目标语言
client.cmd('show', async (ctx) => {
  await showCommand(ctx);
});

// 具体的逻辑
client.on('msg.text', async (ctx) => {
  // 获取 chatId
  const chatId = Number(ctx.message?.chat?.id);

  // 获取发信人
  const fromId = ctx.message?.from?.id || ctx.message?.senderChat?.id;

  // 获取消息Id
  const messageId = ctx.message?.id;

  // 判断是否存在消息Id
  if (!messageId || !chatId || !fromId) {
    console.log("参数不完整");
    console.log(`消息格式: ${ctx.message}`);
    return undefined;
  }

  // 判断是否不是自己
  if (notMe(BigInt(Number(fromId)))) {
    console.log(`[Hears] [${fromId}]`);
    return undefined;
  }

  // 不回复编辑消息
  if (ctx.editedMessage) {
    return undefined;
  }

  // 处理 ,use 命令
  if ((ctx.message?.text || '').startsWith(",use")) {
    await useCommand(ctx);
    return;
  }

  // 处理 ,local 命令
  if ((ctx.message?.text || '').startsWith(",local")) {
    await localCommand(ctx);
    return;
  }

  // 处理 ,show 命令
  if ((ctx.message?.text || '').startsWith(",show")) {
    await showCommand(ctx);
    return;
  }

  // 检查服务是否正确配置
  if (!translationService.isServiceConfigured()) {
    console.warn("翻译服务未正确配置，某些功能可能无法使用");
    return undefined;
  }

  // 获取需要翻译的文本
  let textToTranslate = ctx.message.text;
  if (!textToTranslate) {
    return undefined;
  }

  // 如果消息是 tl 开头，则删除 tl
  if (textToTranslate.startsWith("tl")) {
    textToTranslate = textToTranslate.slice(2);
  } else {
    // 不是 tl 开头，则不翻译
    return undefined;
  }

  // 读取设置
  const settings = await chatSettingsService.getSettings(chatId);

  // 检查是否启用了翻译
  if (!settings || settings.enabledTranslate !== 1) {
    console.log("未启用翻译");
    return undefined;
  }

  // 翻译
  let nextEditMessage = ctx.message.text;
  try {
    const translation = await translationService.translate(
      textToTranslate,
      settings?.targetLanguage || 'In Fluent English With Internet Style'
    );
    console.log("翻译结果:", translation.translatedText);
    nextEditMessage = translation.translatedText;
  } catch (error) {
    console.error("监听消息翻译失败:", error);
    // 编辑消息，如果消息以 tl 开头，删除 tl，这里仍然从 ctx.message.text 中获取，防止变量被修改
    if (ctx.message.text.startsWith("tl")) {
      nextEditMessage = ctx.message.text.slice(2);
    }
  } finally {
    // 如果未被修改，则不编辑消息
    if (nextEditMessage === ctx.message.text || nextEditMessage.length === 0) {
      console.log(`未修改消息 [${chatId}] [${messageId}]`);
      return undefined;
    }
    try {
      console.log(`编辑消息 [${chatId}] [${messageId}]`);
      ctx.api.invoke(new Raw.messages.EditMessage({
        peer: await client.core.resolvePeer(chatId.toString()),
        message: nextEditMessage,
        id: messageId
      }), 2, 1000, 5000);
    } catch (error) {
      console.error(`编辑消息失败 [${chatId}] [${messageId}]: ${error}`);
    }
  }
});

client.run().then(async () => {
  // 获取自己的 Id
  myId = client._me.id;
  console.log(`Bot started with user ${myId}`);
  // 导出 session
  // await client._client.exportSession();
  // 初始化数据库
  try {
    await chatSettingsService.initializeDatabase();
    console.log("数据库初始化成功");
  } catch (error) {
    console.error("数据库初始化失败:", error);
  }
});

