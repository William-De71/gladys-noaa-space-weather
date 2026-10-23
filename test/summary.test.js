import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gOfKp,
  rOfFlux,
  activityText,
  kpTonight,
  forecastDays,
  spaceWeatherOutputs,
  forecastOutputs,
  auroraOutputs,
  scaleEventData,
  stormEndedData,
  flareData,
  alertData,
  forecastData,
  SPACE_OUTPUTS,
  FORECAST_OUTPUTS,
  AURORA_OUTPUTS,
} from '../src/summary.js';
import { parseForecast, parseScales, xrayClass } from '../src/parse.js';
import { parseAlerts } from '../src/alerts.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture, NOW, TZ, HOUR, MINUTE } from './helpers/fake-swpc.js';

const forecast = parseForecast(fixture('forecast'));
const scales = parseScales(fixture('scales'));
const VIEW = {
  now: NOW,
  kpEstimated: { at: NOW, kp: 5.67 },
  scales,
  forecast,
  wind: { speed: 650 },
  mag: { bz: -12.3 },
};

test('levels: G from the Kp, R from the X-ray flux, the activity in words', () => {
  assert.deepEqual([0, 4.67, 5, 5.67, 6, 8.67, 9].map(gOfKp), [0, 0, 1, 1, 2, 4, 5]);
  assert.deepEqual(
    ['C9.9', 'M1', 'M4.9', 'M5', 'X1', 'X9.9', 'X10', 'X20'].map((c) => rOfFlux(xrayClass(c).flux)),
    [0, 1, 1, 2, 3, 3, 4, 5],
  );
  assert.deepEqual(
    [2, 3, 4, 7.33].map((kp) => activityText(kp, 'fr')),
    ['calme', 'agité', 'actif', 'orage G3'],
  );
});

test('forecast: three UTC days, the Kp of the dark hours', () => {
  assert.deepEqual(
    forecastDays(VIEW).map((d) => [d.date, d.kpMax, d.g]),
    [
      ['2026-10-23', 2.67, 0],
      ['2026-10-24', 2.67, 0],
      ['2026-10-25', 3.67, 0],
    ],
  );
  const night = {
    dark: false,
    start: Date.parse('2026-10-25T00:00:00Z'),
    end: Date.parse('2026-10-25T06:00:00Z'),
  };
  assert.equal(kpTonight(forecast, night, NOW), 3.33);
  assert.equal(kpTonight(forecast, { dark: false, start: null, end: null }, NOW), null);
  assert.equal(kpTonight(forecast, null, NOW), null);
});

test('outputs: only the declared keys, a sentence in every language', () => {
  for (const language of LANGUAGES) {
    const space = spaceWeatherOutputs(VIEW, { language, timeZone: TZ });
    assert.ok(Object.keys(space).every((key) => SPACE_OUTPUTS.includes(key)));
    assert.ok(space.summary.length > 20);
    const fc = forecastOutputs(VIEW, { language });
    assert.ok(Object.keys(fc).every((key) => FORECAST_OUTPUTS.includes(key)));
    const house = { name: 'Maison', latitude: -43, longitude: 147 };
    const au = auroraOutputs(
      {
        house,
        probability: 30,
        observation: NOW,
        fresh: true,
        darkness: { dark: true, start: NOW - HOUR, end: NOW + HOUR },
        kpTonight: 6,
        threshold: 10,
      },
      { language, timeZone: TZ, now: NOW },
    );
    assert.ok(Object.keys(au).every((key) => AURORA_OUTPUTS.includes(key)));
    assert.equal(au.possible, true);
  }
  assert.equal(
    spaceWeatherOutputs(VIEW, { language: 'en', timeZone: TZ }).summary,
    'Kp 5.67 (storm G1). NOAA scales: G0, S0, R0. Solar wind 650 km/s, Bz -12.3 nT.',
  );
  assert.equal(
    forecastOutputs(VIEW, { language: 'fr' }).summary,
    'Kp maximal prévu : 2,67 aujourd’hui, 2,67 demain, 3,67 après-demain (jours UTC). Pas d’orage géomagnétique prévu. Probabilités sur 3 jours : black-out radio R1–R2 20 %, R3 ou plus 5 %, tempête de radiations S1 ou plus 5 %.',
  );
  const south = auroraOutputs(
    {
      house: { name: 'Hobart', latitude: -42.9 },
      probability: 30,
      observation: NOW,
      fresh: true,
      darkness: { dark: true, start: null, end: null },
      kpTonight: null,
      threshold: 10,
    },
    { language: 'de', timeZone: TZ, now: NOW },
  );
  assert.match(south.summary, /Schau nach Süden/);
  assert.equal(
    spaceWeatherOutputs({ now: NOW, forecast: [] }, { language: 'es' }).summary,
    'Sin datos recientes del SWPC de la NOAA.',
  );
});

test('payloads: flat, scalar, a sentence in each language', () => {
  for (const language of LANGUAGES) {
    const payloads = [
      scaleEventData({ scale: 'g', level: 4, previous: 2 }, VIEW, language),
      scaleEventData({ scale: 's', level: 1, previous: 0 }, VIEW, language),
      scaleEventData({ scale: 'r', level: 3, previous: 1 }, VIEW, language),
      stormEndedData({ max: 4, start: NOW - 10 * HOUR, end: NOW - 3 * HOUR }, VIEW, language),
      flareData(
        {
          begin: NOW - 9 * MINUTE,
          max: NOW - 2 * MINUTE,
          end: null,
          maxClass: xrayClass('X2.1'),
          maxFlux: 2.1e-4,
        },
        { language, timeZone: TZ, now: NOW },
      ),
      alertData(parseAlerts(fixture('alerts'))[0], { language, timeZone: TZ, now: NOW }),
      forecastData(
        { start: NOW + 30 * HOUR, end: NOW + 36 * HOUR, maxKp: 7 },
        { language, timeZone: TZ, now: NOW },
      ),
    ];
    for (const data of payloads) {
      assert.ok(Object.keys(data).length <= 30);
      for (const value of Object.values(data)) {
        assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
        if (typeof value === 'string') assert.ok(value.length <= 1000);
      }
      assert.ok(data.sentence.length > 10);
    }
    assert.equal(payloads[4].radio_blackout, 'R3');
    assert.equal(payloads[6].level, 'G3');
    assert.equal(payloads[3].duration_hours, 7);
  }
  const x = flareData(
    { begin: NOW, max: NOW, maxClass: xrayClass('X1.0'), maxFlux: null },
    { language: 'fr', timeZone: TZ, now: NOW },
  );
  assert.equal(
    x.sentence,
    'Éruption solaire X1.0 (pic à 17:05). Éruption majeure : coupures de la radio HF et erreurs GPS possibles sur la face éclairée.',
  );
  assert.equal(x.peak_flux, 1e-4);
});
