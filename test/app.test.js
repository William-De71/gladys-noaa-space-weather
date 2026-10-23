// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a fake
// SWPC serving the real files of 2026-10-23 (test/helpers/fake-swpc.js), a
// real HTTP server on 127.0.0.1. No test touches the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, ACTIONS, USER_AGENT, PRODUCTS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import { SCENE_ACTIONS, SPACE_OUTPUTS, AURORA_OUTPUTS, FORECAST_OUTPUTS } from '../src/summary.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  startFakeSwpc,
  dataDir,
  fixture,
  silent,
  NOW,
  TZ,
  MINUTE,
  HOUR,
} from './helpers/fake-swpc.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const HOUSES = [
  { id: 'h-besancon', name: 'Maison', selector: 'maison', latitude: 47.24, longitude: 6.02 },
  { id: 'h-tromso', name: 'Chalet', selector: 'chalet', latitude: 69.65, longitude: 18.96 },
  { id: 'h-none', name: 'Garage', selector: 'garage', latitude: null, longitude: null },
];
const CONFIG = { language: 'fr', aurora_threshold: '10' };
const PREFIX = 'ext:test-integration';
const GLOBAL = `${PREFIX}:space-weather:global`;
const TROMSO = `${PREFIX}:aurora:h-tromso`;

/**
 * @description The integration, connected to a fake Gladys and a fake SWPC.
 * @param {object} t - The test context (closes everything after).
 * @param {object} [options] - `{ config, dir, clock, fake, houses, legacy }`.
 * @returns {Promise<object>} `{ gladys, app, fake, clock, dir }`.
 */
async function startApp(
  t,
  { config = CONFIG, dir = dataDir(), clock = { now: NOW }, fake, houses = HOUSES, legacy } = {},
) {
  fake ??= await startFakeSwpc({ legacy });
  const gladys = createFakeGladys({ config, houses });
  const app = createApp(gladys, {
    baseUrl: fake.url,
    dataDir: dir,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  t.after(async () => {
    await gladys.fake.shutdown().catch(() => {});
    await fake.close();
  });
  return { gladys, app, fake, clock, dir };
}
const create = async (gladys, externalId) =>
  gladys.fake.deviceCreated(
    structuredClone(gladys.fake.discoveredDevices.find((d) => d.external_id === externalId)),
  );
const events = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const declared = (key) => manifest.scene_triggers.find((trigger) => trigger.key === key);

/**
 * @description Check a payload against its trigger: flat, scalar, declared.
 * @param {string} key - The trigger.
 * @param {object} data - The payload.
 */
function assertPayload(key, data) {
  const trigger = declared(key);
  const known = new Set(
    [...(trigger.fields ?? []), ...trigger.variables].map((entry) => entry.key),
  );
  assert.ok(Object.keys(data).length <= 30);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(known.has(name), `${key}.${name} is not declared`);
    assert.ok(
      value === null || ['string', 'number', 'boolean'].includes(typeof value),
      `${key}.${name}`,
    );
    if (typeof value === 'string') assert.ok(value.length <= 1000);
  }
  for (const field of trigger.fields ?? [])
    assert.ok(field.key in data, `${key}: the field ${field.key} is in the data`);
}

test('startup: devices offered, no request before the timer, then each product once', async (t) => {
  const { gladys, app, fake } = await startApp(t);
  assert.deepEqual(fake.calls, [], 'no request before the timer');
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [GLOBAL, 'Météo spatiale (NOAA)'],
      [`${PREFIX}:aurora:h-besancon`, 'Aurores – Maison'],
      [TROMSO, 'Aurores – Chalet'],
    ],
    'the unlocated house gets no device',
  );
  await app.tick();
  assert.deepEqual(
    fake.calls.map((call) => call.product),
    ['kp1m', 'scales', 'wind', 'mag', 'flare', 'alerts', 'kp3h', 'forecast', 'flux'],
    'no OVATION without an Aurora device nor an aurora widget',
  );
  assert.ok(fake.calls.every((call) => call.userAgent === USER_AGENT && call.method === 'GET'));
  assert.deepEqual(gladys.fake.sceneEvents, [], 'the first readings are a baseline');
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.connectionStatus.message.fr, 'SWPC NOAA : Kp 2,33, G0 S0 R0.');
  assert.deepEqual(gladys.fake.states, [], 'no state for a device not created');
});

test('rhythm: the estimated Kp every minute with a 304, the others at their pace', async (t) => {
  const { app, fake, clock } = await startApp(t);
  await app.tick();
  const count = fake.calls.length;
  clock.now += 30 * 1000;
  await app.tick();
  assert.equal(fake.calls.length, count, 'nothing due after 30 s');
  clock.now += 30 * 1000;
  await app.tick();
  assert.deepEqual(
    fake.calls.slice(count).map((c) => [c.product, c.status]),
    [['kp1m', 304]],
  );
  clock.now = NOW + 5 * MINUTE;
  await app.tick();
  assert.deepEqual(
    fake.calls.slice(count + 1).map((c) => c.product),
    ['kp1m', 'scales', 'wind', 'mag', 'flare'],
  );
  clock.now = NOW + HOUR;
  await app.tick();
  const hour = fake.calls.filter((c) => c.status !== null && c.product);
  assert.equal(hour.filter((c) => c.product === 'forecast').length, 2);
  assert.equal(hour.filter((c) => c.product === 'flux').length, 1);
  assert.equal(
    hour.filter((c) => c.status === 304).length,
    hour.length - 9,
    'unchanged files cost a 304',
  );
  for (const product of Object.keys(PRODUCTS)) assert.ok(PRODUCTS[product].every >= MINUTE);
});

test('states: the global device once created, every value republished on creation', async (t) => {
  const { gladys, app } = await startApp(t);
  await app.tick();
  await create(gladys, GLOBAL);
  const state = (key) => gladys.fake.lastState(`${GLOBAL}:${key}`);
  assert.deepEqual(
    [
      'kp_estimated',
      'kp',
      'g_scale',
      's_scale',
      'r_scale',
      'solar_wind_speed',
      'bz',
      'bt',
      'radio_flux',
      'xray_class',
    ].map(state),
    [2.33, 2.67, 0, 0, 0, 420, 2, 6, 106, 'B5.4'],
  );
  const published = gladys.fake.states.length;
  await app.tick();
  assert.equal(gladys.fake.states.length, published, 'only the changes are published');
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.OVERVIEW));
});

test('aurora: the OVATION grid once an Aurora device exists; possible in the dark, then over', async (t) => {
  const { gladys, app, fake, clock } = await startApp(t);
  await app.tick();
  assert.equal(fake.of('ovation').length, 0);
  await create(gladys, TROMSO);
  assert.equal(app.ovationWanted(), true);
  await app.tick();
  assert.equal(fake.of('ovation').length, 1);
  assert.equal(gladys.fake.lastState(`${TROMSO}:probability`), 15);
  assert.equal(gladys.fake.lastState(`${TROMSO}:night`), 0, '15:05 UTC: still light at Tromsø');
  assert.deepEqual(events(gladys, TRIGGERS.AURORA_POSSIBLE), [], 'light sky, then the baseline');
  // 16:05 UTC: dark at Tromsø, the forecast of 14:53 still fresh.
  clock.now = NOW + HOUR;
  await app.tick();
  assert.equal(gladys.fake.lastState(`${TROMSO}:night`), 1);
  const [possible] = events(gladys, TRIGGERS.AURORA_POSSIBLE);
  assert.ok(possible);
  assertPayload(TRIGGERS.AURORA_POSSIBLE, possible.data);
  assert.equal(possible.data.device, TROMSO);
  assert.equal(possible.data.house, 'chalet');
  assert.equal(possible.data.probability, 15);
  assert.match(
    possible.data.sentence,
    /^Chalet : aurore possible, probabilité 15 % \(seuil 10 %\)/,
  );
  assert.equal(events(gladys, TRIGGERS.AURORA_POSSIBLE).length, 1);
  // A new grid: nothing over Tromsø any more.
  const grid = fixture('ovation');
  grid['Observation Time'] = new Date(NOW + 90 * MINUTE).toISOString().slice(0, 19) + 'Z';
  grid.coordinates.forEach((c) => (c[2] = 0));
  fake.set('ovation', grid);
  clock.now = NOW + 100 * MINUTE;
  await app.tick();
  const [ended] = events(gladys, TRIGGERS.AURORA_ENDED);
  assertPayload(TRIGGERS.AURORA_ENDED, ended.data);
  assert.deepEqual(
    [ended.data.reason, ended.data.max_probability, ended.data.probability],
    ['decreased', 15, 0],
  );
  assert.equal(events(gladys, TRIGGERS.AURORA_POSSIBLE).length, 1);
});

test('triggers: a storm, a flare, a new message, a storm in the forecast — once each', async (t) => {
  const { gladys, app, fake, clock } = await startApp(t);
  await app.tick();
  const scales = fixture('scales');
  scales['0'].G = { Scale: '3', Text: 'strong' };
  scales['0'].R = { Scale: '1', Text: 'minor', MinorProb: null, MajorProb: null };
  fake.set('scales', scales);
  fake.set('flare', [
    {
      ...fixture('flare')[0],
      time_tag: '2026-10-23T16:05:00Z',
      begin_time: '2026-10-23T15:02:00Z',
      max_time: '2026-10-23T15:06:00Z',
      max_class: 'M2.4',
      max_xrlong: 2.4e-5,
      end_time: null,
    },
  ]);
  const alerts = fixture('alerts');
  fake.set('alerts', [
    {
      product_id: 'K06A',
      issue_datetime: '2026-10-23 15:07:12.000',
      message:
        'Space Weather Message Code: ALTK06\r\nSerial Number: 999\r\nIssue Time: 2026 Oct 23 1507 UTC\r\n\r\nALERT: Geomagnetic K-index of 6\r\nThreshold Reached: 2026 Oct 23 1506 UTC\r\n',
    },
    ...alerts,
  ]);
  const forecast = fixture('forecast');
  forecast
    .filter((row) => row.time_tag.startsWith('2026-10-25T0'))
    .forEach((row) => (row.kp = 6.33));
  fake.set('forecast', forecast);
  clock.now = NOW + 61 * MINUTE;
  await app.tick();
  const keys = gladys.fake.sceneEvents.map((event) => event.key).sort();
  assert.deepEqual(keys, [
    'geomagnetic_storm',
    'radio_blackout',
    'solar_flare',
    'storm_forecast',
    'swpc_alert',
  ]);
  for (const event of gladys.fake.sceneEvents) assertPayload(event.key, event.data);
  const data = (key) => events(gladys, key)[0].data;
  assert.deepEqual(
    [data('geomagnetic_storm').level, data('geomagnetic_storm').previous_level],
    ['G3', 'G0'],
  );
  assert.equal(
    data('geomagnetic_storm').sentence,
    'Orage géomagnétique G3 (fort) en cours, Kp 2,67.',
  );
  assert.deepEqual(
    [
      data('solar_flare').class,
      data('solar_flare').class_letter,
      data('solar_flare').radio_blackout,
    ],
    ['M2.4', 'M', 'R1'],
  );
  assert.equal(data('solar_flare').peak_time, '17:06');
  assert.deepEqual(
    [data('swpc_alert').type, data('swpc_alert').topic, data('swpc_alert').title],
    ['alert', 'geomagnetic', 'Alerte : indice K de 6 atteint'],
  );
  assert.equal(data('storm_forecast').level, 'G2');
  assert.match(data('storm_forecast').start_time, /^dim\. 25 0[23]:00$/);
  clock.now += 5 * MINUTE;
  await app.tick();
  assert.equal(gladys.fake.sceneEvents.length, 5, 'never twice');
  // The storm ends 3 hours after the G scale is back at 0.
  fake.set('scales', fixture('scales'));
  for (const minutes of [10, 100, 190, 250]) {
    clock.now = NOW + 61 * MINUTE + minutes * MINUTE;
    await app.tick();
  }
  const ended = events(gladys, TRIGGERS.GEOMAGNETIC_STORM_ENDED);
  assert.equal(ended.length, 1);
  assertPayload(TRIGGERS.GEOMAGNETIC_STORM_ENDED, ended[0].data);
  assert.equal(ended[0].data.max_level, 'G3');
});

test('a restart neither bursts nor fires twice; the former Kp format reads the same', async (t) => {
  const dir = dataDir();
  const clock = { now: NOW };
  const first = await startApp(t, { dir, clock, legacy: true });
  await first.app.tick();
  assert.equal(first.app.spaceView().kp.kp, 2.67, 'the former table format');
  await first.gladys.fake.shutdown();
  clock.now = NOW + 2 * MINUTE;
  const second = await startApp(t, { dir, clock });
  await second.app.tick();
  assert.deepEqual(
    second.fake.calls.map((call) => call.product),
    ['kp1m'],
    'only what is due',
  );
  assert.deepEqual(second.gladys.fake.sceneEvents, []);
  assert.equal(second.app.spaceView().kp.kp, 2.67, 'kept in /data');
});

test('failures: the product waits longer each time, the status says it, a truncated file is refused', async (t) => {
  const { gladys, app, fake, clock } = await startApp(t);
  fake.fail('wind', 503);
  fake.truncate('alerts');
  await app.tick();
  assert.equal(app.spaceView().wind, null);
  assert.equal(app.spaceView().alertsRead, false);
  clock.now += 5 * MINUTE;
  await app.tick();
  assert.equal(fake.of('wind').length, 1, 'waits 10 minutes after one failure');
  clock.now += 6 * MINUTE;
  await app.tick();
  assert.equal(fake.of('wind').length, 2);
  assert.equal(gladys.fake.connectionStatus.connected, true, 'the other products answer');
  fake.offline = true;
  clock.now += 15 * MINUTE;
  await app.tick();
  clock.now += 2 * HOUR;
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /^The NOAA SWPC has not answered since/);
  fake.offline = false;
  fake.heal('wind');
  clock.now += 2 * HOUR;
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(fake.of('wind').at(-1).status, 200);
  assert.equal(app.store.data.products.wind.failures, 0);
  // The file of 14:53 is too old now to be "the solar wind now".
  assert.equal(app.spaceView().wind, null);
});

test('scene actions: only the declared outputs, from the cache, in the language of the configuration', async (t) => {
  const { gladys, app, fake } = await startApp(t);
  await app.tick();
  const before = fake.calls.length;
  const space = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_SPACE_WEATHER)).data.outputs;
  assert.deepEqual(Object.keys(space).sort(), [...SPACE_OUTPUTS].sort());
  assert.equal(
    space.summary,
    'Kp 2,33 (calme). Échelles NOAA : G0, S0, R0. Vent solaire 420 km/s, Bz +2 nT. Rayons X : classe B5.4. Dernière éruption B7.6 à 16:03.',
  );
  const forecast = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_FORECAST)).data.outputs;
  assert.deepEqual(Object.keys(forecast).sort(), [...FORECAST_OUTPUTS].sort());
  assert.deepEqual(
    [forecast.kp_max_today, forecast.kp_max_tomorrow, forecast.kp_max_day_after, forecast.g_max],
    [2.67, 2.67, 3.67, 'G0'],
  );
  assert.equal(forecast.radio_blackout_probability, 20);
  assert.equal(fake.calls.length, before, 'no request: the cache is fresh');
  // The aurora reads the OVATION grid when it has none.
  const aurora = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AURORA, { device: TROMSO })).data
    .outputs;
  assert.deepEqual(Object.keys(aurora).sort(), [...AURORA_OUTPUTS].sort());
  assert.equal(fake.of('ovation').length, 1);
  assert.deepEqual(
    [aurora.house_name, aurora.probability, aurora.dark, aurora.possible, aurora.dark_start],
    ['Chalet', 15, false, false, '17:35'],
  );
  assert.match(
    aurora.summary,
    /^Chalet : probabilité d’aurore 15 %\. Nuit noire à partir de 17:35\./,
  );
  const first = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AURORA, {})).data.outputs;
  assert.equal(first.house_name, 'Maison', 'the first located house');
  assert.equal(fake.of('ovation').length, 1, 'the grid is in memory');
  assert.deepEqual(gladys.fake.sceneEvents, [], 'never an event from a scene action');
});

test('scene actions without data or without a house: a clear error', async (t) => {
  const { gladys, fake } = await startApp(t, { houses: [] });
  fake.offline = true;
  const space = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_SPACE_WEATHER);
  assert.equal(space.success, false);
  assert.match(space.error ?? space.message ?? JSON.stringify(space), /SWPC/);
  const aurora = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_AURORA, {});
  assert.equal(aurora.success, false);
  assert.match(JSON.stringify(aurora), /Paramètres → Maisons/);
});

test('widgets: valid contents in every language, the aurora widget asks for the grid', async (t) => {
  const { gladys, app, fake } = await startApp(t);
  const waiting = (await gladys.fake.widgetGet(WIDGETS.OVERVIEW, { language: 'fr' })).data.content;
  assert.match(waiting.components[0].text, /En attente/);
  await app.tick();
  for (const language of LANGUAGES) {
    for (const key of Object.values(WIDGETS)) {
      const settings = key === WIDGETS.AURORA ? { device: TROMSO } : { days: '30' };
      const content = (await gladys.fake.widgetGet(key, { settings, language })).data.content;
      assert.deepEqual(validateWidgetContent(content), [], `${key} ${language}`);
    }
  }
  assert.equal(app.ovationWanted(), true, 'an aurora widget was shown');
  await app.tick();
  assert.equal(fake.of('ovation').length, 1);
  const aurora = (
    await gladys.fake.widgetGet(WIDGETS.AURORA, { settings: { device: TROMSO }, language: 'fr' })
  ).data.content;
  assert.deepEqual(validateWidgetContent(aurora), []);
  assert.equal(aurora.components.find((c) => c.type === 'gauge').value, 15);
  const overview = (await gladys.fake.widgetGet(WIDGETS.OVERVIEW, { language: 'en' })).data.content;
  assert.deepEqual(
    overview.components.map((c) => c.type),
    ['gauge', 'value', 'value', 'value', 'value', 'value', 'chart', 'status'],
  );
  const alerts = (
    await gladys.fake.widgetGet(WIDGETS.ALERTS, {
      settings: { types: ['watch'], days: '30' },
      language: 'de',
    })
  ).data.content;
  assert.ok(alerts.components[1].items.every((item) => item.badge.text === 'Vorwarnung'));
});

test('configuration: language, threshold, test and diagnostic buttons, a scan', async (t) => {
  const { gladys, app } = await startApp(t, { config: {} });
  assert.deepEqual(app.getConfig(), { language: 'auto', threshold: 10 });
  assert.equal(
    gladys.fake.discoveredDevices[0].name,
    'Météo spatiale (NOAA)',
    'auto: the timezone of Gladys',
  );
  await gladys.fake.configUpdated({ language: 'de', aurora_threshold: '30' });
  assert.deepEqual(app.getConfig(), { language: 'de', threshold: 30 });
  assert.equal(gladys.fake.discoveredDevices[0].name, 'Weltraumwetter (NOAA)');
  const result = await gladys.fake.action(ACTIONS.TEST_CONNECTION);
  assert.equal(result.success, true);
  assert.match(
    result.data.message.fr,
    /^SWPC de la NOAA joint : Kp 2,33 à 16:59, échelles NOAA G0 S0 R0\. Maisons localisées : Maison, Chalet\.$/,
  );
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.en, /NOAA diagnostic/);
  await gladys.fake.scanRequest();
  assert.equal(gladys.fake.discoveredDevices.length, 3);
});
