const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { verifyToken, onlyRole } = require("../middleware/auth");

const router = express.Router();
const ROLES = ["mahasiswa", "admin"];

// Membuat token JWT. Jika JWT_EXPIRES_IN di .env salah tulis (misal "2 jam"),
// pakai 2 jam sebagai cadangan agar login tidak gagal.
function buatToken(payload) {
  const nilai = (process.env.JWT_EXPIRES_IN || "2h")
    .trim()
    .replace(/^["']|["']$/g, "");
  const expiresIn = /^\d+$/.test(nilai) ? Number(nilai) : nilai;
  try {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  } catch {
    console.warn(
      `JWT_EXPIRES_IN="${nilai}" tidak valid (contoh benar: 2h, 30m, 7d). Memakai 2h.`,
    );
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "2h" });
  }
}

// POST /register  -> membuat user "mahasiswa" atau "admin"
router.post("/register", (req, res) => {
  const {
    nama,
    email,
    password,
    role = "mahasiswa",
    kode_admin,
  } = req.body || {};

  if (!nama || !email || !password) {
    return res
      .status(400)
      .json({ message: "nama, email, dan password wajib diisi." });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Format email tidak valid." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password minimal 6 karakter." });
  }
  if (!ROLES.includes(role)) {
    return res
      .status(400)
      .json({ message: 'role harus "mahasiswa" atau "admin".' });
  }
  if (
    role === "admin" &&
    process.env.ADMIN_CODE &&
    kode_admin !== process.env.ADMIN_CODE
  ) {
    return res.status(403).json({ message: "kode_admin salah." });
  }
  if (db.prepare("SELECT id FROM User WHERE email = ?").get(email)) {
    return res.status(409).json({ message: "Email sudah terdaftar." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO User (nama, email, password, role) VALUES (?, ?, ?, ?)",
    )
    .run(nama, email, hash, role);

  res.status(201).json({
    message: `Registrasi ${role} berhasil.`,
    user: { id: info.lastInsertRowid, nama, email, role },
  });
});

// POST /login  -> mengembalikan token JWT
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "email dan password wajib diisi." });
  }

  const user = db.prepare("SELECT * FROM User WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Email atau password salah." });
  }

  const token = buatToken({ id: user.id, email: user.email, role: user.role });

  res.json({
    message: "Login berhasil.",
    token,
    user: { id: user.id, nama: user.nama, email: user.email, role: user.role },
  });
});

// GET /me  -> contoh route terproteksi token
router.get("/me", verifyToken, (req, res) => {
  const user = db
    .prepare("SELECT id, nama, email, role, created_at FROM User WHERE id = ?")
    .get(req.user.id);
  res.json({ user });
});

// GET /users  -> hanya admin
router.get("/users", verifyToken, onlyRole("admin"), (req, res) => {
  const users = db
    .prepare("SELECT id, nama, email, role, created_at FROM User")
    .all();
  res.json({ users });
});

module.exports = router;
