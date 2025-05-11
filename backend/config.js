// config.js - Konfigurasi untuk backend

export const config = {
  // Port untuk server
  port: process.env.PORT || 3000,
  
  // Konfigurasi Puppeteer
  puppeteer: {
    headless: process.env.NODE_ENV === 'production', // Headless di production, browser terlihat di development
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1366, height: 768 }
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
