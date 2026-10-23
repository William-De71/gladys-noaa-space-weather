import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAlerts, parseMessage, alertTitle, KINDS, TOPICS, STATUSES } from '../src/alerts.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture } from './helpers/fake-swpc.js';

const messages = parseAlerts(fixture('alerts'));

test('the 94 real messages: code, serial, kind, status, topic, newest first', () => {
  assert.equal(messages.length, 94);
  const first = messages[0];
  assert.equal(first.code, 'ALTEF3');
  assert.equal(first.serial, 3755);
  assert.equal(first.issued, Date.parse('2026-10-23T11:47:50.950Z'));
  assert.deepEqual([first.kind, first.status, first.topic], ['alert', 'new', 'radiation']);
  for (let i = 1; i < messages.length; i += 1)
    assert.ok(messages[i - 1].issued >= messages[i].issued);
  for (const message of messages) {
    assert.ok(KINDS.includes(message.kind), message.code);
    assert.ok(TOPICS.includes(message.topic), message.code);
    assert.ok(STATUSES.includes(message.status), message.code);
    assert.notEqual(message.topic, 'other', `${message.code} is recognised`);
    assert.doesNotMatch(message.text, /\r/);
  }
  assert.equal(new Set(messages.map((m) => m.id)).size, messages.length, 'ids are unique');
});

test('short titles in four languages, 60 characters at most', () => {
  const byCode = (code, status = 'new') =>
    messages.find((m) => m.code === code && m.status === status);
  assert.equal(alertTitle(byCode('ALTK05'), 'fr'), 'Alerte : indice K de 5 atteint');
  assert.equal(alertTitle(byCode('WATA20'), 'en'), 'Watch: G1 geomagnetic storm predicted');
  assert.equal(
    alertTitle(byCode('WATA30', 'cancelled'), 'de'),
    'Vorwarnung (Aufhebung): geomagnetischer Sturm G2 erwartet',
  );
  assert.equal(
    alertTitle(byCode('WARK04', 'extended'), 'es'),
    'Aviso (prórroga): índice K de 4 previsto',
  );
  assert.equal(alertTitle(byCode('SUMXM5'), 'fr'), 'Bilan : rayons X au-delà de M5');
  for (const message of messages) {
    for (const language of LANGUAGES) {
      const title = alertTitle(message, language);
      assert.ok(title.length > 5 && title.length <= 60, `${message.code} ${language}: ${title}`);
    }
  }
});

test('subjects not seen in the sample: protons; an unknown subject keeps its headline', () => {
  const proton = parseMessage({
    product_id: 'EF3A',
    issue_datetime: '2026-10-24 01:00:00.000',
    message:
      'Space Weather Message Code: ALTPX1\r\nSerial Number: 12\r\n\r\nALERT: Proton Event 10MeV Integral Flux exceeded 10pfu\r\n',
  });
  assert.equal(proton.topic, 'radiation');
  assert.equal(alertTitle(proton, 'fr'), 'Alerte : protons 10 MeV au-delà de 10 pfu');
  const odd = parseMessage({
    message: 'Space Weather Message Code: XYZ\nWARNING: Something new\n',
  });
  assert.deepEqual([odd.kind, odd.topic], ['warning', 'other']);
  assert.equal(alertTitle(odd, 'fr'), 'Avertissement : Something new');
  assert.equal(parseMessage({ message: '' }), null);
  assert.deepEqual(parseAlerts({}), []);
});
