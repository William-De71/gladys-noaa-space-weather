import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { TRIGGERS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS, ALERT_DAYS, DEFAULT_ALERT_DAYS } from '../src/widgets.js';
import { SCENE_ACTIONS, SPACE_OUTPUTS, AURORA_OUTPUTS, FORECAST_OUTPUTS } from '../src/summary.js';
import { KINDS, TOPICS } from '../src/alerts.js';
import { AUTO_LANGUAGE, THRESHOLDS, DEFAULT_THRESHOLD } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const REPO = 'William-De71/gladys-noaa-space-weather';

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'NOAA Space Weather');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\./);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/william-de71/gladys-noaa-space-weather:${pkg.version}`,
  );
  assert.equal(manifest.cover_image, `https://raw.githubusercontent.com/${REPO}/main/cover.jpg`);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-noaa-space-weather');
});

test('declares the cloud transport: services.swpc.noaa.gov only, no key', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.match(source('../src/swpc-api.js'), /https:\/\/services\.swpc\.noaa\.gov/);
  for (const file of [
    'app',
    'parse',
    'alerts',
    'ovation',
    'events',
    'summary',
    'widgets',
    'device',
    'store',
    'sun',
    'time',
    'config',
  ]) {
    assert.doesNotMatch(
      source(`../src/${file}.js`),
      /fetch\(|node:https?|node:net|node:dgram/,
      file,
    );
  }
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.ok(
    !manifest.config_schema.some((field) =>
      ['secret', 'oauth2', 'account_link'].includes(field.type),
    ),
  );
});

test('Gladys 5.1.0: widgets and scenes; the houses read with `location`, chosen through their devices', () => {
  assert.equal(manifest.gladys_version, '>=5.1.0');
  assert.deepEqual(manifest.categories, ['environment']);
  assert.equal(manifest.location, true, 'getHouses() for the Aurora devices');
  assert.match(source('../src/app.js'), /gladys\.getHouses\(\)/);
  assert.doesNotMatch(JSON.stringify(manifest), /"source":"houses"/, 'houses need 5.2.0');
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks', 'messaging']) {
    assert.equal(manifest[key], undefined, key);
  }
  for (const widget of manifest.widgets)
    assert.equal(widget.action_timeout_seconds, undefined, 'no button');
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  const app = source('../src/app.js');
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key),
    Object.values(TRIGGERS),
  );
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key),
    Object.values(SCENE_ACTIONS),
  );
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    Object.values(WIDGETS),
  );
  for (const key of Object.keys(WIDGETS))
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  for (const key of Object.keys(SCENE_ACTIONS))
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  assert.deepEqual(
    manifest.actions.map((a) => a.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS))
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  assert.doesNotMatch(app, /onWidgetAction/);
  const outputs = (key) =>
    byKey(manifest.scene_actions)
      .get(key)
      .outputs.map((o) => o.key);
  assert.deepEqual(outputs('get_space_weather'), SPACE_OUTPUTS);
  assert.deepEqual(outputs('get_aurora'), AURORA_OUTPUTS);
  assert.deepEqual(outputs('get_forecast'), FORECAST_OUTPUTS);
});

test('the option values of the fields mirror the code', () => {
  const triggers = byKey(manifest.scene_triggers);
  const field = (trigger, key) => byKey(triggers.get(trigger).fields).get(key);
  assert.deepEqual(values(field('geomagnetic_storm', 'level')), ['G1', 'G2', 'G3', 'G4', 'G5']);
  assert.deepEqual(values(field('radiation_storm', 'level')), ['S1', 'S2', 'S3', 'S4', 'S5']);
  assert.deepEqual(values(field('radio_blackout', 'level')), ['R1', 'R2', 'R3', 'R4', 'R5']);
  assert.deepEqual(values(field('solar_flare', 'class_letter')), ['M', 'X']);
  assert.deepEqual(values(field('swpc_alert', 'type')), KINDS);
  assert.deepEqual(values(field('swpc_alert', 'topic')), TOPICS);
  for (const key of ['aurora_possible', 'aurora_ended']) {
    assert.equal(field(key, 'device').source, 'devices');
  }
  const alerts = byKey(byKey(manifest.widgets).get('alerts').settings);
  assert.deepEqual(values(alerts.get('types')), KINDS);
  assert.deepEqual(values(alerts.get('days')), ALERT_DAYS);
  assert.equal(alerts.get('days').default, DEFAULT_ALERT_DAYS);
  const config = byKey(manifest.config_schema);
  assert.deepEqual(values(config.get('aurora_threshold')), THRESHOLDS);
  assert.equal(config.get('aurora_threshold').default, DEFAULT_THRESHOLD);
  assert.deepEqual(values(config.get('language')), [AUTO_LANGUAGE, ...LANGUAGES]);
  // Every trigger field is a key of the event data (the core compares them).
  for (const trigger of manifest.scene_triggers) {
    for (const f of trigger.fields ?? []) {
      assert.ok(['level', 'class_letter', 'device', 'type', 'topic'].includes(f.key));
      assert.ok(
        trigger.variables.some((v) => v.key === f.key),
        `${trigger.key}.${f.key} is also a variable`,
      );
      assert.ok(!('default' in f));
    }
  }
});

test('limits of the store: counts, timeouts, sizes', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20 && manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.fields.length <= 10 && action.outputs.length <= 20, action.key);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8);
});
