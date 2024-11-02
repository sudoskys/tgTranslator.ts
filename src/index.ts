import { Raw, Snake } from "tgsnake";
import { ChatSettingsService } from "./services/chatSettings.service";
import { TranslationService } from "./services/translation.service";

const client = new Snake();
const chatSettingsService = new ChatSettingsService();
const translationService = new TranslationService();

let myId: bigint | null = null;

// 判断是否不是自己
const notMe = (id: bigint) => {
  return id !== myId;
};

// 添加中间件来处理身份验证
client.use(async (ctx, next) => {
  const fromId = ctx.message?.from?.id;
  if (fromId && notMe(BigInt(Number(fromId)))) {
    return undefined;
  }
  return next();
});

// 添加一个通用的删除消息函数
const deleteMessage = async (ctx: any, messageId: number, delay: number = 3000) => {
  try {
    // 延迟指定时间后删除消息
    setTimeout(async () => {
      await ctx.api.invoke(new Raw.messages.DeleteMessages({
        id: [messageId],
      }), 1, 1000, 2000);
    }, delay);
  } catch (error) {
    console.error("删除消息失败:", error);
  }
};

// 巴别塔翻译
client.cmd('ping', async (ctx) => {
  console.log("命令：活动测试");
  // 获取 chatId
  const chatId = Number(ctx.message.chat.id);
  // 获取发信人
  const fromId = Number(ctx.message.from.id);
  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Ping] [${fromId}]`);
    return undefined;
  }
  // 删除原命令消息
  await deleteMessage(ctx, ctx.message.id);
  return ctx.message.reply(`Chat ID: ${chatId}`);
});

// 启用翻译对齐
client.cmd('local', async (ctx) => {
  console.log("命令：翻译对齐");
  // 获取 chatId
  const chatId = Number(ctx.message.chat.id);
  // 获取发信人
  const fromId = Number(ctx.message.from.id);
  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Local] [${fromId}]`);
    return undefined;
  }
  // 删除原命令消息
  await deleteMessage(ctx, ctx.message.id);
  // 读取设置
  const settings = await chatSettingsService.getSettings(chatId);
  let nextEnabledTranslate = 1;
  if (settings.enabledTranslate != 0) {
    nextEnabledTranslate = 0;
  }
  await chatSettingsService.upsertSettings({
    chatId: chatId,
    enabledTranslate: nextEnabledTranslate
  });
  let nextMessage = '';
  // 翻译
  try {
    const translation = await translationService.translate(
      `我为你配置了 ${nextEnabledTranslate == 1 ? 'enabled' : 'disabled'} 翻译`,
      settings.targetLanguage || 'In Fluent English With Internet Style'
    );
    nextMessage = translation.translatedText;
  } catch (error) {
    console.error("翻译失败:", error);
    nextMessage = `Now ${nextEnabledTranslate == 1 ? 'enabled' : 'disabled'} translate`;
  }
  // 删除原命令消息
  await deleteMessage(ctx, ctx.message.id);
  // 发消息表明自己已经启用
  return ctx.message.reply(nextMessage);
});


// 设置群组的目标语言
client.cmd('lang', async (ctx) => {
  console.log("命令：设置目标语言");
  // 获取 chatId
  const chatId = Number(ctx.message.chat.id);
  // 获取发信人
  const fromId = Number(ctx.message.from.id);
  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Lang] [${fromId}]`);
    return undefined;
  }
  // 删除原命令消息
  await deleteMessage(ctx, ctx.message.id);
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
    targetLanguage: targetLanguage || 'In Fluent English With Internet Style'
  });
  // 检查服务
  if (!translationService.isServiceConfigured()) {
    return ctx.message.reply(`I configured translation to ${targetLanguage}, but service is not configured`);
  }
  // 当场翻译消息表示
  try {
    const translation = await translationService.translate(
      `我在这个群组配置了语言自适应 ${targetLanguage}。有问题记得@我`, // 不允许修改
      targetLanguage
    );
    console.log("翻译结果:", translation.translatedText);
    if (translation.detectedLanguage) {
      console.log("检测到的语言:", translation.detectedLanguage);
    }
    // 删除原命令消息
    await deleteMessage(ctx, ctx.message.id);
    return ctx.message.reply(translation.translatedText);
  } catch (error) {
    console.error("设置消息翻译失败:", error);
    return ctx.message.reply(`Mistake!`);
  }
});

// 具体的逻辑
client.on('msg.text', async (ctx) => {
  // 获取 chatId
  const chatId = Number(ctx.message.chat.id);
  // 获取发信人
  const fromId = Number(ctx.message.from.id);
  // 判断是否不是自己
  if (notMe(BigInt(fromId))) {
    console.log(`[Hears] [${fromId}]`);
    return undefined;
  }
  // 不回复编辑消息
  if (ctx.editedMessage) {
    return undefined;
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
  if (settings.enabledTranslate !== 1) {
    console.log("未启用翻译");
    return undefined;
  }
  // 翻译
  let nextEditMessage = ctx.message.text;
  try {
    const translation = await translationService.translate(
      textToTranslate,
      settings.targetLanguage || 'In Fluent English With Internet Style'
    );
    console.log("翻译结果:", translation.translatedText);
    if (translation.detectedLanguage) {
      console.log("检测到的语言:", translation.detectedLanguage);
    }
    nextEditMessage = translation.translatedText;
  } catch (error) {
    console.error("监听消息翻译失败:", error);
    // 编辑消息，如果消息以 tl 开头，删除 tl，这里仍然从 ctx.message.text 中获取，防止变量被修改
    if (ctx.message.text.startsWith("tl")) {
      nextEditMessage = ctx.message.text.slice(2);
    }
  } finally {
    // 如果未被修改，则不编辑消息
    if (nextEditMessage === ctx.message.text) {
      return undefined;
    }
    try {
      ctx.api.invoke(new Raw.messages.EditMessage({
        peer: new Raw.InputPeerChat({ chatId: BigInt(chatId) }),
        message: nextEditMessage,
        id: ctx.message.id
      }), 3, 1000, 2000);
    } catch (error) {
      console.error("编辑消息失败:", error);
    }
  }
});

client.run().then(() => {
  // 获取自己的 Id
  myId = client._me.id;
  console.log(`Bot started with user ${myId}`);
});





