import { differenceInMilliseconds } from 'date-fns';
import { Telegraf } from 'telegraf';
import Cache from 'ttl-mem-cache';
import {
  fetchData,
  formatAlert,
  formatInvasion,
  formatSentientOutpost,
  getBaro,
} from './api.js';

// flag to log sentient outpost
const TRACK_SENTIENT_OUTPOSTS = process.env.TRACK_SENTIENT_OUTPOSTS === '1';

// Interval to re-fetch the data
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 mins
// Time-to-live for invasion data
const INVASION_TTL = 12 * 60 * 60 * 1000; // 12 hours
// Time-to-live for sentient outpost data
const SENTIENT_TTL = 30 * 60 * 1000; // 30 mins
// cache for already mentioned things
const cache = new Cache();

/**
 *
 * @param {*} ctx
 */
const handleCheck = async (ctx) => {
  const { alerts, invasions, sentientOutpost } = await fetchData();

  // send alert messages
  const now = Date.now();
  alerts
    // filter alert that were already sent to chat
    .filter((alert) => !cache.get(alert.id))
    .forEach((alert) => {
      // add to cache
      cache.set(alert.id, alert.id, differenceInMilliseconds(alert.end, now));
      // reply with formatted human-readable info about alert
      ctx.reply(formatAlert({ alert, now }));
    });

  // send invasion messages
  invasions
    // filter invasions that were already sent to chat
    .filter((invasion) => !cache.get(invasion.id))
    .forEach((invasion) => {
      // add to cache
      cache.set(invasion.id, invasion.id, INVASION_TTL);
      // reply with formatted human-readable info about invasion
      ctx.reply(formatInvasion(invasion));
    });

  // send sentient outpost data
  if (
    TRACK_SENTIENT_OUTPOSTS === true &&
    sentientOutpost.id &&
    !cache.get(sentientOutpost.id)
  ) {
    // add to cache
    cache.set(sentientOutpost.id, sentientOutpost.id, SENTIENT_TTL);
    // reply with formatted human-readable info about invasion
    ctx.reply(formatSentientOutpost(sentientOutpost));
  }
};

/**
 * Main function that starts the bot.
 * The bot will only work in one group / chat as it is now
 */
export default async () => {
  // bot status
  let status = 'waiting';
  // re-fetch interval reference
  let nextCheckInterval = -1;
  // default context that is passed to handler
  let context = {
    // by default reply will log data to console
    reply: (...args) => console.log(args),
  };

  // telegraf bot instance
  const bot = new Telegraf(process.env.BOT_TOKEN);
  const { username } = await bot.telegram.getMe();
  bot.options.username = username;

  // start command
  // has to be invoke for bot to start handling alerts
  bot.command('start', async (ctx) => {
    // ignore multiple calls
    if (status === 'running') {
      ctx.reply('Already running!');
      return;
    }

    // notify user that we're starting
    ctx.reply(
      `OK, I'll let you know when cool things are in alerts or invasions.`
    );
    // set new status
    status = 'running';
    // store chat context for replies
    context = ctx;
    // call initial alerts parsing
    await handleCheck(context);
    // schedule checks at the given interval
    nextCheckInterval = setInterval(() => handleCheck(ctx), CHECK_INTERVAL);
  });

  // status command
  // reports current bot status
  bot.command('status', (ctx) => ctx.reply(`Current status: ${status}`));

  // stop command
  // stops current alert monitoring, cleans up refresh interval
  bot.command('stop', (ctx) => {
    status = 'stopped';
    ctx.reply('Will no longer report alerts!');
    if (nextCheckInterval) {
      clearInterval(nextCheckInterval);
    }
  });

  // baro command
  // gets info about baro's shop
  bot.command('baro', async (ctx) => {
    const baroText = await getBaro();
    ctx.reply(baroText);
  });

  // help command
  // displays available commands to user
  bot.command('help', (ctx) => {
    ctx.reply(`Here's commands I know:
* /start - will start monitoring process
* /stop - will stop monitoring process
* /status - will display current monitoring status
* /baro - will display current Baro offerings
* /help - this help thingy`);
  });

  // start polling chat for messages
  bot.startPolling();
  console.log('Bot is now running!');
};
