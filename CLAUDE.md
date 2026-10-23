# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the space weather of the
[NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/) (SWPC): a
Node.js service (Node 22+, ESM, no build step) in its own sandboxed Docker
container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency, and to the public JSON files of
<https://services.swpc.noaa.gov/> (no account, no key). `type: "device"`,
Gladys 5.1.0+ (widgets, scenes), `transports: ["cloud"]`, `location: true`
(the houses, for the aurora). Not affiliated with the NOAA: never its logo.

## Commands

```bash
npm install
npm test                                  # node --test; a fake SWPC HTTP server on 127.0.0.1
node --test test/app.test.js              # one file
UPDATE_BASELINE=1 npm test                # rewrite test/fixtures/discovery.baseline.json (on purpose only)
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js               SDK wiring only (new GladysIntegration + createApp)
src/app.js             every handler; the timer (what is due per product), houses, devices
                       and states, scene events, scene actions, widgets, status
src/swpc-api.js        HTTP client: GET JSON, User-Agent, If-Modified-Since / If-None-Match
src/parse.js           the products (new objects and former tables of the SWPC)
src/alerts.js          the SWPC messages: kind, status, topic, short titles
src/ovation.js         the OVATION grid (920 kB) into bytes, the probability at a house
src/sun.js             the elevation of the sun (NOAA equations): the dark sky (-6°)
src/events.js          the detectors of the triggers (pure: state + reading -> events)
src/summary.js         outputs of the scene actions, payloads and sentences of the triggers
src/device.js          the global device and the Aurora devices, their states
src/widgets.js         overview, aurora and alerts widgets
src/store.js           /data/noaa-space-weather.json (a few kB)
src/config.js          language, aurora threshold
src/i18n.js            runtime texts, en / fr / de / es
src/time.js            UTC times of the SWPC, texts in the timezone of Gladys
test/helpers/fake-swpc.js   the fake SWPC (real files of 2026-10-23, 304, errors)
.github/scripts/release.mjs     version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store:
  `ext:<selector>:space-weather:global`, `ext:<selector>:aurora:<house id>`,
  features `…:<key>`, feature `category` / `type` / `unit` / `min` / `max`,
  the keys of `config_schema` and `actions`, `last_language`, widgets and
  settings, triggers (fields, option values, variables), scene actions
  (fields, outputs). `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update it to make a test
  pass without a documented migration.
- **No unit Gladys does not have.** km/s, nT, sfu and the Kp have none: the
  features are `unknown` / `risk` / `text` without a unit, the unit in their
  name, and the widgets show inline values with their unit.
- **Be sober with a free public service.** Every product has its rhythm
  (`PRODUCTS` of app.js); the OVATION grid only while an Aurora device exists
  or an aurora widget was shown in the last 30 minutes; a failure doubles the
  wait (an hour at most). Never a request from a widget handler; a scene
  action only reads what is too old. The tests never touch the network.
- **`should_poll` stays false**: the integration has its own timer.
- **Times**: the SWPC writes UTC, with or without `Z`; texts are written in
  the timezone of Gladys (TZ). The forecast days are UTC days, like the NOAA's.
- **Scene events** once per transition, never at the first reading, never
  from a scene action (the detectors only run on the timer), never on a
  reading too old to be "now".
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, `src/i18n.js`,
  `docs/*.md`, README) exists in en, fr, de, es; `test/i18n.test.js` checks it.
  German says "du", Spanish "usted". The SWPC texts stay in English; only
  their short titles are translated.
- **Widget images.** After any change to a widget content, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  Below 1.0.0 until the maintainer runs Release with `release-as: 1.0.0`.
- **Changelog.** Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Commits and PR titles** follow Conventional Commits, in English.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.

## Pitfalls

- Many SWPC products moved from tables (an array of arrays, a header row,
  strings) to arrays of objects: `rowsOf()` reads both. Gone (404) on
  2026-10-23: `products/solar-wind/plasma-7-day.json`, `mag-7-day.json`.
- The estimated Kp restarts at 0 at 00, 03, 06… UTC and means nothing for
  about 10 minutes: those minutes are skipped (`parseKp1m`).
- The files are rewritten every minute (Last-Modified moves even when the
  content does not); the server answers 304 to both validators.
- OVATION longitudes are 0–359 east; Gladys gives -180–180.
- `node --test` also runs `test/helpers/`: nothing starts on import.
- The validator of the Gladys core creates `gladys-development.duckdb` in the
  current folder: run it from elsewhere.
