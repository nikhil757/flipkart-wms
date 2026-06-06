// src/routes/auth.js
const express = require("express");
const { db } = require("../db/database");

const router = express.Router();

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const user = db
    .prepare("SELECT id, username, role FROM users WHERE username = ? AND password = ?")
    .get(username.trim(), password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // In production: issue a JWT. Here we return user details as a simple session token.
  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    token: Buffer.from(`${user.id}:${user.username}:${user.role}`).toString("base64"),
  });
});

// ── POST /api/auth/register (admin only) ─────────────────────────────────────
router.post("/register", (req, res) => {
  const { username, password, role = "operator" } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  if (!["admin", "operator", "qa"].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Must be: admin, operator, or qa" });
  }

  try {
    const stmt = db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    );
    const result = stmt.run(username.trim(), password, role);
    return res.json({
      success: true,
      user: { id: result.lastInsertRowid, username: username.trim(), role },
    });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(409).json({ error: "Username already exists" });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

// ── GET /api/auth/users (admin only) ─────────────────────────────────────────
router.get("/users", (req, res) => {
  const users = db
    .prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC")
    .all();
  return res.json({ users });
});

module.exports = router;
