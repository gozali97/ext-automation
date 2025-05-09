# Digital Panel Downloader Extension

Ekstensi browser untuk mengunduh resource dari freepik.com melalui Digital Panel.

## Fitur

- Otomatis mendeteksi dan menyimpan token autentikasi dari app.digitalpanel.id
- Menambahkan tombol "By Digitalpanel" di halaman freepik.com
- Mengirim permintaan unduhan ke Digital Panel API
- Menerima notifikasi saat unduhan selesai
- Antarmuka popup yang intuitif untuk mengelola koneksi
- Integrasi dengan SheetDB untuk manajemen cookie dan autentikasi
- Fitur detail untuk melihat status proses unduhan
- Dukungan untuk multiple platform:
  - Freepik.com
  - MotionArray.com
  - Envato Elements
- Side Panel untuk akses cepat ke status dan layanan
- Fitur Pikaso untuk akses konten premium di Freepik
- Pengecekan langganan otomatis
- Monitoring penggunaan kredit AI di Freepik Labs
- Perhitungan kredit otomatis untuk berbagai model AI

## Cara Penggunaan

1. **Login ke Digital Panel**

   - Klik ikon ekstensi untuk membuka popup
   - Klik tombol "Login to Digital Panel"
   - Login dengan akun Digital Panel Anda
   - Setelah login berhasil, Anda akan dikembalikan ke tab sebelumnya

2. **Mengunduh dari Freepik**
   - Kunjungi [freepik.com](https://www.freepik.com)
   - Buka halaman detail resource yang ingin diunduh
   - Klik tombol "By Digitalpanel" yang muncul di samping tombol unduh asli
   - Tunggu hingga proses pengiriman selesai
   - Resource akan tersedia di akun Digital Panel Anda

## Setup SheetDB

Ekstensi ini menggunakan SheetDB untuk manajemen cookie dan autentikasi. SheetDB adalah layanan yang memungkinkan penggunaan Google Sheets sebagai database sederhana melalui API.

### Konfigurasi SheetDB

1. **Endpoint API**

   - Ekstensi menggunakan endpoint: `https://sheetdb.io/api/v1/6jl6g0kktcslt`
   - Endpoint ini terhubung ke Google Sheet yang berisi data cookie

2. **Struktur Data**

   - Google Sheet memiliki kolom berikut:
     - **Email**: Alamat email pengguna
     - **Cookies**: String JSON berisi cookie browser
     - **Headers**: Header HTTP tambahan (opsional)
     - **Expired**: Tanggal kedaluwarsa cookie

3. **Mode Produksi**
   - Untuk lingkungan produksi, pastikan Google Sheet telah dikonfigurasi dengan benar
   - Akses hanya diberikan kepada pengguna yang berwenang
   - Data sensitif seperti cookie dienkripsi untuk keamanan

### Penggunaan SheetDB dalam Ekstensi

- Ekstensi mengambil data cookie dari SheetDB saat pengguna mengakses halaman freepik.com
- Cookie diimpor ke browser pengguna untuk memungkinkan akses ke fitur premium
- Ekstensi secara otomatis mengelola cookie, termasuk pembaruan dan penghapusan saat diperlukan
- Sistem verifikasi langganan memeriksa apakah pengguna memiliki langganan Freepik dengan limit minimal 30
- Logika persetujuan impor cookies:
  - Memeriksa status langganan pengguna di Digital Panel
  - Jika langganan valid (limit ≥ 30), cookies diimpor secara otomatis
  - Jika langganan tidak valid, menampilkan popup informasi
  - Menyimpan status impor di localStorage untuk menghindari impor berulang

## Fitur Detail

Ekstensi ini menyediakan beberapa fitur detail untuk meningkatkan pengalaman pengguna:

1. **Popup Proses Unduhan**

   - Menampilkan popup interaktif saat proses unduhan sedang berlangsung
   - Indikator progres visual dengan animasi
   - Notifikasi sukses atau error setelah proses selesai

2. **Tombol "By Digitalpanel"**

   - Tombol ditambahkan di tiga lokasi strategis dalam modal preview Freepik:
     - Di sebelah tombol download thumbnail
     - Di sebelah tombol Go Premium
     - Di topbar modal preview
   - Tombol memiliki animasi klik untuk umpan balik visual
   - Dukungan untuk MotionArray dengan tombol di bawah tombol Download
   - Dukungan untuk Envato Elements dengan tombol di bawah tombol Subscribe

3. **Manajemen Cookie Otomatis**

   - Impor cookie otomatis dari SheetDB
   - Fallback ke metode alternatif jika impor utama gagal
   - Penghapusan cookie saat sesi berakhir
   - Penyimpanan status cookie di localStorage untuk performa lebih baik
   - Deteksi otomatis saat pengguna meninggalkan halaman untuk membersihkan cookie

4. **Fitur Pikaso**

   - Akses konten premium di Freepik melalui halaman Pikaso
   - Pengecekan langganan otomatis untuk memverifikasi akses
   - Popup informasi langganan jika akses tidak tersedia
   - Refresh otomatis setelah mengimpor cookie
   - Verifikasi limit langganan (minimal 30) sebelum mengimpor cookies
   - Logika persetujuan impor cookies berdasarkan status langganan
   - Monitoring penggunaan kredit AI dengan perhitungan otomatis
   - Pembatasan penggunaan berdasarkan limit kredit yang tersedia
   - Perhitungan kredit berdasarkan model AI dan mode yang digunakan

5. **Sistem Monitoring Kredit**

   - Monitoring otomatis penggunaan kredit AI di Freepik Labs
   - Perhitungan kredit berdasarkan jenis tool dan mode yang digunakan
   - Dukungan untuk berbagai model AI seperti Flux, Mystic, dan Classic
   - Pembatasan tombol generate saat limit kredit tercapai
   - Penyimpanan penggunaan kredit di localStorage untuk persistensi
   - Notifikasi saat limit kredit tercapai
   - Dukungan untuk reset kredit melalui popup atau background script
   - Monitoring permintaan API consume-credits menggunakan chrome.webRequest

   **Rumus Perhitungan Limit Kredit:**

   ```
   Generate Limit = (active_period × limit) × 6
   ```

   Dimana:

   - active_period: Periode aktif langganan (dalam bulan)
   - limit: Limit dasar langganan Freepik

   **Tabel Kredit Model AI:**

   | Tool                        | Mode                | Kredit per Penggunaan | Deskripsi                           |
   | --------------------------- | ------------------- | --------------------- | ----------------------------------- |
   | **Image Generator**         |
   | text-to-image               | flux-fast           | 5                     | Flux 1.0 Fast                       |
   | text-to-image               | flux                | 40                    | Flux 1.0                            |
   | text-to-image               | flux-realism        | 40                    | Flux 1.0 Realism                    |
   | text-to-image               | flux-dev            | 50                    | Flux 1.1                            |
   | text-to-image               | mystic              | 45                    | Mystic                              |
   | text-to-image               | mystic-2-5          | 50                    | Mystic 2.5                          |
   | text-to-image               | mystic-2-5-flexible | 80                    | Mystic 2.5 Flexible (Premium+ only) |
   | text-to-image               | classic-fast        | 1                     | Classic Fast                        |
   | text-to-image               | classic             | 5                     | Classic                             |
   | text-to-image               | imagen3             | 50                    | Google Imagen 3                     |
   | text-to-image               | ideogram            | 60                    | Ideogram                            |
   | **Custom LoRA**             |
   | custom-lora-character-high  | high                | 5500                  | Custom Character High               |
   | custom-lora-character-ultra | ultra               | 5500                  | Custom Character Ultra              |
   | custom-lora-product-high    | high                | 5500                  | Custom Product High                 |
   | custom-lora-product-ultra   | ultra               | 5500                  | Custom Product Ultra                |
   | custom-lora-style-medium    | medium              | 2300                  | Custom Style Medium                 |
   | custom-lora-style-high      | high                | 5500                  | Custom Style High                   |
   | custom-lora-style-ultra     | ultra               | 5500                  | Custom Style Ultra                  |
   | **Download**                |
   | svg-download                | svg                 | 150                   | SVG Download                        |
   | **Style Reference**         |
   | style-reference-flux        | flux                | 80                    | Style Reference Flux 1.0            |
   | style-reference-mystic      | mystic-2-5          | 100                   | Style Reference Mystic 2.5          |
   | **Other Tools**             |
   | sketch-to-image             | default             | 1                     | Sketch to Image                     |
   | designer-text-to-image      | default             | 1                     | Designer Text to Image              |
   | designer-background-remover | default             | 3                     | Designer Background Remover         |
   | upscaler-normal             | normal              | 72                    | Upscaler Normal                     |
   | upscaler-large              | large               | 216                   | Upscaler Large                      |
   | reimagine-classic-fast      | classic-fast        | 1                     | Reimagine Classic Fast              |
   | reimagine-flux              | flux                | 5                     | Reimagine Flux                      |
   | retouch-erase               | erase               | 25                    | Retouch Erase                       |
   | retouch-replace-prompt-auto | replace-prompt-auto | 60                    | Retouch Replace Prompt Auto         |
   | retouch-replace-prompt-pro  | replace-prompt-pro  | 80                    | Retouch Replace Prompt Pro          |
   | retouch-replace-image-auto  | replace-image-auto  | 60                    | Retouch Replace Image Auto          |
   | retouch-replace-image-pro   | replace-image-pro   | 80                    | Retouch Replace Image Pro           |
   | retouch-replace-character   | replace-character   | 70                    | Retouch Replace Character           |
   | background-remover          | default             | 3                     | Background Remover                  |
   | background-replace          | default             | 15                    | Background Replace                  |
   | expand-classic              | classic             | 40                    | Expand Classic                      |
   | expand-pro                  | pro                 | 80                    | Expand Pro                          |
   | expand-fast                 | fast                | 20                    | Expand Fast                         |

6. **Side Panel**
   - Akses cepat ke status koneksi Digital Panel
   - Tab Status untuk melihat informasi koneksi
   - Tab Layanan untuk melihat daftar layanan aktif
   - Tombol untuk login/logout dan membuka dashboard

## Pengembangan

Ekstensi ini dikembangkan menggunakan:

- [Plasmo Framework](https://www.plasmo.com/) - Framework ekstensi browser
- [React](https://reactjs.org/) - Library UI
- [TypeScript](https://www.typescriptlang.org/) - Bahasa pemrograman
- [Pusher.js](https://pusher.com/) - Komunikasi real-time
- [SheetDB](https://sheetdb.io/) - API untuk Google Sheets

### Perintah Pengembangan

```bash
# Instalasi dependensi
pnpm install

# Mode pengembangan
pnpm dev

# Build untuk produksi
pnpm build

# Membuat package untuk distribusi
pnpm package
```

## Struktur Proyek

- `src/background.ts` - Background script untuk menangani komunikasi API dan penyimpanan
- `src/popup.tsx` - Antarmuka popup ekstensi
- `src/contents/` - Content scripts untuk berbagai domain
  - `digitalpanel.ts` - Script untuk app.digitalpanel.id
  - `freepik.ts` - Script untuk freepik.com
  - `motionarray.ts` - Script untuk motionarray.com
  - `envato.ts` - Script untuk elements.envato.com
  - `freepik-labs.ts` - Script untuk fitur eksperimental Freepik dan monitoring kredit
- `src/components/` - Komponen UI dan utilitas
  - `freepik/` - Komponen khusus untuk Freepik
    - `CookieManager.ts` - Pengelolaan cookie untuk Freepik
    - `BackgroundCommunicator.ts` - Komunikasi dengan background script
    - `SubscriptionPopup.ts` - Popup langganan
  - `onpage/` - Komponen yang ditampilkan di halaman
    - `ProcessingPopup.ts` - Popup proses unduhan
    - `SuccessPopup.ts` - Popup sukses
    - `ErrorPopup.ts` - Popup error
- `src/utils/` - Utilitas dan layanan
  - `api.ts` - Layanan API untuk komunikasi dengan Digital Panel
  - `storage.ts` - Fungsi penyimpanan untuk token dan data pengguna
  - `creditMonitor.ts` - Monitoring penggunaan kredit untuk consume-credits API
  - `modelCredits.ts` - Definisi dan perhitungan kredit untuk berbagai model AI

## Izin yang Digunakan

- `tabs` - Untuk mengelola tab browser
- `storage` - Untuk menyimpan token dan data pengguna
- `notifications` - Untuk menampilkan notifikasi
- `host_permissions` - Untuk mengakses domain app.digitalpanel.id dan freepik.com

## Deployment
- edit version pada file [package.json](package.json)
- run action `Submit to Web Store` secara manual

github action akan membuild dan mengupload ke webstore secara otomatis setelah menjalankan action `Submit to Web Store`.