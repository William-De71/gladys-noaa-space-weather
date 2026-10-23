// -----------------------------------------------------------------------------
// HTTP client of the NOAA SWPC data service (https://services.swpc.noaa.gov/),
// public data without a key. Only GET requests of JSON files, one at a time:
//
//   json/planetary_k_index_1m.json                 estimated Kp, every minute
//   products/noaa-planetary-k-index.json           official 3-hour Kp (7 days)
//   products/noaa-planetary-k-index-forecast.json  Kp observed, estimated, predicted
//   products/noaa-scales.json                      NOAA scales G / S / R, now and 3 days
//   products/alerts.json                           the messages of the SWPC
//   products/summary/solar-wind-speed.json         solar wind speed (km/s)
//   products/summary/solar-wind-mag-field.json     Bt and Bz (nT)
//   products/summary/10cm-flux.json                10.7 cm radio flux (sfu)
//   json/goes/primary/xray-flares-latest.json      the latest X-ray flare
//   json/ovation_aurora_latest.json                OVATION aurora grid (about 920 kB)
//
// Every answer carries Last-Modified and a (weak) ETag, and the server
// honours If-Modified-Since and If-None-Match with a 304 (checked live on
// 2026-10-23): the validators of the last answer are sent back, so an
// unchanged file costs a few hundred bytes. They live in memory only, next to
// the data they validate: after a restart the first request is a full one.
// A User-Agent names the integration and its repository, as the SWPC asks of
// automated clients.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://services.swpc.noaa.gov';
const PATHS = {
  kp1m: '/json/planetary_k_index_1m.json',
  kp3h: '/products/noaa-planetary-k-index.json',
  forecast: '/products/noaa-planetary-k-index-forecast.json',
  scales: '/products/noaa-scales.json',
  alerts: '/products/alerts.json',
  wind: '/products/summary/solar-wind-speed.json',
  mag: '/products/summary/solar-wind-mag-field.json',
  flux: '/products/summary/10cm-flux.json',
  flare: '/json/goes/primary/xray-flares-latest.json',
  ovation: '/json/ovation_aurora_latest.json',
};
const TIMEOUT_MS = 30000;

/**
 * @description An error of the SWPC service, with a kind.
 */
class SwpcError extends Error {
  /**
   * @param {string} kind - `unreachable` (no answer), `http` (an error status),
   * `invalid` (not the JSON expected).
   * @param {string} message - The message.
   * @param {object} [extra] - `{ status, product }`.
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'SwpcError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

/**
 * @description The SWPC client.
 * @param {object} options - Options.
 * @param {string} options.userAgent - The User-Agent of every request.
 * @param {Function} [options.fetch] - The fetch implementation (tests).
 * @param {string} [options.baseUrl] - The service root (tests).
 * @returns {object} `{ get, forget }`.
 */
function createSwpcClient({ userAgent, fetch: fetchFn = globalThis.fetch, baseUrl = BASE_URL }) {
  const validators = new Map();
  let busy = Promise.resolve();

  /**
   * @description One request at a time: a request waits for the previous one.
   * @param {Function} task - `() => Promise`.
   * @returns {Promise<unknown>} Its result.
   */
  function serial(task) {
    const run = busy.then(task);
    busy = run.catch(() => {});
    return run;
  }

  /**
   * @description Read one product.
   * @param {string} product - A PATHS key.
   * @param {object} [options] - `{ conditional }`: send the validators of the
   * last answer (only when its data is still at hand).
   * @returns {Promise<{ status: 200|304, data?: unknown, bytes?: number }>} The
   * parsed JSON on a 200, nothing on a 304.
   */
  function get(product, { conditional = true } = {}) {
    return serial(async () => {
      const url = new URL(PATHS[product], baseUrl);
      const headers = { 'User-Agent': userAgent, Accept: 'application/json' };
      const known = conditional ? validators.get(product) : null;
      if (known?.lastModified) headers['If-Modified-Since'] = known.lastModified;
      if (known?.etag) headers['If-None-Match'] = known.etag;
      let response;
      try {
        response = await fetchFn(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (err) {
        throw new SwpcError(
          'unreachable',
          String(err?.cause?.code ?? err?.name ?? 'network error'),
          { product },
        );
      }
      if (response.status === 304) {
        await response.body?.cancel?.().catch(() => {});
        return { status: 304 };
      }
      const body = await response.text().catch(() => '');
      if (response.status !== 200) {
        throw new SwpcError('http', `HTTP ${response.status}`, {
          status: response.status,
          product,
        });
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw new SwpcError('invalid', `Not JSON (${body.length} bytes)`, { product });
      }
      const lastModified = response.headers.get('last-modified');
      const etag = response.headers.get('etag');
      validators.set(product, { lastModified, etag });
      return { status: 200, data, bytes: body.length };
    });
  }

  return {
    get,
    // Drop the validators of a product whose data was lost or refused.
    forget: (product) => validators.delete(product),
  };
}

export { BASE_URL, PATHS, SwpcError, createSwpcClient };
