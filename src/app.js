// -----------------------------------------------------------------------------
// The NOAA Space Weather integration: every handler, registered on a Gladys
// client.
//
// Brings the space weather of the NOAA Space Weather Prediction Center
// (public data, no key) into Gladys:
//   - devices (device.js): "Space weather" (Kp, NOAA scales G / S / R, solar
//     wind, magnetic field, radio flux, X-ray class) and one "Aurora" device
//     per located house (OVATION probability, dark sky, Kp expected tonight);
//   - scene triggers (events.js): geomagnetic storm and its end, radiation
//     storm, radio blackout, M and X flares, aurora possible at a house and
//     its end, each new SWPC message, a storm in the forecast;
//   - scene actions (summary.js): read the space weather, the aurora at a
//     house, the 3-day forecast, with sentences ready to send;
//   - dashboard widgets (widgets.js): overview, aurora, SWPC messages.
//
// The integration's own timer (every 30 s) reads what is due: the estimated
// Kp every minute, the solar wind, the magnetic field, the flares and the
// scales every 5 minutes, the messages every 10, the 3-hour Kp every 30, the
// forecast every hour, the radio flux every 3 hours, and the OVATION grid
// (920 kB) every 20 minutes ONLY while an Aurora device exists or an aurora
// widget was shown lately. Conditional requests (If-Modified-Since /
// If-None-Match); after a failure, a product waits twice as long each time
// (an hour at most). Never a request from a widget handler; a scene action
// only reads what is too old.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake SWPC (test/helpers/fake-swpc.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createSwpcClient } from './swpc-api.js';
import {
  parseKp1m,
  parseKp3h,
  parseForecast,
  parseScales,
  parseWind,
  parseMag,
  parseFlux,
  parseFlare,
} from './parse.js';
import { parseAlerts } from './alerts.js';
import { parseOvation, probabilityAt } from './ovation.js';
import { darkness } from './sun.js';
import { createStore, DEFAULT_DIR } from './store.js';
import {
  globalIds,
  auroraIds,
  houseOfExternalId,
  buildGlobalDevice,
  buildAuroraDevice,
  buildGlobalStates,
  buildAuroraStates,
} from './device.js';
import {
  TRIGGERS,
  detectScale,
  detectFlare,
  detectAlerts,
  detectForecast,
  detectAurora,
  levelName,
  OVATION_FRESH_MS,
} from './events.js';
import {
  SCENE_ACTIONS,
  roundKp,
  kpNowOf,
  kpTonight,
  spaceWeatherOutputs,
  forecastOutputs,
  auroraOutputs,
  scaleEventData,
  stormEndedData,
  flareData,
  auroraData,
  alertData,
  forecastData,
} from './summary.js';
import {
  WIDGETS,
  messageContent,
  buildOverviewWidget,
  buildAuroraWidget,
  buildAlertsWidget,
} from './widgets.js';
import { MINUTE_MS, HOUR_MS, DAY_MS, defaultTimeZone, formatTime } from './time.js';
import { t, all, formatNumber, LANGUAGES } from './i18n.js';

const ACTIONS = { TEST_CONNECTION: 'test_connection', DIAGNOSTIC: 'diagnostic' };
const TICK_MS = 30 * 1000;
// No burst at startup: the first readings wait a little.
const STARTUP_DELAY_MS = 10 * 1000;
// The rhythm of each product, and how old its data may be to say "now".
const PRODUCTS = {
  kp1m: { every: MINUTE_MS, fresh: 30 * MINUTE_MS },
  scales: { every: 5 * MINUTE_MS, fresh: HOUR_MS },
  wind: { every: 5 * MINUTE_MS, fresh: HOUR_MS },
  mag: { every: 5 * MINUTE_MS, fresh: HOUR_MS },
  flare: { every: 5 * MINUTE_MS, fresh: HOUR_MS },
  alerts: { every: 10 * MINUTE_MS, fresh: 2 * HOUR_MS },
  kp3h: { every: 30 * MINUTE_MS, fresh: 9 * HOUR_MS },
  forecast: { every: HOUR_MS, fresh: 12 * HOUR_MS },
  flux: { every: 3 * HOUR_MS, fresh: 3 * DAY_MS },
  ovation: { every: 20 * MINUTE_MS, fresh: OVATION_FRESH_MS },
};
const MAX_BACKOFF_MS = HOUR_MS;
// An aurora widget shown this long ago still asks for the OVATION grid.
const WIDGET_SEEN_MS = 30 * MINUTE_MS;
const HOUSES_EVERY_MS = HOUR_MS;
const ALERTS_STORED = 30;
const HISTORY_MS = DAY_MS;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const USER_AGENT = `gladys-noaa-space-weather/${VERSION} (+https://github.com/William-De71/gladys-noaa-space-weather)`;

// How each product is read, and what of it is kept.
const READERS = {
  kp1m: parseKp1m,
  kp3h: (raw) => {
    const rows = parseKp3h(raw);
    return rows.length ? rows.slice(-64) : null;
  },
  forecast: (raw) => {
    const rows = parseForecast(raw);
    return rows.length ? rows : null;
  },
  scales: parseScales,
  wind: parseWind,
  mag: parseMag,
  flux: parseFlux,
  flare: parseFlare,
  alerts: (raw) => (Array.isArray(raw) ? parseAlerts(raw) : null),
  ovation: parseOvation,
};

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport (tests).
 * @param {string} [options.baseUrl] - The SWPC root (tests).
 * @param {string} [options.dataDir] - The writable folder (/data).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of Gladys (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    baseUrl,
    dataDir = DEFAULT_DIR,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  let language = guessLanguage(timeZone);
  let createdDevices = new Set();
  let houses = [];
  let housesAt = 0;
  let lastStatus = null;
  let lastDiscovery = null;
  let timer = null;
  let startTimer = null;
  let running = null;
  let stopped = false;
  // The OVATION grid stays in memory only (65 kB); its houses are in /data.
  let ovationGrid = null;
  let auroraWidgetSeen = 0;

  const store = createStore({ dir: dataDir, logger });
  const api = createSwpcClient({
    userAgent: USER_AGENT,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  });

  /**
   * @description Remember the language of a widget request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!LANGUAGES.includes(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  // --- What is known ------------------------------------------------------------------

  /**
   * @description The record of a product in the store.
   * @param {string} product - A PRODUCTS key.
   * @returns {object} `{ value, fetchedAt, triedAt, failures, error }`.
   */
  function recordOf(product) {
    store.data.products[product] ??= {};
    return store.data.products[product];
  }

  /**
   * @description The value of a product, null when older than its freshness.
   * @param {string} product - A PRODUCTS key.
   * @param {Function} [instantOf] - The instant a value describes (else the reading time).
   * @returns {unknown} The value.
   */
  function freshValue(product, instantOf) {
    const record = recordOf(product);
    if (record.value === undefined || record.value === null) return null;
    const at = instantOf ? instantOf(record.value) : record.fetchedAt;
    return Number.isFinite(at) && now() - at <= PRODUCTS[product].fresh ? record.value : null;
  }

  /**
   * @description The space weather now, as the widgets, the scenes and the states see it.
   * @returns {object} The view.
   */
  function spaceView() {
    const kp3h = recordOf('kp3h').value ?? [];
    const lastKp = kp3h[kp3h.length - 1] ?? null;
    const flare = recordOf('flare').value ?? null;
    const flareFresh = freshValue('flare', (value) => value.at ?? null);
    const fetched = Object.keys(PRODUCTS)
      .map((product) => recordOf(product).fetchedAt)
      .filter(Number.isFinite);
    return {
      now: now(),
      kpEstimated: freshValue('kp1m', (value) => value.at),
      kp: lastKp && now() - lastKp.at <= PRODUCTS.kp3h.fresh ? lastKp : null,
      scales: freshValue('scales'),
      wind: freshValue('wind', (value) => value.at ?? null),
      mag: freshValue('mag', (value) => value.at ?? null),
      flux: freshValue('flux', (value) => value.at ?? null),
      xray: flareFresh?.current ?? null,
      flare,
      forecast: recordOf('forecast').value ?? [],
      alerts: recordOf('alerts').value ?? [],
      alertsRead: Number.isFinite(recordOf('alerts').fetchedAt),
      updatedAt: fetched.length ? Math.max(...fetched) : null,
    };
  }

  /**
   * @description The aurora at a house.
   * @param {object} house - `{ id, name, selector, latitude, longitude }`.
   * @returns {object} The aurora view.
   */
  function auroraView(house) {
    const record = store.data.auroras[house.id] ?? {};
    const dark = darkness(now(), house);
    return {
      house,
      probability: Number.isFinite(record.probability) ? record.probability : null,
      observation: Number.isFinite(record.observation) ? record.observation : null,
      fresh: Number.isFinite(record.observation) && now() - record.observation <= OVATION_FRESH_MS,
      darkness: dark,
      kpTonight: kpTonight(recordOf('forecast').value ?? [], dark, now()),
      threshold: config.threshold,
      history: Array.isArray(record.history) ? record.history : [],
    };
  }

  /**
   * @description The values of the features of the global device now.
   * @returns {object} `{ kp_estimated, kp, … }`, null when unknown.
   */
  function globalValues() {
    const view = spaceView();
    return {
      kp_estimated: view.kpEstimated?.kp ?? null,
      kp: view.kp?.kp ?? null,
      g_scale: view.scales?.now?.g ?? null,
      s_scale: view.scales?.now?.s ?? null,
      r_scale: view.scales?.now?.r ?? null,
      solar_wind_speed: view.wind?.speed ?? null,
      bz: view.mag?.bz ?? null,
      bt: view.mag?.bt ?? null,
      radio_flux: view.flux?.flux ?? null,
      xray_class: view.xray?.text ?? null,
    };
  }

  /**
   * @description The values of the features of the aurora device of a house now.
   * @param {object} house - The house.
   * @returns {object} `{ probability, night, kp_tonight }`.
   */
  function auroraValues(house) {
    const aurora = auroraView(house);
    return {
      probability: aurora.fresh ? aurora.probability : null,
      night: aurora.darkness ? (aurora.darkness.dark ? 1 : 0) : null,
      kp_tonight: aurora.kpTonight,
    };
  }

  // --- Houses and devices -------------------------------------------------------------

  /**
   * @description Read the houses of Gladys (the located ones only).
   * @returns {Promise<void>}
   */
  async function refreshHouses() {
    try {
      const list = await gladys.getHouses();
      houses = (Array.isArray(list) ? list : []).filter(
        (house) => house?.id && Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
      );
      housesAt = now();
    } catch (err) {
      logger.warn(`Unable to read the houses of Gladys: ${err.message}`);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description The houses whose Aurora device exists.
   * @returns {object[]} The houses.
   */
  const createdAuroraHouses = () =>
    houses.filter((house) => createdDevices.has(auroraIds(gladys, house.id).device));

  /**
   * @description Whether the OVATION grid is wanted: an Aurora device, or an aurora widget shown lately.
   * @returns {boolean} True when wanted.
   */
  const ovationWanted = () =>
    houses.length > 0 &&
    (createdAuroraHouses().length > 0 || now() - auroraWidgetSeen < WIDGET_SEEN_MS);

  /**
   * @description Offer the devices on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = [
      buildGlobalDevice(gladys, lang),
      ...houses.map((house) => buildAuroraDevice(gladys, house, lang)),
    ];
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const states = [];
    if (createdDevices.has(globalIds(gladys).device)) {
      states.push(...buildGlobalStates(gladys, globalValues()));
    }
    for (const house of createdAuroraHouses()) {
      states.push(...buildAuroraStates(gladys, house.id, auroraValues(house)));
    }
    if (states.length) {
      await gladys
        .publishChangedStates(states)
        .catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));
    }
  }

  // --- Status -------------------------------------------------------------------------

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const clipped = Object.fromEntries(
      Object.entries(message).map(([lang, text]) => [lang, text.slice(0, 200)]),
    );
    const signature = JSON.stringify([connected, clipped]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, clipped);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Work out the connection status.
   * @returns {Promise<void>}
   */
  async function refreshStatus() {
    const records = Object.keys(PRODUCTS)
      .filter((product) => product !== 'ovation')
      .map(recordOf);
    const lastSuccess = Math.max(0, ...records.map((record) => record.fetchedAt ?? 0));
    const failing = records.filter((record) => record.failures > 0);
    if (!lastSuccess) {
      if (failing.length) {
        const error = store.data.lastError;
        await reportStatus(
          false,
          all('statusUnreachable', (lang) => ({
            time: formatTime(error?.since ?? now(), { language: lang, timeZone, now: now() }),
            detail: error?.message ?? '',
          })),
        );
      } else {
        await reportStatus(true, all('statusWaiting'));
      }
      return;
    }
    // The estimated Kp is read every minute: half an hour without any answer is an outage.
    if (failing.length > 0 && now() - lastSuccess > 30 * MINUTE_MS) {
      await reportStatus(
        false,
        all('statusUnreachable', (lang) => ({
          time: formatTime(lastSuccess, { language: lang, timeZone, now: now() }),
          detail: store.data.lastError?.message ?? '',
        })),
      );
      return;
    }
    const view = spaceView();
    const kp = roundKp(kpNowOf(view));
    const scales = view.scales?.now;
    await reportStatus(
      true,
      all((lang) =>
        [
          t('statusOk', lang, {
            kp: formatNumber(kp, lang, 2),
            g: levelName('g', scales?.g ?? 0),
            s: levelName('s', scales?.s ?? 0),
            r: levelName('r', scales?.r ?? 0),
          }),
          houses.length ? null : t('statusNoHouse', lang),
        ]
          .filter(Boolean)
          .join(' '),
      ),
    );
  }

  /**
   * @description Ask the open widgets to pull their content again.
   * @param {string[]} [keys] - The widgets (all by default).
   */
  function refreshWidgets(keys = Object.values(WIDGETS)) {
    for (const key of keys) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading ------------------------------------------------------------------------

  /**
   * @description Whether a product is due now.
   * @param {string} product - A PRODUCTS key.
   * @returns {boolean} True when due.
   */
  function isDue(product) {
    if (product === 'ovation' && !ovationWanted()) return false;
    const record = recordOf(product);
    const every = PRODUCTS[product].every;
    const wait = record.failures
      ? Math.min(MAX_BACKOFF_MS, every * 2 ** Math.min(record.failures, 6))
      : every;
    return now() - (record.triedAt ?? 0) >= wait;
  }

  /**
   * @description Compute the probability at every located house from the grid.
   * @param {object} ovation - parseOvation().
   */
  function learnOvation(ovation) {
    for (const house of houses) {
      const record = (store.data.auroras[house.id] ??= {});
      const probability = probabilityAt(ovation.grid, house.latitude, house.longitude);
      if (!Number.isFinite(probability)) continue;
      const observation = ovation.observation ?? now();
      const history = (Array.isArray(record.history) ? record.history : []).filter(
        (point) => point.t >= now() - HISTORY_MS && point.t !== observation,
      );
      history.push({ t: observation, v: probability });
      Object.assign(record, {
        probability,
        observation,
        forecast: ovation.forecast ?? null,
        history: history.sort((a, b) => a.t - b.t).slice(-150),
      });
    }
    // Forget the houses that are gone.
    for (const id of Object.keys(store.data.auroras)) {
      if (!houses.some((house) => house.id === id)) delete store.data.auroras[id];
    }
  }

  /**
   * @description Read one product of the SWPC and keep what it says.
   * @param {string} product - A PRODUCTS key.
   * @returns {Promise<boolean>} True when its data changed.
   */
  async function read(product) {
    const record = recordOf(product);
    record.triedAt = now();
    try {
      const answer = await api.get(product);
      if (answer.status === 304) {
        // Unchanged; the grid of OVATION may be gone (a restart): read in full next time.
        if (product === 'ovation' && !ovationGrid) api.forget(product);
        Object.assign(record, { fetchedAt: now(), failures: 0, error: null });
        return false;
      }
      const value = READERS[product](answer.data);
      if (value === null || value === undefined) {
        api.forget(product);
        throw Object.assign(new Error('Unexpected content'), { kind: 'invalid' });
      }
      let changed;
      if (product === 'ovation') {
        ovationGrid = value;
        learnOvation(value);
        changed = true;
      } else if (product === 'alerts') {
        // Every message of the feed counts for the trigger; a few are kept.
        const before = JSON.stringify(record.value?.[0]?.id ?? null);
        record.value = value.slice(0, ALERTS_STORED).map((message) => ({
          ...message,
          text: message.text.slice(0, 2000),
        }));
        record.ids = value.map((message) => message.id);
        changed = before !== JSON.stringify(record.value[0]?.id ?? null);
      } else {
        changed = JSON.stringify(record.value) !== JSON.stringify(value);
        record.value = value;
      }
      Object.assign(record, { fetchedAt: now(), failures: 0, error: null });
      return changed;
    } catch (err) {
      record.failures = (record.failures ?? 0) + 1;
      const kind = err.kind ?? 'failed';
      record.error = { kind, message: String(err.message).slice(0, 200) };
      const since = store.data.lastError?.since ?? now();
      store.data.lastError = { product, kind, message: record.error.message, at: now(), since };
      logger.warn(`SWPC ${product} (${kind}): ${err.message}`);
      return false;
    }
  }

  /**
   * @description The scene events after the readings, from what is known now.
   * @returns {Array<{ key: string, data: object }>} The events.
   */
  function detectEvents() {
    const seen = store.data.seen;
    const lang = textLanguage();
    const view = spaceView();
    const events = [];
    const options = { language: lang, timeZone, now: now() };
    const scales = view.scales?.now;
    if (scales) {
      for (const scale of ['g', 's', 'r']) {
        const { events: found, next } = detectScale(seen[scale], {
          scale,
          level: scales[scale],
          now: now(),
        });
        seen[scale] = next;
        for (const event of found) {
          events.push({
            key: event.key,
            data:
              event.key === TRIGGERS.GEOMAGNETIC_STORM_ENDED
                ? stormEndedData(event, view, lang)
                : scaleEventData(event, view, lang),
          });
        }
      }
    }
    if (freshValue('flare', (value) => value.at ?? null)) {
      const { events: found, next } = detectFlare(seen.flare, view.flare, now());
      seen.flare = next;
      found.forEach((event) =>
        events.push({ key: event.key, data: flareData(event.flare, options) }),
      );
    }
    if (recordOf('alerts').fetchedAt) {
      const record = recordOf('alerts');
      const messages = record.value ?? [];
      const ids = new Set(record.ids ?? []);
      // The ids of the whole feed: a message no longer kept is still known.
      const { events: found, next } = detectAlerts(
        seen.alerts?.initialized ? seen.alerts : { initialized: false, ids: [...ids] },
        messages,
        now(),
      );
      seen.alerts = { initialized: true, ids: [...new Set([...next.ids, ...ids])].slice(-300) };
      found.forEach((event) =>
        events.push({ key: event.key, data: alertData(event.message, options) }),
      );
    }
    if (view.forecast.length && recordOf('forecast').fetchedAt) {
      const { events: found, next } = detectForecast(seen.forecast, view.forecast, now());
      seen.forecast = next;
      found.forEach((event) =>
        events.push({ key: event.key, data: forecastData(event.episode, options) }),
      );
    }
    seen.aurora ??= {};
    const kp = kpNowOf(view);
    for (const house of createdAuroraHouses()) {
      const aurora = auroraView(house);
      const { events: found, next } = detectAurora(seen.aurora[house.id], {
        probability: aurora.probability,
        observation: aurora.observation,
        dark: aurora.darkness?.dark ?? null,
        threshold: config.threshold,
        now: now(),
      });
      seen.aurora[house.id] = next;
      const device = auroraIds(gladys, house.id).device;
      found.forEach((event) =>
        events.push({
          key: event.key,
          data: auroraData(event, aurora, { ...options, kp, device }),
        }),
      );
    }
    for (const id of Object.keys(seen.aurora)) {
      if (!houses.some((house) => house.id === id)) delete seen.aurora[id];
    }
    return events;
  }

  /**
   * @description Publish scene events, one by one.
   * @param {Array<{ key: string, data: object }>} events - The events.
   * @returns {Promise<void>}
   */
  async function publishEvents(events) {
    for (const { key, data } of events) {
      logger.info(
        `NOAA: ${key}${data.level ? ` (${data.level})` : ''}${data.class ? ` (${data.class})` : ''}`,
      );
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Unable to fire ${key}: ${err.message}`);
      }
    }
  }

  /**
   * @description Read what is due, then publish what changed.
   * @returns {Promise<void>}
   */
  async function runReadings() {
    if (now() - housesAt >= HOUSES_EVERY_MS) {
      const before = JSON.stringify(houses);
      await refreshHouses();
      if (JSON.stringify(houses) !== before) {
        await publishDiscoveredDevices().catch((err) =>
          logger.warn(`Unable to offer the devices: ${err.message}`),
        );
      }
    }
    const changed = new Set();
    for (const product of Object.keys(PRODUCTS)) {
      if (stopped) return;
      if (isDue(product) && (await read(product))) changed.add(product);
    }
    if ([...Object.keys(PRODUCTS)].every((product) => !recordOf(product).failures)) {
      store.data.lastError = null;
    }
    const events = detectEvents();
    await store.save();
    await publishEvents(events);
    await publishStates();
    if (changed.size) {
      const widgets = new Set();
      if ([...changed].some((product) => !['alerts', 'ovation'].includes(product))) {
        widgets.add(WIDGETS.OVERVIEW);
      }
      if (changed.has('alerts')) {
        widgets.add(WIDGETS.ALERTS).add(WIDGETS.OVERVIEW);
      }
      if (changed.has('ovation') || changed.has('forecast')) widgets.add(WIDGETS.AURORA);
      refreshWidgets([...widgets]);
    }
    await refreshStatus();
  }

  /**
   * @description Run the readings (one round at a time).
   * @returns {Promise<void>}
   */
  function tick() {
    if (!running) {
      running = runReadings()
        .catch((err) => logger.error('Readings', err))
        .finally(() => {
          running = null;
        });
    }
    return running;
  }

  /**
   * @description (Re)arm the reading timer.
   */
  function schedule() {
    clearInterval(timer);
    clearTimeout(startTimer);
    if (!timers || stopped) {
      return;
    }
    startTimer = setTimeout(tick, STARTUP_DELAY_MS);
    startTimer.unref?.();
    timer = setInterval(tick, TICK_MS);
    timer.unref?.();
  }

  /**
   * @description Read some products now when their data are too old (scene actions).
   * @param {string[]} products - PRODUCTS keys.
   * @returns {Promise<void>}
   */
  async function ensureFresh(products) {
    for (const product of products) {
      const record = recordOf(product);
      const old = now() - (record.fetchedAt ?? 0) > 2 * PRODUCTS[product].every;
      const resting =
        record.failures > 0 && now() - (record.triedAt ?? 0) < PRODUCTS[product].every;
      if (old && !resting) {
        await read(product);
      }
    }
    await store.save();
  }

  /**
   * @description The house a widget or a scene action targets: the house of
   * an Aurora device, else the first located house.
   * @param {unknown} externalId - The `source: "devices"` value.
   * @returns {object|null} The house.
   */
  function targetHouse(externalId) {
    const id = houseOfExternalId(externalId);
    return houses.find((house) => house.id === id) ?? houses[0] ?? null;
  }

  // --- Dashboard widgets --------------------------------------------------------------

  gladys.onWidgetGet(WIDGETS.OVERVIEW, async ({ language: lang }) => {
    rememberLanguage(lang);
    return buildOverviewWidget({ view: spaceView(), language: lang, timeZone });
  });

  gladys.onWidgetGet(WIDGETS.AURORA, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const before = auroraWidgetSeen;
    auroraWidgetSeen = now();
    if (houses.length === 0) {
      return messageContent(t('widgetNoHouse', lang));
    }
    // The OVATION grid is read by the timer from now on; the first time, soon.
    if (now() - before >= WIDGET_SEEN_MS && timers) {
      setTimeout(() => tick(), 1000).unref?.();
    }
    return buildAuroraWidget({
      aurora: auroraView(targetHouse(settings.device)),
      language: lang,
      now: now(),
      timeZone,
    });
  });

  gladys.onWidgetGet(WIDGETS.ALERTS, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    if (!recordOf('alerts').fetchedAt) {
      return messageContent(t('widgetWaiting', lang));
    }
    return buildAlertsWidget({
      alerts: recordOf('alerts').value ?? [],
      language: lang,
      now: now(),
      settings,
    });
  });

  // --- Scene actions ------------------------------------------------------------------
  // They answer from what the timer read, and read again only what is too old.

  gladys.onSceneAction(SCENE_ACTIONS.GET_SPACE_WEATHER, async () => {
    const lang = textLanguage();
    await ensureFresh(['kp1m', 'scales', 'wind', 'mag', 'flare', 'kp3h', 'flux']);
    const view = spaceView();
    if (kpNowOf(view) === null && !view.scales && !view.wind) {
      throw new Error(t('errNoData', lang, { detail: store.data.lastError?.message ?? '–' }));
    }
    return spaceWeatherOutputs(view, { language: lang, timeZone });
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_FORECAST, async () => {
    const lang = textLanguage();
    await ensureFresh(['forecast', 'scales']);
    const view = spaceView();
    if (!view.forecast.length && !view.scales) {
      throw new Error(t('errNoData', lang, { detail: store.data.lastError?.message ?? '–' }));
    }
    return forecastOutputs(view, { language: lang });
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_AURORA, async (fields = {}) => {
    const lang = textLanguage();
    if (houses.length === 0) await refreshHouses();
    const house = targetHouse(fields.device);
    if (!house) {
      throw new Error(t('errNoHouse', lang));
    }
    const record = store.data.auroras[house.id];
    if (!ovationGrid || !record || now() - (record.observation ?? 0) > OVATION_FRESH_MS) {
      await ensureFresh(['ovation', 'forecast']);
      if (ovationGrid && !store.data.auroras[house.id]) learnOvation(ovationGrid);
    } else {
      await ensureFresh(['forecast']);
    }
    return auroraOutputs(auroraView(house), { language: lang, timeZone, now: now() });
  });

  // --- Configuration screen actions ---------------------------------------------------

  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    await refreshHouses();
    await read('scales');
    await read('kp1m');
    await store.save();
    const failed = ['scales', 'kp1m'].map(recordOf).find((record) => record.failures > 0);
    await publishDiscoveredDevices().catch(() => {});
    await refreshStatus();
    if (failed) {
      return all('testFailed', { detail: failed?.error?.message ?? '–' });
    }
    const view = spaceView();
    const scales = view.scales?.now;
    return all((lang) =>
      t('testOk', lang, {
        kp: formatNumber(roundKp(kpNowOf(view)), lang, 2),
        time:
          formatTime(view.kpEstimated?.at ?? null, { language: lang, timeZone, now: now() }) || '–',
        g: levelName('g', scales?.g ?? 0),
        s: levelName('s', scales?.s ?? 0),
        r: levelName('r', scales?.r ?? 0),
        houses: houses.length ? houses.map((house) => house.name).join(', ') : t('none', lang),
      }).slice(0, 1000),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const iso = (value) => (Number.isFinite(value) ? new Date(value).toISOString() : null);
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      language: config.language,
      threshold: config.threshold,
      houses: houses.map((house) => ({ id: house.id, name: house.name, located: true })),
      created: [...createdDevices],
      ovationWanted: ovationWanted(),
      ovationInMemory: Boolean(ovationGrid),
      lastError: store.data.lastError,
      products: Object.fromEntries(
        Object.keys(PRODUCTS).map((product) => {
          const record = recordOf(product);
          return [
            product,
            {
              fetchedAt: iso(record.fetchedAt),
              triedAt: iso(record.triedAt),
              failures: record.failures ?? 0,
              error: record.error ?? null,
            },
          ];
        }),
      ),
      values: globalValues(),
      auroras: Object.fromEntries(
        houses.map((house) => {
          const aurora = auroraView(house);
          return [
            house.id,
            {
              probability: aurora.probability,
              observation: iso(aurora.observation),
              dark: aurora.darkness?.dark ?? null,
              kpTonight: aurora.kpTonight,
            },
          ];
        }),
      ),
      seen: store.data.seen,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `NOAA diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices ------------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await refreshHouses();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishStates();
    refreshWidgets();
    // An Aurora device asks for the OVATION grid: read it soon.
    if (timers && ovationWanted() && !ovationGrid) setTimeout(() => tick(), 1000).unref?.();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration ------------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    await loadConfig(rawConfig);
    logger.info('Configuration updated');
    lastStatus = null;
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await publishStates();
    await refreshStatus();
    refreshWidgets([WIDGETS.AURORA]);
  });

  // --- Connection lifecycle -----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await store.load();
      await loadConfig();
      await refreshHouses();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to offer the devices: ${err.message}`),
      );
      await publishStates();
      await refreshStatus();
      schedule();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown --------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearInterval(timer);
    clearTimeout(startTimer);
    await store.save();
  });

  return {
    store,
    tick,
    isDue,
    spaceView,
    auroraView,
    globalValues,
    targetHouse,
    houses: () => houses,
    ovationWanted,
    seeAuroraWidget: () => {
      auroraWidgetSeen = now();
    },
    getConfig: () => config,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, PRODUCTS, USER_AGENT, TICK_MS };
