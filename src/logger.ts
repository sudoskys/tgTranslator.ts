// 零依赖分级日志。时间戳与文件分流交给 PM2（见 pm2.json），这里只负责
// 级别过滤、统一格式和内容脱敏。LOG_LEVEL 控制阈值，默认 info。
// warn/error 走 stderr，debug/info 走 stdout，便于 PM2 分流到 error/out 日志。

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = LEVELS[(process.env.LOG_LEVEL?.toLowerCase() as LogLevel)] ?? LEVELS.info;

const isDebug = threshold <= LEVELS.debug;

const emit = (level: LogLevel, scope: string, message: string, args: unknown[]): void => {
  if (LEVELS[level] < threshold) {
    return;
  }
  const line = `${level.toUpperCase()} [${scope}] ${message}`;
  if (level === "warn" || level === "error") {
    console.error(line, ...args);
  } else {
    console.log(line, ...args);
  }
};

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const createLogger = (scope: string): Logger => ({
  debug: (message, ...args) => emit("debug", scope, message, args),
  info: (message, ...args) => emit("info", scope, message, args),
  warn: (message, ...args) => emit("warn", scope, message, args),
  error: (message, ...args) => emit("error", scope, message, args),
});

// 用户消息原文/译文走这里：默认只暴露字符数，仅在 LOG_LEVEL=debug 时记全文。
// 与项目“不存用户内容”的立场一致。
export const preview = (text: string | null | undefined): string => {
  if (!text) {
    return "<empty>";
  }
  return isDebug ? text : `<${[...text].length} chars>`;
};
