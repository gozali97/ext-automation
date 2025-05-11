# Panduan Penggunaan Ext-Automation

Panduan ini menjelaskan cara menggunakan aplikasi Ext-Automation yang menggabungkan ekstensi browser dengan backend Node.js untuk otomatisasi web dan web scraping.

## Daftar Isi

1. [Instalasi](#instalasi)
2. [Menjalankan Aplikasi](#menjalankan-aplikasi)
3. [Menggunakan Ekstensi Browser](#menggunakan-ekstensi-browser)
4. [Menggunakan API Backend](#menggunakan-api-backend)
5. [Contoh Penggunaan](#contoh-penggunaan)
6. [Troubleshooting](#troubleshooting)

## Instalasi

### Prasyarat

- Node.js v14+ dan npm/pnpm
- Chrome, Firefox, atau Edge browser terbaru

### Langkah-langkah Instalasi

1. **Backend Node.js**

   ```bash
   cd backend
   npm install
   ```

2. **Ekstensi Browser**

   ```bash
   cd extension
   npm install
   ```

## Menjalankan Aplikasi

### Backend Node.js

Untuk menjalankan backend, gunakan salah satu cara berikut:

1. **Menggunakan batch file (Windows)**

   ```
   cd backend
   start.bat
   ```

2. **Menggunakan npm**

   ```bash
   cd backend
   npm start
   ```

Backend akan berjalan di `http://localhost:3000`.

### Ekstensi Browser

Untuk menjalankan ekstensi browser:

1. **Mode Pengembangan**

   ```bash
   cd extension
   npm run dev
   ```

2. **Build untuk Produksi**

   ```bash
   cd extension
   npm run build
   ```

3. **Load Ekstensi ke Browser**

   - Chrome: Buka `chrome://extensions/`, aktifkan "Developer mode", klik "Load unpacked", pilih folder `extension/build/chrome-mv3-dev` (untuk mode pengembangan) atau `extension/build/chrome-mv3-prod` (untuk produksi)
   - Firefox: Buka `about:debugging#/runtime/this-firefox`, klik "Load Temporary Add-on", pilih file `manifest.json` di folder `extension/build/firefox-mv2-dev`

## Menggunakan Ekstensi Browser

Ekstensi browser menyediakan antarmuka pengguna untuk:

1. **Konfigurasi Website**
   - URL website
   - Kredensial login (email/username dan password)

2. **Test Case**
   - Login Test: Menguji fungsi login
   - Logout Test: Menguji fungsi logout
   - Form Fill Test: Mengisi formulir secara otomatis
   - Form Submit Test: Mengirim formulir dan memvalidasi respons
   - Required Fields Test: Memeriksa validasi field yang wajib diisi

3. **Menjalankan Test**
   - Pilih test case yang ingin dijalankan
   - Klik "Run Tests" untuk menjalankan test

## Menggunakan API Backend

Backend menyediakan API untuk otomatisasi web dan web scraping:

### Endpoint API

| Endpoint | Metode | Deskripsi | Parameter |
|----------|--------|-----------|-----------|
| `/api/status` | GET | Memeriksa status server | - |
| `/api/login` | POST | Melakukan login ke website | `websiteConfig` |
| `/api/logout` | POST | Melakukan logout dari website | `websiteConfig` |
| `/api/run-tests` | POST | Menjalankan test case | `websiteConfig`, `testCases` |
| `/api/results` | GET | Mendapatkan hasil test sebelumnya | - |
| `/api/scrape` | POST | Melakukan scraping pada halaman web | `url`, `options` |
| `/api/scrape-auth` | POST | Melakukan scraping pada halaman web yang memerlukan autentikasi | `websiteConfig`, `options` |

### Format Request

#### Login

```json
{
  "websiteConfig": {
    "url": "https://example.com",
    "loginUrl": "https://example.com/login",
    "credentials": {
      "type": "email",
      "identifier": "user@example.com",
      "password": "password123"
    }
  }
}
```

#### Run Tests

```json
{
  "websiteConfig": {
    "url": "https://example.com",
    "loginUrl": "https://example.com/login",
    "credentials": {
      "type": "email",
      "identifier": "user@example.com",
      "password": "password123"
    }
  },
  "testCases": [
    {
      "id": "test-0",
      "name": "Login Test",
      "type": "login",
      "enabled": true,
      "status": "idle"
    },
    {
      "id": "test-1",
      "name": "Form Fill Test",
      "type": "fillForm",
      "enabled": true,
      "status": "idle",
      "config": {
        "url": "https://example.com/form",
        "selectors": {
          "form": "form#contact-form",
          "submitButton": "button[type='submit']"
        },
        "fields": [
          {
            "selector": "input[name='name']",
            "value": "John Doe"
          },
          {
            "selector": "input[name='email']",
            "value": "john@example.com"
          }
        ]
      }
    }
  ]
}
```

#### Scrape

```json
{
  "url": "https://example.com",
  "options": {
    "selectors": {
      "title": "h1",
      "description": ".description",
      "price": ".price"
    },
    "saveResults": true,
    "screenshot": true
  }
}
```

## Contoh Penggunaan

### Contoh 1: Login dan Scrape Data

1. **Konfigurasi Website di Ekstensi**
   - Buka ekstensi dan masuk ke tab "Configuration"
   - Masukkan URL website dan kredensial login
   - Simpan konfigurasi

2. **Jalankan Test Login**
   - Buka tab "Tests"
   - Aktifkan "Login Test"
   - Klik "Run Tests"

3. **Scrape Data Menggunakan API**
   - Kirim request ke `/api/scrape-auth` dengan konfigurasi website dan selector untuk data yang ingin di-scrape

### Contoh 2: Otomatisasi Pengisian Form

1. **Konfigurasi Website di Ekstensi**
   - Buka ekstensi dan masuk ke tab "Configuration"
   - Masukkan URL website dan kredensial login
   - Simpan konfigurasi

2. **Konfigurasi Form Fill Test**
   - Buka tab "Tests"
   - Aktifkan "Form Fill Test"
   - Konfigurasi selector form dan field yang akan diisi
   - Klik "Run Tests"

## Troubleshooting

### Backend Tidak Dapat Dijalankan

1. Pastikan Node.js dan npm terinstal dengan benar
2. Periksa apakah port 3000 sudah digunakan oleh aplikasi lain
3. Periksa log error di konsol

### Ekstensi Tidak Dapat Terhubung ke Backend

1. Pastikan backend berjalan di `http://localhost:3000`
2. Periksa apakah ada error CORS di konsol browser
3. Pastikan URL backend di `extension/src/lib/api-client.ts` sudah benar

### Test Case Gagal

1. Periksa apakah selector yang digunakan sudah benar
2. Periksa apakah website target menggunakan CAPTCHA atau proteksi anti-bot
3. Coba jalankan test dengan mode headless dinonaktifkan untuk debugging

## Pengembangan Lanjutan

### Menambahkan Test Case Baru

1. Tambahkan definisi test case di `extension/src/types.ts`
2. Implementasikan logika test di `backend/routes.js`
3. Update UI di `extension/src/components/TestRunner.tsx`

### Kustomisasi Scraping

Untuk kustomisasi scraping, Anda dapat memodifikasi file `backend/scraper.js` dan menambahkan fungsi-fungsi baru sesuai kebutuhan.

---

Untuk informasi lebih lanjut, silakan lihat kode sumber atau hubungi pengembang.
