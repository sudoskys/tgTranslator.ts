# i18n_me Goal

> **Positioning**: i18n_me is a Telegram UserBot that translates the operator's own messages for cross-language chat.

## Users

- The primary user is the Telegram account operator who runs the UserBot.

## What This Project Does

- It listens to Telegram text messages from the authenticated operator.
- It translates messages prefixed with `tl` into a configured target language.
- It stores per-chat translation settings in a local SQLite/libSQL database.
- It exposes chat commands for pinging, enabling/disabling translation, setting a target language, and showing current settings.

## What This Project Does Not Do

- It does not translate other users' messages.
- It does not provide a hosted service or multi-tenant control plane.
- It does not make Telegram credentials, session files, API keys, or local database files safe to commit.

## Success Criteria

- The operator can enable translation in a chat, choose a target language, and have `tl` messages edited into translated text.
- Chat settings survive process restarts through the configured local database.
- The bot refuses to act on messages that do not come from the authenticated operator.

## Constraints

- The runtime depends on `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and the local `TELEGRAM_SESSION_FILE`.
- Translation depends on `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL`. The default provider is DeepSeek, with `deepseek-v4-flash` as the default model.
- Database state depends on `DB_FILE_NAME`, Drizzle migrations, and the local SQLite/libSQL file.

## Unknowns

- The supported deployment environments are not documented beyond local start and PM2 production start.
- Provider-specific behavior for OpenAI-compatible providers besides DeepSeek is not documented.
- The expected error handling behavior during Telegram, translation API, or database outages is not documented.
