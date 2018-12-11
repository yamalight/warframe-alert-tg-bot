const got = require('got');
const dateFns = require('date-fns');
const Telegraf = require('telegraf');
const Cache = require('ttl-mem-cache');

const dataUrl = 'http://content.warframe.com/dynamic/worldState.php';

const interestingItems = [
  'OrokinReactorBlueprint',
  'OrokinCatalystBlueprint',
  'PlayerMeleeWeaponRandomModRare',
  'LotusPistolRandomModRare',
  'LotusRifleRandomModRare',
  'LotusShotgunRandomModRare',
];

const interestingItemsAlerts = interestingItems.concat(['FormaBlueprint', 'Alertium', 'CatbrowGeneticSignature']);

const itemNames = {
  OrokinReactorBlueprint: 'Orokin Reactor Blueprint',
  OrokinCatalystBlueprint: 'Orokin Catalyst Blueprint',
  Alertium: 'Nitain',
  FormaBlueprint: 'Forma Blueprint',
  PlayerMeleeWeaponRandomModRare: 'Melee Riven Mod',
  LotusPistolRandomModRare: 'Pistol Riven Mod',
  LotusRifleRandomModRare: 'Rifle Riven Mod',
  LotusShotgunRandomModRare: 'Shotgun Riven Mod',
  CatbrowGeneticSignature: 'Kavat Genetic Code',
};

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 mins
const INVASION_TTL = 12 * 60 * 60 * 1000; // 12 hours

// cache for already mentioned things
const cache = new Cache();

// fetch data from warframe API
const fetchData = async (req, reply) => {
  const response = await got(dataUrl, {json: true});
  const {Alerts, Invasions} = response.body;

  // parse alerts
  const now = Date.now();
  const alerts = Alerts.map(a => ({
    id: a._id.$oid,
    start: new Date(Number(a.Activation.$date.$numberLong)),
    end: new Date(Number(a.Expiry.$date.$numberLong)),
    type: a.MissionInfo.missionType,
    rewards: (a.MissionInfo.missionReward.items || [])
      .concat((a.MissionInfo.missionReward.countedItems || []).map(it => it.ItemType))
      .map(reward => reward.split('/').pop()),
  }))
    .filter(a => a.end.getTime() > now)
    .filter(alert => alert.rewards.some(reward => interestingItemsAlerts.includes(reward)));

  // parse invasions
  const invasions = Invasions.filter(i => !i.Completed)
    .map(i => ({
      id: i._id.$oid,
      count: i.Count,
      goal: i.Goal,
      attackReward: (i.AttackerReward.countedItems || []).map(it => it.ItemType.split('/').pop()),
      defenderReward: (i.DefenderReward.countedItems || []).map(it => it.ItemType.split('/').pop()),
    }))
    .filter(invasion =>
      invasion.attackReward.concat(invasion.defenderReward).some(reward => interestingItems.includes(reward))
    );

  return {alerts, invasions};
};

const handleCheck = async ctx => {
  const {alerts, invasions} = await fetchData();

  // send alert messages
  const now = Date.now();
  alerts
    .filter(alert => !cache.get(alert.id))
    .forEach(alert => {
      // add to cache
      cache.set(alert.id, alert.id, dateFns.differenceInMilliseconds(alert.end, now));

      ctx.reply(
        `NEW ALERT:
Rewards: ${alert.rewards
          .map(reward => itemNames[reward])
          .filter(r => r)
          .join(' ')}
Ends in: ${dateFns.differenceInMinutes(alert.end, now)} mins
${alert.start > now ? `Starts in: ${dateFns.differenceInMinutes(alert.start, now)} mins` : ''}`
      );
    });

  // send invasion messages
  invasions
    .filter(invasion => !cache.get(invasion.id))
    .forEach(invasion => {
      // add to cache
      cache.set(invasion.id, invasion.id, INVASION_TTL);

      ctx.reply(
        `NEW INVASION: 
Rewards: ${invasion.attackReward
          .concat(invasion.defenderReward)
          .map(reward => itemNames[reward])
          .filter(r => r)
          .join(', ')}
Current progress: ~${(Math.floor(Math.abs(invasion.count / invasion.goal) * 100) / 100) * 100}%`
      );
    });
};

const start = () => {
  let status = 'waiting';
  let nextCheckInterval = -1;
  let context = {
    reply: (...args) => console.log(args),
  };
  const bot = new Telegraf(process.env.BOT_TOKEN);
  bot.command('lwstart', async ctx => {
    if (status === 'running') {
      ctx.reply('Already running!');
      return;
    }
    ctx.reply(`OK, I'll let you know when cool things are in alerts or invasions.`);
    status = 'running';
    context = ctx;
    await handleCheck(ctx);
    nextCheckInterval = setInterval(() => {
      handleCheck(ctx);
    }, CHECK_INTERVAL);
  });
  bot.command('lwstatus', ctx => ctx.reply(`Current status: ${status}`));
  bot.command('lwstop', ctx => {
    status = 'stopped';
    ctx.reply('Will no longer report alerts!');
    if (nextCheckInterval) {
      clearInterval(nextCheckInterval);
    }
  });
  bot.command('lwhelp', ctx => {
    ctx.reply(`Here's commands I know:
* /lwstart - will start monitoring process
* /lwstop - will stop monitoring process
* /lwstatus - will display current monitoring status
* /lwhelp - this help thingy`);
  });
  bot.startPolling();
  console.log('Bot is now running!');
};

start();
