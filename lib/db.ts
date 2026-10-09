import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const globals = globalThis as typeof globalThis & { mcDatabase?: DatabaseSync };
export function db(): DatabaseSync {
  if (globals.mcDatabase) return globals.mcDatabase;
  const directory = process.env.MCMISSIONS_DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path.join(directory, 'mcmissions.sqlite'));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, slot TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(user_id,date,slot));
    CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, mission_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS completions (mission_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, quote_id TEXT NOT NULL, reward INTEGER NOT NULL, completed_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (code TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  globals.mcDatabase = database;
  return database;
}
