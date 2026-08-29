import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'anchor.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  hours REAL,
  quality INTEGER,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS study_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_title TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

function safeAlter(sql) {
  try { db.exec(sql); } catch (e) { /* column already exists — fine */ }
}
safeAlter('ALTER TABLE flashcards ADD COLUMN box INTEGER');
safeAlter('ALTER TABLE flashcards ADD COLUMN due_date TEXT');
safeAlter('ALTER TABLE flashcards ADD COLUMN last_reviewed TEXT');
db.exec("UPDATE flashcards SET box = 1 WHERE box IS NULL");
db.exec("UPDATE flashcards SET due_date = date('now') WHERE due_date IS NULL");

safeAlter('ALTER TABLE meal_logs ADD COLUMN carbs INTEGER');
safeAlter('ALTER TABLE meal_logs ADD COLUMN fat INTEGER');

safeAlter('ALTER TABLE users ADD COLUMN age INTEGER');
safeAlter('ALTER TABLE users ADD COLUMN weight_kg REAL');
safeAlter('ALTER TABLE users ADD COLUMN height_cm REAL');
safeAlter('ALTER TABLE users ADD COLUMN sex TEXT');
safeAlter('ALTER TABLE users ADD COLUMN activity_level TEXT');
safeAlter('ALTER TABLE users ADD COLUMN goal TEXT');
safeAlter('ALTER TABLE users ADD COLUMN target_weight_kg REAL');

safeAlter('ALTER TABLE users ADD COLUMN strava_athlete_id TEXT');
safeAlter('ALTER TABLE users ADD COLUMN strava_access_token TEXT');
safeAlter('ALTER TABLE users ADD COLUMN strava_refresh_token TEXT');
safeAlter('ALTER TABLE users ADD COLUMN strava_token_expires_at INTEGER');
safeAlter('ALTER TABLE workout_logs ADD COLUMN strava_activity_id TEXT');
safeAlter('ALTER TABLE workout_logs ADD COLUMN distance_km REAL');
safeAlter('ALTER TABLE workout_logs ADD COLUMN title TEXT');
safeAlter('ALTER TABLE users ADD COLUMN apple_health_token TEXT');

db.exec(`
CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  source TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_title TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);


db.exec(`
CREATE TABLE IF NOT EXISTS study_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_title TEXT NOT NULL,
  summary TEXT,
  key_points TEXT,
  test_focus TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);


db.exec(`
CREATE TABLE IF NOT EXISTS meal_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

export default db;
