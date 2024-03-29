import { differenceInHours, formatDistance } from 'date-fns';
import got from 'got';
import worldstateData from 'warframe-worldstate-data';

// Offical Warframe API endpoint, essentially a really big JSON dump
const dataUrl = 'http://content.warframe.com/dynamic/worldState.php';

/**
 * Items of interest in invasions
 * Uses item substring after last `/`
 * (in theory it might be trigger on false items at one point,
 * but so far works fine)
 */
const interestingItems = [
  'OrokinReactor',
  'OrokinReactorBlueprint',
  'OrokinCatalyst',
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
  'WeaponSecondaryArcaneUnlocker',
  'WeaponUtilityUnlockerBlueprint',
];

/**
 * Sentient outpost values to names mapping
 */
const sentientOutpostValues = {
  505: 'Ruse War Field',
  510: 'Gian Point',
  550: 'Nsu Grid',
  551: `Ganalen's Grave`,
  552: 'Rya',
  553: 'Flexa',
  554: 'H-2 Cloud',
  555: 'R-9 Cloud',
};

/**
 * Fissure level modifiers
 */
const fissureModifiers = {
  VoidT1: 'Lith',
  VoidT2: 'Meso',
  VoidT3: 'Neo',
  VoidT4: 'Axi',
  VoidT5: 'Requiem',
};

/**
 * Items of interest in alerts
 * Follows the same pattern as invasion items
 */
const interestingItemsAlerts = interestingItems.concat([
  'Forma',
  'FormaBlueprint',
  'FormaUmbra',
  'UmbraFormaBlueprint',
  'Alertium',
  'CatbrowGeneticSignature',
  'MarketTier3FusionBundle',
]);

/**
 * Items of interest in alerts (regexes for partial matches)
 */
const interestingItemsRegexAlerts = [
  /* Nightwave creds, e.g. NoraIntermissionFourCreds */
  /Creds$/,
  /* Factions standing */
  /Standing/,
];

/**
 * Mappings between item values and human-readable names
 */
const itemNames = {
  OrokinReactorBlueprint: 'Orokin Reactor Blueprint',
  OrokinReactor: 'Orokin Reactor',
  OrokinCatalystBlueprint: 'Orokin Catalyst Blueprint',
  OrokinCatalyst: 'Orokin Catalyst',
  Alertium: 'Nitain',
  Forma: 'Forma',
  FormaUmbra: 'Umbra Forma',
  FormaBlueprint: 'Forma Blueprint',
  MarketTier3FusionBundle: '1000 endo',
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
  WeaponSecondaryArcaneUnlocker: 'Secondary Arcane Adapter',
  WeaponUtilityUnlockerBlueprint: 'Exilus Weapon Adapter Blueprint',
};

/**
 * Mappings between item values and human-readable names
 */
const itemNamesRegex = [{ regex: /Creds$/, name: 'Nightwave Creds' }];

/**
 * Converts item label to human-readable name
 * @param {String} item Item name
 * @returns {string} Human-readable item name
 */
const itemLabelToName = (item) => {
  // if there is direct mapping, use it
  if (item in itemNames) {
    return itemNames[item];
  }

  // otherwise, try to find a partial match via regex
  for (const { regex, name } of itemNamesRegex) {
    if (regex.test(item)) {
      return name;
    }
  }

  // If we don't have a name, just return the item
  return item;
};

/**
 * Fetches data from warframe API and returns filtered,
 * simply formatted arrays of invasions and alerts
 * that include interesting items
 */
export async function fetchData() {
  const { Alerts, Invasions, Goals, ActiveMissions, Tmp } = await got(dataUrl).json();

  // parse alerts
  const now = Date.now();
  const alerts = Alerts.map((a) => ({
    id: a._id.$oid,
    start: new Date(Number(a.Activation.$date.$numberLong)),
    end: new Date(Number(a.Expiry.$date.$numberLong)),
    type: a.MissionInfo.missionType,
    rewards: (a.MissionInfo.missionReward.items || [])
      .map((it) => ({
        name: it.split('/').pop(),
        count: 1,
      }))
      .concat(
        (a.MissionInfo.missionReward.countedItems || []).map((it) => ({
          name: it.ItemType.split('/').pop(),
          count: it.ItemCount,
        }))
      ),
  }))
    .filter((a) => a.end.getTime() > now)
    .filter((alert) => {
      return (
        alert.rewards.some((reward) => interestingItemsAlerts.includes(reward.name)) ||
        alert.rewards.some((reward) => interestingItemsRegexAlerts.some((regex) => reward.name?.match?.(regex)))
      );
    });

  // parse invasions
  const invasions = Invasions.filter((i) => !i.Completed)
    .map((i) => ({
      id: i._id.$oid,
      count: i.Count,
      goal: i.Goal,
      attackReward: (i.AttackerReward.countedItems || []).map((it) => ({
        name: it.ItemType.split('/').pop(),
        count: it.ItemCount,
      })),
      defenderReward: (i.DefenderReward.countedItems || []).map((it) => ({
        name: it.ItemType.split('/').pop(),
        count: it.ItemCount,
      })),
    }))
    .filter((invasion) =>
      invasion.attackReward.concat(invasion.defenderReward).some((reward) => interestingItems.includes(reward.name))
    );

  // parse goal-based events
  const fomorianData = Goals.find((i) => i.Fomorian === true);
  let fomorian;
  if (fomorianData) {
    fomorian = {
      id: fomorianData._id.$oid,
      start: new Date(Number(fomorianData.Activation.$date.$numberLong)),
      end: new Date(Number(fomorianData.Expiry.$date.$numberLong)),
      count: fomorianData.Count,
      goal: fomorianData.Goal,
      reward: (fomorianData.Reward.items || []).map((it) => it.split('/').pop()),
    };
  }

  // parse sentient outpost info
  let sentientOutpost = {};
  try {
    const outpostJson = JSON.parse(Tmp);
    const outpostCode = outpostJson.sfn;
    if (outpostCode) {
      const outpostName = sentientOutpostValues[outpostCode];
      sentientOutpost = {
        id: `sentient_outpost_${outpostCode}`,
        name: outpostName,
        detectedDate: new Date(),
      };
    }
  } catch (e) {
    console.error('Error parsing sentient outpost:', e);
  }

  // parse steel path void fissures survival
  const steelPath = ActiveMissions
    // only take steelpath missions
    .filter((m) => m.Hard && m.MissionType === 'MT_SURVIVAL')
    // only take grineer missions
    .filter((m) => worldstateData.solNodes[m.Node]?.enemy === 'Grineer')
    // map to final data for printing
    .map((i) => ({
      id: i._id.$oid,
      start: new Date(Number(i.Activation.$date.$numberLong)),
      end: new Date(Number(i.Expiry.$date.$numberLong)),
      location: worldstateData.solNodes[i.Node]?.value ?? i.Node,
      type: fissureModifiers[i.Modifier] ?? i.Modifier,
    }));

  return { alerts, invasions, fomorian, sentientOutpost, steelPath };
}

/**
 * Formats given alert into a string
 * @param {Object} alert
 */
export function formatAlert({ alert, now }) {
  return `NEW ALERT:
Rewards: ${alert.rewards
    .map((reward) =>
      reward.count > 1 ? `${itemLabelToName(reward.name)} x${reward.count}` : itemLabelToName(reward.name)
    )
    .filter((r) => r)
    .join(' ')}
Ends in: ${formatDistance(alert.end, now)}
${alert.start > now ? `Starts in: ${formatDistance(alert.start, now)}` : ''}`;
}

/**
 * Formats given invasion into a string
 * @param {Object} invasion
 */
export function formatInvasion(invasion) {
  return `NEW INVASION: 
Rewards: ${invasion.attackReward
    .concat(invasion.defenderReward)
    .map((reward) =>
      reward.count > 1 ? `${itemLabelToName(reward.name)} x${reward.count}` : itemLabelToName(reward.name)
    )
    .filter((r) => r)
    .join(', ')}
Current progress: ~${(Math.floor(Math.abs(invasion.count / invasion.goal) * 100) / 100) * 100}%`;
}

/**
 * Formats given fomorian event into a string
 * @param {Object} fomorian
 */
export function formatFomorian({ fomorian, now }) {
  return `NEW FOMORIAN EVENT:
Rewards: ${fomorian.reward
    .map((reward) => itemLabelToName(reward))
    .filter((r) => r)
    .join(' ')}
Ends in: ${formatDistance(fomorian.end, now)}
${fomorian.start > now ? `Starts in: ${formatDistance(fomorian.start, now)}` : ''}`;
}

/**
 * Formats given fissure into a string
 * @param {Object} fissure
 */
export function formatFissure({ fissure, now }) {
  return `NEW STEEL PATH SURVIVAL FISSURE: 
  Type: ${fissure.type}
  Location: ${fissure.location}
  Ends in: ${formatDistance(fissure.end, now)}
  ${fissure.start > now ? `Starts in: ${formatDistance(fissure.start, now)}` : ''}`;
}

export async function getBaro() {
  const res = await got(dataUrl).json();
  if (!res.VoidTraders) {
    return;
  }

  const { VoidTraders } = res;
  const baro = VoidTraders.find((t) => t.Character === "Baro'Ki Teel");

  if (!baro || !baro.Manifest) {
    return 'Baro is not here yet!';
  }

  const now = Date.now();
  const date = new Date(Number(baro.Expiry.$date.$numberLong));
  let result = `Baro is here (leaves in ${differenceInHours(date, now)}h)
Here's what he has:`;

  baro.Manifest.forEach((it) => {
    const { ItemType, PrimePrice, RegularPrice } = it;
    const name = ItemType.split('/').pop().replace(/[A-Z]/g, ' $&');

    result += `\n  ${name} - ${PrimePrice} ducats, ${RegularPrice} credits`;
  });

  return result;
}

/**
 * Formats given sentient outpost into a string
 * @param {Object} outpost
 */
export function formatSentientOutpost(outpost) {
  return `NEW SENTIENT OUTPOST: ${outpost.name}`;
}
