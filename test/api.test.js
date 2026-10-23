import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwpcClient, PATHS, BASE_URL, SwpcError } from '../src/swpc-api.js';
import { USER_AGENT } from '../src/app.js';
import { startFakeSwpc } from './helpers/fake-swpc.js';

const client = (fake) => createSwpcClient({ userAgent: USER_AGENT, baseUrl: fake.url });

test('the real service and the paths checked live on 2026-10-23', () => {
  assert.equal(BASE_URL, 'https://services.swpc.noaa.gov');
  assert.equal(Object.keys(PATHS).length, 10);
  assert.ok(
    !Object.values(PATHS).some((path) => /solar-wind\/(plasma|mag)-7-day/.test(path)),
    'gone (404)',
  );
  assert.match(
    USER_AGENT,
    /^gladys-noaa-space-weather\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/William-De71\/gladys-noaa-space-weather\)$/,
  );
});

test('a 200 then a 304: the validators of the last answer are sent back', async (t) => {
  const fake = await startFakeSwpc();
  t.after(() => fake.close());
  const api = client(fake);
  const first = await api.get('scales');
  assert.equal(first.status, 200);
  assert.equal(first.data['0'].G.Scale, '0');
  const second = await api.get('scales');
  assert.deepEqual(second, { status: 304 });
  const [a, b] = fake.of('scales');
  assert.equal(a.ifModifiedSince, null);
  assert.ok(b.ifModifiedSince && b.ifNoneMatch);
  assert.equal(a.userAgent, USER_AGENT);
  fake.set('scales', { 0: { G: { Scale: '2' } } });
  assert.equal((await api.get('scales')).status, 200, 'a new content');
  api.forget('scales');
  await api.get('scales');
  assert.equal(fake.of('scales').at(-1).ifModifiedSince, null, 'forgotten');
});

test('errors: an HTTP status, a truncated JSON, no answer', async (t) => {
  const fake = await startFakeSwpc();
  t.after(() => fake.close());
  const api = client(fake);
  fake.fail('wind', 503);
  await assert.rejects(
    api.get('wind'),
    (err) => err instanceof SwpcError && err.kind === 'http' && err.status === 503,
  );
  fake.truncate('alerts');
  await assert.rejects(api.get('alerts'), (err) => err.kind === 'invalid');
  fake.offline = true;
  await assert.rejects(api.get('kp1m'), (err) => err.kind === 'unreachable');
  const closed = createSwpcClient({ userAgent: USER_AGENT, baseUrl: 'http://127.0.0.1:9' });
  await assert.rejects(closed.get('kp1m'), (err) => err.kind === 'unreachable');
});
