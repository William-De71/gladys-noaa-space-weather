import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOvation, probabilityAt, gridLongitude, cellOf } from '../src/ovation.js';
import { fixture } from './helpers/fake-swpc.js';

const real = parseOvation(fixture('ovation'));

test('the real OVATION file: 65,160 cells, its times', () => {
  assert.equal(real.observation, Date.parse('2026-10-23T14:53:00Z'));
  assert.equal(real.forecast, Date.parse('2026-10-23T15:58:00Z'));
  assert.equal(real.max, 29);
  assert.equal(real.grid.length, 360 * 181);
  assert.ok(!real.grid.includes(255), 'every cell has a value');
});

test('houses on the real grid: nothing at Besançon, something at Tromsø and Fairbanks', () => {
  assert.equal(probabilityAt(real.grid, 47.24, 6.02), 0);
  assert.equal(probabilityAt(real.grid, 69.65, 18.96), 15);
  assert.equal(probabilityAt(real.grid, 64.84, -147.72), 12);
});

test('longitudes: -180..180 of Gladys onto 0..359 east of OVATION, wrapped', () => {
  assert.deepEqual(
    [
      gridLongitude(0),
      gridLongitude(-0.4),
      gridLongitude(-1),
      gridLongitude(-122.3),
      gridLongitude(179.6),
      gridLongitude(-180),
    ],
    [0, 0, 359, 238, 180, 180],
  );
});

test('the highest of the nine cells around, across the 0/359 seam and at the poles', () => {
  const coordinates = [];
  for (let lon = 0; lon < 360; lon += 1)
    for (let lat = -90; lat <= 90; lat += 1) coordinates.push([lon, lat, 0]);
  const set = (lon, lat, v) => (coordinates[cellOf(lon, lat)][2] = v);
  set(359, 60, 40);
  set(1, 61, 25);
  set(10, 90, 7);
  const { grid } = parseOvation({ 'Observation Time': '2026-10-23T14:53:00Z', coordinates });
  assert.equal(probabilityAt(grid, 60, 0.2), 40, 'west of the seam');
  assert.equal(probabilityAt(grid, 60.4, 2), 25);
  assert.equal(probabilityAt(grid, 58, 0), 0, 'two cells away: not counted');
  assert.equal(probabilityAt(grid, 89.8, 10.4), 7, 'at the pole');
  assert.equal(probabilityAt(grid, 60, 0, 0), 0, 'radius 0: the nearest cell only');
  assert.equal(probabilityAt(grid, Number.NaN, 0), null);
});

test('a truncated or foreign file is refused', () => {
  assert.equal(parseOvation({ coordinates: [[0, 0, 1]] }), null);
  assert.equal(parseOvation({}), null);
  assert.equal(parseOvation(null), null);
});
