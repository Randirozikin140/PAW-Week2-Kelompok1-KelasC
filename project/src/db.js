const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Folder data dibuat otomatis kalau belum ada
const folder = path.join(__dirname, "..", "data");
fs.mkdirSync(folder, { recursive: true });

const db = new Database(path.join(folder, "sakuusaha.db"));
db.pragma("foreign_keys = ON");

// Jika file database lama dibuat oleh kode versi lain (kolom berbeda), tabel lama
// diganti namanya (datanya tidak dihapus) lalu tabel baru dibuat.
function cocok(tabel, kolomWajib) {
  const kolom = db
    .prepare(`PRAGMA table_info(${tabel})`)
    .all()
    .map((k) => k.name);
  return kolom.length === 0 || kolomWajib.every((k) => kolom.includes(k));
}

const userOk = cocok("User", [
  "id",
  "nama",
  "email",
  "password",
  "role",
  "created_at",
]);
const transaksiOk = cocok("Transaksi", [
  "id",
  "user_id",
  "jenis",
  "nominal",
  "tanggal",
  "kategori",
  "catatan",
  "created_at",
]);

if (!userOk || !transaksiOk) {
  const cap = Date.now();
  db.pragma("foreign_keys = OFF");
  db.exec("DROP INDEX IF EXISTS idx_transaksi_user_tanggal");
  for (const tabel of ["Transaksi", "User"]) {
    const ada = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tabel);
    if (ada) db.exec(`ALTER TABLE ${tabel} RENAME TO ${tabel}_lama_${cap}`);
  }
  db.pragma("foreign_keys = ON");
  console.warn(
    `Struktur database lama tidak cocok. Tabel lama disimpan sebagai *_lama_${cap}, tabel baru dibuat.`,
  );
}

db.exec(`
  -- Tabel User
  CREATE TABLE IF NOT EXISTS User (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nama       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'mahasiswa' CHECK (role IN ('mahasiswa','admin')),
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabel Transaksi: setiap transaksi dimiliki satu user
  CREATE TABLE IF NOT EXISTS Transaksi (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES User(id) ON DELETE CASCADE,
    jenis      TEXT    NOT NULL CHECK (jenis IN ('pemasukan','pengeluaran')),
    nominal    INTEGER NOT NULL CHECK (nominal > 0),
    tanggal    TEXT    NOT NULL,
    kategori   TEXT    NOT NULL,
    catatan    TEXT,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_transaksi_user_tanggal
    ON Transaksi (user_id, tanggal);
`);

module.exports = db;
