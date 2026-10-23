// The detectors of the scene triggers: one event per transition, never at
// the first reading, never twice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIGGERS,
  detectScale,
  detectFlare,
  detectAlerts,
  detectForecast,
  detectAurora,
  stormEpisodes,
  hysteresisOf,
} from '../src/events.js';
import { parseAlerts } from '../src/alerts.js';
import { fixture, NOW, HOUR, MINUTE } from './helpers/fake-swpc.js';

/**
 * @description Feed a detector a series of readings.
 * @param {Function} detect - `(state, reading) => { events, next }`.
 * @param {Array} readings - The readings.
 * @returns {Array<Array<object>>} The events of each reading.
 */
function run(detect, readings) {
  let state;
  return readings.map((reading) => {
    const { events, next } = detect(state, reading);
    state = next;
    return events;
  });
}

test('geomagnetic storm: rises once per new level, ends after 3 quiet hours', () => {
  const at = (h) => NOW + h * HOUR;
  const series = [
    [0, 0],
    [0, 1],
    [1, 1.5],
    [1, 2],
    [3, 2.5],
    [2, 3],
    [3, 3.5],
    [0, 4],
    [1, 5],
    [0, 6],
    [0, 8.9],
    [0, 9.1],
    [0, 12],
  ];
  const events = run(
    (state, [level, h]) => detectScale(state, { scale: 'g', level, now: at(h) }),
    series,
  );
  assert.deepEqual(events[0], [], 'the first reading is a baseline');
  assert.deepEqual(events[2], [
    { key: TRIGGERS.GEOMAGNETIC_STORM, scale: 'g', level: 1, previous: 0 },
  ]);
  assert.deepEqual(events[3], []);
  assert.deepEqual(events[4], [
    { key: TRIGGERS.GEOMAGNETIC_STORM, scale: 'g', level: 3, previous: 1 },
  ]);
  assert.deepEqual(
    [events[5], events[6], events[7], events[8]],
    [[], [], [], []],
    'no repeat inside the episode',
  );
  assert.deepEqual(events[10], [], 'only 2.9 h quiet');
  assert.deepEqual(events[11], [
    { key: TRIGGERS.GEOMAGNETIC_STORM_ENDED, scale: 'g', max: 3, start: at(1.5), end: at(6) },
  ]);
  assert.deepEqual(events[12], []);
  assert.deepEqual(detectScale(undefined, { scale: 'g', level: null, now: NOW }).events, []);
  // Started in a storm: no event for it, its level is the one to beat.
  const inStorm = run(
    (state, [level, h]) => detectScale(state, { scale: 'g', level, now: at(h) }),
    [
      [2, 0],
      [2, 1],
      [3, 2],
    ],
  );
  assert.deepEqual(
    inStorm.map((list) => list.map((e) => e.level)),
    [[], [], [3]],
  );
});

test('radiation and radio: rise events, a silent end after an hour', () => {
  const events = run(
    (state, [level, m]) => detectScale(state, { scale: 'r', level, now: NOW + m * MINUTE }),
    [
      [0, 0],
      [1, 5],
      [0, 10],
      [1, 30],
      [0, 40],
      [0, 101],
      [2, 110],
    ],
  );
  assert.equal(events[1][0].key, TRIGGERS.RADIO_BLACKOUT);
  assert.deepEqual([events[3], events[5]], [[], []], 'a dip of 20 minutes stays the same episode');
  assert.deepEqual(events[6], [
    { key: TRIGGERS.RADIO_BLACKOUT, scale: 'r', level: 2, previous: 0 },
  ]);
  assert.equal(
    detectScale({ initialized: true, max: 0 }, { scale: 's', level: 1, now: NOW }).events[0].key,
    TRIGGERS.RADIATION_STORM,
  );
});

test('flares: M then X of the same flare, never twice, never a B or C, never at startup', () => {
  const flare = (begin, max) => ({ begin, maxClass: { text: max, letter: max[0], flux: 1e-5 } });
  const t0 = NOW - 10 * MINUTE;
  const events = run(
    (state, f) => detectFlare(state, f, NOW),
    [
      flare(t0 - HOUR, 'M3.0'),
      flare(t0, 'C4.0'),
      flare(t0, 'M1.2'),
      flare(t0, 'M8.0'),
      flare(t0, 'X1.1'),
      flare(t0, 'X2.0'),
      flare(t0 + 5 * MINUTE, 'X1.0'),
    ],
  );
  assert.deepEqual(
    events.map((list) => list.map((e) => e.flare.maxClass.text)),
    [[], [], ['M1.2'], [], ['X1.1'], [], ['X1.0']],
  );
  // A flare that began 7 hours ago (a restart after a long stop) is only noted.
  assert.deepEqual(
    detectFlare({ initialized: true, begin: 0, letters: [] }, flare(NOW - 7 * HOUR, 'X5'), NOW)
      .events,
    [],
  );
});

test('SWPC messages: a baseline, then each new one once, the old ones only noted', () => {
  const messages = parseAlerts(fixture('alerts'));
  const first = detectAlerts(undefined, messages, NOW);
  assert.deepEqual(first.events, []);
  assert.equal(first.next.ids.length, 94);
  const fresh = { ...messages[0], id: 'new:1', issued: NOW - MINUTE };
  const old = { ...messages[0], id: 'new:2', issued: NOW - 3 * 24 * HOUR };
  const second = detectAlerts(first.next, [fresh, old, ...messages], NOW);
  assert.deepEqual(
    second.events.map((e) => e.message.id),
    ['new:1'],
  );
  assert.deepEqual(detectAlerts(second.next, [fresh, old, ...messages], NOW).events, []);
  const flood = Array.from({ length: 15 }, (_, i) => ({
    ...fresh,
    id: `f:${i}`,
    issued: NOW - i * 1000,
  }));
  assert.equal(detectAlerts(second.next, flood, NOW).events.length, 10, 'ten at most a round');
});

test('forecast: one event per predicted episode of Kp 5 or more, even when it moves', () => {
  const row = (h, kp) => ({ at: NOW + h * HOUR, kp, kind: 'predicted', scale: null });
  const quiet = [row(3, 3), row(6, 3)];
  const storm = [row(24, 4), row(27, 5.33), row(30, 6), row(33, 4)];
  assert.deepEqual(stormEpisodes(storm, NOW), [
    { start: NOW + 27 * HOUR, end: NOW + 33 * HOUR, maxKp: 6 },
  ]);
  let state = detectForecast(undefined, quiet, NOW).next;
  const first = detectForecast(state, storm, NOW);
  assert.deepEqual(
    first.events.map((e) => e.episode.maxKp),
    [6],
  );
  state = first.next;
  const moved = [row(24, 5), row(27, 5.67), row(30, 4)];
  assert.deepEqual(detectForecast(state, moved, NOW + HOUR).events, [], 'the same episode, moved');
  const later = [row(60, 7)];
  assert.equal(
    detectForecast(state, later, NOW).events.length,
    1,
    'another episode two days later',
  );
  assert.deepEqual(detectForecast(undefined, storm, NOW).events, [], 'never at the first forecast');
  assert.deepEqual(
    stormEpisodes([{ at: NOW, kp: 7, kind: 'observed' }], NOW),
    [],
    'only predictions',
  );
});

test('aurora: possible in a dark sky at the threshold, over at dawn or below the margin', () => {
  const reading = (probability, dark, m = 0) => ({
    probability,
    observation: NOW + m * MINUTE - 10 * MINUTE,
    dark,
    threshold: 10,
    now: NOW + m * MINUTE,
  });
  const events = run(detectAurora, [
    reading(3, true),
    reading(12, false, 20),
    reading(12, true, 40),
    reading(30, true, 60),
    reading(9, true, 80),
    reading(7, true, 100),
    reading(15, true, 120),
    reading(15, false, 140),
  ]);
  assert.deepEqual(
    events.map((list) => list.map((e) => e.key + (e.reason ? `:${e.reason}` : ''))),
    [
      [],
      [],
      ['aurora_possible'],
      [],
      [],
      ['aurora_ended:decreased'],
      ['aurora_possible'],
      ['aurora_ended:dawn'],
    ],
  );
  assert.equal(events[5][0].max, 30);
  assert.equal(hysteresisOf(10), 2);
  assert.equal(hysteresisOf(50), 10);
  // Already possible at startup: no event, and no end either.
  const start = run(detectAurora, [reading(40, true), reading(40, false, 20)]);
  assert.deepEqual(start, [[], []]);
  // A stale forecast (over 90 minutes) never starts anything.
  const stale = detectAurora(
    { initialized: true, active: false },
    { ...reading(40, true), observation: NOW - 2 * HOUR },
  );
  assert.deepEqual(stale.events, []);
});
