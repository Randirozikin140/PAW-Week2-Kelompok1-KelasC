// Dimuat di semua halaman: helper API, register, login, dan status masuk di header.
const TOKEN_KEY = "sakuusaha_token";
const USER_KEY = "sakuusaha_user";

// Jika halaman dibuka dari port lain (misal Live Server :5500), arahkan ke server di :3000
const API_BASE = location.port === "3000" ? "" : "http://localhost:3000";

async function apiFetch(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = "Bearer " + token;

  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      // Token kedaluwarsa atau tidak valid: hapus supaya status header ikut berubah
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    return { ok: res.ok, status: res.status, body: data };
  } catch {
    return {
      ok: false,
      status: 0,
      body: {
        message:
          "Tidak dapat terhubung ke server. Pastikan server sudah dijalankan (npm start).",
      },
    };
  }
}

function tampilPesan(el, teks, sukses) {
  el.textContent = teks;
  el.className =
    "form__message " + (sukses ? "form__message--ok" : "form__message--error");
  el.hidden = false;
}

// ----- Halaman register -----
const formRegister = document.getElementById("form-register");
if (formRegister) {
  const pesan = document.getElementById("pesan");
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formRegister));
    const { ok, body } = await apiFetch("/register", {
      method: "POST",
      body: data,
    });
    tampilPesan(pesan, body.message || "Terjadi kesalahan.", ok);
    if (ok) {
      formRegister.reset();
      setTimeout(() => (location.href = "login.html"), 1200);
    }
  });
}

// ----- Halaman login -----
const formLogin = document.getElementById("form-login");
if (formLogin) {
  const pesan = document.getElementById("pesan");
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formLogin));
    const { ok, body } = await apiFetch("/login", {
      method: "POST",
      body: data,
    });
    tampilPesan(pesan, body.message || "Terjadi kesalahan.", ok);
    if (ok) {
      localStorage.setItem(TOKEN_KEY, body.token);
      localStorage.setItem(USER_KEY, JSON.stringify(body.user));
      setTimeout(() => (location.href = "index.html"), 800);
    }
  });
}

// ----- Status masuk di header -----
const slot = document.getElementById("auth-slot");
if (slot) {
  const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
  if (user && localStorage.getItem(TOKEN_KEY)) {
    slot.innerHTML = "";
    const sapa = document.createElement("span");
    sapa.className = "auth-greeting";
    sapa.textContent = `Halo, ${user.nama}`;
    const keluar = document.createElement("button");
    keluar.type = "button";
    keluar.className = "btn btn--ghost";
    keluar.textContent = "Keluar";
    keluar.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.reload();
    });
    slot.append(sapa, keluar);
  }
}
