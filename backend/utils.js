// utils.js - Fungsi utilitas untuk backend
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Memastikan direktori ada, jika tidak maka akan dibuat
 * @param {string} dirPath - Path direktori yang akan dicek/dibuat
 */
export function ensureDirectoryExists(dirPath) {
  try {
    const absolutePath = path.isAbsolute(dirPath) 
      ? dirPath 
      : path.join(__dirname, dirPath);
      
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      console.log(`Direktori dibuat: ${absolutePath}`);
    } else {
      console.log(`Direktori sudah ada: ${absolutePath}`);
    }
    return absolutePath;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    // Try to create with absolute path as fallback
    try {
      const fallbackPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(dirPath);
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
        console.log(`Direktori dibuat (fallback): ${fallbackPath}`);
      }
      return fallbackPath;
    } catch (fallbackError) {
      console.error(`Failed to create directory even with fallback:`, fallbackError);
      throw error; // rethrow the original error
    }
  }
}

/**
 * Menyimpan data ke file JSON
 * @param {string} filePath - Path file untuk menyimpan data
 * @param {object} data - Data yang akan disimpan
 */
export function saveToJsonFile(filePath, data) {
  try {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, filePath);
    
    // Pastikan direktori ada
    const dir = path.dirname(absolutePath);
    ensureDirectoryExists(dir);
    
    // Tulis file
    fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2));
    console.log(`File saved successfully: ${absolutePath}`);
    return absolutePath;
  } catch (error) {
    console.error(`Error saving file ${filePath}:`, error);
    // Try an alternative approach with resolved path
    try {
      const altPath = path.resolve(filePath);
      const dir = path.dirname(altPath);
      ensureDirectoryExists(dir);
      fs.writeFileSync(altPath, JSON.stringify(data, null, 2));
      console.log(`File saved successfully (fallback): ${altPath}`);
      return altPath;
    } catch (fallbackError) {
      console.error(`Failed to save file even with fallback:`, fallbackError);
      throw error; // rethrow the original error
    }
  }
}

/**
 * Membaca data dari file JSON
 * @param {string} filePath - Path file untuk dibaca
 * @returns {object} Data dari file JSON
 */
export function readFromJsonFile(filePath) {
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.join(__dirname, filePath);
  
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Mendapatkan daftar file dalam direktori
 * @param {string} dirPath - Path direktori
 * @param {string} extension - Filter berdasarkan ekstensi file
 * @returns {Array} Daftar file
 */
export function getFilesInDirectory(dirPath, extension = null) {
  try {
    const absolutePath = path.isAbsolute(dirPath) 
      ? dirPath 
      : path.join(__dirname, dirPath);
    
    if (!fs.existsSync(absolutePath)) {
      console.log(`Directory does not exist: ${absolutePath}`);
      return [];
    }
    
    let files = fs.readdirSync(absolutePath);
    console.log(`Found ${files.length} files in ${absolutePath}`);
    
    if (extension) {
      files = files.filter(file => file.endsWith(extension));
      console.log(`Filtered to ${files.length} files with extension ${extension}`);
    }
    
    return files.map(file => ({
      name: file,
      path: path.join(absolutePath, file),
      stats: fs.statSync(path.join(absolutePath, file))
    }));
  } catch (error) {
    console.error(`Error listing files in ${dirPath}:`, error);
    return [];
  }
}

/**
 * Format tanggal untuk nama file
 * @returns {string} Tanggal dalam format YYYY-MM-DD_HH-MM-SS
 */
export function getFormattedDate() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
}

/**
 * Mendapatkan domain dari URL
 * @param {string} url - URL lengkap
 * @returns {string} Domain dari URL
 */
export function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return url.replace(/https?:\/\//, '').split('/')[0];
  }
}

/**
 * Menghasilkan ID unik
 * @returns {string} ID unik
 */
export function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Sanitasi nama file
 * @param {string} filename - Nama file yang akan disanitasi
 * @returns {string} Nama file yang aman
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Menyimpan detail error ke file
 * @param {Error} error - Objek error
 * @param {string} prefix - Prefix untuk nama file error
 */
export function saveErrorToFile(error, prefix = 'error') {
  try {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      code: error.code || '',
      name: error.name || ''
    };
    
    const errorFilename = `${prefix}_${getFormattedDate()}.json`;
    const errorFilePath = path.join(__dirname, "results", errorFilename);
    
    fs.writeFileSync(errorFilePath, JSON.stringify(errorDetails, null, 2));
    console.log(`Error details saved to ${errorFilePath}`);
  } catch (saveError) {
    console.error('Failed to save error details:', saveError);
  }
}
