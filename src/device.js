// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// 1. "Space weather" (`ext:<selector>:space-weather:global`), one per
//    instance, read-only features in a stable order:
//      kp_estimated      estimated planetary Kp of the last minutes (0–9)
//      kp                official planetary Kp of the last 3-hour period (0–9)
//      g_scale / s_scale / r_scale   NOAA scales now: geomagnetic storm,
//                        solar radiation storm, radio blackout (0–5)
//      solar_wind_speed  km/s
//      bz / bt           interplanetary magnetic field, nT
//      radio_flux        10.7 cm solar radio flux, sfu
//      xray_class        class of the X-ray flux now ("B5.4"), a text
// 2. "Aurora" (`ext:<selector>:aurora:<house id>`), one per house of Gladys
//    with a location (the user creates the ones wanted):
//      probability       OVATION probability of an aurora overhead, percent
//      night             the sky is dark (the sun 6° below the horizon), 0/1
//      kp_tonight        highest Kp expected during the next dark hours
//
// Units: Gladys has none of km/s, nT, sfu, nor a Kp index, and its table of
// units per category (DEVICE_FEATURE_UNITS_BY_CATEGORY, server/utils/constants.js
// of the core) gives none to the `unknown` and `risk` categories: those
// features carry NO unit, and their name says it ("Solar wind (km/s)"). A
// `speed-sensor` in km/h would show 1,512,000 for 420 km/s; a percent on an
// `unknown` feature is not in that table either, so the probability says "%"
// in its name. The NOAA levels are `risk` / `integer`; the night is 1 or 0. The X-ray class is a text: a
// flare class is a letter and a number, the integration does not fake a
// logarithmic number for it.
//
// Several features share a type on each device, so the dashboard shows
// their names. `should_poll` stays false: the integration reads the SWPC on
// its own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
} from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const GLOBAL_TYPE = 'space-weather';
const GLOBAL_ID = 'global';
const AURORA_TYPE = 'aurora';

const number = (min, max) => ({ category: C.UNKNOWN, type: T.UNKNOWN.UNKNOWN, min, max });
const scale = { category: C.RISK, type: T.RISK.INTEGER, min: 0, max: 5 };

const GLOBAL_FEATURES = [
  { key: 'kp_estimated', ...number(0, 9), decimals: 2 },
  { key: 'kp', ...number(0, 9), decimals: 2 },
  { key: 'g_scale', ...scale, decimals: 0 },
  { key: 's_scale', ...scale, decimals: 0 },
  { key: 'r_scale', ...scale, decimals: 0 },
  // The fastest wind ever measured is about 3,000 km/s (August 1972).
  { key: 'solar_wind_speed', ...number(0, 3000), decimals: 0 },
  // Bz past ±100 nT and Bt past 150 nT have only been seen in the
  // strongest storms of the space era.
  { key: 'bz', ...number(-150, 150), decimals: 1 },
  { key: 'bt', ...number(0, 200), decimals: 1 },
  // The 10.7 cm flux stays between about 60 and 400 sfu.
  { key: 'radio_flux', ...number(0, 1000), decimals: 0 },
  { key: 'xray_class', category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0, text: true },
];

const AURORA_FEATURES = [
  { key: 'probability', ...number(0, 100), decimals: 0 },
  // 1 = dark, 0 = light. Not a `binary` type: alone of its type on the
  // device, the dashboard would show "Binary (on/off)" instead of its name.
  { key: 'night', ...number(0, 1), decimals: 0 },
  { key: 'kp_tonight', ...number(0, 9), decimals: 2 },
];

/**
 * @description The external ids of the global device.
 * @param {object} gladys - The GladysIntegration instance.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const globalIds = (gladys) => gladys.externalIds(GLOBAL_TYPE, GLOBAL_ID);

/**
 * @description The external ids of the aurora device of a house.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} houseId - The id of the house (GET /house).
 * @returns {{ device: string, feature: Function }} The ids.
 */
const auroraIds = (gladys, houseId) => gladys.externalIds(AURORA_TYPE, String(houseId));

/**
 * @description The house id of an aurora device (or feature) external id.
 * @param {unknown} externalId - The id.
 * @returns {string|null} The house id.
 * @example
 * houseOfExternalId('ext:noaa-space-weather:aurora:6f1c…:probability'); // -> '6f1c…'
 */
function houseOfExternalId(externalId) {
  const match = /:aurora:([^:]+)(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description A feature of a device.
 * @param {object} feature - The feature definition.
 * @param {Function} ids - The feature id factory.
 * @param {string} language - The language of the names.
 * @returns {object} The discovered feature.
 */
function featureOf(feature, ids, language) {
  return {
    name: t(`feature_${feature.key}`, language),
    external_id: ids(feature.key),
    category: feature.category,
    type: feature.type,
    min: feature.min,
    max: feature.max,
    read_only: true,
    has_feedback: false,
    keep_history: !feature.text,
  };
}

/**
 * @description The global "Space weather" device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} [language] - The language of the names.
 * @returns {object} The discovered device.
 */
function buildGlobalDevice(gladys, language = 'en') {
  const ids = globalIds(gladys);
  return {
    name: t('deviceGlobal', language),
    external_id: ids.device,
    model: 'NOAA SWPC',
    should_poll: false,
    features: GLOBAL_FEATURES.map((feature) => featureOf(feature, ids.feature, language)),
  };
}

/**
 * @description The "Aurora" device of a house.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} house - `{ id, name }`.
 * @param {string} [language] - The language of the names.
 * @returns {object} The discovered device.
 */
function buildAuroraDevice(gladys, house, language = 'en') {
  const ids = auroraIds(gladys, house.id);
  return {
    name: t('deviceAurora', language, { house: house.name || house.id }).slice(0, 100),
    external_id: ids.device,
    model: 'NOAA OVATION',
    should_poll: false,
    features: AURORA_FEATURES.map((feature) => featureOf(feature, ids.feature, language)),
  };
}

/**
 * @description The states of a device, from its values now: a value left
 * out (null) is left untouched.
 * @param {object[]} features - GLOBAL_FEATURES or AURORA_FEATURES.
 * @param {Function} ids - The feature id factory.
 * @param {object} values - `{ key: number|string|null }`.
 * @returns {object[]} `{ device_feature_external_id, state }` or `{ …, text }`.
 */
function statesOf(features, ids, values) {
  const states = [];
  for (const feature of features) {
    const value = values?.[feature.key];
    if (feature.text) {
      if (typeof value === 'string' && value) {
        states.push({ device_feature_external_id: ids(feature.key), text: value.slice(0, 100) });
      }
    } else if (Number.isFinite(value)) {
      const factor = 10 ** feature.decimals;
      const bounded = Math.min(feature.max, Math.max(feature.min, value));
      states.push({
        device_feature_external_id: ids(feature.key),
        state: Math.round(bounded * factor) / factor,
      });
    }
  }
  return states;
}

const buildGlobalStates = (gladys, values) =>
  statesOf(GLOBAL_FEATURES, globalIds(gladys).feature, values);
const buildAuroraStates = (gladys, houseId, values) =>
  statesOf(AURORA_FEATURES, auroraIds(gladys, houseId).feature, values);

export {
  GLOBAL_TYPE,
  AURORA_TYPE,
  GLOBAL_FEATURES,
  AURORA_FEATURES,
  globalIds,
  auroraIds,
  houseOfExternalId,
  buildGlobalDevice,
  buildAuroraDevice,
  buildGlobalStates,
  buildAuroraStates,
};
