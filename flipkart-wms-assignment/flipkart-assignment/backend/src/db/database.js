// src/db/database.js
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "../../data/wms.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

/**
 * Initialize all tables and indexes.
 * Using INTEGER PRIMARY KEY for wid_id and separate unique constraint on wid string.
 * Indexes on EAN and dates for fast reporting queries.
 */
function initializeDatabase() {
  db.exec(`
    -- Products table: one row per unique WID physical item
    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      wid           TEXT    NOT NULL UNIQUE,
      ean           TEXT    NOT NULL,
      manufacturing_date TEXT NOT NULL,
      expiry_date        TEXT NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for fast lookups
    CREATE INDEX IF NOT EXISTS idx_products_wid  ON products(wid);
    CREATE INDEX IF NOT EXISTS idx_products_ean  ON products(ean);
    CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);

    -- Validation logs: every time an operator checks a WID
    CREATE TABLE IF NOT EXISTS validation_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      wid          TEXT NOT NULL,
      operator_id  TEXT NOT NULL DEFAULT 'operator',
      image_path   TEXT,
      verified_at  TEXT NOT NULL DEFAULT (datetime('now')),
      result       TEXT NOT NULL DEFAULT 'found'  -- 'found' | 'not_found'
    );

    CREATE INDEX IF NOT EXISTS idx_logs_wid        ON validation_logs(wid);
    CREATE INDEX IF NOT EXISTS idx_logs_verified   ON validation_logs(verified_at);
    CREATE INDEX IF NOT EXISTS idx_logs_operator   ON validation_logs(operator_id);

    -- POD (Proof of Delivery) table
    CREATE TABLE IF NOT EXISTS pod_deliveries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      awb_number    TEXT NOT NULL,
      driver_id     TEXT NOT NULL DEFAULT 'driver',
      media_type    TEXT NOT NULL DEFAULT 'photo',   -- 'photo' | 'video'
      media_path    TEXT,
      cloud_url     TEXT,
      delivered_at  TEXT NOT NULL DEFAULT (datetime('now')),
      notes         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pod_awb       ON pod_deliveries(awb_number);
    CREATE INDEX IF NOT EXISTS idx_pod_delivered ON pod_deliveries(delivered_at);

    -- Users table (optional RBAC)
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'operator',  -- 'admin' | 'operator' | 'qa'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed a default admin user (password: admin123)
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
  if (!existing) {
    db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    ).run("admin", "admin123", "admin");
    db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    ).run("operator1", "op123", "operator");
    db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    ).run("qa_manager", "qa123", "qa");
  }

  console.log("✅ Database initialized at", DB_PATH);
}

module.exports = { db, initializeDatabase };
