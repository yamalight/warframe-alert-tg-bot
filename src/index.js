const dateFns = require('date-fns');
const Telegraf = require('telegraf');
const Cache = require('ttl-mem-cache');
const {fetchData, formatAlert, formatInvasion} = require('./api');

// Interval to re-fetch the data
const CHECK_INTERVAL = 10 * 60 * 1000; // 10 mins
// Time-to-live for invasion data
const INVASION_TTL = 12 * 60 * 60 * 1000; // 12 hours
// cache for already mentioned things
const cache = new Cache();

/**
 *
 * @param {*} ctx
 */
const handleCheck = async ctx => {
  const {alerts, invasions} = await fetchData();

  // send alert messages
  const now = Date.now();
  alerts
    // filter alert that were already sent to chat
    .filter(alert => !cache.get(alert.id))
    .forEach(alert => {
      // add to cache
      cache.set(alert.id, alert.id, dateFns.differenceInMilliseconds(alert.end, now));
      // reply with formatted human-readable info about alert
      ctx.reply(formatAlert({alert, now}));
    });

  // send invasion messages
  invasions
    // filter invasions that were already sent to chat
    .filter(invasion => !cache.get(invasion.id))
    .forEach(invasion => {
      // add to cache
      cache.set(invasion.id, invasion.id, INVASION_TTL);
      // reply with formatted human-readable info about invasion
      ctx.reply(formatInvasion(invasion));
    });
};

/**
 * Main function that starts the bot.
 * The bot will only work in one group / chat as it is now
 */
module.exports = () => {
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

  // start command
  // has to be invoke for bot to start handling alerts
  bot.command('lwstart', async ctx => {
    // ignore multiple calls
    if (status === 'running') {
      ctx.reply('Already running!');
      return;
    }

    // notify user that we're starting
    ctx.reply(`OK, I'll let you know when cool things are in alerts or invasions.`);
    // set new status
    status = 'running';
    // store chat context for replies
    context = ctx;
    // call initial alerts parsing
    await handleCheck(ctx);
    // schedule checks at the given interval
    nextCheckInterval = setInterval(() => handleCheck(ctx), CHECK_INTERVAL);
  });

  // status command
  // reports current bot status
  bot.command('lwstatus', ctx => ctx.reply(`Current status: ${status}`));

  // stop command
  // stops current alert monitoring, cleans up refresh interval
  bot.command('lwstop', ctx => {
    status = 'stopped';
    ctx.reply('Will no longer report alerts!');
    if (nextCheckInterval) {
      clearInterval(nextCheckInterval);
    }
  });

  // help command
  // displays available commands to user
  bot.command('lwhelp', ctx => {
    ctx.reply(`Here's commands I know:
* /lwstart - will start monitoring process
* /lwstop - will stop monitoring process
* /lwstatus - will display current monitoring status
* /lwhelp - this help thingy`);
  });

  // start polling chat for messages
  bot.startPolling();
  console.log('Bot is now running!');
};