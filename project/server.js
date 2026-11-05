require("dotenv").config();
const express = require("express");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET belum diisi. Isi file .env (lihat .env.example).");
  process.exit(1);
}

const app = express();

// Mengizinkan halaman yang dibuka dari port lain di localhost (misal Live Server :5500)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// API
// API
app.use("/", require("./src/routes/auth")); // /register, /login, /me, /users
app.use("/", require("./src/routes/transaksi")); // /transaksi, /ringkasan // /transaksi, /ringkasan

// Website statis (index.html, login.html, register.html, css, js)
app.use(express.static(__dirname, { index: "index.html", dotfiles: "ignore" }));

// JSON yang rusak dari client -> 400, bukan halaman error HTML
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Format JSON tidak valid." });
  }
  console.error(err);
  // Saat belajar/pengembangan, tampilkan penyebabnya agar mudah dicari
  const detail =
    process.env.NODE_ENV === "production" ? "." : `: ${err.message}`;
  res.status(500).json({ message: "Terjadi kesalahan pada server" + detail });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`SakuUsaha berjalan di http://localhost:${PORT}`),
);
