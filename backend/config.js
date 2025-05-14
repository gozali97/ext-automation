// config.js - Konfigurasi untuk backend

export const config = {
  // Port untuk server
  port: process.env.PORT || 3000,
  
  // Konfigurasi Puppeteer
  puppeteer: {
    headless: process.env.NODE_ENV === 'production', // Headless di production, browser terlihat di development
    executablePath: '/usr/bin/google-chrome', // Menggunakan Chrome yang sudah terinstall di sistem
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--start-maximized', // Memaksimalkan ukuran browser
      '--window-size=1920,1080' // Set ukuran window lebih besar
    ],
    defaultViewport: null // Menggunakan null agar viewport mengikuti ukuran window
  },
  
  // Konfigurasi timeout
  timeouts: {
    navigation: 10000,
    element: 5000,
    action: 3000
  },
  
  // Path untuk menyimpan hasil
  resultsPath: './results',
  
  // Konfigurasi logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: 'dev'
  }
};
