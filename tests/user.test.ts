import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { assertSameOrigin, sessionCookie, userId } from '../lib/user';

let directory: string;
before(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'mcmissions-session-'));
  process.env.MCMISSIONS_DATA_DIR = directory;
});
after(() => rmSync(directory, { recursive: true, force: true }));

test('signed profile cookies round-trip and cannot be reassigned or forged', () => {
  const id = randomUUID(),
    other = randomUUID();
  const request = new Request('http://localhost:3000/api/game/bootstrap');
  const cookie = sessionCookie(id, request);
  assert.match(cookie, /; HttpOnly; SameSite=Strict; Path=\//);
  const value = cookie.split(';')[0];
  const auth = (raw: string) =>
    new Request('http://localhost:3000/api/game/quote', {
      headers: { cookie: `another_cookie=x; ${raw}; extra=y` },
    });
  assert.equal(userId(auth(value)), id);
  assert.throws(() => userId(auth(value.replace(id, other))), /会话无效/);
  assert.throws(() => userId(auth(`mc_user=${id}.invented-signature`)), /会话无效/);
  assert.throws(() => userId(auth(`mc_user=${id}`)), /建立个人档案/);
  assert.throws(() => userId(new Request('http://localhost:3000/api/game/quote')), /建立个人档案/);
  const tlsCookie = sessionCookie(id, new Request('https://quests.example/api/game/bootstrap'));
  assert.match(tlsCookie, /; Secure$/);
  assert.doesNotMatch(cookie, /; Secure$/);
});

test('same-origin browser requests are accepted when Next exposes an internal bind address', () => {
  const request = new Request('http://0.0.0.0:3000/api/game/solve', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
    },
  });
  assert.doesNotThrow(() => assertSameOrigin(request));
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Request('https://quests.example/api/mcp/read', {
        headers: { origin: 'https://quests.example' },
      }),
    ),
  );
  assert.doesNotThrow(() => assertSameOrigin(new Request('http://localhost:3000/api/game/solve')));
});

test('foreign origins, different ports and explicit cross-site requests are rejected', () => {
  const cases = [
    { host: 'localhost:3000', origin: 'https://other.example', 'sec-fetch-site': 'cross-site' },
    { host: 'localhost:3000', origin: 'http://localhost:3001', 'sec-fetch-site': 'same-site' },
    { host: 'localhost:3000', origin: 'https://localhost:3000', 'sec-fetch-site': 'same-origin' },
    { host: 'localhost:3000', origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of cases)
    assert.throws(
      () =>
        assertSameOrigin(
          new Request('http://0.0.0.0:3000/api/mcp/execute', { method: 'POST', headers }),
        ),
      /请求来源不匹配|跨站请求已拒绝/,
    );
});
