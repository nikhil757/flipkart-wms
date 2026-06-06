// src/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");

const { initializeDatabase } = require("./db/database");
const productsRouter = require("./routes/products");
const validationRouter = require("./routes/validation");
const podRouter = require("./routes/pod");
const authRouter = require("./routes/auth");

// ── Bootstrap DB ─────────────────────────────────────────────────────────────
initializeDatabase();

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Static files (uploaded images) ───────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/products", productsRouter);
app.use("/api/validation", validationRouter);
app.use("/api/pod", podRouter);
app.use("/api/auth", authRouter);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 WMS Backend running on http://localhost:${PORT}`);
  console.log(`   Products API  → http://localhost:${PORT}/api/products`);
  console.log(`   Validation    → http://localhost:${PORT}/api/validation`);
  console.log(`   POD           → http://localhost:${PORT}/api/pod`);
  console.log(`   Auth          → http://localhost:${PORT}/api/auth`);
});

module.exports = app;
