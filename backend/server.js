import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import routes from './routes.js';
import { config } from './config.js';
import { ensureDirectoryExists } from './utils.js';

// Mendapatkan direktori saat ini
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Membuat direktori untuk menyimpan hasil jika belum ada
const resultsDir = join(__dirname, 'results');
console.log(`Ensuring results directory exists at: ${resultsDir}`);
ensureDirectoryExists(resultsDir);

// Additional check to verify directory was created
if (!fs.existsSync(resultsDir)) {
  console.error(`Failed to create results directory at: ${resultsDir}`);
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Inisialisasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan(config.logging.format));
app.use(express.static(join(__dirname, 'public')));

// Gunakan routes dari routes.js
app.use('/api', routes);

// Tambahkan route untuk dokumentasi API
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Ext-Automation API</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          h2 { color: #0066cc; margin-top: 30px; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
          .endpoint { margin-bottom: 20px; border-left: 3px solid #0066cc; padding-left: 15px; }
          .method { font-weight: bold; color: #0066cc; }
        </style>
      </head>
      <body>
        <h1>Ext-Automation API Documentation</h1>
        <p>API untuk otomatisasi web dan web scraping.</p>
        
        <h2>Endpoints</h2>
        
        <div class="endpoint">
          <p><span class="method">GET</span> /api/status</p>
          <p>Memeriksa status server.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> /api/login</p>
          <p>Melakukan login ke website.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> /api/logout</p>
          <p>Melakukan logout dari website.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> /api/run-tests</p>
          <p>Menjalankan test case.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">GET</span> /api/results</p>
          <p>Mendapatkan hasil test sebelumnya.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> /api/scrape</p>
          <p>Melakukan scraping pada halaman web.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> /api/scrape-auth</p>
          <p>Melakukan scraping pada halaman web yang memerlukan autentikasi.</p>
        </div>
        
        <h2>Status Server</h2>
        <p>Server berjalan di port ${PORT}</p>
        <p>Waktu server: ${new Date().toISOString()}</p>
      </body>
    </html>
  `);
});

// Mulai server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Waktu server: ${new Date().toISOString()}`);
  console.log('API Endpoints:');
  console.log('  GET  /api/status');
  console.log('  POST /api/login');
  console.log('  POST /api/logout');
  console.log('  POST /api/run-tests');
  console.log('  GET  /api/results');
  console.log('  POST /api/scrape');
  console.log('  POST /api/scrape-auth');
});
