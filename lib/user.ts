import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const globals = globalThis as typeof globalThis & { mcSessionSecret?: Buffer };
function secret() {
  if (globals.mcSessionSecret) return globals.mcSessionSecret;
  const directory = process.env.MCMISSIONS_DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyPath = path.join(directory, 'session.key');
  try {
    globals.mcSessionSecret = readFileSync(keyPath);
  } catch {
    const value = randomBytes(32);
    try {
      writeFileSync(keyPath, value, { flag: 'wx', mode: 0o600 });
      globals.mcSessionSecret = value;
    } catch {
      globals.mcSessionSecret = readFileSync(keyPath);
    }
  }
  return globals.mcSessionSecret;
}
function signature(id: string) {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}
export function sessionCookie(id: string, request: Request) {
  return `mc_user=${id}.${signature(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export function userId(request: Request): string {
  const cookie = request.headers.get('cookie') || '';
  const raw = cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('mc_user='))
    ?.slice(8);
  const [id, mac] = raw?.split('.') || [];
  if (!id || !mac || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('请先打开任务大厅建立个人档案');
  const expected = Buffer.from(signature(id));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw new Error('个人会话无效，请重新打开任务大厅');
  return id;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Next may expose its internal bind address in request.url; browsers use Host.
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  if (origin && origin !== `${url.protocol}//${host}`) throw new Error('请求来源不匹配');
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') throw new Error('跨站请求已拒绝');
}
