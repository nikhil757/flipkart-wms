// src/routes/products.js
const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse");
const path = require("path");
const fs = require("fs");
const { db } = require("../db/database");

const router = express.Router();

// ── Multer: CSV uploads ──────────────────────────────────────────────────────
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/csv");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload_${Date.now()}_${file.originalname}`);
  },
});
const csvUpload = multer({
  storage: csvStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

// ── Prepared statements (compiled once, reused for speed) ───────────────────
const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (wid, ean, manufacturing_date, expiry_date)
  VALUES (@wid, @ean, @manufacturing_date, @expiry_date)
`);

const upsertProduct = db.prepare(`
  INSERT INTO products (wid, ean, manufacturing_date, expiry_date)
  VALUES (@wid, @ean, @manufacturing_date, @expiry_date)
  ON CONFLICT(wid) DO UPDATE SET
    ean = excluded.ean,
    manufacturing_date = excluded.manufacturing_date,
    expiry_date = excluded.expiry_date
`);

// Wrap many inserts in a single transaction for huge CSV performance
const bulkInsert = db.transaction((rows) => {
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const info = upsertProduct.run(row);
    if (info.changes > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
});

// ── POST /api/products/upload ────────────────────────────────────────────────
/**
 * Bulk CSV upload endpoint.
 * Strategy for millions of rows:
 *  - Stream CSV parsing (don't load entire file into memory)
 *  - Batch rows into chunks of 10,000 and insert via transaction
 */
router.post("/upload", csvUpload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file provided" });
  }

  const filePath = req.file.path;
  const BATCH_SIZE = 10_000;
  let batch = [];
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalRows = 0;
  let errors = [];

  const parser = fs
    .createReadStream(filePath)
    .pipe(
      parse({
        columns: true,          // first row = headers
        skip_empty_lines: true,
        trim: true,
      })
    );

  try {
    for await (const record of parser) {
      totalRows++;

      // Validate required columns
      const { WID, EAN, Manufacturing_Date, Expiry_Date } = record;
      if (!WID || !EAN || !Manufacturing_Date || !Expiry_Date) {
        errors.push({
          row: totalRows,
          issue: "Missing required field",
          data: record,
        });
        if (errors.length > 100) errors = errors.slice(0, 100); // cap error list
        continue;
      }

      batch.push({
        wid: WID.trim(),
        ean: EAN.trim(),
        manufacturing_date: Manufacturing_Date.trim(),
        expiry_date: Expiry_Date.trim(),
      });

      // Flush batch
      if (batch.length >= BATCH_SIZE) {
        const result = bulkInsert(batch);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        batch = [];
      }
    }

    // Final flush
    if (batch.length > 0) {
      const result = bulkInsert(batch);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
    }

    // Clean up uploaded file to save disk space
    fs.unlinkSync(filePath);

    return res.json({
      success: true,
      summary: {
        totalRows,
        inserted: totalInserted,
        updated: totalSkipped,
        errorCount: errors.length,
      },
      sampleErrors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error("CSV parse error:", err);
    return res.status(500).json({ error: "Failed to process CSV", detail: err.message });
  }
});

// ── GET /api/products/:wid ───────────────────────────────────────────────────
router.get("/:wid", (req, res) => {
  const { wid } = req.params;
  const product = db
    .prepare("SELECT * FROM products WHERE wid = ?")
    .get(wid.trim());

  if (!product) {
    return res.status(404).json({ error: "Product not found", wid });
  }
  return res.json(product);
});

// ── GET /api/products ────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { page = 1, limit = 50, ean } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = "SELECT * FROM products";
  let countQuery = "SELECT COUNT(*) as total FROM products";
  const params = [];

  if (ean) {
    query += " WHERE ean = ?";
    countQuery += " WHERE ean = ?";
    params.push(ean);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const products = db.prepare(query).all(...params, parseInt(limit), offset);
  const { total } = db.prepare(countQuery).get(...params);

  return res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = router;
