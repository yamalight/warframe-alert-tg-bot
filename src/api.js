const got = require("got");
const dateFns = require("date-fns");

// Offical Warframe API endpoint, essentially a really big JSON dump
const dataUrl = "http://content.warframe.com/dynamic/worldState.php";

/**
 * Items of interest in invasions
 * Uses item substring after last `/`
 * (in theory it might be trigger on false items at one point,
 * but so far works fine)
 */
const interestingItems = [
  "OrokinReactorBlueprint",
  "OrokinCatalystBlueprint",
  "UtilityUnlockerBlueprint",
  "PlayerMeleeWeaponRandomModRare",
  "LotusModularMeleeRandomModRare",
  "LotusPistolRandomModRare",
  "LotusModularPistolRandomModRare",
  "LotusRifleRandomModRare",
  "LotusModularRifleRandomModRare",
  "LotusShotgunRandomModRare",
  "LotusModularShotgunRandomModRare"
];

/**
 * Sentient outpost values to names mapping
 */
const sentientOutpostValues = {
  505: "Ruse War Field",
  510: "Gian Point",
  550: "Nsu Grid",
  551: `Ganalen's Grave`,
  552: "Rya",
  553: "Flexa",
  554: "H-2 Cloud",
  555: "R-9 Cloud"
};

/**
 * Items of interest in alerts
 * Follows the same pattern as invasion items
 */
const interestingItemsAlerts = interestingItems.concat([
  "FormaBlueprint",
  "Alertium",
  "CatbrowGeneticSignature"
]);

/**
 * Mappings between item values and human-readable names
 */
const itemNames = {
  OrokinReactorBlueprint: "Orokin Reactor Blueprint",
  OrokinCatalystBlueprint: "Orokin Catalyst Blueprint",
  Alertium: "Nitain",
  FormaBlueprint: "Forma Blueprint",
  UtilityUnlockerBlueprint: "Exilus Adapter",
  PlayerMeleeWeaponRandomModRare: "Melee Riven Mod",
  LotusModularMeleeRandomModRare: "Zaw Riven Mod",
  LotusPistolRandomModRare: "Pistol Riven Mod",
  LotusModularPistolRandomModRare: "Kitgun Riven Mod",
  LotusRifleRandomModRare: "Rifle Riven Mod",
  LotusModularRifleRandomModRare: "Modular Rifle Riven Mod",
  LotusShotgunRandomModRare: "Shotgun Riven Mod",
  LotusModularShotgunRandomModRare: "Modular Shotgun Riven Mod",
  CatbrowGeneticSignature: "Kavat Genetic Code"
};

/**
 * Fetches data from warframe API and returns filtered,
 * simply formatted arrays of invasions and alerts
 * that include interesting items
 */
exports.fetchData = async () => {
  const { Alerts, Invasions, Tmp } = await got(dataUrl).json();

  // parse alerts
  const now = Date.now();
  const alerts = Alerts.map(a => ({
    id: a._id.$oid,
    start: new Date(Number(a.Activation.$date.$numberLong)),
    end: new Date(Number(a.Expiry.$date.$numberLong)),
    type: a.MissionInfo.missionType,
    rewards: (a.MissionInfo.missionReward.items || [])
      .concat(
        (a.MissionInfo.missionReward.countedItems || []).map(it => it.ItemType)
      )
      .map(reward => reward.split("/").pop())
  }))
    .filter(a => a.end.getTime() > now)
    .filter(alert =>
      alert.rewards.some(reward => interestingItemsAlerts.includes(reward))
    );

  // parse invasions
  const invasions = Invasions.filter(i => !i.Completed)
    .map(i => ({
      id: i._id.$oid,
      count: i.Count,
      goal: i.Goal,
      attackReward: (i.AttackerReward.countedItems || []).map(it =>
        it.ItemType.split("/").pop()
      ),
      defenderReward: (i.DefenderReward.countedItems || []).map(it =>
        it.ItemType.split("/").pop()
      )
    }))
    .filter(invasion =>
      invasion.attackReward
        .concat(invasion.defenderReward)
        .some(reward => interestingItems.includes(reward))
    );

  // parse sentient outpost info
  let sentientOutpost = {};
  try {
    const outpostJson = JSON.parse(Tmp);
    const outpostCode = outpostJson.sfn;
    const outpostName = sentientOutpostValues[outpostCode];
    sentientOutpost = {
      id: `sentient_outpost_${outpostCode}`,
      name: outpostName,
      detectedDate: new Date()
    };
  } catch (e) {
    console.error("Error parsing sentient outpost:", e);
  }

  return { alerts, invasions, sentientOutpost };
};

/**
 * Formats given alert into a string
 * @param {Object} alert
 */
exports.formatAlert = ({ alert, now }) => `NEW ALERT:
Rewards: ${alert.rewards
  .map(reward => itemNames[reward])
  .filter(r => r)
  .join(" ")}
Ends in: ${dateFns.differenceInMinutes(alert.end, now)} mins
${
  alert.start > now
    ? `Starts in: ${dateFns.differenceInMinutes(alert.start, now)} mins`
    : ""
}`;

/**
 * Formats given invasion into a string
 * @param {Object} invasion
 */
exports.formatInvasion = invasion => `NEW INVASION: 
Rewards: ${invasion.attackReward
  .concat(invasion.defenderReward)
  .map(reward => itemNames[reward])
  .filter(r => r)
  .join(", ")}
Current progress: ~${(Math.floor(
  Math.abs(invasion.count / invasion.goal) * 100
) /
  100) *
  100}%`;

exports.getBaro = async () => {
  const { VoidTraders } = await got(dataUrl).json();
  const baro = VoidTraders.find(t => t.Character === "Baro'Ki Teel");

  if (!baro) {
    return "Baro is not here yet!";
  }

  const now = Date.now();
  const date = new Date(Number(baro.Expiry.$date.$numberLong));
  let result = `Baro is here (leaves in ${dateFns.differenceInHours(
    date,
    now
  )}h)
Here's what he has:`;

  baro.Manifest.forEach(it => {
    const { ItemType, PrimePrice, RegularPrice } = it;
    const name = ItemType.split("/")
      .pop()
      .replace(/[A-Z]/g, " $&");

    result += `\n  ${name} - ${PrimePrice} ducats, ${RegularPrice} credits`;
  });

  return result;
};

/**
 * Formats given sentient outpost into a string
 * @param {Object} outpost
 */
exports.formatSentientOutpost = outpost =>
  `NEW SENTIENT OUTPOST: ${outpost.name}`;
