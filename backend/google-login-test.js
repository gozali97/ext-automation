// google-login-test.js - Google login test implementation

import path from "path";
import { getFormattedDate } from "./utils.js";
import { saveErrorToFile } from "./test-utils.js";

/**
 * Executes a Google login test on the specified website
 * @param {Object} page - Puppeteer page object
 * @param {Object} websiteConfig - Website configuration
 * @param {Object} result - Test result object to update
 * @param {string} __dirname - Directory path
 * @returns {Promise<boolean>} - Whether login was successful
 */
export async function executeGoogleLoginTest(page, websiteConfig, result, __dirname) {
  try {
    // Navigasi ke halaman login
    console.log(`Navigasi ke URL: ${websiteConfig.loginUrl || websiteConfig.url}`);
    const targetUrl = websiteConfig.loginUrl || websiteConfig.url;

    try {
      await page.goto(targetUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch (navigationError) {
      console.error('Error saat navigasi:', navigationError.message);
      saveErrorToFile(navigationError, 'google_navigation_error');
      await page.screenshot({
        path: path.join(__dirname, "results", "google_navigation_error.png"),
      });
    }

    // Tunggu halaman dimuat
    await page.waitForTimeout(3000);

    // Ambil screenshot untuk debugging
    await page.screenshot({
      path: path.join(__dirname, "results", "google_login_page.png"),
    });

    // Cari tombol login dengan Google
    const googleLoginButton = await page.evaluate(() => {
      // Cari berbagai format tombol login Google
      const googleButtons = [];
      
      // Cari berdasarkan teks
      const googleTexts = ['google', 'with google', 'sign in with google', 'login with google', 'masuk dengan google'];
      const textButtons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
      
      for (const button of textButtons) {
        const buttonText = button.textContent.toLowerCase().trim();
        for (const googleText of googleTexts) {
          if (buttonText.includes(googleText)) {
            googleButtons.push({
              element: button,
              type: 'text',
              text: buttonText
            });
            break;
          }
        }
      }
      
      // Cari berdasarkan class/id
      const googleSelectors = [
        '.google-login', '.google-signin', '.google-button', '.btn-google', '.google', 
        '#google-login', '#google-signin', '#google-button', '#btn-google', '#google',
        '[class*="google"]', '[id*="google"]'
      ];
      
      for (const selector of googleSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          googleButtons.push({
            element: element,
            type: 'selector',
            selector: selector
          });
        }
      }
      
      // Cari berdasarkan atribut
      const googleImgs = document.querySelectorAll('img[src*="google"], img[alt*="google"]');
      for (const img of googleImgs) {
        // Cari parent yang bisa diklik
        let parent = img.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
          if (parent.tagName === 'A' || parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
            googleButtons.push({
              element: parent,
              type: 'image-parent',
              imgSrc: img.src
            });
            break;
          }
          parent = parent.parentElement;
        }
      }
      
      // Pilih tombol pertama jika ada
      if (googleButtons.length > 0) {
        const firstButton = googleButtons[0];
        console.log(`Menemukan tombol Google: ${firstButton.type}`, firstButton);
        
        // Dapatkan koordinat untuk klik
        const rect = firstButton.element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          found: true,
          type: firstButton.type
        };
      }
      
      return { found: false };
    });

    if (googleLoginButton && googleLoginButton.found) {
      console.log("Tombol login Google ditemukan:", googleLoginButton);

      // Klik tombol login dengan Google
      try {
        console.log(`Mengklik tombol Google di koordinat: ${googleLoginButton.x}, ${googleLoginButton.y}`);
        await page.mouse.click(googleLoginButton.x, googleLoginButton.y);
        
        // Tunggu redirect ke halaman login Google
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
          .catch(err => console.log('Navigation timeout setelah klik tombol Google:', err.message));
        
        // Tunggu tambahan untuk memastikan halaman dimuat
        await page.waitForTimeout(3000);
        
        // Ambil screenshot untuk debugging
        await page.screenshot({
          path: path.join(__dirname, "results", "google_auth_page.png"),
        });
        
        // Cek apakah kita berada di halaman login Google
        const isGoogleLoginPage = await page.evaluate(() => {
          return window.location.href.includes('accounts.google.com') || 
                document.querySelector('input[type="email"][id="identifierId"]') !== null;
        });
        
        if (isGoogleLoginPage) {
          console.log("Halaman login Google terdeteksi");

          // Isi alamat Gmail
          if (websiteConfig.credentials.gmailAddress) {
            await page.waitForSelector('input[type="email"]', { visible: true, timeout: 10000 })
              .catch(() => console.log('Email input tidak ditemukan'));
            
            await page.type('input[type="email"]', websiteConfig.credentials.gmailAddress, { delay: 100 });
            
            // Klik tombol Next/Berikutnya
            const nextButton = await page.$('button:not([type="button"]), button[type="submit"], #identifierNext, .VfPpkd-LgbsSe');
            if (nextButton) {
              await nextButton.click();
              
              // Tunggu halaman password muncul
              await page.waitForTimeout(3000);
              
              // Isi password
              await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 })
                .catch(() => console.log('Password input tidak ditemukan'));
              
              await page.type('input[type="password"]', websiteConfig.credentials.password, { delay: 100 });
              
              // Klik tombol Sign In/Masuk
              const signInButton = await page.$('button:not([type="button"]), button[type="submit"], #passwordNext, .VfPpkd-LgbsSe');
              if (signInButton) {
                await signInButton.click();
                
                // Tunggu redirect kembali ke website
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
                  .catch(err => console.log('Navigation timeout setelah login Google:', err.message));
                
                // Tunggu tambahan untuk memastikan halaman dimuat
                await page.waitForTimeout(5000);
                
                // Ambil screenshot setelah login
                await page.screenshot({
                  path: path.join(__dirname, "results", "after_google_login.png"),
                });
                
                // Cek apakah login berhasil
                const loginSuccess = await page.evaluate((originalUrl) => {
                  return !window.location.href.includes('accounts.google.com');
                }, websiteConfig.url);
                
                if (loginSuccess) {
                  console.log("Login dengan Google berhasil");
                  result.status = "passed";
                  result.result.details.message = "Login dengan Google berhasil";
                  return true;
                } else {
                  console.log("Login dengan Google gagal");
                  result.status = "failed";
                  result.result.details.message = "Login dengan Google gagal";
                  return false;
                }
              } else {
                console.log("Tombol Sign In tidak ditemukan");
                result.status = "failed";
                result.result.details.message = "Tombol Sign In tidak ditemukan";
                return false;
              }
            } else {
              console.log("Tombol Next tidak ditemukan");
              result.status = "failed";
              result.result.details.message = "Tombol Next tidak ditemukan";
              return false;
            }
          } else {
            console.log("Alamat Gmail tidak dikonfigurasi");
            result.status = "failed";
            result.result.details.message = "Alamat Gmail tidak dikonfigurasi";
            return false;
          }
        } else {
          console.log("Halaman login Google tidak terdeteksi");
          result.status = "failed";
          result.result.details.message = "Halaman login Google tidak terdeteksi";
          return false;
        }
      } catch (googleLoginError) {
        console.error("Google login error:", googleLoginError);
        result.status = "failed";
        result.result.details.message = googleLoginError.message;
        return false;
      }
    } else {
      console.log("Tombol login Google tidak ditemukan");
      result.status = "failed";
      result.result.details.message = "Tombol login Google tidak ditemukan";
      return false;
    }
  } catch (error) {
    console.error("Google test execution error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'google_test_error');
    result.status = "failed";
    result.result.details.message = error.message;
    return false;
  }
}
