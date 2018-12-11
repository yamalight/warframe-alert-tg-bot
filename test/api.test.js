const nock = require('nock');
const dateFns = require('date-fns');
const {fetchData, formatAlert, formatInvasion} = require('../src/api');
const mockData = require('./fixtures/apiResponse.json');

// mock response from warframe API
nock('http://content.warframe.com')
  .get('/dynamic/worldState.php')
  .reply(200, mockData);

// mock time now
const mockNow = new Date(2018, 0, 1, 1, 1, 1, 1);

// mock alert data for formatting
const mockAlert = {
  rewards: ['Alertium'],
  end: dateFns.addMinutes(mockNow, 40),
  start: dateFns.addMinutes(mockNow, 5),
};

const mockInvasion = {
  attackReward: ['OrokinReactorBlueprint'],
  defenderReward: ['OrokinCatalystBlueprint'],
  count: 1,
  goal: 100,
};

describe('Warframe API handling', () => {
  test('should fetch invasions and alerts', async done => {
    const result = await fetchData();
    expect(result).toMatchSnapshot();
    done();
  });

  test('should format alert info', () => {
    const alertText = formatAlert({alert: mockAlert, now: mockNow});
    expect(alertText).toMatchSnapshot();
  });

  test('should format invasion info', () => {
    const invasionText = formatInvasion(mockInvasion);
    expect(invasionText).toMatchSnapshot();
  });
});