// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): should_poll with poll_frequency, min /
// max / read_only / has_feedback on every feature, category / type / unit
// triples the core knows (DEVICE_FEATURE_UNITS_BY_CATEGORY of
// server/utils/constants.js, read on v5.1.0 and upstream/master on
// 2026-10-23: no unit at all for `unknown`, `risk` and `text`), a single
// invalid field rejecting the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
} from '@gladysassistant/integration-sdk';
import {
  GLOBAL_FEATURES,
  AURORA_FEATURES,
  globalIds,
  auroraIds,
  houseOfExternalId,
  buildGlobalDevice,
  buildAuroraDevice,
  buildGlobalStates,
  buildAuroraStates,
} from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';

const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:noaa-space-weather:${type}:${id}`,
    feature: (key) => `ext:noaa-space-weather:${type}:${id}:${key}`,
  }),
};
const HOUSE = { id: '6f1c2d3e-0000-4000-8000-000000000001', name: 'Maison', selector: 'maison' };
// The categories the core gives no unit (absent from DEVICE_FEATURE_UNITS_BY_CATEGORY).
const NO_UNIT = [C.UNKNOWN, C.RISK, C.TEXT];
const PAIRS = {
  kp_estimated: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  kp: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  g_scale: [C.RISK, T.RISK.INTEGER],
  s_scale: [C.RISK, T.RISK.INTEGER],
  r_scale: [C.RISK, T.RISK.INTEGER],
  solar_wind_speed: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  bz: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  bt: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  radio_flux: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  xray_class: [C.TEXT, T.TEXT.TEXT],
  probability: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  night: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
  kp_tonight: [C.UNKNOWN, T.UNKNOWN.UNKNOWN],
};
const devices = (language) => [
  buildGlobalDevice(fakeGladys, language),
  buildAuroraDevice(fakeGladys, HOUSE, language),
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature: min, max, read_only, has_feedback, a unique name, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        assert.equal(typeof feature.min, 'number', feature.external_id);
        assert.equal(typeof feature.max, 'number', feature.external_id);
        assert.ok(feature.min <= feature.max);
        assert.equal(feature.read_only, true);
        assert.equal(feature.has_feedback, false);
        assert.ok(feature.name.length <= 50);
      }
      assert.equal(new Set(device.features.map((f) => f.name)).size, device.features.length);
      // Several features share each type: the dashboard shows their names.
      for (const feature of device.features.filter((f) => f.category !== C.TEXT)) {
        assert.ok(
          device.features.filter((other) => other.type === feature.type).length > 1,
          feature.external_id,
        );
      }
    }
  }
});

test('category / type pairs of the SDK, and no unit: Gladys has none of km/s, nT, sfu, Kp', () => {
  for (const device of devices('en')) {
    for (const feature of device.features) {
      const key = feature.external_id.split(':').pop();
      assert.deepEqual([feature.category, feature.type], PAIRS[key], key);
      assert.equal(feature.unit, undefined, key);
      assert.ok(NO_UNIT.includes(feature.category), key);
    }
  }
  assert.deepEqual(
    devices('en').flatMap((d) => d.features.map((f) => f.external_id.split(':').pop())),
    Object.keys(PAIRS),
  );
});

test('names and ids: the global device and one per house, by its id', () => {
  const [global, aurora] = devices('fr');
  assert.equal(global.name, 'Météo spatiale (NOAA)');
  assert.equal(global.external_id, 'ext:noaa-space-weather:space-weather:global');
  assert.equal(aurora.name, 'Aurores – Maison');
  assert.equal(aurora.external_id, `ext:noaa-space-weather:aurora:${HOUSE.id}`);
  assert.equal(houseOfExternalId(`${aurora.external_id}:probability`), HOUSE.id);
  assert.equal(houseOfExternalId(aurora.external_id), HOUSE.id);
  assert.equal(houseOfExternalId(global.external_id), null);
  assert.equal(
    globalIds(fakeGladys).feature('kp'),
    'ext:noaa-space-weather:space-weather:global:kp',
  );
  assert.equal(auroraIds(fakeGladys, 'x').device, 'ext:noaa-space-weather:aurora:x');
});

test('states: rounded and bounded, a text for the X-ray class, an unknown value left untouched', () => {
  const states = buildGlobalStates(fakeGladys, {
    kp_estimated: 2.3333,
    g_scale: 0,
    solar_wind_speed: 420.4,
    bz: -250,
    xray_class: 'B5.4',
    kp: null,
  });
  assert.deepEqual(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    [
      ['kp_estimated', 2.33],
      ['g_scale', 0],
      ['solar_wind_speed', 420],
      ['bz', -150],
      ['xray_class', 'B5.4'],
    ],
  );
  assert.deepEqual(
    buildAuroraStates(fakeGladys, 'h', { probability: 12, night: 1, kp_tonight: null }).length,
    2,
  );
  assert.equal(GLOBAL_FEATURES.length + AURORA_FEATURES.length, 13);
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices([
      buildGlobalDevice(gladys, language),
      buildAuroraDevice(gladys, HOUSE, language),
    ]);
  }
  for (const device of gladys.fake.discoveredDevices) await gladys.fake.deviceCreated(device);
  await gladys.publishStates([
    ...buildGlobalStates(gladys, { kp: 3, xray_class: 'M1.0', bz: -4.2 }),
    ...buildAuroraStates(gladys, HOUSE.id, { probability: 20, night: 1, kp_tonight: 5.33 }),
  ]);
  assert.equal(gladys.fake.lastState(globalIds(gladys).feature('bz')), -4.2);
  assert.equal(gladys.fake.lastState(auroraIds(gladys, HOUSE.id).feature('kp_tonight')), 5.33);
});
