// -----------------------------------------------------------------------------
// The scene triggers: what HAPPENS in space weather, detected by comparing
// each new reading with what the previous ones left in `seen` (kept in /data).
//
// Rules, for every detector:
//   - one event per transition, never a periodic snapshot;
//   - never at the first reading (or after /data was lost): that reading is a
//     baseline;
//   - never from a scene action (the detectors only run on the timer);
//   - a reading too old to be "now" never starts anything.
//
// The detectors are pure: `(state, reading, now) -> { events, next }`, the
// events being `{ key, … facts }`; app.js turns the facts into the flat
// payload of the trigger (summary.js writes the sentences).
// -----------------------------------------------------------------------------

import { MINUTE_MS, HOUR_MS, DAY_MS } from './time.js';

const TRIGGERS = {
  GEOMAGNETIC_STORM: 'geomagnetic_storm',
  GEOMAGNETIC_STORM_ENDED: 'geomagnetic_storm_ended',
  RADIATION_STORM: 'radiation_storm',
  RADIO_BLACKOUT: 'radio_blackout',
  SOLAR_FLARE: 'solar_flare',
  AURORA_POSSIBLE: 'aurora_possible',
  AURORA_ENDED: 'aurora_ended',
  SWPC_ALERT: 'swpc_alert',
  STORM_FORECAST: 'storm_forecast',
};

// The trigger of each scale, and how long it must stay at 0 for its episode
// to end: a geomagnetic storm is judged on 3-hour periods, so one quiet
// period; the radiation and radio scales follow a flux that can dip for a
// few minutes.
const SCALE_TRIGGERS = {
  g: TRIGGERS.GEOMAGNETIC_STORM,
  s: TRIGGERS.RADIATION_STORM,
  r: TRIGGERS.RADIO_BLACKOUT,
};
const QUIET_MS = { g: 3 * HOUR_MS, s: HOUR_MS, r: HOUR_MS };
// A flare that began longer ago (a restart after a long stop) is only noted.
const FLARE_MAX_AGE_MS = 6 * HOUR_MS;
// A message older than this (a restart after a long stop) is only noted.
const ALERT_MAX_AGE_MS = DAY_MS;
const ALERTS_KEPT = 300;
const ALERTS_PER_ROUND = 10;
// Predicted periods of Kp >= STORM_KP (G1) make an episode; a new forecast
// that moves an episode by less than FORECAST_SLACK_MS is the same one.
const STORM_KP = 5;
const FORECAST_WINDOW_MS = 3 * DAY_MS;
const FORECAST_SLACK_MS = 6 * HOUR_MS;
// An OVATION reading this old no longer says "now".
const OVATION_FRESH_MS = 90 * MINUTE_MS;

/**
 * @description A NOAA scale level as the scenes read it: "G3".
 * @param {string} scale - g, s or r.
 * @param {number|null} level - 0 to 5.
 * @returns {string|null} The level.
 */
const levelName = (scale, level) =>
  Number.isInteger(level) ? `${scale.toUpperCase()}${level}` : null;

/**
 * @description A level of a NOAA scale now: a storm of a scale rises, and ends.
 * @param {object} state - The `seen` of the scale.
 * @param {object} reading - `{ scale: 'g'|'s'|'r', level, now }`.
 * @returns {{ events: object[], next: object }} The events: `{ key, scale,
 * level, previous }` while it rises above the highest level of the episode,
 * `{ key: geomagnetic_storm_ended, max, start }` when a geomagnetic storm
 * ends (the radiation and radio episodes end silently).
 */
function detectScale(state, { scale, level, now }) {
  if (!Number.isInteger(level)) {
    return { events: [], next: state ?? {} };
  }
  const events = [];
  if (!state?.initialized) {
    return {
      events,
      next: {
        initialized: true,
        level,
        max: level,
        start: level > 0 ? now : null,
        quietSince: level === 0 ? now : null,
      },
    };
  }
  const next = { ...state, level };
  if (level > 0) {
    next.quietSince = null;
    next.start ??= now;
    if (level > (state.max ?? 0)) {
      events.push({ key: SCALE_TRIGGERS[scale], scale, level, previous: state.max ?? 0 });
      next.max = level;
    }
    return { events, next };
  }
  next.quietSince ??= now;
  if ((state.max ?? 0) > 0 && now - next.quietSince >= QUIET_MS[scale]) {
    if (scale === 'g') {
      events.push({
        key: TRIGGERS.GEOMAGNETIC_STORM_ENDED,
        scale,
        max: state.max,
        start: state.start ?? null,
        end: next.quietSince,
      });
    }
    next.max = 0;
    next.start = null;
  }
  return { events, next };
}

/**
 * @description The latest flare: a new one of class M or X, once per class
 * reached (a flare that grows from M to X fires again, as X).
 * @param {object} state - `{ initialized, begin, letters }`.
 * @param {object|null} flare - parseFlare().
 * @param {number} now - Now.
 * @returns {{ events: object[], next: object }} `{ key: solar_flare, flare }`.
 */
function detectFlare(state, flare, now) {
  if (!flare?.maxClass || !Number.isFinite(flare.begin)) {
    return { events: [], next: state ?? {} };
  }
  const letter = flare.maxClass.letter;
  const significant = letter === 'M' || letter === 'X';
  const reached = significant ? (letter === 'X' ? ['M', 'X'] : ['M']) : [];
  if (!state?.initialized || now - flare.begin > FLARE_MAX_AGE_MS) {
    return {
      events: [],
      next: {
        initialized: true,
        begin: flare.begin,
        letters:
          state?.begin === flare.begin
            ? [...new Set([...(state.letters ?? []), ...reached])]
            : reached,
      },
    };
  }
  const known = state.begin === flare.begin ? (state.letters ?? []) : [];
  const events =
    significant && !known.includes(letter) ? [{ key: TRIGGERS.SOLAR_FLARE, flare }] : [];
  return {
    events,
    next: { initialized: true, begin: flare.begin, letters: [...new Set([...known, ...reached])] },
  };
}

/**
 * @description The messages of the SWPC: each new one, once.
 * @param {object} state - `{ initialized, ids }`.
 * @param {object[]} messages - parseAlerts() (newest first).
 * @param {number} now - Now.
 * @returns {{ events: object[], next: object }} `{ key: swpc_alert, message }`,
 * oldest first, ten at most a round.
 */
function detectAlerts(state, messages, now) {
  const ids = new Set(state?.ids ?? []);
  const events = [];
  if (state?.initialized) {
    const fresh = messages
      .filter((message) => !ids.has(message.id))
      .sort((a, b) => (a.issued ?? 0) - (b.issued ?? 0));
    for (const message of fresh) {
      ids.add(message.id);
      const recent = Number.isFinite(message.issued) && now - message.issued <= ALERT_MAX_AGE_MS;
      if (recent && events.length < ALERTS_PER_ROUND) {
        events.push({ key: TRIGGERS.SWPC_ALERT, message });
      }
    }
  } else {
    messages.forEach((message) => ids.add(message.id));
  }
  // The newest first: the feed holds about a month of messages.
  const kept = [...ids].slice(-ALERTS_KEPT);
  return { events, next: { initialized: true, ids: kept } };
}

/**
 * @description The predicted episodes of Kp >= 5 within three days.
 * @param {object[]} rows - parseForecast().
 * @param {number} now - Now.
 * @returns {Array<{ start: number, end: number, maxKp: number }>} The episodes.
 */
function stormEpisodes(rows, now) {
  const episodes = [];
  for (const row of rows) {
    if (row.kind !== 'predicted' || row.kp < STORM_KP) continue;
    const end = row.at + 3 * HOUR_MS;
    if (end <= now || row.at > now + FORECAST_WINDOW_MS) continue;
    const last = episodes[episodes.length - 1];
    if (last && row.at - last.end <= 0) {
      last.end = end;
      last.maxKp = Math.max(last.maxKp, row.kp);
    } else {
      episodes.push({ start: row.at, end, maxKp: row.kp });
    }
  }
  return episodes;
}

/**
 * @description The Kp forecast: each new episode of a predicted G1 storm or
 * more, once (a later forecast that moves it a little is the same one).
 * @param {object} state - `{ initialized, episodes }`.
 * @param {object[]} rows - parseForecast().
 * @param {number} now - Now.
 * @returns {{ events: object[], next: object }} `{ key: storm_forecast, episode }`.
 */
function detectForecast(state, rows, now) {
  const known = (state?.episodes ?? [])
    .filter((episode) => episode.end > now - DAY_MS)
    .map((episode) => ({ ...episode }));
  const events = [];
  for (const episode of stormEpisodes(rows, now)) {
    const same = known.find(
      (old) =>
        episode.start <= old.end + FORECAST_SLACK_MS &&
        episode.end >= old.start - FORECAST_SLACK_MS,
    );
    if (same) {
      same.start = Math.min(same.start, episode.start);
      same.end = Math.max(same.end, episode.end);
      continue;
    }
    known.push({ start: episode.start, end: episode.end });
    if (state?.initialized) {
      events.push({ key: TRIGGERS.STORM_FORECAST, episode });
    }
  }
  return { events, next: { initialized: true, episodes: known.slice(-20) } };
}

/**
 * @description The margin under the threshold before an aurora ends: a
 * probability around the threshold must not fire every round.
 * @param {number} threshold - Percent.
 * @returns {number} Percent.
 */
const hysteresisOf = (threshold) => Math.max(2, Math.round(threshold * 0.2));

/**
 * @description An aurora at a house: possible (the probability at the
 * threshold or above, in a dark sky), then over (the dawn, or the
 * probability below the threshold minus the margin).
 * @param {object} state - `{ initialized, active, announced, max }`.
 * @param {object} reading - `{ probability, observation, dark, threshold, now }`.
 * @returns {{ events: object[], next: object }} `{ key: aurora_possible }` or
 * `{ key: aurora_ended, reason: dawn|decreased, max }`.
 */
function detectAurora(state, { probability, observation, dark, threshold, now }) {
  const fresh =
    Number.isFinite(probability) &&
    Number.isFinite(observation) &&
    now - observation <= OVATION_FRESH_MS;
  const possible = fresh && dark === true && probability >= threshold;
  if (!state?.initialized) {
    return {
      events: [],
      next: {
        initialized: true,
        active: possible,
        announced: false,
        max: possible ? probability : 0,
      },
    };
  }
  const events = [];
  const next = { ...state };
  if (!state.active) {
    if (possible) {
      events.push({ key: TRIGGERS.AURORA_POSSIBLE });
      Object.assign(next, { active: true, announced: true, max: probability });
    }
    return { events, next };
  }
  if (fresh) next.max = Math.max(state.max ?? 0, probability);
  const reason =
    dark === false
      ? 'dawn'
      : fresh && probability < threshold - hysteresisOf(threshold)
        ? 'decreased'
        : null;
  if (reason) {
    if (state.announced) events.push({ key: TRIGGERS.AURORA_ENDED, reason, max: next.max });
    Object.assign(next, { active: false, announced: false, max: 0 });
  }
  return { events, next };
}

export {
  TRIGGERS,
  QUIET_MS,
  STORM_KP,
  OVATION_FRESH_MS,
  levelName,
  detectScale,
  detectFlare,
  detectAlerts,
  stormEpisodes,
  detectForecast,
  hysteresisOf,
  detectAurora,
};
