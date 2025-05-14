// login-test.js - Login test implementation

import path from "path";
import { getFormattedDate } from "./utils.js";
import { saveErrorToFile, detectLoginForm, submitLoginForm } from "./test-utils.js";

/**
 * Executes a login test on the specified website
 * @param {Object} page - Puppeteer page object
 * @param {Object} websiteConfig - Website configuration
 * @param {Object} testResult - Test result object to update
 * @param {string} __dirname - Directory path
 * @returns {Promise<boolean>} - Whether login was successful
 */
export async function executeLoginTest(page, websiteConfig, testResult, __dirname) {
  console.log(`Mencoba login ke: ${websiteConfig.url}`);
  console.log(
    `Menggunakan kredensial: ${websiteConfig.credentials.type} - ${websiteConfig.credentials.identifier}`
  );

  try {
    // Setup basic authentication jika diperlukan
    if (websiteConfig.basicAuth && websiteConfig.basicAuth.username && websiteConfig.basicAuth.password) {
      try {
        await page.authenticate({
          username: websiteConfig.basicAuth.username,
          password: websiteConfig.basicAuth.password,
        });
      } catch (authError) {
        console.error('Error saat setup basic authentication:', authError.message);
        saveErrorToFile(authError, 'auth_setup_error');
      }
    }
    
    // Navigasi ke halaman login dengan timeout yang lebih lama
    console.log(`Navigasi ke: ${websiteConfig.loginUrl || websiteConfig.url}`);
    try {
      await page.goto(websiteConfig.loginUrl || websiteConfig.url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    } catch (navigationError) {
      console.error('Error saat navigasi:', navigationError.message);
      // Simpan error ke file
      saveErrorToFile(navigationError, 'navigation_error');
      // Ambil screenshot untuk debugging jika navigasi gagal
      await page.screenshot({
        path: path.join(__dirname, "results", "navigation_error.png"),
      });
      console.log('Screenshot navigation error disimpan');
    }

    // Tunggu halaman dimuat
    // Use page.evaluate with setTimeout as a replacement for waitForTimeout
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));

    // Ambil screenshot untuk debugging
    await page.screenshot({
      path: path.join(__dirname, "results", "login_page.png"),
    });
    console.log("Screenshot login page disimpan");

    let loginSuccess = false;

    // Cek apakah menggunakan login via Google
    if (websiteConfig.credentials.type === "google") {
      console.log("Menggunakan login via Google");

      // Coba cari tombol login dengan Google
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
        // Klik tombol login dengan Google
        console.log(`Mengklik tombol Google di koordinat: ${googleLoginButton.x}, ${googleLoginButton.y}`);
        await page.mouse.click(googleLoginButton.x, googleLoginButton.y);
        
        // Tunggu redirect ke halaman login Google
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
          .catch(err => console.log('Navigation timeout setelah klik tombol Google:', err.message));
        
        // Tunggu tambahan untuk memastikan halaman dimuat
        // Use page.evaluate with setTimeout as a replacement for waitForTimeout
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
        
        // Ambil screenshot untuk debugging
        await page.screenshot({
          path: path.join(__dirname, "results", "google_login_page.png"),
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
              // Use page.evaluate with setTimeout as a replacement for waitForTimeout
              await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
              
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
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
                
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
                  testResult.status = "passed";
                  testResult.result.details.message = "Login dengan Google berhasil";
                  return true;
                } else {
                  console.log("Login dengan Google gagal");
                  testResult.status = "failed";
                  testResult.result.details.message = "Login dengan Google gagal";
                  return false;
                }
              } else {
                console.log("Tombol Sign In tidak ditemukan");
                testResult.status = "failed";
                testResult.result.details.message = "Tombol Sign In tidak ditemukan";
                return false;
              }
            } else {
              console.log("Tombol Next tidak ditemukan");
              testResult.status = "failed";
              testResult.result.details.message = "Tombol Next tidak ditemukan";
              return false;
            }
          } else {
            console.log("Alamat Gmail tidak dikonfigurasi");
            testResult.status = "failed";
            testResult.result.details.message = "Alamat Gmail tidak dikonfigurasi";
            return false;
          }
        } else {
          console.log("Halaman login Google tidak terdeteksi");
          testResult.status = "failed";
          testResult.result.details.message = "Halaman login Google tidak terdeteksi";
          return false;
        }
      } else {
        console.log("Tombol login Google tidak ditemukan");
        testResult.status = "failed";
        testResult.result.details.message = "Tombol login Google tidak ditemukan";
        return false;
      }
    } else {
      // Login normal dengan email/username dan password
      console.log("Menggunakan login normal");

      // Deteksi elemen form login
      const formElements = await detectLoginForm(page);
      console.log("Form elements detected:", formElements);
      
      // Cek apakah elemen form login ditemukan dengan metode standar
      if (formElements.hasEmailInput && formElements.hasPasswordInput) {
        console.log("Elemen form login ditemukan dengan metode standar");
        
        // Isi form login
        await page.type(formElements.emailSelector, websiteConfig.credentials.identifier);
        await page.type(formElements.passwordSelector, websiteConfig.credentials.password);

        console.log("Mengklik tombol login...");
        
        // Coba submit form
        if (formElements.hasSubmitButton) {
          try {
            // Klik tombol submit dengan menunggu navigasi
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {}),
              page.click(formElements.submitSelector)
            ]);
          } catch (submitError) {
            console.error("Error saat submit form:", submitError.message);
            
            // Coba metode alternatif
            await submitLoginForm(page, formElements.submitSelector, websiteConfig.credentials);
          }
        } else {
          console.log("Tombol submit tidak ditemukan, mencoba metode alternatif...");
          await submitLoginForm(page, null, websiteConfig.credentials);
        }
      } else {
        // Gunakan pendekatan alternatif untuk login
        console.log("Elemen form login tidak ditemukan dengan metode standar, mencoba metode alternatif...");
        
        // Cari elemen login dengan pendekatan yang lebih agresif
        const alternativeInputs = await page.evaluate((credentials) => {
          // Fungsi untuk memeriksa apakah elemen terlihat
          const isVisible = (element) => {
            const isStyleVisible = window.getComputedStyle(element).display !== 'none' && 
                                  window.getComputedStyle(element).visibility !== 'hidden' && 
                                  window.getComputedStyle(element).opacity !== '0';
            
            const rect = element.getBoundingClientRect();
            const hasSize = rect.width > 0 && rect.height > 0;
            
            return isStyleVisible && hasSize;
          };
          
          // Fungsi untuk mendapatkan semua teks dari elemen dan child-nya
          const getAllText = (element) => {
            return element.textContent.trim().toLowerCase();
          };
          
          // Fungsi untuk memeriksa apakah elemen memiliki kelas Tailwind tertentu
          const hasTailwindClass = (element, classPattern) => {
            if (!element.className) return false;
            
            const classStr = typeof element.className === 'string' 
              ? element.className 
              : element.className.baseVal || '';
              
            return new RegExp(classPattern).test(classStr);
          };
          
          // Deteksi apakah halaman menggunakan React
          const isReactApp = !!document.getElementById('app') || 
                            !!document.getElementById('root') || 
                            !!document.querySelector('[data-reactroot]') ||
                            !!document.querySelector('[data-reactid]');
          
          // Deteksi apakah halaman menggunakan Angular
          const isAngularApp = !!document.querySelector('[ng-app]') || 
                              !!document.querySelector('[ng-controller]') || 
                              !!document.querySelector('[ng-model]') ||
                              document.documentElement.hasAttribute('ng-app');
          
          // Deteksi apakah halaman menggunakan Vue
          const isVueApp = !!document.querySelector('[v-app]') || 
                          !!document.querySelector('[v-model]') || 
                          !!document.querySelector('[v-bind]') ||
                          !!document.querySelector('[data-v-]');
          
          // Deteksi framework yang digunakan
          console.log(`Framework detection: React=${isReactApp}, Angular=${isAngularApp}, Vue=${isVueApp}`);
          
          // Cari semua input yang mungkin untuk email/username
          const possibleEmailInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
            .filter(input => {
              if (!isVisible(input)) return false;
              
              const type = input.type?.toLowerCase() || '';
              const name = input.name?.toLowerCase() || '';
              const id = input.id?.toLowerCase() || '';
              const placeholder = input.placeholder?.toLowerCase() || '';
              const className = input.className?.toLowerCase() || '';
              
              return type === 'email' || type === 'text' || type === '' || 
                    name.includes('email') || name.includes('username') || name.includes('user') || name.includes('login') || 
                    id.includes('email') || id.includes('username') || id.includes('user') || id.includes('login') || 
                    placeholder.includes('email') || placeholder.includes('username') || placeholder.includes('user') || placeholder.includes('login') ||
                    className.includes('email') || className.includes('username') || className.includes('user') || className.includes('login') ||
                    input.getAttribute('aria-label')?.toLowerCase().includes('email') ||
                    input.getAttribute('aria-label')?.toLowerCase().includes('username');
            });
          
          // Cari semua input yang mungkin untuk password
          const possiblePasswordInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
            .filter(input => {
              if (!isVisible(input)) return false;
              
              const type = input.type?.toLowerCase() || '';
              const name = input.name?.toLowerCase() || '';
              const id = input.id?.toLowerCase() || '';
              const placeholder = input.placeholder?.toLowerCase() || '';
              const className = input.className?.toLowerCase() || '';
              
              return type === 'password' || 
                    name.includes('password') || name.includes('pass') || 
                    id.includes('password') || id.includes('pass') || 
                    placeholder.includes('password') || placeholder.includes('pass') ||
                    className.includes('password') || className.includes('pass') ||
                    input.getAttribute('aria-label')?.toLowerCase().includes('password');
            });
          
          // Cari semua tombol yang mungkin untuk submit
          const possibleSubmitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"], [tabindex="0"], .btn, .button, [class*="btn"], [class*="button"]'))
            .filter(button => {
              if (!isVisible(button)) return false;
              
              const type = button.type?.toLowerCase() || '';
              const text = button.textContent?.toLowerCase() || '';
              const value = button.value?.toLowerCase() || '';
              const className = button.className?.toLowerCase() || '';
              
              return type === 'submit' || 
                    text.includes('login') || text.includes('sign in') || text.includes('masuk') || text.includes('log in') || 
                    value.includes('login') || value.includes('sign in') || value.includes('masuk') || value.includes('log in') || 
                    className.includes('login') || className.includes('signin') || className.includes('submit') ||
                    hasTailwindClass(button, 'btn|button') ||
                    button.getAttribute('aria-label')?.toLowerCase().includes('login') ||
                    button.getAttribute('aria-label')?.toLowerCase().includes('sign in');
            });
          
          return {
            emailInputs: possibleEmailInputs.map(el => ({
              element: el,
              type: el.type || '',
              name: el.name || '',
              id: el.id || '',
              placeholder: el.placeholder || ''
            })),
            passwordInputs: possiblePasswordInputs.map(el => ({
              element: el,
              type: el.type || '',
              name: el.name || '',
              id: el.id || '',
              placeholder: el.placeholder || ''
            })),
            submitButtons: possibleSubmitButtons.map(el => ({
              element: el,
              type: el.type || '',
              text: el.textContent?.trim() || '',
              value: el.value || ''
            }))
          };
        }, websiteConfig.credentials);
        
        console.log(`Menemukan ${alternativeInputs.emailInputs.length} input email, ${alternativeInputs.passwordInputs.length} input password, dan ${alternativeInputs.submitButtons.length} tombol submit`);
        
        if (alternativeInputs.emailInputs.length > 0 && alternativeInputs.passwordInputs.length > 0) {
          // Gunakan elemen pertama yang ditemukan
          const emailInput = alternativeInputs.emailInputs[0];
          const passwordInput = alternativeInputs.passwordInputs[0];
          
          console.log(`Menggunakan input email: ${emailInput.id || emailInput.name || emailInput.placeholder || 'unknown'}`);
          console.log(`Menggunakan input password: ${passwordInput.id || passwordInput.name || passwordInput.placeholder || 'unknown'}`);
          
          // Isi form dengan JavaScript
          const loginSuccess = await page.evaluate((credentials, emailInput, passwordInput) => {
            try {
              // Cari elemen berdasarkan atribut yang diberikan
              let emailElement, passwordElement;
              
              if (emailInput.id) {
                emailElement = document.getElementById(emailInput.id);
              } else if (emailInput.name) {
                emailElement = document.querySelector(`[name="${emailInput.name}"]`);
              } else {
                // Gunakan selector yang lebih umum
                emailElement = document.querySelector('input[type="email"], input[type="text"], input:not([type="password"])');
              }
              
              if (passwordInput.id) {
                passwordElement = document.getElementById(passwordInput.id);
              } else if (passwordInput.name) {
                passwordElement = document.querySelector(`[name="${passwordInput.name}"]`);
              } else {
                // Gunakan selector yang lebih umum
                passwordElement = document.querySelector('input[type="password"]');
              }
              
              if (emailElement && passwordElement) {
                // Isi nilai
                emailElement.value = credentials.identifier;
                passwordElement.value = credentials.password;
                
                // Trigger events
                emailElement.dispatchEvent(new Event('input', { bubbles: true }));
                emailElement.dispatchEvent(new Event('change', { bubbles: true }));
                passwordElement.dispatchEvent(new Event('input', { bubbles: true }));
                passwordElement.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Cari tombol submit
                const submitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"]')).filter(el => {
                  const type = el.type?.toLowerCase() || '';
                  const text = el.textContent?.toLowerCase() || '';
                  const value = el.value?.toLowerCase() || '';
                  
                  return type === 'submit' || 
                        text.includes('login') || text.includes('sign in') || text.includes('masuk') ||
                        value.includes('login') || value.includes('sign in') || value.includes('masuk');
                });
                
                if (submitButtons.length > 0) {
                  console.log('Menemukan tombol submit, melakukan klik...');
                  submitButtons[0].click();
                  return true;
                } else {
                  // Jika tidak ada tombol submit, coba submit form
                  const forms = document.querySelectorAll('form');
                  if (forms.length > 0) {
                    console.log('Menemukan form, mencoba submit...');
                    forms[0].submit();
                    return true;
                  }
                }
              }
              
              return false;
            } catch (error) {
              console.error('Error saat mengisi form:', error);
              return false;
            }
          }, websiteConfig.credentials, emailInput, passwordInput);
          
          if (loginSuccess) {
            console.log('Berhasil mengisi form login dengan JavaScript');
            
            // Tunggu navigasi setelah login
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
              .catch(() => console.log('Navigation timeout setelah login'));
          } else {
            console.log('Gagal mengisi form login dengan JavaScript, mencoba metode lain...');
            
            // Coba metode lain dengan Puppeteer API
            if (alternativeInputs.submitButtons.length > 0) {
              const submitButton = alternativeInputs.submitButtons[0];
              
              // Isi form dengan Puppeteer API
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
                }
              }, websiteConfig.credentials);
              
              // Klik tombol submit
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {}),
                page.evaluate((submitText) => {
                  // Cari tombol berdasarkan teks
                  const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"]'));
                  const loginButton = buttons.find(el => el.textContent.toLowerCase().includes(submitText.toLowerCase()));
                  
                  if (loginButton) {
                    loginButton.click();
                    return true;
                  }
                  
                  // Jika tidak ditemukan, klik tombol submit pertama
                  if (buttons.length > 0) {
                    buttons[0].click();
                    return true;
                  }
                  
                  return false;
                }, submitButton.text || 'login')
              ]);
            }
          }
        } else {
          // Gunakan metode standar meskipun tidak lengkap
          console.log('Tidak menemukan elemen alternatif, mencoba metode standar meskipun tidak lengkap');
          
          // Isi form login jika ada
          const emailSelector = 'input[type="email"], input[type="text"], input[name*="email"], input[name*="username"], input[id*="email"], input[id*="username"]';
          const passwordSelector = 'input[type="password"], input[name*="password"], input[id*="password"]';
          
          const hasEmailInput = await page.$(emailSelector) !== null;
          const hasPasswordInput = await page.$(passwordSelector) !== null;
          
          if (hasEmailInput) {
            await page.type(emailSelector, websiteConfig.credentials.identifier);
          }
          
          if (hasPasswordInput) {
            await page.type(passwordSelector, websiteConfig.credentials.password);
          }
          
          if (hasEmailInput && hasPasswordInput) {
            // Cari tombol submit
            const submitSelector = 'button[type="submit"], input[type="submit"], button:not([type]), button, input[type="button"]';
            
            try {
              // Klik tombol submit dengan menunggu navigasi
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {}),
                page.click(submitSelector)
              ]);
            } catch (submitError) {
              console.error("Error saat submit form:", submitError.message);
              
              // Coba metode alternatif
              await submitLoginForm(page, submitSelector, websiteConfig.credentials);
            }
          }
        }
      }

      // Tunggu setelah login
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
      
      // Ambil screenshot setelah login
      await page.screenshot({
        path: path.join(__dirname, "results", "after_login.png"),
      });
      
      // Cek apakah login berhasil
      const success = await page.evaluate((originalUrl) => {
        const currentUrl = window.location.href;
        console.log(`Original URL: ${originalUrl}, Current URL: ${currentUrl}`);

        // Cek apakah URL berubah dan berisi kata 'dashboard' atau 'admin'
        const urlChanged = !currentUrl.includes('login') && 
                          !currentUrl.includes('signin') && 
                          !currentUrl.includes('sign-in') &&
                          (currentUrl !== originalUrl || 
                          currentUrl.includes('dashboard') || 
                          currentUrl.includes('admin') ||
                          currentUrl.includes('home') ||
                          currentUrl.includes('account'));
        
        // Cek apakah ada elemen yang menunjukkan login berhasil
        const successElements = document.querySelectorAll('.dashboard, .admin, .user-info, .user-profile, .logout, .signout, .user-menu, .user-avatar');
        
        // Cek apakah ada form login
        const loginForm = document.querySelector('form[action*="login"], form[action*="signin"], form[action*="sign-in"]');
        const loginInputs = document.querySelectorAll('input[type="password"]');
        
        return urlChanged || successElements.length > 0 || (!loginForm && loginInputs.length === 0);
      }, websiteConfig.url);
      
      if (success) {
        console.log("Login berhasil");
        testResult.status = "passed";
        testResult.result.details.message = "Login berhasil";
        loginSuccess = true;
      } else {
        console.log("Login gagal");
        testResult.status = "failed";
        testResult.result.details.message = "Login gagal";
        loginSuccess = false;
      }
    }

    return loginSuccess;
  } catch (error) {
    console.error("Login error:", error);
    testResult.status = "failed";
    testResult.result.details.message = error.message;
    return false;
  }
}
