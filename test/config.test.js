import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, readLanguage, guessLanguage, INTERNAL_KEYS } from '../src/config.js';

test('language and threshold, with their defaults', () => {
  assert.deepEqual(normalizeConfig(), { language: 'auto', threshold: 10 });
  assert.deepEqual(normalizeConfig(null), { language: 'auto', threshold: 10 });
  assert.deepEqual(normalizeConfig({ language: 'es', aurora_threshold: '50' }), {
    language: 'es',
    threshold: 50,
  });
  assert.deepEqual(normalizeConfig({ language: 'it', aurora_threshold: '7' }), {
    language: 'auto',
    threshold: 10,
  });
  assert.equal(normalizeConfig({ aurora_threshold: 20 }).threshold, 20);
});

test('the language of the last widget, else the timezone', () => {
  assert.equal(readLanguage({ [INTERNAL_KEYS.language]: 'de' }, 'en'), 'de');
  assert.equal(readLanguage({ [INTERNAL_KEYS.language]: 'xx' }, 'fr'), 'fr');
  assert.deepEqual(
    [
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'America/Argentina/Cordoba',
      'Asia/Tokyo',
      '',
    ].map(guessLanguage),
    ['fr', 'de', 'es', 'es', 'en', 'en'],
  );
});
