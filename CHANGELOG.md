# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.2.0] - 2026-10-25

### Added

- require Gladys 5.3 and declare catalog keywords ([48bb465](https://github.com/William-De71/gladys-noaa-space-weather/commit/48bb46505bbc161648bab99001a3fc2eb825c7ab))

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([266aafd](https://github.com/William-De71/gladys-noaa-space-weather/commit/266aafde7558469b6de672134ab82542ae6bdd56))

## [0.1.0] - 2026-10-23

### Added

- **data:** the space weather of the NOAA Space Weather Prediction Center, public data without a key: estimated Kp every minute, official 3-hour Kp, NOAA scales G / S / R now and for 3 days, solar wind, magnetic field Bt and Bz, 10.7 cm radio flux, X-ray flares, SWPC messages and the OVATION aurora forecast; new and former formats of the SWPC files, conditional requests, a longer wait after each failure
- **devices:** a "Space weather" device (Kp estimated and official, G / S / R, solar wind, Bz, Bt, radio flux, X-ray class) and an "Aurora" device per located house of Gladys (OVATION probability, dark sky, Kp expected tonight); the OVATION grid is only read while an Aurora device exists or an aurora widget is shown
- **scenes:** triggers for a geomagnetic storm and its end, a solar radiation storm, a radio blackout, an M or X flare, an aurora possible at a house in a dark sky and its end, each new SWPC message (filtered by kind and topic) and a storm in the 3-day forecast; actions that read the space weather, the aurora at a house and the 3-day forecast, each with a sentence ready to send
- **widgets:** space weather now (Kp gauge, G / S / R, solar wind, Bz, X-rays, Kp observed and expected), the aurora forecast of a house, and the last SWPC messages with a short translated title
- **configuration:** language of the texts, aurora threshold, a "Test the connection" button and a "Diagnostic" button
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README

[0.2.0]: https://github.com/William-De71/gladys-noaa-space-weather/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-noaa-space-weather/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-noaa-space-weather/releases/tag/v0.1.0
