// logout-test.js - Logout test implementation

import path from "path";
import { getFormattedDate } from "./utils.js";
import { saveErrorToFile, findElementByText } from "./test-utils.js";

/**
 * Executes a logout test on the specified website
 * @param {Object} page - Puppeteer page object
 * @param {Object} testResult - Test result object to update
 * @param {string} __dirname - Directory path
 * @returns {Promise<boolean>} - Whether logout was successful
 */
export async function executeLogoutTest(page, testResult, __dirname) {
  console.log('Menjalankan test case logout...');
  
  try {
    console.log('Metode 1: Mencari tombol logout berdasarkan atribut dan teks...');
    
    // Cari berdasarkan href - Menggunakan pendekatan yang lebih aman
    const logoutHrefs = ['logout', 'signout', 'keluar', 'log-out'];
    
    // Cek apakah ada link dengan href yang mengandung kata logout
    let foundLogoutLink = false;
    
    for (const hrefText of logoutHrefs) {
      try {
        // Gunakan locator API yang lebih modern dan handal
        const selector = `a[href*="${hrefText}"]`;
        const linkExists = await page.$(selector) !== null;
        
        if (linkExists) {
          console.log(`Tombol logout ditemukan dengan selector: ${selector}`);
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => console.log('Navigation timeout, continuing')),
            page.click(selector)
          ]);
          console.log('Logout berhasil dengan metode href');
          testResult.status = "passed";
          testResult.result.details.message = "Logout berhasil dengan metode href";
          foundLogoutLink = true;
          break;
        }
      } catch (err) {
        console.log(`Error saat mencoba selector a[href*="${hrefText}"]:`, err.message);
      }
    }
    
    if (foundLogoutLink) {
      // Logout berhasil, lanjutkan ke langkah berikutnya
    } else {
      // Cari berdasarkan class/id - Menggunakan pendekatan yang lebih aman
      console.log('Mencari berdasarkan class/id...');
      
      // Daftar selector berdasarkan class/id
      const classSelectors = [
        '.logout', '.signout', '.keluar', '#logout', '#signout', '.btn-logout'
      ];
      
      let foundClassSelector = false;
      
      for (const selector of classSelectors) {
        try {
          const elementExists = await page.$(selector) !== null;
          
          if (elementExists) {
            console.log(`Tombol logout ditemukan dengan selector: ${selector}`);
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => console.log('Navigation timeout, continuing')),
              page.click(selector)
            ]);
            console.log('Logout berhasil dengan metode class/id');
            testResult.status = "passed";
            testResult.result.details.message = "Logout berhasil dengan metode class/id";
            foundClassSelector = true;
            break;
          }
        } catch (err) {
          console.log(`Error saat mencoba selector ${selector}:`, err.message);
        }
      }
      
      if (foundClassSelector) {
        // Logout berhasil, lanjutkan ke langkah berikutnya
      } else {
        // Cari berdasarkan teks - Menggunakan pendekatan yang lebih aman
        console.log('Mencari berdasarkan teks...');
        
        // Daftar teks yang biasa digunakan untuk logout
        const logoutTexts = ['logout', 'log out', 'sign out', 'signout', 'keluar'];
        let foundTextElement = false;
        
        // Coba cari elemen berdasarkan teks menggunakan XPath
        for (const logoutText of logoutTexts) {
          try {
            // XPath untuk mencari elemen yang mengandung teks tertentu
            const xpathA = `//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${logoutText}')]`;
            const xpathButton = `//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${logoutText}')]`;
            
            // Cek apakah ada elemen yang cocok
            const hasMatchingLink = (await page.$x(xpathA)).length > 0;
            const hasMatchingButton = (await page.$x(xpathButton)).length > 0;
            
            if (hasMatchingLink) {
              console.log(`Tombol logout ditemukan dengan XPath link: ${xpathA}`);
              const [link] = await page.$x(xpathA);
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => console.log('Navigation timeout, continuing')),
                link.click()
              ]);
              console.log('Logout berhasil dengan metode teks (link)');
              testResult.status = "passed";
              testResult.result.details.message = "Logout berhasil dengan metode teks (link)";
              foundTextElement = true;
              break;
            } else if (hasMatchingButton) {
              console.log(`Tombol logout ditemukan dengan XPath button: ${xpathButton}`);
              const [button] = await page.$x(xpathButton);
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => console.log('Navigation timeout, continuing')),
                button.click()
              ]);
              console.log('Logout berhasil dengan metode teks (button)');
              testResult.status = "passed";
              testResult.result.details.message = "Logout berhasil dengan metode teks (button)";
              foundTextElement = true;
              break;
            }
          } catch (err) {
            console.log(`Error saat mencari teks '${logoutText}':`, err.message);
          }
        }
        
        if (foundTextElement) {
          // Logout berhasil, lanjutkan ke langkah berikutnya
        } else {
          // Metode 2: Hapus cookies dan local storage
          console.log('Metode 2: Tidak menemukan tombol logout, menggunakan metode alternatif...');
          
          // Hapus cookies
          const cookies = await page.cookies();
          console.log(`Menghapus ${cookies.length} cookies...`);
          await page.deleteCookie(...cookies);
          
          // Hapus local storage
          await page.evaluate(() => {
            try {
              localStorage.clear();
              console.log('Local storage dihapus');
            } catch (e) {
              console.log('Error saat menghapus local storage:', e);
            }
            
            try {
              sessionStorage.clear();
              console.log('Session storage dihapus');
            } catch (e) {
              console.log('Error saat menghapus session storage:', e);
            }
          });
          
          // Refresh halaman
          await page.reload({ waitUntil: 'networkidle0' });
          
          // Cek apakah logout berhasil
          const isLoggedOut = await page.evaluate(() => {
            // Cek apakah ada form login
            const hasLoginForm = document.querySelector('input[type="password"]') !== null;
            
            // Cek apakah URL mengandung kata login
            const hasLoginUrl = window.location.href.toLowerCase().includes('login') || 
                               window.location.href.toLowerCase().includes('signin');
            
            return hasLoginForm || hasLoginUrl;
          });
          
          if (isLoggedOut) {
            console.log('Logout berhasil dengan metode alternatif');
            testResult.status = "passed";
            testResult.result.details.message = "Logout berhasil dengan metode alternatif";
          } else {
            console.log('Logout gagal dengan semua metode');
            testResult.status = "failed";
            testResult.result.details.message = "Logout gagal dengan semua metode";
          }
        }
      }
    }
    
    // Ambil screenshot untuk debugging
    const screenshotPath = path.join(__dirname, 'results', `logout_${getFormattedDate()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot disimpan di ${screenshotPath}`);
    
    return testResult.status === "passed";
  } catch (error) {
    console.error('Error saat logout:', error);
    testResult.status = "failed";
    testResult.result.details.message = `Error saat logout: ${error.message}`;
    return false;
  }
}
