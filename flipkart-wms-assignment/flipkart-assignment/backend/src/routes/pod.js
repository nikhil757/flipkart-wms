// src/routes/pod.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db } = require("../db/database");

const router = express.Router();

// ── Multer: POD media (photos and short videos) ──────────────────────────────
const podStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/pod");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `pod_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const podUpload = multer({
  storage: podStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB for videos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image or video files allowed"), false);
    }
  },
});

// ── POST /api/pod/deliver ─────────────────────────────────────────────────────
/**
 * Submit a proof of delivery.
 * In production, the media_path would be uploaded to S3/GCS/Cloudinary.
 * Here we simulate the cloud_url with a local path.
 */
router.post("/deliver", podUpload.single("media"), (req, res) => {
  const { awb_number, driver_id = "driver", notes = "" } = req.body;

  if (!awb_number) {
    return res.status(400).json({ error: "AWB number is required" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Media file (photo or video) is required" });
  }

  const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "photo";
  const mediaPath = req.file.filename;

  // Simulate cloud URL (in production: upload to S3 and store URL)
  const cloudUrl = `https://storage.flipkart-wms.example.com/pod/${mediaPath}`;

  const stmt = db.prepare(`
    INSERT INTO pod_deliveries (awb_number, driver_id, media_type, media_path, cloud_url, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const entry = stmt.run(awb_number.trim(), driver_id, mediaType, mediaPath, cloudUrl, notes);

  return res.json({
    success: true,
    delivery_id: entry.lastInsertRowid,
    awb_number: awb_number.trim(),
    media_type: mediaType,
    media_url: `/api/pod/media/${mediaPath}`,
    cloud_url: cloudUrl,
    delivered_at: new Date().toISOString(),
  });
});

// ── GET /api/pod/media/:filename ──────────────────────────────────────────────
router.get("/media/:filename", (req, res) => {
  const safeName = path.basename(req.params.filename);
  const mediaPath = path.join(__dirname, "../../uploads/pod", safeName);

  if (!fs.existsSync(mediaPath)) {
    return res.status(404).json({ error: "Media not found" });
  }
  return res.sendFile(mediaPath);
});

// ── GET /api/pod/deliveries ───────────────────────────────────────────────────
router.get("/deliveries", (req, res) => {
  const { awb, start_date, end_date, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];

  if (awb) {
    conditions.push("awb_number LIKE ?");
    params.push(`%${awb}%`);
  }
  if (start_date) {
    conditions.push("delivered_at >= ?");
    params.push(start_date + " 00:00:00");
  }
  if (end_date) {
    conditions.push("delivered_at <= ?");
    params.push(end_date + " 23:59:59");
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const rows = db
    .prepare(`SELECT * FROM pod_deliveries ${where} ORDER BY delivered_at DESC LIMIT ? OFFSET ?`)
    .all(...params, parseInt(limit), offset);

  const { total } = db
    .prepare(`SELECT COUNT(*) as total FROM pod_deliveries ${where}`)
    .get(...params);

  return res.json({ deliveries: rows, total, page: parseInt(page) });
});

// ── GET /api/pod/deliveries/:awb ─────────────────────────────────────────────
router.get("/deliveries/:awb", (req, res) => {
  const entries = db
    .prepare("SELECT * FROM pod_deliveries WHERE awb_number = ? ORDER BY delivered_at DESC")
    .all(req.params.awb.trim());

  return res.json({ awb_number: req.params.awb, entries });
});

module.exports = router;
