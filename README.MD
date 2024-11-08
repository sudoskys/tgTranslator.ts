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
git clone https://github.com/sudoskys/i18n_me.git
pnpm install
```

2. Create a `.env` file in the root directory with the following variables:

```env
OAI_BASE_URL=https://api.openai.com/v1
DB_FILE_NAME=file:group.db
OAI_API_KEY=sk-xxxxx
OAI_MODEL=gpt-4o
```

3. Edit `tgsnake.config.js`

```bash
nano tgsnake.config.js
```

get your `apiHash` and `apiId` from [my.telegram.org](https://my.telegram.org)

```js
/** @type {import('tgsnake').Options } */
const config = {
  apiHash : 'xxxx',
  apiId : 123456,
  login : {
    botToken : '',
    sessionName : 'user',
    forceDotSession : true,
  },
  logLevel : ['error','info'],
  clientOptions : {"ipv6":false},
  plugins : []
}
module.exports = config
``` 

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

- [tgsnake](https://github.com/tgsnake/tgsnake) - Telegram MTProto framework
- [instructor-ai](https://github.com/instructor-ai/instructor-js) - Translate text with AI
- [Bun](https://bun.sh/) - For the amazing runtime and tooling

---
Made with ❤️ by [@sudoskys](https://github.com/sudoskys)
