# i18n_me

I18 With AI...

A Telegram **UserBot** that provides real-time message translation capabilities, allowing users to seamlessly communicate across language barriers.

## Features

- 🔄 Real-time message translation(but only for yourself)
- 🎯 Custom target language settings per chat
- 🤖 Easy-to-use commands

## Prerequisites

- [Bun](https://bun.sh/), go to [Bun](https://bun.sh/) to install
- OpenAI API Key (for translation service)

## Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/i18n_me.git
bun install
```

2. Create a `.env` file in the root directory with the following variables:

```env
OAI_BASE_URL=https://api.openai.com/v1
DB_FILE_NAME=group.sqlite
OAI_API_KEY=sk-xxxxx
OAI_MODEL=gpt-4o
```


## Usage

### Starting the Bot

Development mode:

```bash
bun run start
```

Build for production:

```bash
npm install -g pm2
pm2 start pm2.json
pm2 status
```

### Bot Commands

- `/ping` - Test if the bot is active and get current chat ID
- `/local` - Toggle translation feature on/off
- `/lang [target_language]` - Set target language for translations
- `tl [text]` - Translate the following text (prefix any message with 'tl' to translate)

## Acknowledgments

- [tgsnake](https://github.com/tgsnake/tgsnake) - Telegram MTProto framework
- [instructor-ai](https://github.com/instructor-ai/instructor-js) - Translate text with AI
- [Bun](https://bun.sh/) - For the amazing runtime and tooling

---
Made with ❤️ by [@sudoskys](https://github.com/sudoskys)
