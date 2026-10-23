// The readers of the SWPC products, on the real files of 2026-10-23
// (test/fixtures/swpc/) and on the former table format of the SWPC.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  num,
  rowsOf,
  parseKp3h,
  parseKp1m,
  parseForecast,
  parseScales,
  parseWind,
  parseMag,
  parseFlux,
  parseFlare,
  xrayClass,
} from '../src/parse.js';
import { readUtc } from '../src/time.js';
import { fixture, legacyKp } from './helpers/fake-swpc.js';

test('numbers and rows: both formats of the SWPC', () => {
  assert.deepEqual(
    [num(2.33), num('2.33'), num(''), num('null'), num(null), num('x')],
    [2.33, 2.33, null, null, null, null],
  );
  assert.deepEqual(
    rowsOf([
      ['time_tag', 'Kp'],
      ['2026-10-16 00:00:00.000', '3.33'],
    ]),
    [{ time_tag: '2026-10-16 00:00:00.000', Kp: '3.33' }],
  );
  assert.deepEqual(rowsOf([{ a: 1 }, null, [1]]), [{ a: 1 }]);
  assert.deepEqual(rowsOf({}), []);
});

test('times: UTC with or without the zone', () => {
  const expected = Date.parse('2026-10-23T11:47:50.950Z');
  assert.equal(readUtc('2026-10-23 11:47:50.950'), expected);
  assert.equal(readUtc('2026-10-23T15:01:00'), Date.parse('2026-10-23T15:01:00Z'));
  assert.equal(readUtc('2026-10-23T15:01:00Z'), Date.parse('2026-10-23T15:01:00Z'));
  assert.equal(readUtc('yesterday'), null);
});

test('3-hour Kp: the new objects and the former table give the same values', () => {
  const rows = parseKp3h(fixture('kp3h'));
  assert.equal(rows.length, 61);
  assert.deepEqual(rows.at(-1), { at: Date.parse('2026-10-23T12:00:00Z'), kp: 2.67 });
  assert.deepEqual(parseKp3h(legacyKp(fixture('kp3h'))), rows);
  assert.deepEqual(parseKp3h([{ time_tag: '2026-10-23T12:00:00', Kp: 12 }]), [], 'out of range');
});

test('estimated Kp: the settling minutes of a new 3-hour period are skipped', () => {
  // The real file ends at 15:01 with 0.00 ("0Z"): the period restarted at 15:00.
  assert.deepEqual(parseKp1m(fixture('kp1m')), {
    at: Date.parse('2026-10-23T14:59:00Z'),
    kp: 2.33,
  });
  const rows = (minutes) =>
    minutes.map((m) => ({
      time_tag: new Date(Date.parse('2026-10-23T15:00:00Z') + m * 60000).toISOString().slice(0, 19),
      estimated_kp: m < 0 ? 3 : m < 10 ? 0 : 3.67,
    }));
  assert.equal(parseKp1m(rows([-2, -1, 0, 5])).kp, 3);
  assert.deepEqual(parseKp1m(rows([-1, 0, 20])), {
    at: Date.parse('2026-10-23T15:20:00Z'),
    kp: 3.67,
  });
  assert.equal(parseKp1m([]), null);
});

test('forecast: observed, estimated and predicted periods', () => {
  const rows = parseForecast(fixture('forecast'));
  assert.equal(rows.length, 81);
  assert.equal(rows.filter((row) => row.kind === 'predicted').length, 17);
  assert.deepEqual(rows.at(-1), {
    at: Date.parse('2026-10-26T00:00:00Z'),
    kp: 2.33,
    kind: 'predicted',
    scale: null,
  });
  const legacy = parseForecast([
    ['time_tag', 'kp', 'observed', 'noaa_scale'],
    ['2026-10-25 00:00:00', '5.33', 'predicted', 'G1'],
  ]);
  assert.deepEqual(legacy, [
    { at: Date.parse('2026-10-25T00:00:00Z'), kp: 5.33, kind: 'predicted', scale: 'G1' },
  ]);
});

test('NOAA scales: now and the next days, probabilities as numbers', () => {
  const scales = parseScales(fixture('scales'));
  assert.deepEqual(scales.now, { at: Date.parse('2026-10-23T15:04:00Z'), g: 0, s: 0, r: 0 });
  assert.deepEqual(scales.days[0], { date: '2026-10-23', g: 0, rMinor: 20, rMajor: 5, s: 5 });
  assert.equal(scales.days.length, 3);
  assert.equal(parseScales([]), null);
  assert.equal(parseScales({ 0: { G: { Scale: null } } }), null);
});

test('summaries: solar wind, magnetic field, radio flux; the former object format too', () => {
  assert.deepEqual(parseWind(fixture('wind')), {
    at: Date.parse('2026-10-23T14:53:00Z'),
    speed: 420,
  });
  assert.deepEqual(parseMag(fixture('mag')), {
    at: Date.parse('2026-10-23T14:53:00Z'),
    bt: 6,
    bz: 2,
  });
  assert.deepEqual(parseFlux(fixture('flux')), {
    at: Date.parse('2026-10-22T20:00:00Z'),
    flux: 106,
  });
  assert.equal(parseWind({ WindSpeed: '512', TimeStamp: '2026-10-23 14:53:00.000' }).speed, 512);
  assert.equal(parseMag({ Bt: '7', Bz: '-3' }).bz, -3);
  assert.equal(parseWind([{ proton_speed: null }]), null);
  assert.equal(parseFlux({}), null);
});

test('flares: classes, the current level and the last flare', () => {
  assert.deepEqual(xrayClass('M2.5'), { text: 'M2.5', letter: 'M', flux: 2.5e-5 });
  assert.equal(xrayClass('X10').flux, 1e-3);
  assert.equal(xrayClass('Z1'), null);
  const flare = parseFlare(fixture('flare'));
  assert.equal(flare.current.text, 'B5.4');
  assert.equal(flare.maxClass.text, 'B7.6');
  assert.equal(flare.begin, Date.parse('2026-10-23T14:01:00Z'));
  assert.equal(flare.max, Date.parse('2026-10-23T14:03:00Z'));
  assert.equal(parseFlare([]), null);
});
