// -----------------------------------------------------------------------------
// Times. The SWPC writes every time in UTC ("2026-10-23T15:01:00Z", or
// "2026-10-23T15:01:00" and "2026-10-23 11:47:50.950" without the zone, still
// UTC). The texts shown to the user are written in the timezone of the Gladys
// instance (TZ, given by the supervisor), else UTC. Intl only, no dependency.
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description Whether a text is a timezone Intl knows.
 * @param {unknown} value - "Europe/Paris".
 * @returns {boolean} True when valid.
 */
function isTimeZone(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * @description The timezone to write the times in: the one of Gladys, else UTC.
 * @param {unknown} zone - The timezone of Gladys.
 * @returns {string} An IANA name.
 */
const zoneOrUtc = (zone) => (isTimeZone(zone) ? zone.trim() : 'UTC');

/**
 * @description Read a time of the SWPC (always UTC, with or without the zone).
 * @param {unknown} value - "2026-10-23T15:01:00Z", "2026-10-23T15:01:00",
 * "2026-10-23 11:47:50.950".
 * @returns {number|null} The instant (ms).
 * @example
 * readUtc('2026-10-23 11:47:50.950'); // -> Date.parse('2026-10-23T11:47:50.950Z')
 */
function readUtc(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]00:?00)?$/.exec(
      value.trim(),
    );
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute, second = '0', millis = '0'] = match.slice(1);
  const instant = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millis.padEnd(3, '0')),
  );
  return Number.isFinite(instant) ? instant : null;
}

const formatters = new Map();
/**
 * @description A cached Intl formatter of the calendar fields in a timezone.
 * @param {string} timeZone - The timezone.
 * @returns {Intl.DateTimeFormat} The formatter.
 */
function partsFormatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }
  return formatters.get(timeZone);
}

/**
 * @description The local calendar fields of an instant.
 * @param {number} instant - The instant (ms).
 * @param {string} timeZone - The timezone.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number,
 * date: string }} The fields; `date` "2026-10-23".
 */
function localParts(instant, timeZone) {
  const fields = Object.fromEntries(
    partsFormatter(zoneOrUtc(timeZone))
      .formatToParts(new Date(instant))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const pad = (n) => String(n).padStart(2, '0');
  const { year, month, day, hour, minute } = fields;
  return { year, month, day, hour, minute, date: `${year}-${pad(month)}-${pad(day)}` };
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/**
 * @description "14:05" in the language and timezone of the user; the day too
 * when it is not today.
 * @param {number|null} instant - The instant (ms).
 * @param {object} [options] - `{ language, timeZone, now }`.
 * @returns {string} The time, '' when none.
 */
function formatTime(instant, { language = 'en', timeZone, now } = {}) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  const zone = zoneOrUtc(timeZone);
  const sameDay =
    !Number.isFinite(now) || localParts(instant, zone).date === localParts(now, zone).date;
  return new Intl.DateTimeFormat(locale(language), {
    timeZone: zone,
    ...(sameDay ? {} : { weekday: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
}

/**
 * @description A day in the language of the user: "Fri 23", "ven. 23".
 * @param {number} instant - An instant of the day.
 * @param {object} [options] - `{ language, timeZone }` (UTC for the NOAA days).
 * @returns {string} The day.
 */
function formatDay(instant, { language = 'en', timeZone = 'UTC' } = {}) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  return new Intl.DateTimeFormat(locale(language), {
    timeZone: zoneOrUtc(timeZone),
    weekday: 'short',
    day: 'numeric',
  }).format(new Date(instant));
}

/**
 * @description The UTC day of an instant: "2026-10-23".
 * @param {number} instant - The instant (ms).
 * @returns {string} The day.
 */
const utcDay = (instant) => new Date(instant).toISOString().slice(0, 10);

export {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  defaultTimeZone,
  isTimeZone,
  zoneOrUtc,
  readUtc,
  localParts,
  formatTime,
  formatDay,
  utcDay,
};
