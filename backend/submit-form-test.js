// submit-form-test.js - Submit form test implementation

import path from "path";
import { getFormattedDate } from "./utils.js";
import { saveErrorToFile } from "./test-utils.js";

/**
 * Executes a form submission test on the specified website
 * @param {Object} page - Puppeteer page object
 * @param {Object} test - Test configuration
 * @param {Object} testResult - Test result object to update
 * @param {string} __dirname - Directory path
 * @returns {Promise<boolean>} - Whether form submission was successful
 */
export async function executeSubmitFormTest(page, test, testResult, __dirname) {
  if (
    !test.config ||
    !test.config.selectors ||
    !test.config.selectors.form ||
    !test.config.selectors.submitButton
  ) {
    console.error("Konfigurasi form submit tidak lengkap");
    testResult.status = "failed";
    testResult.result.details.message = "Konfigurasi form submit tidak lengkap";
    return false;
  }

  try {
    console.log("Menjalankan Form Submit Test...");
    
    // Navigasi ke URL form jika disediakan
    if (test.config.targetUrl) {
      console.log(`Navigasi ke URL form: ${test.config.targetUrl}`);
      await page.goto(test.config.targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForTimeout(3000);
    }
    
    // Tunggu form muncul
    console.log(`Menunggu form muncul dengan selector: ${test.config.selectors.form}`);
    try {
      await page.waitForSelector(test.config.selectors.form, { timeout: 10000 });
    } catch (selectorError) {
      console.error(`Form tidak ditemukan: ${selectorError.message}`);
      testResult.status = "failed";
      testResult.result.details.message = `Form tidak ditemukan: ${selectorError.message}`;
      return false;
    }
    
    // Isi form jika ada input fields yang dikonfigurasi
    if (test.config.inputFields && test.config.inputFields.length > 0) {
      console.log("Mengisi form fields...");
      
      for (const field of test.config.inputFields) {
        if (field.selector && field.value) {
          console.log(`Mengisi field ${field.selector} dengan nilai: ${field.value}`);
          
          // Cek tipe elemen
          const elementType = await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            
            if (element.tagName === 'SELECT') return 'select';
            if (element.tagName === 'TEXTAREA') return 'textarea';
            if (element.tagName === 'INPUT') {
              return element.type || 'input';
            }
            return 'input';
          }, field.selector);
          
          if (elementType === 'select') {
            // Handle select element
            await page.select(field.selector, field.value);
          } else if (elementType === 'checkbox' || elementType === 'radio') {
            // Handle checkbox/radio
            await page.evaluate((selector, value) => {
              const element = document.querySelector(selector);
              if (element) {
                element.checked = value === 'true' || value === true;
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, field.selector, field.value);
          } else {
            // Handle text input/textarea
            await page.evaluate((selector, value) => {
              const element = document.querySelector(selector);
              if (element) {
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, field.selector, field.value);
          }
          
          // Tunggu sedikit untuk memastikan perubahan terekam
          await page.waitForTimeout(500);
        }
      }
    }
    
    // Ambil screenshot sebelum submit
    await page.screenshot({
      path: path.join(__dirname, "results", `before_submit_${getFormattedDate()}.png`),
    });
    
    // Klik tombol submit
    console.log(`Mengklik tombol submit dengan selector: ${test.config.selectors.submitButton}`);
    
    try {
      // Cek apakah tombol submit ada
      const submitButtonExists = await page.$(test.config.selectors.submitButton) !== null;
      
      if (submitButtonExists) {
        // Klik tombol dengan menunggu navigasi
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => console.log('Navigation timeout, continuing')),
          page.click(test.config.selectors.submitButton)
        ]);
      } else {
        console.error("Tombol submit tidak ditemukan");
        testResult.status = "failed";
        testResult.result.details.message = "Tombol submit tidak ditemukan";
        return false;
      }
    } catch (submitError) {
      console.error(`Error saat submit form: ${submitError.message}`);
      
      // Coba metode alternatif dengan JavaScript
      console.log("Mencoba metode alternatif dengan JavaScript...");
      
      await page.evaluate((submitSelector) => {
        const submitButton = document.querySelector(submitSelector);
        if (submitButton) {
          submitButton.click();
          return true;
        }
        
        // Jika tombol tidak ditemukan, coba submit form langsung
        const form = document.querySelector('form');
        if (form) {
          form.submit();
          return true;
        }
        
        return false;
      }, test.config.selectors.submitButton);
      
      // Tunggu navigasi setelah submit
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
        .catch(() => console.log('Navigation timeout setelah submit alternatif'));
    }
    
    // Tunggu setelah submit
    await page.waitForTimeout(5000);
    
    // Ambil screenshot setelah submit
    await page.screenshot({
      path: path.join(__dirname, "results", `after_submit_${getFormattedDate()}.png`),
    });
    
    // Cek apakah submit berhasil
    let submitSuccess = true;
    
    // Jika ada selector sukses, cek apakah elemen tersebut muncul
    if (test.config.selectors.successIndicator) {
      console.log(`Memeriksa indikator sukses: ${test.config.selectors.successIndicator}`);
      
      try {
        await page.waitForSelector(test.config.selectors.successIndicator, { timeout: 10000 });
        console.log("Indikator sukses ditemukan");
        submitSuccess = true;
      } catch (successError) {
        console.log(`Indikator sukses tidak ditemukan: ${successError.message}`);
        submitSuccess = false;
      }
    }
    
    // Jika ada selector error, cek apakah elemen tersebut muncul
    if (test.config.selectors.errorIndicator) {
      console.log(`Memeriksa indikator error: ${test.config.selectors.errorIndicator}`);
      
      try {
        const errorExists = await page.$(test.config.selectors.errorIndicator) !== null;
        if (errorExists) {
          console.log("Indikator error ditemukan");
          submitSuccess = false;
        }
      } catch (errorCheckError) {
        console.log(`Error saat memeriksa indikator error: ${errorCheckError.message}`);
      }
    }
    
    // Jika tidak ada indikator khusus, coba deteksi berdasarkan perubahan URL
    if (!test.config.selectors.successIndicator && !test.config.selectors.errorIndicator) {
      console.log("Tidak ada indikator khusus, memeriksa perubahan URL...");
      
      const currentUrl = await page.url();
      const initialUrl = test.config.targetUrl;
      
      if (currentUrl !== initialUrl) {
        console.log(`URL berubah dari ${initialUrl} menjadi ${currentUrl}`);
        submitSuccess = true;
      }
    }
    
    if (submitSuccess) {
      console.log("Form submit berhasil");
      testResult.status = "passed";
      testResult.result.details.message = "Form submit berhasil";
    } else {
      console.log("Form submit gagal");
      testResult.status = "failed";
      testResult.result.details.message = "Form submit gagal";
    }
    
    return submitSuccess;
  } catch (error) {
    console.error("Form submit error:", error);
    testResult.status = "failed";
    testResult.result.details.message = error.message;
    return false;
  }
}
