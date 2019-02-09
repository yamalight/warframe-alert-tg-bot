const got = require('got');
const dateFns = require('date-fns');

// Offical Warframe API endpoint, essentially a really big JSON dump
const dataUrl = 'http://content.warframe.com/dynamic/worldState.php';

/**
 * Items of interest in invasions
 * Uses item substring after last `/`
 * (in theory it might be trigger on false items at one point,
 * but so far works fine)
 */
const interestingItems = [
  'OrokinReactorBlueprint',
  'OrokinCatalystBlueprint',
  'UtilityUnlockerBlueprint',
  'PlayerMeleeWeaponRandomModRare',
  'LotusModularMeleeRandomModRare',
  'LotusPistolRandomModRare',
  'LotusModularPistolRandomModRare',
  'LotusRifleRandomModRare',
  'LotusModularRifleRandomModRare',
  'LotusShotgunRandomModRare',
  'LotusModularShotgunRandomModRare',
];

/**
 * Items of interest in alerts
 * Follows the same pattern as invasion items
 */
const interestingItemsAlerts = interestingItems.concat(['FormaBlueprint', 'Alertium', 'CatbrowGeneticSignature']);

/**
 * Mappings between item values and human-readable names
 */
const itemNames = {
  OrokinReactorBlueprint: 'Orokin Reactor Blueprint',
  OrokinCatalystBlueprint: 'Orokin Catalyst Blueprint',
  Alertium: 'Nitain',
  FormaBlueprint: 'Forma Blueprint',
  UtilityUnlockerBlueprint: 'Exilus Adapter',
  PlayerMeleeWeaponRandomModRare: 'Melee Riven Mod',
  LotusModularMeleeRandomModRare: 'Zaw Riven Mod',
  LotusPistolRandomModRare: 'Pistol Riven Mod',
  LotusModularPistolRandomModRare: 'Kitgun Riven Mod',
  LotusRifleRandomModRare: 'Rifle Riven Mod',
  LotusModularRifleRandomModRare: 'Modular Rifle Riven Mod',
  LotusShotgunRandomModRare: 'Shotgun Riven Mod',
  LotusModularShotgunRandomModRare: 'Modular Shotgun Riven Mod',
  CatbrowGeneticSignature: 'Kavat Genetic Code',
};

/**
 * Fetches data from warframe API and returns filtered,
 * simply formatted arrays of invasions and alerts
 * that include interesting items
 */
exports.fetchData = async () => {
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

/**
 * Formats given alert into a string
 * @param {Object} alert
 */
exports.formatAlert = ({alert, now}) => `NEW ALERT:
Rewards: ${alert.rewards
  .map(reward => itemNames[reward])
  .filter(r => r)
  .join(' ')}
Ends in: ${dateFns.differenceInMinutes(alert.end, now)} mins
${alert.start > now ? `Starts in: ${dateFns.differenceInMinutes(alert.start, now)} mins` : ''}`;

/**
 * Formats given invasion into a string
 * @param {Object} invasion
 */
exports.formatInvasion = invasion => `NEW INVASION: 
Rewards: ${invasion.attackReward
  .concat(invasion.defenderReward)
  .map(reward => itemNames[reward])
  .filter(r => r)
  .join(', ')}
Current progress: ~${(Math.floor(Math.abs(invasion.count / invasion.goal) * 100) / 100) * 100}%`;
