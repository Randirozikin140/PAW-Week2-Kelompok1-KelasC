// Logika Homepage: simpan, ubah, hapus, filter riwayat, dan ringkasan.
// Membutuhkan auth.js (apiFetch, TOKEN_KEY, USER_KEY, tampilPesan) dimuat lebih dulu.
(function () {
  const form = document.getElementById("form-transaksi");
  if (!form) return;
  document.body.dataset.transaksiSiap = "1"; // penanda: file ini berhasil dimuat

  const $ = (id) => document.getElementById(id);
  const pesan = $("pesan-transaksi");
  const infoLogin = $("info-login");
  const tombolSimpan = $("tombol-simpan");
  const tombolBatal = $("tombol-batal");
  const idEdit = $("transaksi-id");
  const filter = $("form-filter");
  const daftar = $("daftar-transaksi");

  const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");
  const pad = (n) => String(n).padStart(2, "0");
  const tglLokal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sudahLogin = () => Boolean(localStorage.getItem(TOKEN_KEY));

  // ----- Nilai awal: tanggal hari ini, filter = bulan ini -----
  const sekarang = new Date();
  form.elements.tanggal.value = tglLokal(sekarang);
  filter.elements.dari.value = tglLokal(
    new Date(sekarang.getFullYear(), sekarang.getMonth(), 1),
  );
  filter.elements.sampai.value = tglLokal(
    new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0),
  );

  // ----- Validasi di sisi klien (server juga memvalidasi) -----
  function periksa(data) {
    if (!data.jenis) return "Pilih jenis transaksi.";
    if (!data.nominal || Number(data.nominal) <= 0)
      return "Nominal harus lebih dari 0.";
    if (!Number.isInteger(Number(data.nominal)))
      return "Nominal harus berupa angka bulat tanpa titik atau koma.";
    if (!data.tanggal) return "Tanggal wajib diisi.";
    if (!data.kategori) return "Kategori wajib dipilih.";
    return null;
  }

  function aturModeEdit(aktif) {
    tombolSimpan.textContent = aktif ? "Simpan perubahan" : "Simpan transaksi";
    tombolBatal.hidden = !aktif;
    if (!aktif) idEdit.value = "";
  }

  function resetForm() {
    form.reset();
    form.elements.tanggal.value = tglLokal(new Date());
    aturModeEdit(false);
  }

  // ----- Submit: simpan baru atau simpan perubahan -----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sudahLogin()) {
      tampilPesan(pesan, "Masuk dulu untuk menyimpan transaksi.", false);
      infoLogin.hidden = false;
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const salah = periksa(data);
    if (salah) return tampilPesan(pesan, salah, false);

    const sedangEdit = Boolean(idEdit.value);
    tombolSimpan.disabled = true;
    const { ok, body } = await apiFetch(
      sedangEdit ? `/transaksi/${idEdit.value}` : "/transaksi",
      {
        method: sedangEdit ? "PUT" : "POST",
        body: {
          jenis: data.jenis,
          nominal: Number(data.nominal),
          tanggal: data.tanggal,
          kategori: data.kategori,
          catatan: data.catatan,
        },
      },
    );
    tombolSimpan.disabled = false;

    tampilPesan(pesan, body.message || "Terjadi kesalahan.", ok);
    if (ok) {
      resetForm();
      muat();
    }
  });

  tombolBatal.addEventListener("click", () => {
    resetForm();
    pesan.hidden = true;
  });

  // ----- Filter riwayat -----
  filter.addEventListener("submit", (e) => {
    e.preventDefault();
    muat();
  });

  // ----- Tampilkan ringkasan -----
  function tampilRingkasan(r) {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    $("ledger-sub").textContent =
      `Data ${user ? user.nama : "Anda"}, ${filter.elements.dari.value} s/d ${filter.elements.sampai.value}`;
    $("sum-in").textContent = rupiah(r.pemasukan);
    $("sum-out").textContent = rupiah(r.pengeluaran);
    $("sum-saldo").textContent = rupiah(r.saldo);
    $("ledger-foot").textContent = `${r.jumlah} transaksi pada periode ini`;
  }

  // ----- Tampilkan riwayat (DOM, bukan innerHTML, agar aman dari XSS) -----
  function sel(teks, kelas) {
    const td = document.createElement("td");
    td.textContent = teks;
    if (kelas) td.className = kelas;
    return td;
  }

  function tampilRiwayat(daftarTransaksi) {
    daftar.innerHTML = "";
    if (daftarTransaksi.length === 0) {
      const tr = document.createElement("tr");
      const td = sel("Belum ada transaksi pada filter ini.", "tabel__kosong");
      td.colSpan = 6;
      tr.append(td);
      daftar.append(tr);
      return;
    }

    for (const t of daftarTransaksi) {
      const tr = document.createElement("tr");
      const masuk = t.jenis === "pemasukan";
      tr.append(
        sel(t.tanggal),
        sel(masuk ? "Pemasukan" : "Pengeluaran", masuk ? "in" : "out"),
        sel(t.kategori),
        sel(t.catatan || "-"),
        sel(
          (masuk ? "+ " : "- ") + rupiah(t.nominal),
          "tabel__angka " + (masuk ? "in" : "out"),
        ),
      );

      const aksi = document.createElement("td");
      aksi.className = "tabel__aksi";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn btn--ghost btn--small";
      edit.textContent = "Ubah";
      edit.addEventListener("click", () => mulaiEdit(t));
      const hapus = document.createElement("button");
      hapus.type = "button";
      hapus.className = "btn btn--danger btn--small";
      hapus.textContent = "Hapus";
      hapus.addEventListener("click", () => hapusTransaksi(t));
      aksi.append(edit, hapus);
      tr.append(aksi);
      daftar.append(tr);
    }
  }

  function mulaiEdit(t) {
    idEdit.value = t.id;
    form.elements.jenis.value = t.jenis;
    form.elements.nominal.value = t.nominal;
    form.elements.tanggal.value = t.tanggal;
    form.elements.kategori.value = t.kategori;
    form.elements.catatan.value = t.catatan || "";
    aturModeEdit(true);
    pesan.hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    form.elements.nominal.focus();
  }

  async function hapusTransaksi(t) {
    const yakin = confirm(
      `Hapus transaksi ${t.kategori} sebesar ${rupiah(t.nominal)}?`,
    );
    if (!yakin) return; // dibatalkan: transaksi tetap ada
    const { ok, body } = await apiFetch(`/transaksi/${t.id}`, {
      method: "DELETE",
    });
    tampilPesan(pesan, body.message || "Terjadi kesalahan.", ok);
    if (ok) muat();
  }

  // ----- Ambil data dari server -----
  async function muat() {
    if (!sudahLogin()) {
      infoLogin.hidden = false;
      daftar.innerHTML = "";
      const tr = document.createElement("tr");
      const td = sel(
        "Masuk untuk melihat riwayat transaksi Anda.",
        "tabel__kosong",
      );
      td.colSpan = 6;
      tr.append(td);
      daftar.append(tr);
      return;
    }
    infoLogin.hidden = true;

    const q = new URLSearchParams();
    for (const nama of ["dari", "sampai", "jenis"]) {
      if (filter.elements[nama].value) q.set(nama, filter.elements[nama].value);
    }
    const qRingkasan = new URLSearchParams({
      dari: q.get("dari") || "",
      sampai: q.get("sampai") || "",
    });

    const [riwayat, ringkasan] = await Promise.all([
      apiFetch("/transaksi?" + q),
      apiFetch("/ringkasan?" + qRingkasan),
    ]);

    if (!riwayat.ok) {
      if (riwayat.status === 401) {
        infoLogin.hidden = false;
        return tampilPesan(pesan, "Sesi berakhir. Silakan masuk lagi.", false);
      }
      return tampilPesan(
        pesan,
        riwayat.body.message || "Gagal memuat data.",
        false,
      );
    }
    tampilRiwayat(riwayat.body.transaksi);
    if (ringkasan.ok) tampilRingkasan(ringkasan.body);
  }

  muat();
})();
