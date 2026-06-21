# i18n_me

I18 With AI...

A Telegram **UserBot** that provides real-time message translation capabilities, allowing users to seamlessly communicate across language barriers.

## Features

- 🔄 Real-time message translation(but only for yourself)
- 🎯 Custom target language settings per chat
- 🤖 Easy-to-use commands

## Prerequisites

- [Bun](https://bun.sh/), go to [Bun](https://bun.sh/) to install
- DeepSeek API key or another OpenAI-compatible API key for the translation service

## Installation

1. Clone the repository

```bash
git clone https://github.com/sudoskys/i18n_me.git
pnpm install
```

2. Create a `.env` file in the root directory with the following variables:

```env
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef
TELEGRAM_SESSION_FILE=mtcute.session
OAI_BASE_URL=https://api.deepseek.com
DB_FILE_NAME=file:group.db
OAI_API_KEY=sk-xxxxx
OAI_MODEL=deepseek-v4-flash
```

Get your `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from [my.telegram.org](https://my.telegram.org).
The default translation provider is DeepSeek's OpenAI-compatible API. Override `OAI_BASE_URL` and `OAI_MODEL` when using another compatible provider.

## Usage

### Starting the Bot

Connect to your Telegram account and start the bot:

```bash
pnpm run start
```

Then, Ctrl+C to stop the bot and run the following command to start the bot in production mode:

Build for production:

```bash
apt install npm
npm install -g pm2
# In the repo root directory
pm2 start pm2.json
pm2 status
```

Do not share your `.env` file or `.session` file with others.

### Bot Commands

- `/ping` - Test if the bot is active and get current chat ID
- `/local` - Toggle translation feature on/off
- `/use [target_language]` - Set target language for translations
- `tl [text]` - Translate the following text (prefix any message with 'tl' to translate)

## Acknowledgments

- [mtcute](https://github.com/mtcute/mtcute) - Telegram MTProto framework
- [instructor-ai](https://github.com/instructor-ai/instructor-js) - Translate text with AI
- [Bun](https://bun.sh/) - For the amazing runtime and tooling

---
Made with ❤️ by [@sudoskys](https://github.com/sudoskys)
