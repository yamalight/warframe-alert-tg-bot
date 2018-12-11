# Warframe Telegram Alert Bot

Simple Telegram bot for warframe that will notify you about interesting items in alerts and invasions.

## Requirements

Node 10.x or higher.

## Installation

1. Clone the repository
2. Install deps with `npm install`
3. Specify `BOT_TOKEN` environmental variable with your Telegram bot access token
4. Start the bot with `npm start`

## Using the bot

1. Invite bot to group chat or start a direct chat with him
2. Call `/lwstart` to request alert monitoring
3. Bot will now send you notifications about new alerts and invasions that contain listed items

## Caveats

Currently bot will only work in one chat.
Some additional work is needed for it to be multi-chat.
PRs are welcome :)
