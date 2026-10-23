// A fake NOAA SWPC for the tests: a real HTTP server on 127.0.0.1 serving
// the REAL files downloaded from https://services.swpc.noaa.gov/ on
// 2026-10-23 around 15:05 UTC (test/fixtures/swpc/, the OVATION grid
// gzipped). Tests never touch the network. Nothing starts on import
// (`node --test` also runs this file).
//
//   - every answer carries Last-Modified and a weak ETag, and a request with
//     If-Modified-Since / If-None-Match matching them gets a 304 without a
//     body, like the real server (checked live on 2026-10-23);
//   - `fake.set(product, value)` replaces the content of a product (a new
//     Last-Modified and ETag), `fake.fail(product, status)` answers an error,
//     `fake.truncate(product)` cuts the JSON in half, `fake.offline = true`
//     drops the connections;
//   - `legacy: true` serves the 3-hour Kp in the former table format of the
//     SWPC (an array of arrays, a header row, strings), built from the real file.

import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PATHS } from '../../src/swpc-api.js';

// The files were read at 15:05 UTC: a Friday, 17:05 in Paris.
const NOW = Date.parse('2026-10-23T15:05:00Z');
const TZ = 'Europe/Paris';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary folder standing for /data.
 * @returns {string} The path.
 */
const dataDir = () => mkdtempSync(join(tmpdir(), 'noaa-space-weather-'));

const FIXTURES = new URL('../fixtures/swpc/', import.meta.url);
const FILES = {
  kp1m: 'json_planetary_k_index_1m.json',
  kp3h: 'products_noaa-planetary-k-index.json',
  forecast: 'products_noaa-planetary-k-index-forecast.json',
  scales: 'products_noaa-scales.json',
  alerts: 'products_alerts.json',
  wind: 'products_summary_solar-wind-speed.json',
  mag: 'products_summary_solar-wind-mag-field.json',
  flux: 'products_summary_10cm-flux.json',
  flare: 'json_goes_primary_xray-flares-latest.json',
  ovation: 'json_ovation_aurora_latest.json.gz',
};

/**
 * @description The real file of a product, parsed.
 * @param {string} product - A PATHS key.
 * @returns {unknown} The JSON.
 */
function fixture(product) {
  const raw = readFileSync(new URL(FILES[product], FIXTURES));
  return JSON.parse(
    product === 'ovation' ? gunzipSync(raw).toString('utf8') : raw.toString('utf8'),
  );
}

/**
 * @description The 3-hour Kp in the former table format of the SWPC.
 * @param {object[]} rows - The new format.
 * @returns {Array<Array<string>>} The table.
 */
function legacyKp(rows) {
  return [
    ['time_tag', 'Kp', 'a_running', 'station_count'],
    ...rows.map((row) => [
      `${row.time_tag.replace('T', ' ')}.000`,
      row.Kp.toFixed(2),
      String(row.a_running),
      String(row.station_count),
    ]),
  ];
}

/**
 * @description Start the fake SWPC.
 * @param {object} [options] - `{ legacy }`.
 * @returns {Promise<object>} The fake: `{ url, calls, set, fail, truncate, of, close }`.
 */
async function startFakeSwpc({ legacy = false } = {}) {
  const products = Object.fromEntries(Object.keys(PATHS).map((product) => [product, null]));
  const byPath = new Map(Object.entries(PATHS).map(([product, path]) => [path, product]));
  const fake = {
    calls: [],
    offline: false,
    failures: new Map(),
    truncated: new Set(),
  };
  let version = 0;
  /**
   * @description Replace the content of a product.
   * @param {string} product - A PATHS key.
   * @param {unknown} value - Its JSON (a string is sent as it is).
   */
  fake.set = (product, value) => {
    version += 1;
    products[product] = {
      body: typeof value === 'string' ? value : JSON.stringify(value),
      lastModified: new Date(Date.UTC(2026, 9, 23, 15, 0, version)).toUTCString(),
      etag: `W/"${product}-${version}"`,
    };
  };
  for (const product of Object.keys(PATHS)) {
    const data = fixture(product);
    fake.set(product, product === 'kp3h' && legacy ? legacyKp(data) : data);
  }
  fake.fail = (product, status = 503) => fake.failures.set(product, status);
  fake.heal = (product) => fake.failures.delete(product);
  fake.truncate = (product) => fake.truncated.add(product);
  fake.of = (product) => fake.calls.filter((call) => call.product === product);

  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const product = byPath.get(path) ?? null;
    const call = {
      product,
      path,
      method: request.method,
      userAgent: request.headers['user-agent'] ?? null,
      ifModifiedSince: request.headers['if-modified-since'] ?? null,
      ifNoneMatch: request.headers['if-none-match'] ?? null,
      status: null,
    };
    fake.calls.push(call);
    if (fake.offline) {
      request.socket.destroy();
      return;
    }
    const answer = (status, headers = {}, body = '') => {
      call.status = status;
      response.writeHead(status, headers);
      response.end(body);
    };
    if (!product) {
      answer(404, { 'Content-Type': 'text/html' }, '<html><h1>Not Found</h1></html>');
      return;
    }
    if (fake.failures.has(product)) {
      answer(fake.failures.get(product), { 'Content-Type': 'text/html' }, '<html>error</html>');
      return;
    }
    const content = products[product];
    const validators = {
      'Last-Modified': content.lastModified,
      ETag: content.etag,
      'Cache-Control': 'max-age=60',
    };
    if (call.ifNoneMatch === content.etag || call.ifModifiedSince === content.lastModified) {
      answer(304, validators);
      return;
    }
    const body = fake.truncated.has(product)
      ? content.body.slice(0, Math.floor(content.body.length / 2))
      : content.body;
    answer(200, { 'Content-Type': 'application/json', ...validators }, body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.url = `http://127.0.0.1:${server.address().port}`;
  fake.close = () =>
    new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  return fake;
}

export { NOW, TZ, MINUTE, HOUR, FILES, silent, dataDir, fixture, legacyKp, startFakeSwpc };
