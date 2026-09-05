import { Pool, types } from 'pg';

// DailyFlow now runs on a single shared Postgres database (Neon) instead of a
// local SQLite file, so the same account and data show up on every device —
// Mac, PC, and phone — as long as DATABASE_URL points at that same database.

// node-postgres returns BIGINT (COUNT/SUM results) and NUMERIC (AVG results)
// as strings by default, to avoid silent precision loss for huge values.
// This app's counts/sums/averages are always small (minutes, calories,
// session counts), and a lot of call sites do real arithmetic and
// .toFixed() on them expecting plain numbers — exactly like node:sqlite
// always gave them — so parse both back to JS numbers here, once, globally.
types.setTypeParser(20 /* int8/bigint */, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700 /* numeric */, (val) => (val === null ? null : parseFloat(val)));

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — database calls will fail until it is configured in .env.local (or your Vercel project settings).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

// --- one-time schema setup, run lazily on first query and memoized ---------

let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = runMigrations();
  return initPromise;
}

async function safeAlter(sql) {
  try {
    await pool.query(sql);
  } catch (e) {
    // column/constraint already exists — fine
  }
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS sleep_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      hours REAL,
      quality INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS study_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      subject TEXT,
      minutes INTEGER,
      focus INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS workout_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT,
      minutes INTEGER,
      intensity INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS meal_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      calories INTEGER,
      protein INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS deadlines (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS flashcards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      source_title TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS weight_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      source TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      source_title TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS study_notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      source_title TEXT NOT NULL,
      summary TEXT,
      key_points TEXT,
      test_focus TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS meal_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      answers TEXT,
      budget TEXT,
      currency TEXT,
      plan_json TEXT,
      shopping_list_json TEXT,
      total_est_cost REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  await safeAlter('ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS box INTEGER');
  await safeAlter('ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS due_date TEXT');
  await safeAlter('ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS last_reviewed TEXT');
  await pool.query("UPDATE flashcards SET box = 1 WHERE box IS NULL");
  await pool.query("UPDATE flashcards SET due_date = CURRENT_DATE::text WHERE due_date IS NULL");

  await safeAlter('ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS carbs INTEGER');
  await safeAlter('ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS fat INTEGER');

  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg REAL');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm REAL');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS sex TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS goal TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS target_weight_kg REAL');

  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_athlete_id TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_access_token TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_token_expires_at BIGINT');
  await safeAlter('ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS strava_activity_id TEXT');
  await safeAlter('ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS distance_km REAL');
  await safeAlter('ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS title TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_health_token TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS grocery_store TEXT');
  await safeAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS kitchen_tools TEXT');
  await safeAlter('ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS regen_history_json TEXT');
}

// --- node:sqlite-compatible query interface, backed by pg ------------------
//
// Call sites throughout the app were written against node:sqlite's
// synchronous DatabaseSync API: db.prepare(sql).get/.all/.run(...args).
// This shim keeps that exact shape so call sites only needed `await` added,
// while translating '?' placeholders to Postgres '$1, $2, ...' under the
// hood and running the one-time schema setup before the first real query.

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function prepare(sql) {
  const pgSql = toPgSql(sql);
  const isInsert = /^\s*insert/i.test(sql);
  const hasReturning = /returning/i.test(sql);
  const insertsIntoSessions = /insert\s+into\s+sessions\b/i.test(sql);
  const runSql = (isInsert && !hasReturning && !insertsIntoSessions) ? `${pgSql} RETURNING id` : pgSql;

  return {
    async get(...params) {
      await ensureInit();
      const res = await pool.query(pgSql, params);
      return res.rows[0];
    },
    async all(...params) {
      await ensureInit();
      const res = await pool.query(pgSql, params);
      return res.rows;
    },
    async run(...params) {
      await ensureInit();
      const res = await pool.query(runSql, params);
      return {
        changes: res.rowCount,
        lastInsertRowid: res.rows[0]?.id,
      };
    },
  };
}

async function exec(sql) {
  await ensureInit();
  await pool.query(sql);
}

const db = { prepare, exec };
export default db;
