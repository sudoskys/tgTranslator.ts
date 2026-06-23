const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("This project uses pnpm. Do not install dependencies with bun or npm.");
  console.error("Run: corepack enable && corepack prepare pnpm@10.33.0 --activate");
  console.error("Then: pnpm install --frozen-lockfile");
  process.exit(1);
}
