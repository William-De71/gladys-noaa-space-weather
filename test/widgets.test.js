// The widget contents, in every state and every language, through the
// validator of the SDK (the rules of normalizeWidgetContent of the core).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  buildOverviewWidget,
  buildAuroraWidget,
  buildAlertsWidget,
  messageContent,
  clip,
} from '../src/widgets.js';
import { parseForecast, parseScales, parseFlare } from '../src/parse.js';
import { parseAlerts } from '../src/alerts.js';
import { darkness } from '../src/sun.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture, NOW, TZ, MINUTE, HOUR } from './helpers/fake-swpc.js';

const flare = parseFlare(fixture('flare'));
const VIEW = {
  now: NOW,
  kpEstimated: { at: NOW - 6 * MINUTE, kp: 2.33 },
  kp: { at: NOW - 3 * HOUR, kp: 2.67 },
  scales: parseScales(fixture('scales')),
  wind: { at: NOW - 12 * MINUTE, speed: 420 },
  mag: { at: NOW - 12 * MINUTE, bt: 6, bz: -7.4 },
  flux: { at: NOW - 19 * HOUR, flux: 106 },
  xray: flare.current,
  flare,
  forecast: parseForecast(fixture('forecast')),
  alerts: parseAlerts(fixture('alerts')).slice(0, 30),
  alertsRead: true,
  updatedAt: NOW - MINUTE,
};
const STORM = {
  ...VIEW,
  kpEstimated: { at: NOW, kp: 7.33 },
  scales: { ...VIEW.scales, now: { g: 3, s: 1, r: 2 } },
  xray: { text: 'X1.2', letter: 'X', flux: 1.2e-4 },
  forecast: VIEW.forecast.map((row) => (row.kind === 'predicted' ? { ...row, kp: 6.67 } : row)),
};
const HOUSE = { id: 'h', name: 'Chalet de montagne', latitude: 69.65, longitude: 18.96 };
const aurora = (overrides = {}) => ({
  house: HOUSE,
  probability: 15,
  observation: NOW - 12 * MINUTE,
  fresh: true,
  darkness: darkness(NOW + HOUR, HOUSE),
  kpTonight: 3.67,
  threshold: 10,
  history: Array.from({ length: 30 }, (_, i) => ({
    t: NOW - (29 - i) * 20 * MINUTE,
    v: (i * 7) % 20,
  })),
  ...overrides,
});

/**
 * @description Assert a content: no violation, within the budget.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (types) => content.components.filter((c) => types.includes(c.type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
}

test('overview: calm and stormy, full and partial, in every language', () => {
  for (const language of LANGUAGES) {
    for (const [name, view] of Object.entries({
      calm: VIEW,
      storm: STORM,
      noWind: { ...VIEW, wind: null, mag: null },
      noForecast: { ...VIEW, forecast: [], alerts: [] },
      empty: { ...VIEW, kpEstimated: null, kp: null, scales: null, wind: null },
    })) {
      assertValid(buildOverviewWidget({ view, language, timeZone: TZ }), `${name} ${language}`);
    }
  }
  const storm = buildOverviewWidget({ view: STORM, language: 'fr', timeZone: TZ });
  const gauge = storm.components.find((c) => c.type === 'gauge');
  assert.deepEqual([gauge.value, gauge.color, gauge.min, gauge.max], [7.33, 'danger', 0, 9]);
  assert.deepEqual(
    storm.components
      .filter((c) => ['globe', 'sun', 'radio'].includes(c.icon))
      .map((c) => [c.value, c.color]),
    [
      ['G3', 'danger'],
      ['S1', 'warning'],
      ['R2', 'warning'],
    ],
  );
  const chart = storm.components.find((c) => c.type === 'chart');
  assert.equal(chart.annotations[0].label, 'G2 prévu');
  assert.equal(chart.series.length, 2);
  assert.equal(chart.now_marker, true);
  const calm = buildOverviewWidget({ view: VIEW, language: 'fr', timeZone: TZ });
  assert.equal(calm.components[0].type, 'gauge');
  assert.equal(calm.components.find((c) => c.icon === 'compass').color, 'warning', 'Bz -7.4 nT');
  assert.match(
    buildOverviewWidget({
      view: { ...VIEW, kpEstimated: null, kp: null, scales: null, wind: null },
      language: 'en',
    }).components[0].text,
    /Waiting/,
  );
});

test('aurora: dark or light, fresh or not, with or without a history', () => {
  for (const language of LANGUAGES) {
    for (const [name, value] of Object.entries({
      full: aurora(),
      light: aurora({ darkness: darkness(NOW, HOUSE) }),
      polar: aurora({ darkness: { dark: true, start: null, end: null } }),
      stale: aurora({ fresh: false }),
      noHistory: aurora({ history: [] }),
      waiting: aurora({ observation: null }),
    })) {
      assertValid(
        buildAuroraWidget({ aurora: value, language, now: NOW, timeZone: TZ }),
        `${name} ${language}`,
      );
    }
  }
  const full = buildAuroraWidget({ aurora: aurora(), language: 'fr', now: NOW, timeZone: TZ });
  assert.equal(full.components.find((c) => c.type === 'gauge').color, 'success');
  assert.match(full.components[0].text, /^Chalet de montagne · OVATION 16:53$/);
});

test('alerts: a card per message, a badge per kind, the filters of the settings', () => {
  for (const language of LANGUAGES) {
    for (const settings of [
      {},
      { days: '30' },
      { types: ['summary'], days: '30' },
      { days: '1' },
    ]) {
      assertValid(
        buildAlertsWidget({ alerts: VIEW.alerts, language, now: NOW, settings }),
        `${language} ${JSON.stringify(settings)}`,
      );
    }
  }
  const all = buildAlertsWidget({
    alerts: VIEW.alerts,
    language: 'fr',
    now: NOW,
    settings: { days: '30' },
  });
  const list = all.components[1];
  assert.equal(list.type, 'card-list');
  assert.equal(list.items.length, 8);
  assert.equal(list.items[0].title, 'Alerte : électrons 2 MeV au-delà de 1000 pfu');
  assert.equal(list.items[0].badge.text, 'Alerte');
  assert.match(list.items[0].description, /^Space Weather Message Code: ALTEF3/);
  const none = buildAlertsWidget({
    alerts: VIEW.alerts,
    language: 'en',
    now: NOW + 40 * 24 * HOUR,
    settings: {},
  });
  assert.match(none.components[0].text, /No message from the SWPC in the last 7 days/);
});

test('helpers', () => {
  assert.equal(clip('abcdef', 4), 'abc…');
  assertValid(messageContent('x'.repeat(400), { heading: 'h'.repeat(50) }), 'message');
});
