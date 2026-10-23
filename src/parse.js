// -----------------------------------------------------------------------------
// Readers of the SWPC products (the files of swpc-api.js).
//
// Many products of the SWPC moved recently from a table (an array of arrays
// whose first row names the columns, every value a string, times written
// "2026-10-16 00:00:00.000") to an array of objects with typed values
// (`[{ "time_tag": "2026-10-16T00:00:00", "Kp": 3.33, … }]`): every reader
// takes both (`rowsOf`). Every time is UTC. A value that is not a finite
// number is null; a reader that finds nothing usable returns null or [].
// -----------------------------------------------------------------------------

import { readUtc, MINUTE_MS, HOUR_MS } from './time.js';

/**
 * @description A number of the SWPC: a number or a numeric string.
 * @param {unknown} value - The value.
 * @returns {number|null} The number.
 */
function num(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '' && !/^(null|nan)$/i.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * @description The rows of a product, as objects, whichever format it uses.
 * @param {unknown} raw - The parsed JSON.
 * @returns {object[]} The rows (the header row of a table removed).
 * @example
 * rowsOf([['time_tag', 'Kp'], ['2026-10-16 00:00:00.000', '3.33']]);
 * // -> [{ time_tag: '2026-10-16 00:00:00.000', Kp: '3.33' }]
 */
function rowsOf(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  if (Array.isArray(raw[0])) {
    const header = raw[0].map((name) => String(name));
    return raw
      .slice(1)
      .filter(Array.isArray)
      .map((row) => Object.fromEntries(header.map((name, index) => [name, row[index]])));
  }
  return raw.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
}

/**
 * @description The first defined field of a row among several names.
 * @param {object} row - The row.
 * @param {string[]} names - The names, in order.
 * @returns {unknown} The value.
 */
const field = (row, names) => names.map((name) => row?.[name]).find((value) => value != null);

/**
 * @description Sort by instant and keep one row per instant (the last one).
 * @param {object[]} rows - `{ at, … }`.
 * @returns {object[]} The rows.
 */
function byInstant(rows) {
  const map = new Map();
  for (const row of rows) {
    if (Number.isFinite(row.at)) map.set(row.at, row);
  }
  return [...map.values()].sort((a, b) => a.at - b.at);
}

/**
 * @description The official 3-hour planetary Kp (products/noaa-planetary-k-index.json).
 * @param {unknown} raw - The JSON.
 * @returns {Array<{ at: number, kp: number }>} The start of each 3-hour period and its Kp.
 */
function parseKp3h(raw) {
  return byInstant(
    rowsOf(raw)
      .map((row) => ({
        at: readUtc(field(row, ['time_tag'])),
        kp: num(field(row, ['Kp', 'kp', 'kp_index'])),
      }))
      .filter((row) => row.kp !== null && row.kp >= 0 && row.kp <= 9),
  );
}

// The estimated Kp of a 3-hour period starts again from 0 at 00, 03, 06…
// UTC and only means something after a few minutes (seen on the real file:
// 2.33 at 14:59, 0.00 from 15:00 to 15:09): its first minutes are skipped,
// the value of the end of the previous period stands for them.
const KP1M_SETTLE_MS = 15 * MINUTE_MS;

/**
 * @description The estimated planetary Kp of the last minute (json/planetary_k_index_1m.json).
 * @param {unknown} raw - The JSON.
 * @returns {{ at: number, kp: number }|null} The last meaningful estimate.
 */
function parseKp1m(raw) {
  const rows = byInstant(
    rowsOf(raw)
      .map((row) => ({
        at: readUtc(field(row, ['time_tag'])),
        kp: num(field(row, ['estimated_kp', 'kp_index'])),
      }))
      .filter((row) => row.kp !== null && row.kp >= 0 && row.kp <= 9),
  );
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const intoPeriod = rows[index].at % (3 * HOUR_MS);
    if (intoPeriod >= KP1M_SETTLE_MS || index === 0) {
      // The settling minutes of the last period: the end of the previous one.
      return rows[index];
    }
  }
  return null;
}

/**
 * @description The Kp observed, estimated and predicted
 * (products/noaa-planetary-k-index-forecast.json).
 * @param {unknown} raw - The JSON.
 * @returns {Array<{ at: number, kp: number, kind: string, scale: string|null }>}
 * `kind` is observed, estimated or predicted; `scale` "G1"… when the period
 * reaches a NOAA level.
 */
function parseForecast(raw) {
  return byInstant(
    rowsOf(raw)
      .map((row) => {
        const kind = String(field(row, ['observed']) ?? '').toLowerCase();
        const scale = String(field(row, ['noaa_scale']) ?? '').toUpperCase();
        return {
          at: readUtc(field(row, ['time_tag'])),
          kp: num(field(row, ['kp', 'Kp'])),
          kind: ['observed', 'estimated', 'predicted'].includes(kind) ? kind : 'predicted',
          scale: /^G[1-5]$/.test(scale) ? scale : null,
        };
      })
      .filter((row) => row.kp !== null && row.kp >= 0 && row.kp <= 9),
  );
}

/**
 * @description A level of a NOAA scale: "0" to "5".
 * @param {unknown} value - The value.
 * @returns {number|null} 0 to 5.
 */
function level(value) {
  const parsed = num(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= 5 ? parsed : null;
}

/**
 * @description A probability in percent.
 * @param {unknown} value - The value.
 * @returns {number|null} 0 to 100.
 */
function probability(value) {
  const parsed = num(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
}

/**
 * @description The NOAA space weather scales (products/noaa-scales.json): key
 * "0" is now, "-1" the day before, "1" to "3" today and the next two days
 * (predicted levels and probabilities).
 * @param {unknown} raw - The JSON.
 * @returns {{ now: object, days: object[] }|null} `now` `{ at, g, s, r }`;
 * `days` `{ date, g, rMinor, rMajor, s }` for today and the next two days.
 */
function parseScales(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw['0']) {
    return null;
  }
  const entry = (key) => raw[key] ?? {};
  const instant = (value) =>
    readUtc(`${value?.DateStamp ?? ''}T${value?.TimeStamp ?? '00:00:00'}Z`) ??
    readUtc(`${value?.DateStamp ?? ''}T00:00:00Z`);
  const now = entry('0');
  const current = {
    at: instant(now),
    g: level(now.G?.Scale),
    s: level(now.S?.Scale),
    r: level(now.R?.Scale),
  };
  if (current.g === null && current.s === null && current.r === null) {
    return null;
  }
  const days = ['1', '2', '3']
    .map((key) => entry(key))
    .filter((day) => typeof day.DateStamp === 'string')
    .map((day) => ({
      date: day.DateStamp,
      g: level(day.G?.Scale),
      rMinor: probability(day.R?.MinorProb),
      rMajor: probability(day.R?.MajorProb),
      s: probability(day.S?.Prob),
    }));
  return { now: current, days };
}

/**
 * @description The last row of a summary product, an object or an array.
 * @param {unknown} raw - The JSON.
 * @returns {object|null} The row.
 */
function summaryRow(raw) {
  if (Array.isArray(raw)) {
    const rows = rowsOf(raw);
    return rows[rows.length - 1] ?? null;
  }
  return raw && typeof raw === 'object' ? raw : null;
}

/**
 * @description The solar wind speed (products/summary/solar-wind-speed.json).
 * @param {unknown} raw - The JSON.
 * @returns {{ at: number|null, speed: number }|null} km/s.
 */
function parseWind(raw) {
  const row = summaryRow(raw);
  const speed = num(field(row, ['proton_speed', 'WindSpeed', 'speed']));
  if (speed === null || speed < 0 || speed > 5000) {
    return null;
  }
  return { at: readUtc(field(row, ['time_tag', 'TimeStamp'])), speed };
}

/**
 * @description The interplanetary magnetic field (products/summary/solar-wind-mag-field.json).
 * @param {unknown} raw - The JSON.
 * @returns {{ at: number|null, bt: number|null, bz: number|null }|null} nT.
 */
function parseMag(raw) {
  const row = summaryRow(raw);
  const bt = num(field(row, ['bt', 'Bt']));
  const bz = num(field(row, ['bz_gsm', 'Bz', 'bz']));
  if ((bt === null && bz === null) || Math.abs(bt ?? 0) > 500 || Math.abs(bz ?? 0) > 500) {
    return null;
  }
  return { at: readUtc(field(row, ['time_tag', 'TimeStamp'])), bt, bz };
}

/**
 * @description The 10.7 cm solar radio flux, once a day at Penticton
 * (products/summary/10cm-flux.json).
 * @param {unknown} raw - The JSON.
 * @returns {{ at: number|null, flux: number }|null} Solar flux units.
 */
function parseFlux(raw) {
  const row = summaryRow(raw);
  const flux = num(field(row, ['flux', 'Flux']));
  if (flux === null || flux <= 0 || flux > 2000) {
    return null;
  }
  return { at: readUtc(field(row, ['time_tag', 'TimeStamp'])), flux };
}

const CLASS_FLUX = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };

/**
 * @description Read an X-ray class: "B5.4", "M1", "X10.2".
 * @param {unknown} value - The class.
 * @returns {{ text: string, letter: string, flux: number }|null} The class,
 * its letter and the flux it stands for (W/m², 1-8 Å).
 * @example
 * xrayClass('M2.5'); // -> { text: 'M2.5', letter: 'M', flux: 2.5e-5 }
 */
function xrayClass(value) {
  const match = /^\s*([ABCMX])\s*(\d+(?:\.\d+)?)\s*$/i.exec(String(value ?? ''));
  if (!match) {
    return null;
  }
  const letter = match[1].toUpperCase();
  const factor = Number(match[2]);
  return { text: `${letter}${match[2]}`, letter, flux: CLASS_FLUX[letter] * factor };
}

/**
 * @description The latest X-ray flare of the GOES primary satellite
 * (json/goes/primary/xray-flares-latest.json): the current level of the X-ray
 * flux and the begin, peak and end of the last flare.
 * @param {unknown} raw - The JSON.
 * @returns {object|null} `{ at, current, begin, beginClass, max, maxClass,
 * maxFlux, end, satellite }`; classes as xrayClass().
 */
function parseFlare(raw) {
  const row = summaryRow(raw);
  if (!row) {
    return null;
  }
  const current = xrayClass(row.current_class);
  const maxClass = xrayClass(row.max_class);
  const begin = readUtc(row.begin_time);
  if (!current && !maxClass) {
    return null;
  }
  return {
    at: readUtc(row.time_tag),
    current,
    begin,
    beginClass: xrayClass(row.begin_class),
    max: readUtc(row.max_time),
    maxClass,
    maxFlux: num(row.max_xrlong) ?? maxClass?.flux ?? null,
    end: readUtc(row.end_time),
    satellite: num(row.satellite),
  };
}

export {
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
  KP1M_SETTLE_MS,
};
