// -----------------------------------------------------------------------------
// Configuration of the NOAA Space Weather integration (no key: the data of
// the SWPC are public).
//
// Fields of the config_schema:
//   - `language`          language of the texts Gladys does not ask for in a
//                         language (device and feature names, scene texts):
//                         `auto` follows the language of the last widget, or
//                         the timezone;
//   - `aurora_threshold`  the OVATION probability (percent) from which an
//                         aurora is "possible" at a house: the aurora_possible
//                         trigger, the colors of the widget. A select ("5" …
//                         "50"): a number field may refuse to be typed in some
//                         versions of the core.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language` language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const THRESHOLDS = ['5', '10', '20', '30', '50'];
const DEFAULT_THRESHOLD = '10';

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ language: string, threshold: number }} The configuration.
 * @example
 * normalizeConfig({ language: 'fr', aurora_threshold: '20' }); // -> { language: 'fr', threshold: 20 }
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const threshold = String(config.aurora_threshold ?? '').trim();
  return {
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
    threshold: Number(THRESHOLDS.includes(threshold) ? threshold : DEFAULT_THRESHOLD),
  };
}

// The timezones of the countries that speak the languages of the integration:
// the automatic language before any widget was shown.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Costa_Rica',
    'America/Panama',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) {
    return 'es';
  }
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  THRESHOLDS,
  DEFAULT_THRESHOLD,
  normalizeConfig,
  guessLanguage,
  readLanguage,
};
