// -----------------------------------------------------------------------------
// The messages of the SWPC (products/alerts.json): alerts, warnings, watches
// and summaries, `[{ product_id, issue_datetime, message }]`, the last 30
// days or so. The message is the text of the bulletin, in English:
//
//   Space Weather Message Code: ALTK05
//   Serial Number: 2154
//   Issue Time: 2026 Oct 22 0003 UTC
//
//   ALERT: Geomagnetic K-index of 5
//   Threshold Reached: 2026 Oct 22 0000 UTC
//   …
//
// The headline gives the kind (ALERT, WARNING, WATCH, SUMMARY, with
// EXTENDED, CONTINUED or CANCEL in front) and the subject. The subjects the
// SWPC issues are recognised (K-index, geomagnetic storm watch, sudden
// impulse, protons, electrons, X-rays, radio emissions and bursts) and get a
// short title in the four languages (i18n.js `subject_*`); any other keeps
// its English headline. The text itself is never translated: the original
// stays available to the scenes and the widget.
// -----------------------------------------------------------------------------

import { readUtc } from './time.js';
import { rowsOf } from './parse.js';
import { t } from './i18n.js';

const KINDS = ['watch', 'warning', 'alert', 'summary'];
const TOPICS = ['geomagnetic', 'radiation', 'radio', 'other'];
const STATUSES = ['new', 'extended', 'continued', 'cancelled'];
const KIND_OF_PREFIX = { ALT: 'alert', WAR: 'warning', WAT: 'watch', SUM: 'summary' };

/**
 * @description Clean the text of a message: line ends, blank lines, spaces.
 * @param {string} message - The message.
 * @returns {string} The text.
 */
function cleanText(message) {
  return String(message ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @description The subject of a headline, for a short title: an i18n key and its values.
 * @param {string} subject - The headline after "ALERT:".
 * @param {string} kind - The kind.
 * @returns {{ key: string, values: object, topic: string }|null} Null: not recognised.
 */
function subjectOf(subject, kind) {
  const text = subject.replace(/\s+/g, ' ').trim();
  let match = /Geomagnetic K-index of (\d)( or greater)?/i.exec(text);
  if (match) {
    return {
      key: kind === 'alert' ? 'subject_kindex_reached' : 'subject_kindex_expected',
      values: { k: `${match[1]}${match[2] ? '+' : ''}` },
      topic: 'geomagnetic',
    };
  }
  match = /Geomagnetic Storm Category (G\d)/i.exec(text);
  if (match) {
    return {
      key: 'subject_storm_predicted',
      values: { level: match[1].toUpperCase() },
      topic: 'geomagnetic',
    };
  }
  if (/Geomagnetic Sudden Impulse/i.test(text)) {
    return {
      key: kind === 'warning' ? 'subject_impulse_expected' : 'subject_impulse_observed',
      values: {},
      topic: 'geomagnetic',
    };
  }
  match = /Proton.*?(\d+)\s*MeV.*?(?:exceed\w*|above|of|greater than)\s*([\d,]+)\s*pfu/i.exec(text);
  if (match) {
    return {
      key: 'subject_protons',
      values: { mev: match[1], pfu: match[2].replace(/,/g, '') },
      topic: 'radiation',
    };
  }
  if (/Proton/i.test(text)) {
    return { key: 'subject_proton_event', values: {}, topic: 'radiation' };
  }
  match = /Electron.*?(\d+)\s*MeV.*?(?:exceed\w*|above)\s*([\d,]+)\s*pfu/i.exec(text);
  if (match) {
    return {
      key: 'subject_electrons',
      values: { mev: match[1], pfu: match[2].replace(/,/g, '') },
      topic: 'radiation',
    };
  }
  match = /X-ray (?:Flux|Event) exceeded ([MX]\d+)/i.exec(text);
  if (match) {
    return { key: 'subject_xray', values: { level: match[1].toUpperCase() }, topic: 'radio' };
  }
  match = /Type (II|IV) Radio Emission/i.exec(text);
  if (match) {
    return {
      key: 'subject_radio_emission',
      values: { type: match[1].toUpperCase() },
      topic: 'radio',
    };
  }
  if (/10\s*cm Radio Burst/i.test(text)) {
    return { key: 'subject_radio_burst', values: {}, topic: 'radio' };
  }
  return null;
}

/**
 * @description Read one message.
 * @param {object} row - `{ product_id, issue_datetime, message }`.
 * @returns {object|null} `{ id, productId, code, serial, issued, kind,
 * status, topic, headline, subject, text }`.
 */
function parseMessage(row) {
  const text = cleanText(row?.message);
  if (!text) {
    return null;
  }
  const code = /Message Code:\s*([A-Z0-9]+)/i.exec(text)?.[1]?.toUpperCase() ?? null;
  const serial = /Serial Number:\s*(\d+)/i.exec(text)?.[1] ?? null;
  const issued = readUtc(String(row.issue_datetime ?? '')) ?? null;
  const line =
    /^(EXTENDED |CONTINUED |CANCEL )?(ALERT|WARNING|WATCH|SUMMARY):\s*(.*)$/im.exec(text) ?? null;
  const kind = line ? line[2].toLowerCase() : (KIND_OF_PREFIX[code?.slice(0, 3)] ?? 'alert');
  const status =
    {
      'EXTENDED ': 'extended',
      'CONTINUED ': 'continued',
      'CANCEL ': 'cancelled',
    }[line?.[1]?.toUpperCase() ?? ''] ?? 'new';
  const headline = line ? line[0].trim() : (text.split('\n').find((l) => l.trim()) ?? '').trim();
  const subject = subjectOf(line ? line[3] : headline, kind);
  const productId = String(row.product_id ?? code ?? '').slice(0, 20);
  return {
    id: `${productId}:${serial ?? ''}:${issued ?? ''}`,
    productId,
    code,
    serial: serial === null ? null : Number(serial),
    issued,
    kind,
    status,
    topic: subject?.topic ?? 'other',
    headline: headline.slice(0, 200),
    subject,
    text,
  };
}

/**
 * @description The messages of the SWPC, the newest first.
 * @param {unknown} raw - The JSON of products/alerts.json.
 * @returns {object[]} parseMessage() of each.
 */
function parseAlerts(raw) {
  return rowsOf(raw)
    .map(parseMessage)
    .filter(Boolean)
    .sort((a, b) => (b.issued ?? 0) - (a.issued ?? 0));
}

/**
 * @description The subject of a message in a language: "K-index of 5 reached".
 * @param {object} message - parseMessage().
 * @param {string} language - The language.
 * @returns {string} The subject (the English headline when not recognised).
 */
function alertSubject(message, language) {
  return message.subject
    ? t(message.subject.key, language, message.subject.values)
    : message.headline.replace(/^(EXTENDED |CONTINUED |CANCEL )?[A-Z]+:\s*/i, '').trim();
}

/**
 * @description The short title of a message in a language: "Alert: K-index
 * of 5 reached", "Veille : orage G1 prévu".
 * @param {object} message - parseMessage().
 * @param {string} language - The language.
 * @returns {string} The title (60 characters at most).
 */
function alertTitle(message, language) {
  const kind =
    message.status === 'new'
      ? t(`kind_${message.kind}`, language)
      : t(`kindStatus_${message.status}`, language, { kind: t(`kind_${message.kind}`, language) });
  const subject = alertSubject(message, language);
  const title = t('alertTitle', language, { kind, subject });
  return title.length > 60 ? `${title.slice(0, 59)}…` : title;
}

export {
  KINDS,
  TOPICS,
  STATUSES,
  cleanText,
  subjectOf,
  parseMessage,
  parseAlerts,
  alertSubject,
  alertTitle,
};
