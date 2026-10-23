// -----------------------------------------------------------------------------
// Entry point of the NOAA Space Weather external integration.
//
// The space weather of the NOAA Space Weather Prediction Center
// (https://www.swpc.noaa.gov/), public data without a key:
//   - devices: "Space weather" (Kp, NOAA scales G / S / R, solar wind,
//     magnetic field, radio flux, X-ray class) and one "Aurora" device per
//     located house, offered on the Discovery screen (src/device.js);
//   - scene triggers: geomagnetic storm and its end, radiation storm, radio
//     blackout, M and X flares, aurora possible at a house and its end, each
//     new SWPC message, a storm in the forecast;
//   - scene actions: read the space weather, the aurora at a house, the
//     3-day forecast;
//   - dashboard widgets: overview, aurora, SWPC messages.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the times written in the scene texts)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the NOAA Space Weather integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
