import { describe, expect, test } from '@jest/globals';
import { addDays, addMinutes } from 'date-fns';
import nock from 'nock';
import { fetchData, formatAlert, formatInvasion, getBaro } from '../src/api';
import mockData from './fixtures/apiResponse.json';

// update mock data timings
const testDate = new Date(2099, 1, 1, 1, 1, 1);
// for alerts (use 2099 date to ensure today is before the alert ends)
mockData.Alerts.forEach((a) => {
  a.Expiry.$date.$numberLong = addDays(testDate, 1).getTime();
});
// for baro (use today's date so that he leaves in 23 hours)
const baro = mockData.VoidTraders.find((t) => t.Character === "Baro'Ki Teel");
baro.Expiry.$date.$numberLong = addDays(Date.now(), 1).getTime();

// mock response from warframe API
nock('http://content.warframe.com').get('/dynamic/worldState.php').times(3).reply(200, mockData);

// mock time now
const mockNow = new Date(2018, 0, 1, 1, 1, 1, 1);

// mock alert data for formatting
const mockAlert = {
  rewards: [{ name: 'Alertium', count: 2 }],
  end: addDays(mockNow, 5),
  start: addMinutes(mockNow, 5),
};

const mockInvasion = {
  attackReward: [{ name: 'OrokinReactorBlueprint', count: 2 }],
  defenderReward: [{ name: 'OrokinCatalystBlueprint', count: 1 }],
  count: 1,
  goal: 100,
};

describe('Warframe API handling', () => {
  test('should fetch invasions, alerts and sentient outpost', async () => {
    const result = await fetchData();
    // remove date from data to keep snapshot persistent
    result.alerts[0].end = 'fixed';
    result.sentientOutpost.detectedDate = 'fixed';
    // compare to snapshot
    expect(result).toMatchSnapshot();
  });

  test('should format alert info', () => {
    const alertText = formatAlert({ alert: mockAlert, now: mockNow });
    expect(alertText).toMatchSnapshot();
  });

  test('should format invasion info', () => {
    const invasionText = formatInvasion(mockInvasion);
    expect(invasionText).toMatchSnapshot();
  });

  test('should get and format baro info', async () => {
    const baroText = await getBaro();
    expect(baroText).toMatchSnapshot();
  });
});
