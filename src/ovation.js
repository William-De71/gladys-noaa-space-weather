// -----------------------------------------------------------------------------
// The OVATION aurora forecast of the SWPC (json/ovation_aurora_latest.json):
// the probability of seeing an aurora OVERHEAD, in percent, on a grid of
// 1 degree, for a "Forecast Time" about 30 to 90 minutes after its
// "Observation Time" (the time the solar wind measured at the L1 point takes
// to reach the Earth).
//
// The file is large (about 920 kB, 65,160 triplets [longitude, latitude,
// probability], longitudes 0 to 359 EAST, latitudes -90 to 90): it is read
// once into a compact grid of bytes (65 kB), then dropped.
//
// The probability at a house is the HIGHEST value of the cells within
// NEIGHBOUR_DEGREES of the nearest cell (±1° of latitude, ±1° of longitude:
// nine cells, about 110 km north to south). The grid is coarse, the oval
// moves within the hour, and the forecast says "overhead": a cell next door
// is as likely. It is not a "visible on the horizon" probability: an aurora
// 500 km further north can be seen low on the northern horizon, which the
// value does not tell.
// -----------------------------------------------------------------------------

import { readUtc } from './time.js';

const LONGITUDES = 360;
const LATITUDES = 181;
const NEIGHBOUR_DEGREES = 1;
// Fewer triplets than this: not the OVATION file (a truncated or changed answer).
const MIN_CELLS = 60000;

/**
 * @description The index of a cell in the grid.
 * @param {number} longitude - 0 to 359 (east).
 * @param {number} latitude - -90 to 90.
 * @returns {number} The index.
 */
const cellOf = (longitude, latitude) => longitude * LATITUDES + (latitude + 90);

/**
 * @description A longitude of Gladys (-180 to 180, east positive) on the
 * grid of OVATION (0 to 359, east): -1.5 is 358.5, rounded to 359 (wrapped).
 * @param {number} longitude - Degrees.
 * @returns {number} 0 to 359.
 * @example
 * gridLongitude(-0.4); // -> 0
 * gridLongitude(-122.3); // -> 238
 */
function gridLongitude(longitude) {
  return ((Math.round(longitude) % LONGITUDES) + LONGITUDES) % LONGITUDES;
}

/**
 * @description Read the OVATION file into a grid.
 * @param {unknown} raw - The JSON.
 * @returns {{ observation: number|null, forecast: number|null, grid: Uint8Array,
 * max: number }|null} The grid (255 = no value), the highest probability.
 */
function parseOvation(raw) {
  const coordinates = raw?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < MIN_CELLS) {
    return null;
  }
  const grid = new Uint8Array(LONGITUDES * LATITUDES).fill(255);
  let max = 0;
  let cells = 0;
  for (const triplet of coordinates) {
    if (!Array.isArray(triplet) || triplet.length < 3) continue;
    const [longitude, latitude, value] = triplet.map(Number);
    if (
      !Number.isInteger(longitude) ||
      !Number.isInteger(latitude) ||
      longitude < 0 ||
      longitude >= LONGITUDES ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(value)
    ) {
      continue;
    }
    const probability = Math.max(0, Math.min(100, Math.round(value)));
    grid[cellOf(longitude, latitude)] = probability;
    max = Math.max(max, probability);
    cells += 1;
  }
  if (cells < MIN_CELLS) {
    return null;
  }
  return {
    observation: readUtc(raw['Observation Time']),
    forecast: readUtc(raw['Forecast Time']),
    grid,
    max,
  };
}

/**
 * @description The probability of an aurora at a place: the highest of the
 * cells around its nearest cell.
 * @param {Uint8Array} grid - parseOvation().grid.
 * @param {number} latitude - Degrees, north positive.
 * @param {number} longitude - Degrees, east positive (-180 to 180).
 * @param {number} [radius] - Cells around (1: nine cells).
 * @returns {number|null} Percent, null when the grid has no value there.
 */
function probabilityAt(grid, latitude, longitude, radius = NEIGHBOUR_DEGREES) {
  if (!grid || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const centerLatitude = Math.max(-90, Math.min(90, Math.round(latitude)));
  const centerLongitude = gridLongitude(longitude);
  let best = null;
  for (let dLat = -radius; dLat <= radius; dLat += 1) {
    const lat = centerLatitude + dLat;
    if (lat < -90 || lat > 90) continue;
    for (let dLon = -radius; dLon <= radius; dLon += 1) {
      const lon = (centerLongitude + dLon + LONGITUDES) % LONGITUDES;
      const value = grid[cellOf(lon, lat)];
      if (value !== 255 && (best === null || value > best)) best = value;
    }
  }
  return best;
}

export { NEIGHBOUR_DEGREES, gridLongitude, parseOvation, probabilityAt, cellOf };
