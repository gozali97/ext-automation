// form-fill-test.js - Form fill test implementation

import path from "path";
import { getFormattedDate } from "./utils.js";
import { saveErrorToFile, isVisible, getLabelText, getFieldName } from "./test-utils.js";

/**
 * Executes a form fill test on the specified website
 * @param {Object} page - Puppeteer page object
 * @param {Object} websiteConfig - Website configuration
 * @param {Object} test - Test configuration
 * @param {Object} testResult - Test result object to update
 * @param {string} __dirname - Directory path
 * @returns {Promise<boolean>} - Whether form fill was successful
 */
export async function executeFormFillTest(page, websiteConfig, test, testResult, __dirname) {
  console.log('Menjalankan Form Fill Test...');
  
  try {
    // Ensure testResult has the correct structure
    if (!testResult.result) {
      testResult.result = {
        timestamp: new Date().toISOString(),
        success: false,
        details: {}
      };
    } else if (!testResult.result.details) {
      testResult.result.details = {};
    }
    
    // Navigasi ke URL form jika disediakan
    let formUrl = websiteConfig.url; // Default to website URL
    
    // Prioritize test config URL if available
    if (test && test.config && (test.config.formUrl || test.config.targetUrl)) {
      formUrl = test.config.formUrl || test.config.targetUrl;
    }
    
    console.log(`Navigasi ke URL form: ${formUrl}`);
    
    // Pendekatan langsung untuk navigasi
    try {
      // Navigasi dengan strategi yang lebih sederhana
      await page.goto(formUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      console.log(`Berhasil navigasi ke: ${await page.url()}`);
      
      // Cek apakah halaman adalah halaman login
      const isLoginPage = await page.evaluate(() => {
        const url = window.location.href.toLowerCase();
        const hasLoginUrl = url.includes('login') || url.includes('signin') || url.includes('sign-in');
        
        const hasLoginForm = document.querySelector('form[action*="login"], form[action*="signin"], input[type="password"]') !== null;
        
        return hasLoginUrl || hasLoginForm;
      });
      
      if (isLoginPage) {
        console.log('Terdeteksi halaman login, melakukan login...');
        
        // Isi form login secara langsung
        await page.evaluate((credentials) => {
          // Cari input email dan password
          const emailInputs = document.querySelectorAll('input[type="email"], input[type="text"], input:not([type="password"])');
          const passwordInputs = document.querySelectorAll('input[type="password"]');
          
          if (emailInputs.length > 0 && passwordInputs.length > 0) {
            emailInputs[0].value = credentials.identifier;
            passwordInputs[0].value = credentials.password;
            
            // Trigger events
            emailInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            emailInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
            passwordInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            passwordInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
            
            // Cari tombol login
            const loginButtons = Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(btn => {
              const text = btn.textContent?.toLowerCase() || '';
              const value = btn.value?.toLowerCase() || '';
              const id = btn.id?.toLowerCase() || '';
              const className = btn.className?.toLowerCase() || '';
              
              return text.includes('login') || text.includes('sign in') || text.includes('masuk') ||
                     value.includes('login') || value.includes('sign in') || value.includes('masuk') ||
                     id.includes('login') || id.includes('signin') || id.includes('masuk') ||
                     className.includes('login') || className.includes('signin') || className.includes('masuk');
            });
            
            if (loginButtons.length > 0) {
              loginButtons[0].click();
            } else {
              // Jika tidak ada tombol login, coba submit form
              const form = emailInputs[0].closest('form') || passwordInputs[0].closest('form');
              if (form) {
                form.submit();
              }
            }
            
            return true;
          }
          
          return false;
        }, websiteConfig.credentials);
        
        // Tunggu navigasi selesai
        try {
          await page.waitForNavigation({ timeout: 10000 });
        } catch (navError) {
          console.log('Timeout menunggu navigasi setelah login, melanjutkan...');
        }
        
        // Tunggu sebentar untuk memastikan halaman sudah dimuat
        await page.waitForTimeout(2000);
        
        // Navigasi ke URL form lagi jika perlu
        if (formUrl !== await page.url()) {
          console.log(`Navigasi ulang ke URL form: ${formUrl}`);
          await page.goto(formUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        }
      }
    } catch (navError) {
      console.error(`Error saat navigasi ke ${formUrl}:`, navError);
      throw new Error(`Gagal navigasi ke URL form: ${navError.message}`);
    }
    
    // Ambil screenshot sebelum mengisi form
    try {
      await page.screenshot({
        path: path.join(__dirname, "results", `form_before_fill_${getFormattedDate()}.png`),
        fullPage: true // Mengambil screenshot full page
      });
      console.log("Screenshot before form fill saved");
    } catch (screenshotError) {
      console.error("Error taking screenshot before form fill:", screenshotError);
    }
    
    // Tunggu elemen form muncul
    await page.waitForSelector('input, textarea, select', { timeout: 5000 })
      .catch(err => {
        console.log(`Tidak dapat menemukan elemen form: ${err.message}`);
      });
    
    // Deteksi dan isi form fields
    const formFillResult = await page.evaluate(() => {
      // Fungsi untuk mendapatkan nilai default berdasarkan tipe input
      const getDefaultValue = (input) => {
        const type = input.type?.toLowerCase() || '';
        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        const className = input.className?.toLowerCase() || '';
        
        // Cek apakah input adalah tanggal
        const isDateField = type === 'date' || 
                          name.includes('date') || name.includes('tanggal') || 
                          id.includes('date') || id.includes('tanggal') || 
                          placeholder.includes('date') || placeholder.includes('tanggal') ||
                          className.includes('date') || className.includes('tanggal') ||
                          input.hasAttribute('data-date');
        
        // Nilai default berdasarkan tipe input
        if (isDateField) {
          // Format tanggal sesuai dengan format yang diharapkan
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          
          if (type === 'date') {
            return `${year}-${month}-${day}`; // Format HTML5 date input
          } else {
            return `${day}/${month}/${year}`; // Format umum
          }
        } else if (type === 'email' || name.includes('email') || id.includes('email') || placeholder.includes('email')) {
          return 'test@example.com';
        } else if (type === 'tel' || name.includes('phone') || name.includes('telp') || id.includes('phone') || id.includes('telp') || placeholder.includes('phone') || placeholder.includes('telp')) {
          return '081234567890';
        } else if (name.includes('name') || id.includes('name') || placeholder.includes('name') || name.includes('nama') || id.includes('nama') || placeholder.includes('nama')) {
          if (name.includes('first') || id.includes('first') || placeholder.includes('first') || name.includes('depan') || id.includes('depan') || placeholder.includes('depan')) {
            return 'John';
          } else if (name.includes('last') || id.includes('last') || placeholder.includes('last') || name.includes('belakang') || id.includes('belakang') || placeholder.includes('belakang')) {
            return 'Doe';
          } else {
            return 'John Doe';
          }
        } else if (name.includes('subject') || id.includes('subject') || placeholder.includes('subject') || name.includes('judul') || id.includes('judul') || placeholder.includes('judul')) {
          return 'Test Subject';
        } else if (name.includes('ticket') || id.includes('ticket') || placeholder.includes('ticket')) {
          return 'Test Ticket ' + new Date().toISOString().slice(0, 10);
        } else if (name.includes('message') || id.includes('message') || placeholder.includes('message') || name.includes('pesan') || id.includes('pesan') || placeholder.includes('pesan')) {
          return 'This is a test message. Please ignore.';
        } else if (name.includes('address') || id.includes('address') || placeholder.includes('address') || name.includes('alamat') || id.includes('alamat') || placeholder.includes('alamat')) {
          return '123 Test Street, Test City';
        } else if (name.includes('company') || id.includes('company') || placeholder.includes('company') || name.includes('perusahaan') || id.includes('perusahaan') || placeholder.includes('perusahaan')) {
          return 'Test Company';
        } else if (name.includes('url') || id.includes('url') || placeholder.includes('url') || name.includes('website') || id.includes('website') || placeholder.includes('website')) {
          return 'https://example.com';
        } else if (type === 'number' || type === 'range') {
          const min = input.min ? parseInt(input.min) : 0;
          const max = input.max ? parseInt(input.max) : 100;
          return Math.floor((min + max) / 2).toString();
        } else if (type === 'password') {
          return 'TestPassword123';
        } else {
          // Default untuk input text
          return 'Test Value';
        }
      };
      
      // Cari semua input, textarea, dan select yang terlihat
      const formElements = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'));
      
      // Filter hanya elemen yang terlihat
      const visibleElements = formElements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      
      // Isi setiap elemen form
      const filledElements = [];
      
      visibleElements.forEach(element => {
        try {
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase() || '';
          
          // Skip elemen yang sudah diisi atau tidak perlu diisi
          if (element.value || type === 'file' || type === 'image' || type === 'button' || type === 'submit' || type === 'reset') {
            return;
          }
          
          // Dapatkan label atau nama field untuk logging
          let fieldName = '';
          
          // Coba dapatkan label dari atribut for yang menunjuk ke id elemen
          if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) {
              fieldName = label.textContent.trim();
            }
          }
          
          // Jika tidak ada label, gunakan atribut name atau placeholder
          if (!fieldName) {
            fieldName = element.name || element.placeholder || element.id || 'Unnamed field';
          }
          
          // Isi berdasarkan tipe elemen
          if (tagName === 'select') {
            // Untuk select, pilih opsi yang tersedia
            const options = Array.from(element.options).filter(opt => !opt.disabled && opt.value);
            if (options.length > 0) {
              // Pilih opsi secara acak, hindari opsi pertama jika mungkin (biasanya placeholder)
              const selectedIndex = options.length > 1 ? Math.floor(Math.random() * (options.length - 1)) + 1 : 0;
              element.selectedIndex = selectedIndex;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              filledElements.push({ name: fieldName, value: element.value, type: 'select' });
            }
          } else if (type === 'checkbox' || type === 'radio') {
            // Untuk checkbox dan radio, centang jika belum dicentang
            if (!element.checked) {
              element.checked = true;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              filledElements.push({ name: fieldName, value: 'checked', type });
            }
          } else {
            // Untuk input text, email, dll dan textarea
            const value = getDefaultValue(element);
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            filledElements.push({ name: fieldName, value, type: type || tagName });
          }
        } catch (error) {
          console.error(`Error filling element: ${error.message}`);
        }
      });
      
      // Cegah form submission dan navigasi
      try {
        // Tambahkan listener untuk mencegah klik pada link, kecuali untuk API calls
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          // Skip prevention for API calls or specific buttons like Close Browser
          if (target && !target.classList.contains('api-action') && !target.getAttribute('data-action')) {
            console.log('Mencegah klik pada link:', target.href);
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
        
        // Mencegah unload/beforeunload kecuali untuk API calls
        const originalBeforeUnload = window.onbeforeunload;
        window.addEventListener('beforeunload', function(e) {
          // Check if this is an API call or intentional navigation
          if (!window.__allowNavigation) {
            console.log('Mencegah beforeunload');
            e.preventDefault();
            e.returnValue = '';
            return '';
          }
        });
        
        // Add a global flag that can be used to allow navigation
        window.__allowNavigation = false;
        
        // Create a function to allow navigation when needed
        window.allowNavigation = function() {
          window.__allowNavigation = true;
          console.log('Navigation is now allowed');
        };
      } catch (error) {
        console.error('Error saat mencoba mencegah navigasi:', error.message);
      }
      
      return {
        total: filledElements.length,
        fields: filledElements
      };
    });
    
    // Ambil screenshot setelah mengisi form
    try {
      await page.screenshot({
        path: path.join(__dirname, "results", `form_after_fill_${getFormattedDate()}.png`),
        fullPage: true // Mengambil screenshot full page
      });
      console.log("Screenshot after form fill saved");
    } catch (screenshotError) {
      console.error("Error taking screenshot after form fill:", screenshotError);
    }
    
    testResult.status = "passed";
    testResult.result.details = {
      message: `Berhasil mengisi ${formFillResult.total} form fields`,
      formFields: formFillResult
    };
    
    return true;
  } catch (formFillError) {
    console.error("Form fill error:", formFillError);
    testResult.status = "failed";
    
    // Ensure testResult has the correct structure before setting properties
    if (!testResult.result) {
      testResult.result = {
        timestamp: new Date().toISOString(),
        success: false,
        details: {
          error: formFillError.message
        }
      };
    } else {
      if (!testResult.result.details) {
        testResult.result.details = {};
      }
      testResult.result.details.error = formFillError.message;
    }
    
    // Save error to file for debugging
    saveErrorToFile(formFillError, 'form_fill_error');
    
    return false;
  }
}
