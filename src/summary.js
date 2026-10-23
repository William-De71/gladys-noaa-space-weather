// -----------------------------------------------------------------------------
// What the scenes read: the outputs of the scene actions (get_space_weather,
// get_forecast, get_aurora), the flat payloads of the scene triggers, and the
// sentences ready to send in a notification, in the language of the
// configuration (Gladys gives none to the scenes).
//
// Days of the forecast are UTC days, like the NOAA's own (00–03 UT … 21–00 UT).
// -----------------------------------------------------------------------------

import { t, formatNumber, formatSigned } from './i18n.js';
import { formatTime, utcDay, HOUR_MS, DAY_MS } from './time.js';
import { levelName, STORM_KP } from './events.js';
import { alertTitle } from './alerts.js';

const SCENE_ACTIONS = {
  GET_SPACE_WEATHER: 'get_space_weather',
  GET_AURORA: 'get_aurora',
  GET_FORECAST: 'get_forecast',
};
const SPACE_OUTPUTS = [
  'kp',
  'kp_official',
  'g_scale',
  's_scale',
  'r_scale',
  'solar_wind_speed',
  'bz',
  'bt',
  'radio_flux',
  'xray_class',
  'last_flare_class',
  'last_flare_time',
  'summary',
];
const AURORA_OUTPUTS = [
  'house_name',
  'probability',
  'possible',
  'dark',
  'dark_start',
  'dark_end',
  'kp_tonight',
  'threshold',
  'observation_time',
  'summary',
];
const FORECAST_OUTPUTS = [
  'kp_max_today',
  'kp_max_tomorrow',
  'kp_max_day_after',
  'g_max',
  'storm_expected',
  'radio_blackout_probability',
  'major_radio_blackout_probability',
  'radiation_storm_probability',
  'summary',
];

/**
 * @description Keep the declared keys only (the core drops the others anyway).
 * @param {object} values - The values.
 * @param {string[]} keys - The declared keys.
 * @returns {object} The outputs.
 */
const pick = (values, keys) =>
  Object.fromEntries(
    keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]),
  );

/**
 * @description Round a Kp for the scenes (a third: 2.33, 2.67).
 * @param {number|null} kp - The Kp.
 * @returns {number|null} The Kp, two decimals.
 */
const roundKp = (kp) => (Number.isFinite(kp) ? Math.round(kp * 100) / 100 : null);

/**
 * @description The geomagnetic activity of a Kp (SWPC: 0–2 quiet, 3
 * unsettled, 4 active, 5 and more a storm G1 to G5).
 * @param {number} kp - The Kp.
 * @returns {{ key: string, g: number }} `key` an i18n key `activity_*`.
 */
function activityOf(kp) {
  const g = gOfKp(kp);
  if (g > 0) return { key: 'activity_storm', g };
  if (kp >= 4 - 1e-6) return { key: 'activity_active', g };
  if (kp >= 3 - 1e-6) return { key: 'activity_unsettled', g };
  return { key: 'activity_quiet', g };
}

/**
 * @description The G level a Kp stands for: Kp 5 is G1 … Kp 9 is G5.
 * @param {number} kp - The Kp (thirds: 5.67 is "6-", still G1).
 * @returns {number} 0 to 5.
 */
function gOfKp(kp) {
  if (!Number.isFinite(kp)) return 0;
  return Math.max(0, Math.min(5, Math.floor(kp + 1e-6) - 4));
}

/**
 * @description The R level of an X-ray flux: M1 is R1, M5 R2, X1 R3, X10 R4, X20 R5.
 * @param {number|null} flux - W/m².
 * @returns {number} 0 to 5.
 */
function rOfFlux(flux) {
  if (!Number.isFinite(flux)) return 0;
  const steps = [1e-5, 5e-5, 1e-4, 1e-3, 2e-3];
  return steps.filter((step) => flux >= step * (1 - 1e-9)).length;
}

/**
 * @description The text of the activity of a Kp.
 * @param {number} kp - The Kp.
 * @param {string} language - The language.
 * @returns {string} "quiet", "storm G2".
 */
function activityText(kp, language) {
  const { key, g } = activityOf(kp);
  return t(key, language, { level: `G${g}` });
}

/**
 * @description The NOAA description of a level: "minor", "strong".
 * @param {string} scale - g, s or r.
 * @param {number} level - 0 to 5.
 * @param {string} language - The language.
 * @returns {string} The description.
 */
const levelText = (scale, level, language) =>
  level > 0 ? t(`${scale}_${level}`, language) : t('level_0', language);

/**
 * @description The Kp of the scenes: the estimate of the last minutes, else
 * the official value of the last period.
 * @param {object} view - The space weather view (app.js).
 * @returns {number|null} The Kp.
 */
const kpNowOf = (view) => view.kpEstimated?.kp ?? view.kp?.kp ?? null;

/**
 * @description The three UTC days of the forecast: today, tomorrow, the day after.
 * @param {object} view - `{ forecast, scales, now }`.
 * @returns {Array<{ date: string, kpMax: number|null, g: number|null }>} The days.
 */
function forecastDays(view) {
  const start = Date.parse(`${utcDay(view.now)}T00:00:00Z`);
  return [0, 1, 2].map((index) => {
    const date = utcDay(start + index * DAY_MS);
    const rows = (view.forecast ?? []).filter((row) => utcDay(row.at) === date);
    const kpMax = rows.length ? Math.max(...rows.map((row) => row.kp)) : null;
    const scaleDay = (view.scales?.days ?? []).find((day) => day.date === date);
    return {
      date,
      kpMax: roundKp(kpMax),
      g: scaleDay?.g ?? (kpMax === null ? null : gOfKp(kpMax)),
    };
  });
}

/**
 * @description The highest Kp expected over a window: the 3-hour periods it overlaps.
 * @param {object[]} rows - parseForecast().
 * @param {number} from - The start (ms).
 * @param {number} to - The end (ms).
 * @returns {number|null} The Kp.
 */
function kpOver(rows, from, to) {
  const kps = (rows ?? [])
    .filter((row) => row.at < to && row.at + 3 * HOUR_MS > from)
    .map((row) => row.kp);
  return kps.length ? roundKp(Math.max(...kps)) : null;
}

/**
 * @description The highest Kp expected during the dark hours of a house: the
 * current dark window, or the next one.
 * @param {object[]} rows - parseForecast().
 * @param {object|null} darkness - sun.darkness().
 * @param {number} now - Now.
 * @returns {number|null} The Kp.
 */
function kpTonight(rows, darkness, now) {
  if (!darkness) return null;
  const from = darkness.dark ? now : darkness.start;
  if (!Number.isFinite(from)) return null;
  const to = Number.isFinite(darkness.end) ? darkness.end : from + 12 * HOUR_MS;
  return kpOver(rows, from, to);
}

/**
 * @description The outputs of get_space_weather.
 * @param {object} view - The space weather view (app.js).
 * @param {object} options - `{ language, timeZone }`.
 * @returns {object} The outputs.
 */
function spaceWeatherOutputs(view, { language, timeZone }) {
  const kp = roundKp(kpNowOf(view));
  const scales = view.scales?.now ?? null;
  const flare = view.flare;
  const time = (instant) => formatTime(instant, { language, timeZone, now: view.now });
  const parts = [];
  if (kp !== null) {
    parts.push(
      t('sumKp', language, {
        kp: formatNumber(kp, language, 2),
        activity: activityText(kp, language),
      }),
    );
  }
  if (scales) {
    parts.push(
      t('sumScales', language, {
        g: levelName('g', scales.g ?? 0),
        s: levelName('s', scales.s ?? 0),
        r: levelName('r', scales.r ?? 0),
      }),
    );
  }
  if (view.wind) {
    parts.push(
      Number.isFinite(view.mag?.bz)
        ? t('sumWind', language, {
            speed: formatNumber(view.wind.speed, language, 0),
            bz: formatSigned(view.mag.bz, language, 1),
          })
        : t('sumWindOnly', language, { speed: formatNumber(view.wind.speed, language, 0) }),
    );
  }
  if (view.xray) {
    parts.push(t('sumXray', language, { xray: view.xray.text }));
  }
  if (flare?.maxClass && Number.isFinite(flare.max ?? flare.begin)) {
    parts.push(
      t('sumFlare', language, { class: flare.maxClass.text, time: time(flare.max ?? flare.begin) }),
    );
  }
  return pick(
    {
      kp,
      kp_official: roundKp(view.kp?.kp ?? null),
      g_scale: scales?.g ?? null,
      s_scale: scales?.s ?? null,
      r_scale: scales?.r ?? null,
      solar_wind_speed: Number.isFinite(view.wind?.speed) ? Math.round(view.wind.speed) : null,
      bz: Number.isFinite(view.mag?.bz) ? view.mag.bz : null,
      bt: Number.isFinite(view.mag?.bt) ? view.mag.bt : null,
      radio_flux: Number.isFinite(view.flux?.flux) ? Math.round(view.flux.flux) : null,
      xray_class: view.xray?.text ?? '',
      last_flare_class: flare?.maxClass?.text ?? '',
      last_flare_time: flare ? time(flare.max ?? flare.begin) : '',
      summary: (parts.length ? parts.join(' ') : t('sumNoData', language)).slice(0, 1000),
    },
    SPACE_OUTPUTS,
  );
}

/**
 * @description The outputs of get_forecast.
 * @param {object} view - The space weather view (app.js).
 * @param {object} options - `{ language }`.
 * @returns {object} The outputs.
 */
function forecastOutputs(view, { language }) {
  const days = forecastDays(view);
  const known = days.some((day) => day.kpMax !== null) || (view.scales?.days ?? []).length > 0;
  const maxOf = (values) => {
    const list = values.filter(Number.isFinite);
    return list.length ? Math.max(...list) : null;
  };
  const scaleDays = view.scales?.days ?? [];
  const gMax = maxOf([...days.map((day) => day.g), ...scaleDays.map((day) => day.g)]) ?? 0;
  const r12 = maxOf(scaleDays.map((day) => day.rMinor));
  const r3 = maxOf(scaleDays.map((day) => day.rMajor));
  const s1 = maxOf(scaleDays.map((day) => day.s));
  const kpText = (value) => formatNumber(value, language, 2);
  const parts = [];
  if (known) {
    parts.push(
      t('fcKp', language, {
        today: kpText(days[0].kpMax),
        tomorrow: kpText(days[1].kpMax),
        after: kpText(days[2].kpMax),
      }),
    );
    parts.push(
      gMax > 0
        ? t('fcStorm', language, { level: `G${gMax}`, description: levelText('g', gMax, language) })
        : t('fcNoStorm', language),
    );
    if ([r12, r3, s1].some(Number.isFinite)) {
      parts.push(
        t('fcProbabilities', language, {
          r12: formatNumber(r12, language, 0),
          r3: formatNumber(r3, language, 0),
          s1: formatNumber(s1, language, 0),
        }),
      );
    }
  }
  return pick(
    {
      kp_max_today: days[0].kpMax,
      kp_max_tomorrow: days[1].kpMax,
      kp_max_day_after: days[2].kpMax,
      g_max: `G${gMax}`,
      storm_expected: gMax > 0,
      radio_blackout_probability: r12,
      major_radio_blackout_probability: r3,
      radiation_storm_probability: s1,
      summary: (parts.length ? parts.join(' ') : t('fcNoData', language)).slice(0, 1000),
    },
    FORECAST_OUTPUTS,
  );
}

/**
 * @description The verdict on an aurora at a probability.
 * @param {number|null} probability - Percent.
 * @param {number} threshold - Percent.
 * @param {number} latitude - Of the house (north or south to look at).
 * @returns {string} An i18n key.
 */
function verdictOf(probability, threshold, latitude) {
  if (!Number.isFinite(probability) || probability < Math.min(5, threshold))
    return 'auVerdict_none';
  if (probability < threshold) return 'auVerdict_low';
  return latitude < 0 ? 'auVerdict_south' : 'auVerdict_north';
}

/**
 * @description The outputs of get_aurora.
 * @param {object} aurora - The aurora view of a house (app.js): `{ house,
 * probability, observation, darkness, kpTonight, threshold, fresh }`.
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The outputs.
 */
function auroraOutputs(aurora, { language, timeZone, now }) {
  const time = (instant) => formatTime(instant, { language, timeZone, now });
  const { house, darkness } = aurora;
  const probability = aurora.fresh ? aurora.probability : null;
  const parts = [];
  if (probability === null) {
    parts.push(t('auNoData', language));
  } else {
    parts.push(
      t('auPlace', language, {
        house: house.name,
        probability: formatNumber(probability, language, 0),
      }),
    );
  }
  if (darkness?.dark) {
    parts.push(
      Number.isFinite(darkness.end)
        ? t('auDarkUntil', language, { time: time(darkness.end) })
        : t('auDark', language),
    );
  } else if (Number.isFinite(darkness?.start)) {
    parts.push(t('auDarkFrom', language, { time: time(darkness.start) }));
  } else if (darkness) {
    parts.push(t('auNoDark', language));
  }
  if (Number.isFinite(aurora.kpTonight)) {
    parts.push(t('auKpTonight', language, { kp: formatNumber(aurora.kpTonight, language, 2) }));
  }
  if (probability !== null) {
    parts.push(t(verdictOf(probability, aurora.threshold, house.latitude), language));
  }
  return pick(
    {
      house_name: house.name,
      probability,
      possible: probability !== null && darkness?.dark === true && probability >= aurora.threshold,
      dark: darkness?.dark === true,
      dark_start: darkness && Number.isFinite(darkness.start) ? time(darkness.start) : '',
      dark_end: darkness && Number.isFinite(darkness.end) ? time(darkness.end) : '',
      kp_tonight: aurora.kpTonight ?? null,
      threshold: aurora.threshold,
      observation_time: Number.isFinite(aurora.observation) ? time(aurora.observation) : '',
      summary: parts.join(' ').slice(0, 1000),
    },
    AURORA_OUTPUTS,
  );
}

// --- Payloads of the scene triggers (flat, scalar) ------------------------------------

/**
 * @description A storm of a NOAA scale rose.
 * @param {object} event - detectScale() `{ scale, level, previous }`.
 * @param {object} view - The space weather view.
 * @param {string} language - The language.
 * @returns {object} The payload.
 */
function scaleEventData(event, view, language) {
  const level = levelName(event.scale, event.level);
  const description = levelText(event.scale, event.level, language);
  const kp = roundKp(kpNowOf(view));
  const sentence = {
    g: () => t('evStorm', language, { level, description, kp: formatNumber(kp, language, 2) }),
    s: () => t('evRadiation', language, { level, description }),
    r: () => t('evRadio', language, { level, description }),
  }[event.scale]();
  return {
    level,
    level_number: event.level,
    previous_level: levelName(event.scale, event.previous ?? 0),
    description,
    ...(event.scale === 'g' ? { kp } : {}),
    sentence,
  };
}

/**
 * @description A geomagnetic storm ended.
 * @param {object} event - detectScale() `{ max, start, end }`.
 * @param {object} view - The space weather view.
 * @param {string} language - The language.
 * @returns {object} The payload.
 */
function stormEndedData(event, view, language) {
  const hours =
    Number.isFinite(event.start) && Number.isFinite(event.end)
      ? Math.max(0, Math.round((event.end - event.start) / HOUR_MS))
      : null;
  const level = levelName('g', event.max);
  return {
    max_level: level,
    max_level_number: event.max,
    duration_hours: hours,
    kp: roundKp(kpNowOf(view)),
    sentence: t('evStormEnded', language, { level, hours: hours ?? '–' }),
  };
}

/**
 * @description A flare of class M or X.
 * @param {object} flare - parseFlare().
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The payload.
 */
function flareData(flare, { language, timeZone, now }) {
  const time = (instant) =>
    Number.isFinite(instant) ? formatTime(instant, { language, timeZone, now }) : '';
  const letter = flare.maxClass.letter;
  const r = rOfFlux(flare.maxFlux ?? flare.maxClass.flux);
  const peak = flare.max ?? flare.begin;
  const sentence = [
    t('evFlare', language, { class: flare.maxClass.text, time: time(peak) }),
    letter === 'X' ? t('evFlareX', language) : null,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    class: flare.maxClass.text,
    class_letter: letter,
    begin_time: time(flare.begin),
    peak_time: time(flare.max),
    end_time: time(flare.end),
    peak_flux: Number.isFinite(flare.maxFlux) ? flare.maxFlux : flare.maxClass.flux,
    radio_blackout: levelName('r', r),
    sentence,
  };
}

/**
 * @description An aurora possible, or over, at a house.
 * @param {object} event - detectAurora() `{ key, reason, max }`.
 * @param {object} aurora - The aurora view of the house.
 * @param {object} options - `{ language, kp, device, timeZone, now }`.
 * @returns {object} The payload.
 */
function auroraData(event, aurora, { language, kp, device, timeZone, now }) {
  const house = aurora.house;
  const common = { device, house: house.selector ?? '', house_name: house.name };
  if (event.key === 'aurora_ended') {
    return {
      ...common,
      reason: event.reason,
      max_probability: event.max ?? null,
      probability: aurora.probability ?? null,
      sentence: t(`evAuroraEnded_${event.reason}`, language, {
        house: house.name,
        probability: formatNumber(
          event.reason === 'dawn' ? event.max : aurora.probability,
          language,
          0,
        ),
      }),
    };
  }
  return {
    ...common,
    probability: aurora.probability,
    threshold: aurora.threshold,
    kp: roundKp(kp),
    kp_tonight: aurora.kpTonight ?? null,
    observation_time: Number.isFinite(aurora.observation)
      ? formatTime(aurora.observation, { language, timeZone, now })
      : '',
    sentence: t('evAurora', language, {
      house: house.name,
      probability: formatNumber(aurora.probability, language, 0),
      threshold: aurora.threshold,
      kp: formatNumber(kp, language, 2),
    }),
  };
}

/**
 * @description A new message of the SWPC.
 * @param {object} message - parseMessage().
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The payload.
 */
function alertData(message, { language, timeZone, now }) {
  const title = alertTitle(message, language);
  return {
    type: message.kind,
    topic: message.topic,
    status: message.status,
    code: message.code ?? '',
    serial: message.serial,
    title,
    headline: message.headline,
    message: message.text.slice(0, 1000),
    issue_time: Number.isFinite(message.issued)
      ? formatTime(message.issued, { language, timeZone, now })
      : '',
    sentence: title,
  };
}

/**
 * @description A geomagnetic storm in the forecast.
 * @param {object} episode - stormEpisodes() `{ start, end, maxKp }`.
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The payload.
 */
function forecastData(episode, { language, timeZone, now }) {
  const g = Math.max(1, gOfKp(episode.maxKp));
  const level = `G${g}`;
  const time = (instant) => formatTime(instant, { language, timeZone, now });
  return {
    level,
    level_number: g,
    max_kp: roundKp(episode.maxKp),
    start_time: time(episode.start),
    end_time: time(episode.end),
    hours_until: Math.max(0, Math.round((episode.start - now) / HOUR_MS)),
    sentence: t('evForecast', language, {
      level,
      kp: formatNumber(episode.maxKp, language, 2),
      time: time(episode.start),
    }),
  };
}

export {
  SCENE_ACTIONS,
  SPACE_OUTPUTS,
  AURORA_OUTPUTS,
  FORECAST_OUTPUTS,
  STORM_KP,
  pick,
  roundKp,
  activityOf,
  activityText,
  gOfKp,
  rOfFlux,
  levelText,
  kpNowOf,
  forecastDays,
  kpOver,
  kpTonight,
  verdictOf,
  spaceWeatherOutputs,
  forecastOutputs,
  auroraOutputs,
  scaleEventData,
  stormEndedData,
  flareData,
  auroraData,
  alertData,
  forecastData,
};
