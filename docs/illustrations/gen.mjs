// Widget contents for the generated illustrations, built by the real code of
// the integration: the app itself (src/app.js) wired to the fake Gladys of the
// SDK and the fake SWPC of the tests (a real local HTTP server), on the real
// files of 23 October 2026, made livelier on purpose: a G2 storm in progress,
// an M3.4 flare, a new K-index alert, a G1 storm in the forecast, and an
// aurora over a house at Tromsø (Norway) at 15:45 UTC, when it is dark there.
// The aurora history of the last 24 hours is drawn from a fixed seed. Never
// real data presented as such. Written as JSON for render.js:
//   node gen.mjs <repo> <out.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(join(repo, file)).href);
const { createApp } = await load('src/app.js');
const { LANGUAGES } = await load('src/i18n.js');
const { createFakeGladys } = await import(
  pathToFileURL(join(repo, 'node_modules/@gladysassistant/integration-sdk/lib/testing.js')).href
);
const { startFakeSwpc, dataDir, fixture, silent, NOW } = await load('test/helpers/fake-swpc.js');

const manifest = JSON.parse(readFileSync(join(repo, 'gladys-assistant-integration.json'), 'utf8'));
const WIDGET_KEYS = ['overview', 'aurora', 'alerts'];
const MINUTE = 60 * 1000;
const AT = NOW + 40 * MINUTE; // 15:45 UTC
const iso = (instant) => new Date(instant).toISOString().slice(0, 19);
const HOUSES = [
  { id: 'chalet', name: 'Chalet', selector: 'chalet', latitude: 69.65, longitude: 18.96 },
];

/**
 * @description A pseudo-random generator with a seed (mulberry32).
 * @param {number} seed - The seed.
 * @returns {Function} `() => number` in [0, 1).
 */
function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @description The fake SWPC of a lively afternoon.
 * @returns {Promise<object>} The fake.
 */
async function liveSwpc() {
  const fake = await startFakeSwpc();
  fake.set('kp1m', [
    { time_tag: iso(AT - 10 * MINUTE), kp_index: 6, estimated_kp: 6.0, kp: '6Z' },
    { time_tag: iso(AT - 5 * MINUTE), kp_index: 6, estimated_kp: 6.33, kp: '6P' },
  ]);
  const scales = fixture('scales');
  scales['0'].G = { Scale: '2', Text: 'moderate' };
  scales['0'].R = { Scale: '1', Text: 'minor', MinorProb: null, MajorProb: null };
  scales['1'].G = { Scale: '2', Text: 'moderate' };
  fake.set('scales', scales);
  fake.set('wind', [{ proton_speed: 612, time_tag: `${iso(AT - 7 * MINUTE)}Z` }]);
  fake.set('mag', [{ bt: 14, bz_gsm: -11, time_tag: `${iso(AT - 7 * MINUTE)}Z` }]);
  fake.set('flare', [
    {
      ...fixture('flare')[0],
      time_tag: `${iso(AT - 4 * MINUTE)}Z`,
      current_class: 'M1.1',
      begin_time: `${iso(AT - 30 * MINUTE)}Z`,
      max_time: `${iso(AT - 18 * MINUTE)}Z`,
      max_class: 'M3.4',
      max_xrlong: 3.4e-5,
      end_time: null,
    },
  ]);
  fake.set('alerts', [
    {
      product_id: 'K06A',
      issue_datetime: `${iso(AT - 12 * MINUTE).replace('T', ' ')}.000`,
      message:
        'Space Weather Message Code: ALTK06\r\nSerial Number: 2155\r\nIssue Time: 2026 Oct 23 1533 UTC\r\n\r\nALERT: Geomagnetic K-index of 6\r\nThreshold Reached: 2026 Oct 23 1530 UTC\r\nSynoptic Period: 1500-1800 UTC\r\n',
    },
    ...fixture('alerts'),
  ]);
  const forecast = fixture('forecast');
  for (const row of forecast) {
    if (row.time_tag === '2026-10-23T15:00:00')
      Object.assign(row, { kp: 6.33, observed: 'estimated' });
    if (['2026-10-23T18:00:00', '2026-10-23T21:00:00'].includes(row.time_tag)) row.kp = 5.67;
    if (row.time_tag.startsWith('2026-10-25T0')) row.kp = 5.33;
  }
  fake.set('forecast', forecast);
  // A brighter oval over northern Norway.
  const grid = fixture('ovation');
  for (const cell of grid.coordinates) {
    if (cell[1] >= 66 && cell[1] <= 72 && (cell[0] >= 10 || cell[0] <= 30))
      cell[2] = Math.min(100, cell[2] + 18);
  }
  fake.set('ovation', grid);
  return fake;
}

/**
 * @description One language: the three widgets.
 * @param {string} language - Language.
 * @returns {Promise<object>} The widget contents.
 */
async function contents(language) {
  const clock = { now: AT };
  const fake = await liveSwpc();
  const gladys = createFakeGladys({ config: { language, aurora_threshold: '20' }, houses: HOUSES });
  const app = createApp(gladys, {
    baseUrl: fake.url,
    dataDir: dataDir(),
    now: () => clock.now,
    timeZone: 'Europe/Paris',
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(structuredClone(device));
  }
  await app.tick();
  // The last 24 hours at the house, every 20 minutes, from a fixed seed.
  const next = random(23102026);
  const record = app.store.data.auroras.chalet;
  const history = [];
  for (let step = 71; step >= 1; step -= 1) {
    const t = record.observation - step * 20 * MINUTE;
    const hours = (t % (24 * 60 * MINUTE)) / (60 * MINUTE);
    const night = hours >= 13.5 || hours <= 5;
    history.push({ t, v: Math.round((night ? 14 : 3) + next() * (night ? 18 : 4)) });
  }
  record.history = [...history, ...record.history];
  const settings = {
    aurora: { device: 'ext:test-integration:aurora:chalet' },
    alerts: { days: '3' },
  };
  const result = {};
  for (const key of WIDGET_KEYS) {
    result[key] = (
      await gladys.fake.widgetGet(key, { settings: settings[key] ?? {}, language })
    ).data.content;
  }
  await gladys.fake.shutdown();
  await fake.close();
  return result;
}

const all = {};
for (const language of LANGUAGES) {
  all[language] = await contents(language);
}

const card = (key) => {
  const widget = manifest.widgets.find((item) => item.key === key);
  return { icon: widget.icon, label: widget.label };
};
writeFileSync(
  out,
  JSON.stringify({
    now: AT,
    contents: all,
    images: {},
    cards: Object.fromEntries(WIDGET_KEYS.map((key) => [key, card(key)])),
  }),
);
