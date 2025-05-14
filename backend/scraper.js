// scraper.js - Fungsi-fungsi untuk web scraping

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { saveToJsonFile, getFormattedDate, sanitizeFilename } from './utils.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Melakukan scraping pada halaman web
 * @param {string} url - URL halaman yang akan di-scrape
 * @param {object} options - Opsi scraping
 * @returns {Promise<object>} Hasil scraping
 */
export async function scrapeWebPage(url, options = {}) {
  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    executablePath: config.puppeteer.executablePath,
    args: config.puppeteer.args,
    defaultViewport: config.puppeteer.defaultViewport
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigasi ke halaman
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: config.timeouts.navigation
    });
    
    // Tunggu halaman dimuat
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    // Scrape data sesuai dengan selector
    const data = await page.evaluate((selectors) => {
      const result = {};
      
      // Jika selectors adalah array, ambil semua elemen
      if (Array.isArray(selectors)) {
        return selectors.map(selector => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.map(el => el.textContent.trim());
        });
      }
      
      // Jika selectors adalah object, ambil data sesuai dengan key
      if (typeof selectors === 'object') {
        Object.keys(selectors).forEach(key => {
          const selector = selectors[key];
          const element = document.querySelector(selector);
          result[key] = element ? element.textContent.trim() : null;
        });
        return result;
      }
      
      // Jika tidak ada selector, ambil semua teks
      return document.body.textContent.trim();
    }, options.selectors);
    
    // Ambil screenshot jika diperlukan
    if (options.screenshot) {
      const screenshotPath = path.join(__dirname, 'results', `screenshot_${getFormattedDate()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
    
    // Simpan hasil jika diperlukan
    if (options.saveResults) {
      const filename = options.filename || `scrape_${sanitizeFilename(url)}_${getFormattedDate()}.json`;
      const filePath = path.join(__dirname, 'results', filename);
      saveToJsonFile(filePath, {
        url,
        timestamp: new Date().toISOString(),
        data
      });
    }
    
    await browser.close();
    
    return {
      success: true,
      url,
      timestamp: new Date().toISOString(),
      data
    };
  } catch (error) {
    await browser.close();
    
    return {
      success: false,
      url,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Melakukan scraping pada beberapa halaman web
 * @param {Array<string>} urls - Daftar URL yang akan di-scrape
 * @param {object} options - Opsi scraping
 * @returns {Promise<Array<object>>} Hasil scraping
 */
export async function scrapeMultiplePages(urls, options = {}) {
  const results = [];
  
  for (const url of urls) {
    const result = await scrapeWebPage(url, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Melakukan scraping pada halaman yang memerlukan login
 * @param {object} config - Konfigurasi website
 * @param {object} options - Opsi scraping
 * @returns {Promise<object>} Hasil scraping
 */
export async function scrapeAuthenticatedPage(websiteConfig, options = {}) {
  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    executablePath: config.puppeteer.executablePath,
    args: config.puppeteer.args,
    defaultViewport: config.puppeteer.defaultViewport
  });
  
  const page = await browser.newPage();
  
  try {
    // Login terlebih dahulu
    await page.goto(websiteConfig.loginUrl || websiteConfig.url);
    
    // Tunggu halaman login dimuat
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
    
    let loginSuccess = false;
    
    // Cek tipe autentikasi
    if (websiteConfig.credentials.type === 'google') {
      console.log('Menggunakan login via Google');
      
      // Cari tombol login Google
      const googleLoginButton = await page.evaluate(() => {
        const button = document.querySelector(
          'button[aria-label*="Google"], a[aria-label*="Google"], ' + 
          'button[data-provider="google"], a[data-provider="google"], ' +
          'button:has-text("Google"), a:has-text("Google"), ' +
          '.google-login, .login-with-google, ' +
          'button.social-button.google, a.social-button.google, ' +
          'button[class*="google"], a[class*="google"]'
        );
        
        return button ? {
          tag: button.tagName.toLowerCase(),
          id: button.id,
          className: button.className,
          text: button.textContent?.trim()
        } : null;
      });
      
      if (googleLoginButton) {
        // Klik tombol login Google
        await Promise.all([
          page.click(
            googleLoginButton.id ? `#${googleLoginButton.id}` : 
            googleLoginButton.className ? `.${googleLoginButton.className.split(' ').join('.')}` : 
            googleLoginButton.tag
          ),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            .catch(err => console.log('Navigation timeout, continuing:', err.message))
        ]);
        
        // Tunggu halaman login Google muncul
        await page.waitForTimeout(3000);
        
        // Cek apakah di halaman login Google
        const isGoogleLoginPage = await page.evaluate(() => {
          return window.location.href.includes('accounts.google.com');
        });
        
        if (isGoogleLoginPage) {
          console.log('Halaman login Google terdeteksi');
          
          // Isi email Google
          if (websiteConfig.credentials.gmailAddress) {
            await page.type('input[type="email"]', websiteConfig.credentials.gmailAddress);
            await page.click('#identifierNext');
            
            // Tunggu halaman password muncul
            await page.waitForTimeout(3000);
            
            // Isi password (jika disediakan)
            if (websiteConfig.credentials.password) {
              await page.type('input[type="password"]', websiteConfig.credentials.password);
              await page.click('#passwordNext');
              
              // Tunggu setelah login
              await page.waitForTimeout(5000);
            }
          }
          
          // Cek login berhasil
          const currentUrl = page.url();
          loginSuccess = !currentUrl.includes('accounts.google.com');
        }
      } else {
        // Metode alternatif mencari elemen Google login
        const foundGoogleSignIn = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a, button, div'));
          const googleElement = elements.find(el => 
            el.textContent && 
            (el.textContent.toLowerCase().includes('google') && 
             (el.textContent.toLowerCase().includes('sign in') || 
              el.textContent.toLowerCase().includes('log in') || 
              el.textContent.toLowerCase().includes('login')))
          );
          
          if (googleElement) {
            googleElement.click();
            return true;
          }
          return false;
        });
        
        if (foundGoogleSignIn) {
          // Tunggu navigasi ke halaman Google
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            .catch(err => console.log('Navigation timeout, continuing:', err.message));
          
          // Proses login di halaman Google
          // ... sama seperti kode sebelumnya
        }
      }
      
      if (!loginSuccess) {
        throw new Error('Login via Google gagal');
      }
    } else {
      // Login normal dengan email/username dan password
      
      // Tunggu form login muncul
      await page.waitForSelector('input[type="email"], input[type="text"], input[name*="email"], input[name*="username"]', { timeout: 5000 })
        .catch(() => console.log('Email/username field not found, continuing anyway'));
      
      await page.waitForSelector('input[type="password"]', { timeout: 5000 })
        .catch(() => console.log('Password field not found, continuing anyway'));
      
      // Isi form login
      await page.type('input[type="email"], input[name*="email"], input[name*="username"], input[type="text"]', websiteConfig.credentials.identifier);
      await page.type('input[type="password"]', websiteConfig.credentials.password);
      
      // Klik tombol login
      await Promise.all([
        page.click('button[type="submit"], input[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => console.log('Navigation timeout, continuing'))
      ]);
    }
    
    // Tunggu sebentar setelah login
    await page.waitForTimeout(2000);
    
    // Navigasi ke halaman yang akan di-scrape
    if (options.targetUrl && options.targetUrl !== websiteConfig.url) {
      await page.goto(options.targetUrl, { 
        waitUntil: 'networkidle2',
        timeout: config.timeouts.navigation
      });
    }
    
    // Scrape data sesuai dengan selector
    const data = await page.evaluate((selectors) => {
      const result = {};
      
      // Jika selectors adalah array, ambil semua elemen
      if (Array.isArray(selectors)) {
        return selectors.map(selector => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.map(el => el.textContent.trim());
        });
      }
      
      // Jika selectors adalah object, ambil data sesuai dengan key
      if (typeof selectors === 'object') {
        Object.keys(selectors).forEach(key => {
          const selector = selectors[key];
          const element = document.querySelector(selector);
          result[key] = element ? element.textContent.trim() : null;
        });
        return result;
      }
      
      // Jika tidak ada selector, ambil semua teks
      return document.body.textContent.trim();
    }, options.selectors);
    
    // Ambil screenshot jika diperlukan
    if (options.screenshot) {
      const screenshotPath = path.join(__dirname, 'results', `auth_screenshot_${getFormattedDate()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
    
    // Simpan hasil jika diperlukan
    if (options.saveResults) {
      const filename = options.filename || `auth_scrape_${sanitizeFilename(websiteConfig.url)}_${getFormattedDate()}.json`;
      const filePath = path.join(__dirname, 'results', filename);
      saveToJsonFile(filePath, {
        url: options.targetUrl || websiteConfig.url,
        timestamp: new Date().toISOString(),
        data
      });
    }
    
    await browser.close();
    
    return {
      success: true,
      url: options.targetUrl || websiteConfig.url,
      timestamp: new Date().toISOString(),
      data
    };
  } catch (error) {
    await browser.close();
    
    return {
      success: false,
      url: options.targetUrl || websiteConfig.url,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Mengekstrak data dari halaman web berdasarkan pola tertentu
 * @param {string} url - URL halaman yang akan diekstrak
 * @param {object} patterns - Pola untuk ekstraksi data
 * @returns {Promise<object>} Hasil ekstraksi
 */
export async function extractDataWithPatterns(url, patterns) {
  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    executablePath: config.puppeteer.executablePath,
    args: config.puppeteer.args,
    defaultViewport: config.puppeteer.defaultViewport
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigasi ke halaman
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: config.timeouts.navigation
    });
    
    // Ekstrak data berdasarkan pola
    const data = await page.evaluate((patterns) => {
      const result = {};
      
      Object.keys(patterns).forEach(key => {
        const pattern = patterns[key];
        
        if (pattern.type === 'selector') {
          // Ekstrak berdasarkan selector
          const elements = document.querySelectorAll(pattern.selector);
          result[key] = Array.from(elements).map(el => {
            if (pattern.attribute) {
              return el.getAttribute(pattern.attribute);
            }
            return el.textContent.trim();
          });
        } else if (pattern.type === 'regex') {
          // Ekstrak berdasarkan regex
          const regex = new RegExp(pattern.pattern, pattern.flags || 'g');
          const text = document.body.textContent;
          const matches = text.match(regex);
          result[key] = matches || [];
        }
      });
      
      return result;
    }, patterns);
    
    await browser.close();
    
    return {
      success: true,
      url,
      timestamp: new Date().toISOString(),
      data
    };
  } catch (error) {
    await browser.close();
    
    return {
      success: false,
      url,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

export default {
  scrapeWebPage,
  scrapeMultiplePages,
  scrapeAuthenticatedPage,
  extractDataWithPatterns
};
