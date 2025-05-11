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
    if (test.config && (test.config.formUrl || test.config.targetUrl)) {
      const formUrl = test.config.formUrl || test.config.targetUrl;
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
    }
    
    // Ambil screenshot sebelum mengisi form
    try {
      await page.screenshot({
        path: path.join(__dirname, "results", `form_before_fill_${getFormattedDate()}.png`),
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
      
      // Fungsi untuk mengisi input fields
      const fillInputs = () => {
        const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"])'));
        
        // Filter input yang terlihat dan tidak readonly/disabled
        const visibleInputs = inputs.filter(input => {
          const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  style.opacity !== '0' && 
                  element.offsetParent !== null;
          };
          
          return isVisible(input) && !input.readOnly && !input.disabled;
        });
        
        // Isi setiap input dengan nilai default
        const filledInputs = visibleInputs.map(input => {
          // Skip file inputs as they can't be set via JavaScript
          if (input.type && input.type.toLowerCase() === 'file') {
            console.log(`Skipping file input: ${input.name || input.id || 'unnamed'}`);
            return {
              type: 'file',
              name: input.name || '',
              id: input.id || '',
              value: '[FILE INPUT - CANNOT BE SET PROGRAMMATICALLY]',
              skipped: true
            };
          }
          
          const defaultValue = getDefaultValue(input);
          
          // Set nilai
          try {
            input.value = defaultValue;
            
            // Trigger events
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (error) {
            console.error(`Error setting value for input ${input.name || input.id || 'unnamed'}: ${error.message}`);
            return {
              type: input.type || 'text',
              name: input.name || '',
              id: input.id || '',
              error: error.message,
              skipped: true
            };
          }
          
          return {
            type: input.type || 'text',
            name: input.name || '',
            id: input.id || '',
            value: input.value
          };
        });
        
        return filledInputs;
      };
      
      // Fungsi untuk mengisi textarea fields
      const fillTextareas = () => {
        const textareas = Array.from(document.querySelectorAll('textarea'));
        
        // Filter textarea yang terlihat dan tidak readonly/disabled
        const visibleTextareas = textareas.filter(textarea => {
          const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  style.opacity !== '0' && 
                  element.offsetParent !== null;
          };
          
          return isVisible(textarea) && !textarea.readOnly && !textarea.disabled;
        });
        
        // Isi setiap textarea dengan nilai default
        const filledTextareas = visibleTextareas.map(textarea => {
          const name = textarea.name?.toLowerCase() || '';
          const id = textarea.id?.toLowerCase() || '';
          const placeholder = textarea.placeholder?.toLowerCase() || '';
          
          let defaultValue = 'This is a test description. Please ignore.';
          
          if (name.includes('message') || id.includes('message') || placeholder.includes('message') || 
              name.includes('pesan') || id.includes('pesan') || placeholder.includes('pesan')) {
            defaultValue = 'This is a test message. Please ignore.';
          } else if (name.includes('comment') || id.includes('comment') || placeholder.includes('comment') || 
                    name.includes('komentar') || id.includes('komentar') || placeholder.includes('komentar')) {
            defaultValue = 'This is a test comment. Please ignore.';
          } else if (name.includes('description') || id.includes('description') || placeholder.includes('description') || 
                    name.includes('deskripsi') || id.includes('deskripsi') || placeholder.includes('deskripsi')) {
            defaultValue = 'This is a test description. Please ignore.';
          } else if (name.includes('address') || id.includes('address') || placeholder.includes('address') || 
                    name.includes('alamat') || id.includes('alamat') || placeholder.includes('alamat')) {
            defaultValue = '123 Test Street, Test City, Test Country';
          }
          
          // Set nilai
          textarea.value = defaultValue;
          
          // Trigger events
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          
          return {
            name: textarea.name || '',
            id: textarea.id || '',
            value: textarea.value
          };
        });
        
        return filledTextareas;
      };
      
      // Fungsi untuk mengisi select fields
      const fillSelects = () => {
        const selects = Array.from(document.querySelectorAll('select'));
        
        // Filter select yang terlihat dan tidak readonly/disabled
        const visibleSelects = selects.filter(select => {
          const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                  style.visibility !== 'hidden' && 
                  style.opacity !== '0' && 
                  element.offsetParent !== null;
          };
          
          return isVisible(select) && !select.disabled;
        });
        
        // Isi setiap select dengan nilai default
        const filledSelects = visibleSelects.map(select => {
          // Pilih opsi yang tidak kosong, jika ada
          const options = Array.from(select.options);
          
          // Default pilih opsi pertama yang tidak kosong
          let selectedIndex = 0;
          
          // Jika ada lebih dari satu opsi, pilih yang kedua (biasanya opsi pertama adalah placeholder)
          if (options.length > 1) {
            selectedIndex = 1;
          }
          
          // Set nilai
          select.selectedIndex = selectedIndex;
          
          // Trigger events
          select.dispatchEvent(new Event('change', { bubbles: true }));
          
          return {
            name: select.name || '',
            id: select.id || '',
            selectedIndex: select.selectedIndex,
            selectedValue: select.value,
            selectedText: select.options[select.selectedIndex]?.text || ''
          };
        });
        
        return filledSelects;
      };
      
      // Isi semua jenis form fields
      const inputResults = fillInputs();
      const textareaResults = fillTextareas();
      const selectResults = fillSelects();
      
      // Return hasil pengisian form
      return {
        inputs: inputResults,
        textareas: textareaResults,
        selects: selectResults,
        total: inputResults.length + textareaResults.length + selectResults.length
      };
    });
    
    console.log('Hasil pengisian form:', formFillResult);
    
    // Mencegah navigasi otomatis yang mungkin terjadi setelah pengisian form
    await page.evaluate(() => {
      try {
        // Gunakan pendekatan yang lebih aman untuk mencegah navigasi
        // Tambahkan listener untuk mencegah submit form
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          form.addEventListener('submit', function(e) {
            console.log('Mencegah submit form');
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, true);
        });
        
        // Tambahkan listener untuk mencegah klik pada link
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target) {
            console.log('Mencegah klik pada link:', target.href);
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
        
        // Mencegah unload/beforeunload
        window.addEventListener('beforeunload', function(e) {
          console.log('Mencegah beforeunload');
          e.preventDefault();
          e.returnValue = '';
          return '';
        });
      } catch (error) {
        console.error('Error saat mencoba mencegah navigasi:', error.message);
      }
    });
    
    // Ambil screenshot setelah mengisi form
    try {
      await page.screenshot({
        path: path.join(__dirname, "results", `form_after_fill_${getFormattedDate()}.png`),
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
