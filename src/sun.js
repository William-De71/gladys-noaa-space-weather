// -----------------------------------------------------------------------------
// The sun at a house, from the equations of the NOAA solar calculator
// (https://gml.noaa.gov/grad/solcalc/calcdetails.html), accurate to a few
// tenths of a degree away from the poles, without a dependency.
//
// An aurora is only seen in a dark sky: the "night" of the integration is
// the sun more than 6 degrees below the horizon (the end of the civil
// twilight), not the sunset itself. A bright twilight sky hides all but the
// strongest aurora. `darkness()` gives the dark window around an instant, by
// steps of 5 minutes, 24 hours back and forth at most (polar days and nights
// included).
// -----------------------------------------------------------------------------

import { MINUTE_MS, DAY_MS } from './time.js';

const RAD = Math.PI / 180;
// The sun this far below the horizon (degrees) makes the night of the integration.
const DARK_ELEVATION = -6;
const STEP_MS = 5 * MINUTE_MS;

/**
 * @description The position of the sun for a Julian century: its declination
 * and the equation of time.
 * @param {number} t - Julian centuries since J2000.0.
 * @returns {{ declination: number, equationOfTime: number }} Degrees and minutes.
 */
function solarPosition(t) {
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(meanAnomaly * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly * RAD) * 0.000289;
  const trueLongitude = meanLongitude + center;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * RAD);
  const declination =
    Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLongitude * RAD)) / RAD;
  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const equationOfTime =
    (4 *
      (y * Math.sin(2 * meanLongitude * RAD) -
        2 * eccentricity * Math.sin(meanAnomaly * RAD) +
        4 * eccentricity * y * Math.sin(meanAnomaly * RAD) * Math.cos(2 * meanLongitude * RAD) -
        0.5 * y * y * Math.sin(4 * meanLongitude * RAD) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * RAD))) /
    RAD;
  return { declination, equationOfTime };
}

/**
 * @description Julian centuries since J2000.0 of an instant.
 * @param {number} instant - The instant (ms).
 * @returns {number} The centuries.
 */
const centuries = (instant) => (instant / 86400000 + 2440587.5 - 2451545) / 36525;

/**
 * @description The elevation of the sun above the horizon (refraction left out).
 * @param {number} instant - The instant (ms).
 * @param {number} latitude - Degrees, north positive.
 * @param {number} longitude - Degrees, east positive.
 * @returns {number} Degrees (negative below the horizon).
 * @example
 * solarElevation(Date.parse('2026-06-21T12:00:00Z'), 51.48, 0); // about 62
 */
function solarElevation(instant, latitude, longitude) {
  const { declination, equationOfTime } = solarPosition(centuries(instant));
  const date = new Date(instant);
  const minutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;
  const trueSolarTime = (((minutes + equationOfTime + 4 * longitude) % 1440) + 1440) % 1440;
  const hourAngle = trueSolarTime / 4 - 180;
  const cosZenith =
    Math.sin(latitude * RAD) * Math.sin(declination * RAD) +
    Math.cos(latitude * RAD) * Math.cos(declination * RAD) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) / RAD;
}

/**
 * @description Whether the sky is dark at a place: the sun 6 degrees below the horizon.
 * @param {number} instant - The instant (ms).
 * @param {object} place - `{ latitude, longitude }`.
 * @returns {boolean|null} Null without a location.
 */
function isDark(instant, { latitude, longitude } = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return solarElevation(instant, latitude, longitude) < DARK_ELEVATION;
}

/**
 * @description The dark window of a place around an instant: the current one
 * when it is dark, else the next one (within 24 hours).
 * @param {number} instant - The instant (ms).
 * @param {object} place - `{ latitude, longitude }`.
 * @returns {{ dark: boolean, start: number|null, end: number|null }|null}
 * `start` and `end` of the window (null when beyond the 24 hours searched: a
 * polar night has no end, a polar day no start); null without a location.
 */
function darkness(instant, place) {
  const dark = isDark(instant, place);
  if (dark === null) {
    return null;
  }
  const at = (offset) => isDark(instant + offset, place);
  let start = null;
  let end = null;
  if (dark) {
    // Back to the start (24 hours at most), forward to the end.
    for (let offset = -STEP_MS; offset >= -DAY_MS; offset -= STEP_MS) {
      if (!at(offset)) {
        start = instant + offset + STEP_MS;
        break;
      }
    }
    for (let offset = STEP_MS; offset <= DAY_MS; offset += STEP_MS) {
      if (!at(offset)) {
        end = instant + offset;
        break;
      }
    }
  } else {
    for (let offset = STEP_MS; offset <= DAY_MS; offset += STEP_MS) {
      if (start === null && at(offset)) {
        start = instant + offset;
      } else if (start !== null && !at(offset)) {
        end = instant + offset;
        break;
      }
    }
  }
  return { dark, start, end };
}

export { DARK_ELEVATION, solarPosition, solarElevation, isDark, darkness };
