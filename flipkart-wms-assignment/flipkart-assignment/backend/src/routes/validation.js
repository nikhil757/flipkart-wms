// src/routes/validation.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db } = require("../db/database");

const router = express.Router();

// ── Multer: product verification images ─────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/validations");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `val_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage: imageStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
  },
});

// ── POST /api/validation/verify ─────────────────────────────────────────────
/**
 * Main verification endpoint.
 * - Accepts WID + optional image
 * - Returns product details if found
 * - Logs every attempt (found or not_found)
 */
router.post("/verify", upload.single("image"), (req, res) => {
  const { wid, operator_id = "operator" } = req.body;

  if (!wid) {
    return res.status(400).json({ error: "WID is required" });
  }

  const product = db
    .prepare("SELECT * FROM products WHERE wid = ?")
    .get(wid.trim());

  const imagePath = req.file ? req.file.filename : null;
  const result = product ? "found" : "not_found";

  // Log the validation event regardless of outcome
  const logInsert = db.prepare(`
    INSERT INTO validation_logs (wid, operator_id, image_path, result)
    VALUES (?, ?, ?, ?)
  `);
  const logEntry = logInsert.run(wid.trim(), operator_id, imagePath, result);

  if (!product) {
    return res.status(404).json({
      error: "Product not found",
      wid: wid.trim(),
      logged: true,
      log_id: logEntry.lastInsertRowid,
    });
  }

  return res.json({
    product,
    log_id: logEntry.lastInsertRowid,
    image_captured: !!imagePath,
    image_url: imagePath ? `/api/validation/image/${imagePath}` : null,
  });
});

// ── GET /api/validation/image/:filename ─────────────────────────────────────
router.get("/image/:filename", (req, res) => {
  const { filename } = req.params;
  // Security: prevent path traversal
  const safeName = path.basename(filename);
  const imgPath = path.join(__dirname, "../../uploads/validations", safeName);

  if (!fs.existsSync(imgPath)) {
    return res.status(404).json({ error: "Image not found" });
  }
  return res.sendFile(imgPath);
});

// ── GET /api/validation/logs ─────────────────────────────────────────────────
router.get("/logs", (req, res) => {
  const { start_date, end_date, wid, operator_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];

  if (start_date) {
    conditions.push("verified_at >= ?");
    params.push(start_date + " 00:00:00");
  }
  if (end_date) {
    conditions.push("verified_at <= ?");
    params.push(end_date + " 23:59:59");
  }
  if (wid) {
    conditions.push("wid = ?");
    params.push(wid.trim());
  }
  if (operator_id) {
    conditions.push("operator_id = ?");
    params.push(operator_id.trim());
  }

  const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const logs = db
    .prepare(
      `SELECT vl.*, p.ean, p.manufacturing_date, p.expiry_date
       FROM validation_logs vl
       LEFT JOIN products p ON vl.wid = p.wid
       ${whereClause}
       ORDER BY vl.verified_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, parseInt(limit), offset);

  const { total } = db
    .prepare(`SELECT COUNT(*) as total FROM validation_logs ${whereClause}`)
    .get(...params);

  return res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── GET /api/validation/report ───────────────────────────────────────────────
/**
 * Summary report for QA manager with date range.
 */
router.get("/report", (req, res) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: "start_date and end_date are required" });
  }

  const from = start_date + " 00:00:00";
  const to = end_date + " 23:59:59";

  // Aggregate stats
  const summary = db
    .prepare(
      `SELECT
         COUNT(*) as total_verifications,
         SUM(CASE WHEN result = 'found' THEN 1 ELSE 0 END) as successful,
         SUM(CASE WHEN result = 'not_found' THEN 1 ELSE 0 END) as failed,
         COUNT(DISTINCT wid) as unique_products_checked,
         COUNT(DISTINCT operator_id) as unique_operators
       FROM validation_logs
       WHERE verified_at BETWEEN ? AND ?`
    )
    .get(from, to);

  // Per-operator breakdown
  const byOperator = db
    .prepare(
      `SELECT operator_id,
              COUNT(*) as total,
              SUM(CASE WHEN result = 'found' THEN 1 ELSE 0 END) as found,
              SUM(CASE WHEN result = 'not_found' THEN 1 ELSE 0 END) as not_found
       FROM validation_logs
       WHERE verified_at BETWEEN ? AND ?
       GROUP BY operator_id
       ORDER BY total DESC`
    )
    .all(from, to);

  // Daily breakdown (for chart)
  const byDay = db
    .prepare(
      `SELECT date(verified_at) as date,
              COUNT(*) as total,
              SUM(CASE WHEN result = 'found' THEN 1 ELSE 0 END) as found
       FROM validation_logs
       WHERE verified_at BETWEEN ? AND ?
       GROUP BY date(verified_at)
       ORDER BY date ASC`
    )
    .all(from, to);

  // Detailed log
  const details = db
    .prepare(
      `SELECT vl.id, vl.wid, vl.operator_id, vl.result, vl.verified_at,
              vl.image_path, p.ean, p.manufacturing_date, p.expiry_date
       FROM validation_logs vl
       LEFT JOIN products p ON vl.wid = p.wid
       WHERE vl.verified_at BETWEEN ? AND ?
       ORDER BY vl.verified_at DESC
       LIMIT 500`
    )
    .all(from, to);

  return res.json({
    period: { start_date, end_date },
    summary,
    byOperator,
    byDay,
    details,
  });
});

module.exports = router;
