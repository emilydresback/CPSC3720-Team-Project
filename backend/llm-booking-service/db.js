/**
 * db.js
 * SQLite connection and helpers
 * - Exposes get(), all(), run() for queries
 * - initFromSql() to apply init.sql (bookings table)
 */
import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || './database.sqlite';

sqlite3.verbose();
const db = new sqlite3.Database(dbPath);

const get = (sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));

const all = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

const run = (sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));

export async function initFromSql() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const sql = readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  await run('BEGIN IMMEDIATE TRANSACTION;');
  try {
    await run(sql);
    await run('COMMIT;');
    console.log('[db] init.sql applied.');
  } catch (e) {
    await run('ROLLBACK;');
    console.error('[db] init failed:', e);
    throw e;
  }
}

export default { get, all, run, raw: db };
