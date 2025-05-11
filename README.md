# Ext-Automation: Browser Extension + Node.js Backend

Aplikasi ini adalah gabungan dari ekstensi browser (menggunakan Plasmo Framework) dan backend Node.js untuk otomatisasi web dan web scraping.

## Struktur Proyek

```
ext-automation/
├── backend/                 # Node.js backend server
│   ├── config.js            # Configuration settings
│   ├── routes.js            # API route definitions
│   ├── scraper.js           # Web scraping functionality
│   ├── server.js            # Main server entry point
│   └── utils.js             # Utility functions
└── extension/               # Browser extension
    ├── src/
    │   ├── components/      # React components
    │   │   ├── TestRunner.tsx
    │   │   ├── ServerStatus.tsx
    │   │   └── ...
    │   ├── lib/
    │   │   ├── api-client.ts # Backend API client
    │   │   └── ...
    │   ├── background.ts    # Extension background script
    │   └── sidepanel.tsx    # Extension side panel UI
    └── ...
```

## Cara Menjalankan

### 1. Menjalankan Backend Node.js

```bash
cd backend
npm install
npm start
```

Server akan berjalan di `http://localhost:3000`.

### 2. Menjalankan Ekstensi Browser

```bash
cd extension
npm install
npm run dev
```

Ekstensi akan di-build dan siap untuk diload ke browser.

## Fitur

- **Otomatisasi Login/Logout**: Otomatisasi proses login dan logout pada website
- **Form Filling**: Mengisi formulir secara otomatis
- **Test Case Execution**: Menjalankan test case untuk validasi website
- **Web Scraping**: Mengambil data dari website
- **Cookie Management**: Mengelola cookie untuk sesi otentikasi

## Integrasi Backend-Ekstensi

Ekstensi browser berkomunikasi dengan backend Node.js melalui API HTTP. Backend menggunakan Puppeteer untuk otomatisasi browser dan web scraping.

### Endpoint API

- `GET /api/status`: Memeriksa status server
- `POST /api/login`: Melakukan login ke website
- `POST /api/logout`: Melakukan logout dari website
- `POST /api/run-tests`: Menjalankan test case
- `GET /api/results`: Mendapatkan hasil test sebelumnya

## Pengembangan

### Menambahkan Test Case Baru

1. Tambahkan definisi test case di `extension/src/types.ts`
2. Implementasikan logika test di `backend/server.js`
3. Update UI di `extension/src/components/TestRunner.tsx`

### Konfigurasi

Konfigurasi backend dapat diubah di `backend/config.js`.

## Kebutuhan Sistem

- Node.js v14+
- Chrome/Firefox/Edge browser terbaru
- NPM atau PNPM
