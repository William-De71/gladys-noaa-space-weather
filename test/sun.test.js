import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solarElevation, isDark, darkness } from '../src/sun.js';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };

test('elevation of the sun: the NOAA calculator values', () => {
  // Greenwich, 21 June 2026 at 12:00 UTC: about 62°.
  assert.ok(Math.abs(solarElevation(Date.parse('2026-06-21T12:00:00Z'), 51.48, 0) - 62) < 0.6);
  // Paris at midnight in winter: far below.
  assert.ok(
    solarElevation(Date.parse('2026-12-21T23:00:00Z'), PARIS.latitude, PARIS.longitude) < -60,
  );
});

test('dark sky: the sun 6° below the horizon, not the sunset', () => {
  // Paris, 23-24 October 2026: sunset about 16:50 UTC, civil dusk about 17:22 UTC, civil dawn about 05:52 UTC.
  assert.equal(isDark(Date.parse('2026-10-23T17:00:00Z'), PARIS), false);
  assert.equal(isDark(Date.parse('2026-10-23T17:40:00Z'), PARIS), true);
  const window = darkness(Date.parse('2026-10-23T15:00:00Z'), PARIS);
  assert.equal(window.dark, false);
  const start = new Date(window.start).toISOString();
  const end = new Date(window.end).toISOString();
  assert.ok(start >= '2026-10-23T17:15' && start <= '2026-10-23T17:35', start);
  assert.ok(end >= '2026-10-24T05:45' && end <= '2026-10-24T06:05', end);
  const inside = darkness(Date.parse('2026-10-23T22:00:00Z'), PARIS);
  assert.equal(inside.dark, true);
  assert.equal(inside.start, window.start);
  assert.equal(isDark(0, {}), null);
  assert.equal(darkness(0, { latitude: null }), null);
});

test('polar night and polar day: windows without an end or a start', () => {
  const tromso = { latitude: 69.65, longitude: 18.96 };
  // 21 December at midnight: a dark sky (at noon, only a civil twilight).
  const winter = darkness(Date.parse('2026-12-21T00:00:00Z'), tromso);
  assert.equal(winter.dark, true);
  const summer = darkness(Date.parse('2026-06-21T00:00:00Z'), tromso);
  assert.deepEqual(summer, { dark: false, start: null, end: null });
});
