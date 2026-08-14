# FORM::IskakFatoni 🚀

> **Aplikasi Pembuat Formulir Modern (Google Forms Clone) dengan Hosting di GitHub Pages, Database Firebase Cloud Firestore, dan Fitur Export ke Excel (.xlsx).**

---

## ✨ Fitur Utama

- **🎨 Modern & Responsive UI**: Antarmuka berbasis *Glassmorphism* dengan tema Gelap (Dark Mode) dan Terang (Light Mode), tipografi modern (*Inter & Outfit*), serta animasi mikro yang halus.
- **🛠️ Form Builder Dinamis**:
  - Tipe pertanyaan lengkap: **Teks Singkat, Paragraf, Pilihan Ganda (Radio), Kotak Centang (Checkboxes), Dropdown, Rating Bintang (1-5), Tanggal, Waktu, dan Angka**.
  - Atur pertanyaan wajib (*Required*), duplikasi pertanyaan, pindah posisi (*reorder*), dan hapus.
  - Kustomisasi warna tema formulir dan gambar banner header.
- **📋 Form Viewer / Responden**:
  - Tampilan pengisian responsif untuk desktop dan smartphone.
  - Validasi formulir realtime.
  - Halaman konfirmasi terkirim (*Thank You screen*) yang dapat dikustomisasi.
- **📊 Responses Dashboard & Analitik**:
  - Ringkasan total responden, tanggal submit terakhir, dan status formulir.
  - Tabel data respon interaktif dengan fitur pencarian.
- **📥 Export ke Excel (.xlsx)**:
  - Ekspor seluruh respon formulir langsung ke berkas Excel `.xlsx` dalam satu klik menggunakan SheetJS.
  - Penyesuaian otomatis lebar kolom dan format tanggal Indonesia.
- **🔥 Firebase Cloud Firestore Realtime**:
  - Data formulir dan respon tersimpan di cloud secara aman.
  - Dilengkapi *Mode Demo Lokal (LocalStorage)* otomatis jika Firebase belum diatur.
- **🌐 100% Siap untuk GitHub Pages**:
  - Arsitektur Single Page Application (SPA) dengan *Hash Router* (`#/builder/...`, `#/view/...`, `#/responses/...`) sehingga tidak ada isu error 404 saat halaman di-refresh di GitHub Pages.

---

## 📂 Struktur Berkas

```
formcraft-app/
├── index.html                   # Halaman utama SPA
├── css/
│   ├── main.css                 # Desain sistem, tema gelap/terang, modal, toast
│   ├── builder.css              # Styling halaman pembuat form
│   ├── form-view.css            # Styling halaman pengisian form untuk responden
│   └── responses.css            # Styling dashboard data tabel respon
├── js/
│   ├── app.js                   # Router utama SPA, controller modal & tema
│   ├── firebase-config.js       # Inisialisasi Firebase Cloud Firestore
│   ├── storage.js               # Data Access Layer (Firestore + fallback LocalStorage)
│   ├── builder.js               # Logika Form Builder (editor pertanyaan & opsi)
│   ├── form-view.js             # Logika Form Viewer (validasi & submit respon)
│   ├── responses.js             # Logika Dashboard Respon & tabel
│   └── export-excel.js          # Engine konversi data ke file Excel (.xlsx)
├── .github/
│   └── workflows/
│       └── deploy.yml           # Otomatisasi deploy ke GitHub Pages
└── README.md                    # Dokumentasi lengkap
```

---

## 🚀 Panduan Setup Firebase Firestore

Untuk menghubungkan Firebase ke FORM::IskakFatoni:

1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru.
2. Buat database **Cloud Firestore** dalam mode *Test mode* atau atur Security Rules berikut:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Izinkan membaca dan membuat formulir
    match /forms/{formId} {
      allow read, write: if true;
    }
    // Izinkan publik mengirimkan respon dan pemilik membaca respon
    match /responses/{responseId} {
      allow read, write: if true;
    }
  }
}
```

3. Daftarkan aplikasi Web di Project Settings Firebase untuk mendapatkan kredensial:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

4. **Masukkan Konfigurasi**:
   - **Cara 1 (Visual via Web)**: Klik ikon database / badge di pojok kanan atas aplikasi FORM::IskakFatoni, lalu masukkan config Firebase Anda.
   - **Cara 2 (Permanen di Kode)**: Edit variabel `DEFAULT_FIREBASE_CONFIG` di berkas `js/firebase-config.js`.

---

### 🌐 Link Publikasi & Repository
- **Repository GitHub**: [https://github.com/iskakfatoni/form-IskakFatoni](https://github.com/iskakfatoni/form-IskakFatoni)
- **Live Demo di GitHub Pages**: [https://iskakfatoni.github.io/form-IskakFatoni/](https://iskakfatoni.github.io/form-IskakFatoni/)

### Langkah Mengaktifkan GitHub Pages di Repository Ini:
1. Buka repository [https://github.com/iskakfatoni/form-IskakFatoni](https://github.com/iskakfatoni/form-IskakFatoni).
2. Klik menu **Settings** > **Pages** di sidebar kiri.
3. Di bagian **Build and deployment**:
   - **Source**: Pilih **Deploy from a branch**.
   - **Branch**: Pilih `main` (atau `master`) dan folder `/ (root)`.
   - Klik **Save**.
4. Dalam 1-2 menit, aplikasi Anda akan live di:
   👉 **https://iskakfatoni.github.io/form-IskakFatoni/**

### Metode 2: Otomatis via GitHub Actions
Berkas `.github/workflows/deploy.yml` sudah disediakan di proyek ini. Anda cukup memilih **Source: GitHub Actions** di menu **Settings > Pages**.

---

## 📊 Cara Menggunakan Fitur Export Excel

1. Buka formulir dari Dashboard dengan mengklik tombol **Respon**.
2. Klik tombol hijau **"Export ke Excel (.xlsx)"** di pojok kanan atas.
3. Berkas `.xlsx` akan otomatis terunduh ke komputer Anda dengan nama `[nama_form]_responses_[tanggal].xlsx` yang langsung dapat dibuka di Microsoft Excel, Google Sheets, atau LibreOffice.

---

## 💡 Lisensi & Bebas Dikembangkan
Proyek ini bersifat open-source dan bebas dimodifikasi sesuai kebutuhan Anda.
