const express = require("express");
const db = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const JENIS = ["pemasukan", "pengeluaran"];
const FORMAT_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// Validasi input transaksi (US-07). Mengembalikan { error } atau { data }.
function validasi(body = {}) {
  const jenis = String(body.jenis || "").trim();
  const nominal = Number(body.nominal);
  const tanggal = String(body.tanggal || "").trim();
  const kategori = String(body.kategori || "").trim();
  const catatan = String(body.catatan || "").trim();

  if (!JENIS.includes(jenis))
    return { error: 'Jenis harus "pemasukan" atau "pengeluaran".' };
  if (!Number.isInteger(nominal) || nominal <= 0)
    return { error: "Nominal harus berupa angka bulat lebih dari 0." };
  if (nominal > 1_000_000_000_000) return { error: "Nominal terlalu besar." };
  if (!FORMAT_TANGGAL.test(tanggal) || Number.isNaN(Date.parse(tanggal)))
    return { error: "Tanggal tidak valid (format YYYY-MM-DD)." };
  if (!kategori) return { error: "Kategori wajib dipilih." };
  if (kategori.length > 50) return { error: "Kategori maksimal 50 karakter." };
  if (catatan.length > 200) return { error: "Catatan maksimal 200 karakter." };

  return { data: { jenis, nominal, tanggal, kategori, catatan } };
}

// Membuat klausa WHERE dari filter tanggal dan jenis (US-04)
function buatFilter(userId, query, denganJenis) {
  const where = ["user_id = ?"];
  const params = [userId];
  if (query.dari && FORMAT_TANGGAL.test(query.dari)) {
    where.push("tanggal >= ?");
    params.push(query.dari);
  }
  if (query.sampai && FORMAT_TANGGAL.test(query.sampai)) {
    where.push("tanggal <= ?");
    params.push(query.sampai);
  }
  if (denganJenis && JENIS.includes(query.jenis)) {
    where.push("jenis = ?");
    params.push(query.jenis);
  }
  return { sql: where.join(" AND "), params };
}

// POST /transaksi -> simpan transaksi baru (US-01, US-02)
router.post("/transaksi", verifyToken, (req, res) => {
  const { error, data } = validasi(req.body);
  if (error) return res.status(400).json({ message: error });

  const info = db
    .prepare(
      "INSERT INTO Transaksi (user_id, jenis, nominal, tanggal, kategori, catatan) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      req.user.id,
      data.jenis,
      data.nominal,
      data.tanggal,
      data.kategori,
      data.catatan,
    );

  res.status(201).json({
    message: "Transaksi berhasil disimpan.",
    transaksi: { id: info.lastInsertRowid, ...data },
  });
});

// GET /transaksi?jenis=&dari=&sampai= -> riwayat milik user (US-04)
router.get("/transaksi", verifyToken, (req, res) => {
  const f = buatFilter(req.user.id, req.query, true);
  const transaksi = db
    .prepare(
      `SELECT id, jenis, nominal, tanggal, kategori, catatan
       FROM Transaksi WHERE ${f.sql} ORDER BY tanggal DESC, id DESC`,
    )
    .all(...f.params);
  res.json({ transaksi });
});

// GET /ringkasan?dari=&sampai= -> total pemasukan, pengeluaran, saldo (US-03)
router.get("/ringkasan", verifyToken, (req, res) => {
  const f = buatFilter(req.user.id, req.query, false);
  const baris = db
    .prepare(
      `SELECT jenis, SUM(nominal) AS total, COUNT(*) AS jumlah FROM Transaksi WHERE ${f.sql} GROUP BY jenis`,
    )
    .all(...f.params);

  const pemasukan = baris.find((b) => b.jenis === "pemasukan")?.total || 0;
  const pengeluaran = baris.find((b) => b.jenis === "pengeluaran")?.total || 0;
  const jumlah = baris.reduce((n, b) => n + b.jumlah, 0);
  res.json({ pemasukan, pengeluaran, saldo: pemasukan - pengeluaran, jumlah });
});

// PUT /transaksi/:id -> ubah transaksi (US-05)
router.put("/transaksi/:id", verifyToken, (req, res) => {
  const { error, data } = validasi(req.body);
  if (error) return res.status(400).json({ message: error });

  const info = db
    .prepare(
      "UPDATE Transaksi SET jenis = ?, nominal = ?, tanggal = ?, kategori = ?, catatan = ? WHERE id = ? AND user_id = ?",
    )
    .run(
      data.jenis,
      data.nominal,
      data.tanggal,
      data.kategori,
      data.catatan,
      req.params.id,
      req.user.id,
    );

  if (info.changes === 0)
    return res.status(404).json({ message: "Transaksi tidak ditemukan." });
  res.json({
    message: "Perubahan berhasil disimpan.",
    transaksi: { id: Number(req.params.id), ...data },
  });
});

// DELETE /transaksi/:id -> hapus transaksi (US-06)
router.delete("/transaksi/:id", verifyToken, (req, res) => {
  const info = db
    .prepare("DELETE FROM Transaksi WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (info.changes === 0)
    return res.status(404).json({ message: "Transaksi tidak ditemukan." });
  res.json({ message: "Transaksi berhasil dihapus." });
});

module.exports = router;
