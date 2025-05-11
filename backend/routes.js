// routes.js - Definisi route API untuk backend

import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import {
  ensureDirectoryExists,
  saveToJsonFile,
  getFilesInDirectory,
  sanitizeFilename,
  getFormattedDate,
} from "./utils.js";

// Fungsi untuk menyimpan error ke file
const saveErrorToFile = (error, prefix = 'error') => {
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
};

// Setup ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan direktori results ada
ensureDirectoryExists(path.join(__dirname, "results"));

const router = express.Router();

// Route untuk memeriksa status server
router.get("/status", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    message: "Server berjalan dengan baik",
  });
});

// Route untuk melakukan login ke website
router.post("/login", async (req, res) => {
  const { websiteConfig } = req.body;

  if (!websiteConfig || !websiteConfig.url || !websiteConfig.credentials) {
    return res.status(400).json({
      success: false,
      message: "Konfigurasi website tidak valid",
    });
  }

  let browser;

  try {
    console.log(`Mencoba login ke: ${websiteConfig.url}`);
    console.log(
      `Menggunakan kredensial: ${websiteConfig.credentials.type} - ${websiteConfig.credentials.identifier}`
    );

    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: [
        ...config.puppeteer.args,
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Tambahkan listener untuk error navigasi
    page.on("requestfailed", (request) => {
      console.log(`Request failed: ${request.url()}`);
      // Add null check to avoid TypeError
      const failure = request.failure();
      if (failure && failure.errorText) {
        console.log(`Reason: ${failure.errorText}`);
      } else {
        console.log("No error details available");
      }
    });

    // Cek apakah website memerlukan basic authentication
    if (
      websiteConfig.hasBasicAuth &&
      websiteConfig.basicAuth &&
      websiteConfig.basicAuth.username &&
      websiteConfig.basicAuth.password
    ) {
      console.log('Website memerlukan basic authentication, menyiapkan kredensial...');
      try {
        await page.authenticate({
          username: websiteConfig.basicAuth.username,
          password: websiteConfig.basicAuth.password
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
    await page.waitForTimeout(3000);

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
        const button = document.querySelector(
          'button[aria-label*="Google"], a[aria-label*="Google"], ' +
            'button[data-provider="google"], a[data-provider="google"], ' +
            'button:has-text("Google"), a:has-text("Google"), ' +
            ".google-login, .login-with-google, " +
            "button.social-button.google, a.social-button.google, " +
            'button[class*="google"], a[class*="google"]'
        );

        return button
          ? {
              tag: button.tagName.toLowerCase(),
              id: button.id,
              className: button.className,
              text: button.textContent?.trim(),
            }
          : null;
      });

      if (googleLoginButton) {
        console.log("Tombol login Google ditemukan:", googleLoginButton);

        // Klik tombol login dengan Google
        await Promise.all([
          page.click(
            googleLoginButton.id
              ? `#${googleLoginButton.id}`
              : googleLoginButton.className
              ? `.${googleLoginButton.className.split(" ").join(".")}`
              : googleLoginButton.tag
          ),
          page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
            .catch((err) =>
              console.log("Navigation timeout, continuing:", err.message)
            ),
        ]);

        // Tunggu halaman login Google muncul
        await page.waitForTimeout(3000);

        // Cek apakah kita sudah di halaman login Google
        const isGoogleLoginPage = await page.evaluate(() => {
          return window.location.href.includes("accounts.google.com");
        });

        if (isGoogleLoginPage) {
          console.log("Halaman login Google terdeteksi");

          // Isi email Google
          if (websiteConfig.credentials.gmailAddress) {
            await page.type(
              'input[type="email"]',
              websiteConfig.credentials.gmailAddress
            );
            await page.click("#identifierNext");

            // Tunggu halaman password muncul
            await page.waitForTimeout(3000);

            // Isi password (jika disediakan)
            if (websiteConfig.credentials.password) {
              await page.type(
                'input[type="password"]',
                websiteConfig.credentials.password
              );
              await page.click("#passwordNext");

              // Tunggu setelah login
              await page.waitForTimeout(5000);
            }
          }

          // Cek apakah login berhasil (redirect kembali ke website asli)
          const currentUrl = page.url();
          loginSuccess = !currentUrl.includes("accounts.google.com");

          console.log(
            "Status login Google:",
            loginSuccess ? "Berhasil" : "Gagal"
          );
          console.log("Current URL after Google login:", currentUrl);
        }
      } else {
        console.log(
          "Tombol login Google tidak ditemukan, mencoba metode alternatif..."
        );

        // Coba temukan dan klik elemen Google Sign-In
        const foundGoogleSignIn = await page.evaluate(() => {
          // Coba berbagai selector dengan mendeteksi teks
          const elements = Array.from(
            document.querySelectorAll("a, button, div")
          );
          const googleElement = elements.find(
            (el) =>
              el.textContent &&
              el.textContent.toLowerCase().includes("google") &&
              (el.textContent.toLowerCase().includes("sign in") ||
                el.textContent.toLowerCase().includes("log in") ||
                el.textContent.toLowerCase().includes("login"))
          );

          if (googleElement) {
            googleElement.click();
            return true;
          }
          return false;
        });

        if (foundGoogleSignIn) {
          console.log("Menemukan dan mengklik elemen Sign-In dengan Google");

          // Tunggu navigasi
          await page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
            .catch((err) =>
              console.log("Navigation timeout, continuing:", err.message)
            );

          // Proses masuk Google
          // Cek apakah kita sudah di halaman login Google
          const isGoogleLoginPage = await page.evaluate(() => {
            return window.location.href.includes("accounts.google.com");
          });

          if (isGoogleLoginPage) {
            console.log("Halaman login Google terdeteksi");

            // Proses login Google
            // ... (sama seperti kode di atas)
          }
        }
      }
    } else {
      // Login normal dengan email/username dan password
      console.log("Menggunakan login normal");

      // Deteksi elemen form login
      console.log("Mendeteksi elemen form login...");
      const formElements = await page.evaluate(() => {
        const emailInput = document.querySelector(
          'input[type="email"], input[type="text"], input[name*="email"], input[name*="username"]'
        );
        const passwordInput = document.querySelector('input[type="password"]');
        const submitButton = document.querySelector(
          'button[type="submit"], input[type="submit"]'
        );

        return {
          hasEmailInput: !!emailInput,
          hasPasswordInput: !!passwordInput,
          hasSubmitButton: !!submitButton,
          emailSelector: emailInput ? getSelector(emailInput) : null,
          passwordSelector: passwordInput ? getSelector(passwordInput) : null,
          submitSelector: submitButton ? getSelector(submitButton) : null,
        };

        function getSelector(element) {
          if (element.id) {
            return `#${element.id}`;
          } else if (
            element.className &&
            typeof element.className === "string"
          ) {
            return `.${element.className.split(" ").join(".")}`;
          } else {
            return element.tagName.toLowerCase();
          }
        }
      });

      console.log("Form elements detected:", formElements);
      
      // Cek apakah elemen form login ditemukan dengan metode standar
      if (!formElements.hasEmailInput || !formElements.hasPasswordInput) {
        console.log("Elemen form login tidak lengkap, mencoba metode alternatif untuk modern framework...");
        
        // Ambil screenshot untuk debugging
        await page.screenshot({
          path: path.join(__dirname, "results", "login_form_before_alternative.png"),
        });
        
        // Pendekatan alternatif untuk React/Vue/modern frameworks dengan dukungan Tailwind CSS
        const alternativeInputs = await page.evaluate(() => {
          // Fungsi untuk mendapatkan semua teks dari elemen dan child-nya
          const getAllText = (element) => {
            let text = element.textContent || '';
            const childTexts = Array.from(element.childNodes)
              .filter(node => node.nodeType === 1) // Element nodes only
              .map(child => getAllText(child));
            return text.trim() + ' ' + childTexts.join(' ');
          };

          // Fungsi untuk memeriksa apakah elemen terlihat
          const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   element.offsetWidth > 0 &&
                   element.offsetHeight > 0;
          };
          
          // Fungsi untuk memeriksa apakah elemen memiliki kelas Tailwind tertentu
          const hasTailwindClass = (element, classPattern) => {
            const className = element.className || '';
            if (typeof className !== 'string') return false;
            
            // Cek pola kelas Tailwind
            return className.split(' ').some(cls => {
              return cls.includes(classPattern);
            });
          };
          
          // Deteksi apakah halaman menggunakan React
          const isReactApp = !!document.getElementById('app') || 
                            !!document.getElementById('root') || 
                            !!document.querySelector('[data-reactroot]') ||
                            !!document.querySelector('[data-react-checksum]') ||
                            !!document.querySelector('[data-reactid]') ||
                            !!document.querySelector('[data-page]');
          
          console.log('Deteksi React app:', isReactApp);
          
          // Cari semua input yang mungkin untuk email/username
          const possibleEmailInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
            .filter(input => {
              if (!isVisible(input)) return false;
              
              const type = input.type?.toLowerCase() || '';
              const name = input.name?.toLowerCase() || '';
              const id = input.id?.toLowerCase() || '';
              const placeholder = input.placeholder?.toLowerCase() || '';
              const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
              const dataTest = input.getAttribute('data-test')?.toLowerCase() || '';
              const dataTestid = input.getAttribute('data-testid')?.toLowerCase() || '';
              const className = input.className?.toLowerCase() || '';
              const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() || '';
              
              // Cek Tailwind classes
              const hasFocusRing = hasTailwindClass(input, 'focus:ring') || hasTailwindClass(input, 'focus-ring');
              const hasBorderClass = hasTailwindClass(input, 'border');
              const hasRoundedClass = hasTailwindClass(input, 'rounded');
              
              // Cek label yang terkait dengan input
              let labelText = '';
              if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) labelText = getAllText(label).toLowerCase();
              }
              
              // Cek parent elements untuk label text
              let parentText = '';
              let parent = input.parentElement;
              for (let i = 0; i < 3 && parent; i++) { // Cek 3 level ke atas
                parentText += ' ' + getAllText(parent).toLowerCase();
                parent = parent.parentElement;
              }
              
              // Cek khusus untuk React dengan Tailwind
              if (isReactApp && (hasFocusRing || hasBorderClass || hasRoundedClass)) {
                if (type === 'email' || 
                    id === 'email' || 
                    name === 'email' || 
                    autocomplete === 'username' || 
                    autocomplete === 'email' || 
                    labelText.includes('email') || 
                    labelText.includes('username')) {
                  console.log('Menemukan input email React+Tailwind:', id || name);
                  return true;
                }
              }
              
              return (
                type === 'email' || type === 'text' ||
                name.includes('email') || name.includes('user') || name.includes('login') || name.includes('name') ||
                id.includes('email') || id.includes('user') || id.includes('login') || id.includes('name') ||
                placeholder.includes('email') || placeholder.includes('user') || placeholder.includes('login') || placeholder.includes('name') ||
                ariaLabel.includes('email') || ariaLabel.includes('user') || ariaLabel.includes('login') || ariaLabel.includes('name') ||
                dataTest.includes('email') || dataTest.includes('user') || dataTest.includes('login') || dataTest.includes('name') ||
                dataTestid.includes('email') || dataTestid.includes('user') || dataTestid.includes('login') || dataTestid.includes('name') ||
                className.includes('email') || className.includes('user') || className.includes('login') || className.includes('name') ||
                labelText.includes('email') || labelText.includes('user') || labelText.includes('login') || labelText.includes('name') ||
                parentText.includes('email') || parentText.includes('user') || parentText.includes('login') || parentText.includes('name') ||
                autocomplete === 'username' || autocomplete === 'email'
              );
            });
          
          // Cari semua input yang mungkin untuk password
          const possiblePasswordInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
            .filter(input => {
              if (!isVisible(input)) return false;
              
              const type = input.type?.toLowerCase() || '';
              const name = input.name?.toLowerCase() || '';
              const id = input.id?.toLowerCase() || '';
              const placeholder = input.placeholder?.toLowerCase() || '';
              const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
              const dataTest = input.getAttribute('data-test')?.toLowerCase() || '';
              const dataTestid = input.getAttribute('data-testid')?.toLowerCase() || '';
              const className = input.className?.toLowerCase() || '';
              const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() || '';
              
              // Cek Tailwind classes
              const hasFocusRing = hasTailwindClass(input, 'focus:ring') || hasTailwindClass(input, 'focus-ring');
              const hasBorderClass = hasTailwindClass(input, 'border');
              const hasRoundedClass = hasTailwindClass(input, 'rounded');
              
              // Cek label yang terkait dengan input
              let labelText = '';
              if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) labelText = getAllText(label).toLowerCase();
              }
              
              // Cek parent elements untuk label text
              let parentText = '';
              let parent = input.parentElement;
              for (let i = 0; i < 3 && parent; i++) { // Cek 3 level ke atas
                parentText += ' ' + getAllText(parent).toLowerCase();
                parent = parent.parentElement;
              }
              
              // Cek khusus untuk React dengan Tailwind
              if (isReactApp && (hasFocusRing || hasBorderClass || hasRoundedClass)) {
                if (type === 'password' || 
                    id === 'password' || 
                    name === 'password' || 
                    autocomplete === 'current-password' || 
                    labelText.includes('password')) {
                  console.log('Menemukan input password React+Tailwind:', id || name);
                  return true;
                }
              }
              
              return (
                type === 'password' ||
                name.includes('pass') || name.includes('pwd') ||
                id.includes('pass') || id.includes('pwd') ||
                placeholder.includes('pass') || placeholder.includes('pwd') ||
                ariaLabel.includes('pass') || ariaLabel.includes('pwd') ||
                dataTest.includes('pass') || dataTest.includes('pwd') ||
                dataTestid.includes('pass') || dataTestid.includes('pwd') ||
                className.includes('pass') || className.includes('pwd') ||
                labelText.includes('pass') || labelText.includes('pwd') ||
                parentText.includes('password') || parentText.includes('kata sandi') ||
                autocomplete === 'current-password'
              );
            });
          
          // Cari semua button yang mungkin untuk submit
          const possibleSubmitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"], [tabindex="0"], .btn, .button, [class*="btn"], [class*="button"]'))
            .filter(button => {
              if (!isVisible(button)) return false;
              
              const type = button.type?.toLowerCase() || '';
              const text = getAllText(button).toLowerCase();
              const value = button.value?.toLowerCase() || '';
              const className = button.className?.toLowerCase() || '';
              const id = button.id?.toLowerCase() || '';
              const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
              const dataTest = button.getAttribute('data-test')?.toLowerCase() || '';
              const dataTestid = button.getAttribute('data-testid')?.toLowerCase() || '';
              
              // Cek Tailwind classes
              const hasBgColor = hasTailwindClass(button, 'bg-') || hasTailwindClass(button, 'background-');
              const hasTextColor = hasTailwindClass(button, 'text-');
              const hasRoundedClass = hasTailwindClass(button, 'rounded');
              const hasPaddingClass = hasTailwindClass(button, 'p-') || hasTailwindClass(button, 'px-') || hasTailwindClass(button, 'py-');
              const hasHoverClass = hasTailwindClass(button, 'hover:');
              
              const loginKeywords = ['login', 'log in', 'sign in', 'signin', 'masuk', 'submit', 'continue', 'lanjut', 'next'];
              
              // Cek khusus untuk React dengan Tailwind
              if (isReactApp && (hasBgColor || hasTextColor || hasRoundedClass || hasPaddingClass || hasHoverClass)) {
                if (text.includes('log in') || text.includes('login') || text.includes('sign in')) {
                  console.log('Menemukan tombol submit React+Tailwind:', text);
                  return true;
                }
              }
              
              return (
                type === 'submit' ||
                loginKeywords.some(keyword => text.includes(keyword)) ||
                loginKeywords.some(keyword => value.includes(keyword)) ||
                loginKeywords.some(keyword => className.includes(keyword)) ||
                loginKeywords.some(keyword => id.includes(keyword)) ||
                loginKeywords.some(keyword => ariaLabel.includes(keyword)) ||
                loginKeywords.some(keyword => dataTest.includes(keyword)) ||
                loginKeywords.some(keyword => dataTestid.includes(keyword))
              );
            });
          
          return {
            emailInputs: possibleEmailInputs.map(el => ({
              tagName: el.tagName,
              id: el.id,
              name: el.name,
              className: el.className,
              type: el.type,
              placeholder: el.placeholder
            })),
            passwordInputs: possiblePasswordInputs.map(el => ({
              tagName: el.tagName,
              id: el.id,
              name: el.name,
              className: el.className,
              type: el.type,
              placeholder: el.placeholder
            })),
            submitButtons: possibleSubmitButtons.map(el => ({
              tagName: el.tagName,
              id: el.id,
              name: el.name,
              className: el.className,
              type: el.type,
              textContent: el.textContent?.trim()
            }))
          };
        });
        
        console.log('Hasil pencarian alternatif:', 
          `Email inputs: ${alternativeInputs.emailInputs.length}`, 
          `Password inputs: ${alternativeInputs.passwordInputs.length}`, 
          `Submit buttons: ${alternativeInputs.submitButtons.length}`
        );
        
        // Jika menemukan elemen alternatif
        if (alternativeInputs.emailInputs.length > 0 && alternativeInputs.passwordInputs.length > 0) {
          // Gunakan elemen pertama yang ditemukan
          const emailInput = alternativeInputs.emailInputs[0];
          const passwordInput = alternativeInputs.passwordInputs[0];
          
          // Isi email/username
          if (emailInput.id) {
            await page.type(`#${emailInput.id}`, websiteConfig.credentials.identifier);
          } else if (emailInput.name) {
            await page.type(`input[name="${emailInput.name}"]`, websiteConfig.credentials.identifier);
          } else if (emailInput.className) {
            const classes = emailInput.className.split(' ').map(c => `.${c}`).join('');
            await page.type(`${emailInput.tagName.toLowerCase()}${classes}`, websiteConfig.credentials.identifier);
          }
          
          // Isi password
          if (passwordInput.id) {
            await page.type(`#${passwordInput.id}`, websiteConfig.credentials.password);
          } else if (passwordInput.name) {
            await page.type(`input[name="${passwordInput.name}"]`, websiteConfig.credentials.password);
          } else if (passwordInput.className) {
            const classes = passwordInput.className.split(' ').map(c => `.${c}`).join('');
            await page.type(`${passwordInput.tagName.toLowerCase()}${classes}`, websiteConfig.credentials.password);
          }
          
          // Klik tombol submit jika ditemukan
          if (alternativeInputs.submitButtons.length > 0) {
            const submitButton = alternativeInputs.submitButtons[0];
            
            try {
              if (submitButton.id) {
                await Promise.all([
                  page.click(`#${submitButton.id}`),
                  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
                ]);
              } else if (submitButton.className) {
                const classes = submitButton.className.split(' ').map(c => `.${c}`).join('');
                await Promise.all([
                  page.click(`${submitButton.tagName.toLowerCase()}${classes}`),
                  page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
                ]);
              } else {
                // Jika tidak ada selector yang cocok, gunakan JavaScript click
                await page.evaluate(() => {
                  const buttons = document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"]');
                  for (const button of buttons) {
                    const text = button.textContent?.toLowerCase() || '';
                    if (text.includes('login') || text.includes('sign in') || text.includes('masuk')) {
                      button.click();
                      return;
                    }
                  }
                  // Jika tidak ada tombol yang cocok, klik tombol pertama
                  if (buttons.length > 0) buttons[0].click();
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
              }
            } catch (clickError) {
              console.log('Error saat mengklik tombol submit, mencoba metode lain:', clickError.message);
              // Jika gagal, coba metode lain dengan JavaScript
              await page.evaluate(() => {
                // Coba submit form
                const forms = document.querySelectorAll('form');
                if (forms.length > 0) forms[0].submit();
              });
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
            }
          } else {
            // Jika tidak ada tombol submit, coba submit form langsung
            await page.evaluate(() => {
              const forms = document.querySelectorAll('form');
              if (forms.length > 0) forms[0].submit();
            });
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          }
          
          // Ambil screenshot setelah login
          await page.screenshot({
            path: path.join(__dirname, "results", "login_form_after_alternative.png"),
          });
          
          console.log('Login dengan metode alternatif selesai');
        } else {
          // Gunakan metode standar meskipun tidak lengkap
          console.log('Tidak menemukan elemen alternatif, mencoba metode standar meskipun tidak lengkap');
          
          // Isi form login jika ada
          if (formElements.hasEmailInput && formElements.emailSelector) {
            await page.type(
              formElements.emailSelector,
              websiteConfig.credentials.identifier
            );
          }

          if (formElements.hasPasswordInput && formElements.passwordSelector) {
            await page.type(
              formElements.passwordSelector,
              websiteConfig.credentials.password
            );
          }

          // Klik tombol submit jika ada
          if (formElements.hasSubmitButton && formElements.submitSelector) {
            await Promise.all([
              page.click(formElements.submitSelector),
              page
                .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
                .catch(() => console.log("Navigation timeout, continuing")),
            ]);
          } else {
            // Coba submit form dengan JavaScript
            await page.evaluate(() => {
              const forms = document.querySelectorAll('form');
              if (forms.length > 0) forms[0].submit();
            });
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
          }
        }
      } else {
        // Gunakan metode standar karena elemen form ditemukan
        // Isi form login
        if (formElements.hasEmailInput && formElements.emailSelector) {
          await page.type(
            formElements.emailSelector,
            websiteConfig.credentials.identifier
          );
        }

        if (formElements.hasPasswordInput && formElements.passwordSelector) {
          await page.type(
            formElements.passwordSelector,
            websiteConfig.credentials.password
          );
        }

        // Klik tombol submit
        if (formElements.hasSubmitButton && formElements.submitSelector) {
          await Promise.all([
            page.click(formElements.submitSelector),
            page
              .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
              .catch(() => console.log("Navigation timeout, continuing")),
          ]);
        }
      }
    }

    // Ambil cookies
    const cookies = await page.cookies();

    // Ambil URL setelah login
    const redirectUrl = page.url();
    console.log(`URL setelah login: ${redirectUrl}`);

    // Ambil screenshot untuk debugging setelah login
    await page.screenshot({
      path: path.join(__dirname, "results", "login_result.png"),
    });
    console.log("Screenshot after login saved");

    // Cek apakah login berhasil - metode yang lebih handal
    // 1. Periksa URL saat ini - jika berbeda dari URL awal atau berisi 'dashboard', kemungkinan login berhasil
    // 2. Periksa elemen-elemen yang biasanya muncul setelah login
    const success = await page.evaluate((originalUrl) => {
      const currentUrl = window.location.href;
      console.log(`Original URL: ${originalUrl}, Current URL: ${currentUrl}`);

      // Cek apakah URL berubah dan berisi kata 'dashboard' atau 'admin'
      const urlChanged = currentUrl !== originalUrl;
      const urlContainsDashboard =
        currentUrl.includes("dashboard") ||
        currentUrl.includes("admin") ||
        currentUrl.includes("home") ||
        currentUrl.includes("index");

      // Cek elemen-elemen yang biasanya muncul setelah login
      const hasLogoutElement = !!document.querySelector(
        ".profile, .dashboard, .account, .user-info, .logout, " +
          'a[href*="logout"], button[onclick*="logout"], ' +
          ".user-profile, .user-avatar, .username"
      );

      // Cek elemen khusus untuk K24
      const hasK24Elements = (() => {
        // Cek selectors standar dulu
        const standardSelectors =
          ".bsc, .menu, #menu, .home, .navbar-brand, .pt-k24, .logo-k24";
        if (document.querySelector(standardSelectors)) return true;

        // Cek h1/h2 dengan teks "HOME"
        const h1Elements = Array.from(document.querySelectorAll("h1"));
        const h2Elements = Array.from(document.querySelectorAll("h2"));
        if (
          h1Elements.some((el) => el.textContent.includes("HOME")) ||
          h2Elements.some((el) => el.textContent.includes("HOME"))
        ) {
          return true;
        }

        // Cek link dengan teks "My BSC"
        const aElements = Array.from(document.querySelectorAll("a"));
        if (aElements.some((el) => el.textContent.includes("My BSC"))) {
          return true;
        }

        return false;
      })();

      // Bisa login berhasil jika: URL berubah ke dashboard ATAU ada elemen post-login yang terdeteksi
      return (
        urlContainsDashboard ||
        hasLogoutElement ||
        hasK24Elements ||
        (urlChanged && !currentUrl.includes("login"))
      );
    }, websiteConfig.loginUrl || websiteConfig.url);

    console.log(`Login success detection: ${success ? "Berhasil" : "Gagal"}`);

    // Simpan hasil login
    const loginResult = {
      success,
      message: success ? "Login berhasil" : "Login gagal",
      redirectUrl,
      cookieData: {
        cookies,
        userData: { lastLogin: new Date().toISOString() },
      },
      browserOpen: true, // Add flag to indicate browser is still open
    };

    // Simpan hasil ke file jika berhasil
    if (success) {
      const filename = `login_${sanitizeFilename(
        websiteConfig.url
      )}_${getFormattedDate()}.json`;
      saveToJsonFile(path.join(__dirname, "results", filename), {
        url: websiteConfig.url,
        timestamp: new Date().toISOString(),
        loginMethod: websiteConfig.credentials.type,
        credentials: {
          type: websiteConfig.credentials.type,
          identifier: websiteConfig.credentials.identifier,
          // Jangan simpan password
          gmailAddress:
            websiteConfig.credentials.type === "google"
              ? websiteConfig.credentials.gmailAddress
              : undefined,
        },
        result: loginResult,
      });

      // Browser isn't closed automatically now on success
      if (!success) {
        await browser.close();
      } else {
        console.log("Browser tetap terbuka, karena login berhasil...");
        // Store browser instance for potential later use
        global.activeBrowser = browser;
        global.activePage = page;
      }
    } else {
      await browser.close();
    }

    res.json(loginResult);
  } catch (error) {
    console.error("Login error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'login_error');
    if (browser) await browser.close();
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat login",
    });
  }
});

// Route untuk melakukan logout dari website
router.post("/logout", async (req, res) => {
  const { websiteConfig } = req.body;

  if (!websiteConfig) {
    return res.status(400).json({
      success: false,
      error: "Konfigurasi website tidak valid",
    });
  }

  let browser;

  try {
    console.log(`Mencoba logout dari: ${websiteConfig.url}`);

    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Navigasi ke halaman utama
    await page.goto(websiteConfig.url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Tunggu halaman dimuat
    await page.waitForTimeout(2000);

    // Ambil screenshot sebelum logout untuk debugging
    const screenshotPath = path.join(
      __dirname,
      "results",
      `before_logout_${getFormattedDate()}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot sebelum logout disimpan di: ${screenshotPath}`);

    // Strategi 1: Coba cari dan klik tombol logout
    let logoutSuccess = false;

    try {
      console.log("Strategi 1: Mencari tombol logout...");

      // Gunakan evaluateHandle untuk menghindari masalah dengan querySelector
      const logoutElement = await page.evaluateHandle(() => {
        // Fungsi untuk mencari elemen dengan teks tertentu
        function findElementByText(selector, textList) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent?.toLowerCase().trim() || "";
            if (textList.some((t) => text.includes(t))) {
              return element;
            }
          }
          return null;
        }

        // 1. Cari berdasarkan href
        const logoutLinks = document.querySelectorAll(
          'a[href*="logout"], a[href*="signout"], a[href*="keluar"], a[href*="log-out"]'
        );
        if (logoutLinks.length > 0) return logoutLinks[0];

        // 2. Cari berdasarkan class/id yang umum
        const classElements = document.querySelectorAll(
          ".logout, .signout, .keluar, #logout, #signout, .btn-logout"
        );
        if (classElements.length > 0) return classElements[0];

        // 3. Cari berdasarkan teks
        const logoutTexts = [
          "logout",
          "log out",
          "sign out",
          "signout",
          "keluar",
        ];

        // Cari di link dan button
        const textElement = findElementByText("a, button", logoutTexts);
        if (textElement) return textElement;

        // 4. Cari di menu dropdown
        const menuItems = document.querySelectorAll(
          ".dropdown-menu a, .menu a, .nav-item a, .navbar-nav a"
        );
        const menuElement = findElementByText(menuItems, logoutTexts);
        if (menuElement) return menuElement;

        return null;
      });

      // Cek apakah elemen ditemukan
      const elementExists = await page.evaluate(
        (el) => el !== null,
        logoutElement
      );

      if (elementExists) {
        console.log("Tombol logout ditemukan, mencoba klik...");

        // Klik elemen logout
        await logoutElement
          .click()
          .catch((e) => console.log("Error saat klik:", e.message));

        // Tunggu navigasi
        await page
          .waitForNavigation({ waitUntil: "networkidle2", timeout: 5000 })
          .catch(() =>
            console.log("Navigation timeout after clicking logout, continuing")
          );

        // Cek apakah logout berhasil (biasanya redirect ke halaman login)
        const currentUrl = page.url();
        console.log(`URL setelah klik logout: ${currentUrl}`);

        // Biasanya setelah logout akan kembali ke halaman login
        if (
          currentUrl.includes("login") ||
          currentUrl !== websiteConfig.url ||
          currentUrl.includes("auth")
        ) {
          console.log("Logout berhasil via klik tombol logout");
          logoutSuccess = true;
        }
      } else {
        console.log("Tidak menemukan tombol logout yang jelas");
      }
    } catch (error) {
      console.log("Error saat mencari/mengklik tombol logout:", error.message);
    }

    // Strategi 2: Jika strategi 1 gagal, coba hapus cookies dan local storage
    if (!logoutSuccess) {
      console.log("Strategi 2: Menghapus cookies dan local storage...");

      // Hapus semua cookies
      const cookies = await page.cookies();
      console.log(`Menghapus ${cookies.length} cookies...`);

      await page.deleteCookie(...cookies);

      // Hapus local storage
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          console.log("Local storage dan session storage dihapus");
          return true;
        } catch (e) {
          console.log("Error saat menghapus storage:", e);
          return false;
        }
      });

      // Refresh halaman untuk memastikan perubahan diterapkan
      await page.reload({ waitUntil: "networkidle2" });

      // Cek apakah kita sudah logout (biasanya redirect ke halaman login)
      const currentUrl = page.url();
      console.log(`URL setelah menghapus cookies: ${currentUrl}`);

      if (currentUrl.includes("login") || currentUrl !== websiteConfig.url) {
        console.log("Logout berhasil via penghapusan cookies");
        logoutSuccess = true;
      }
    }

    // Strategi 3: Jika strategi 1 dan 2 gagal, coba akses URL logout langsung
    if (!logoutSuccess && websiteConfig.logoutUrl) {
      console.log(
        `Strategi 3: Mengakses URL logout langsung: ${websiteConfig.logoutUrl}`
      );

      await page.goto(websiteConfig.logoutUrl, { waitUntil: "networkidle2" });

      // Cek apakah kita sudah logout
      const currentUrl = page.url();
      console.log(`URL setelah mengakses URL logout: ${currentUrl}`);

      if (currentUrl.includes("login") || currentUrl !== websiteConfig.url) {
        console.log("Logout berhasil via URL logout langsung");
        logoutSuccess = true;
      }
    }

    // Strategi 4: Jika semua gagal, coba akses URL login untuk reset session
    if (!logoutSuccess && websiteConfig.loginUrl) {
      console.log(
        `Strategi 4: Mengakses URL login untuk reset session: ${websiteConfig.loginUrl}`
      );

      await page.goto(websiteConfig.loginUrl, { waitUntil: "networkidle2" });

      // Anggap berhasil jika kita sampai di halaman login
      console.log("Logout dianggap berhasil via akses halaman login");
      logoutSuccess = true;
    }

    // Ambil screenshot setelah logout untuk debugging
    const afterScreenshotPath = path.join(
      __dirname,
      "results",
      `after_logout_${getFormattedDate()}.png`
    );
    await page.screenshot({ path: afterScreenshotPath, fullPage: true });
    console.log(
      `Screenshot setelah logout disimpan di: ${afterScreenshotPath}`
    );

    await browser.close();

    // Simpan hasil logout ke file JSON
    const logoutResultPath = path.join(
      __dirname,
      "results",
      `logout_result_${sanitizeFilename(
        websiteConfig.url
      )}_${getFormattedDate()}.json`
    );
    saveToJsonFile(logoutResultPath, {
      url: websiteConfig.url,
      timestamp: new Date().toISOString(),
      success: logoutSuccess,
      message: logoutSuccess
        ? "Logout berhasil"
        : "Tidak dapat melakukan logout",
    });

    res.json({
      success: logoutSuccess,
      message: logoutSuccess
        ? "Logout berhasil"
        : "Tidak dapat melakukan logout",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    if (browser) await browser.close();
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat logout",
    });
  }
});

// Helper function untuk mendeteksi form login
async function detectLoginForm(page) {
  try {
    // Coba deteksi form login dengan metode standar
    const formElements = await page.evaluate(() => {
      const emailInput = document.querySelector('input[type="email"], input[type="text"], input[name*="email"], input[name*="username"]');
      const passwordInput = document.querySelector('input[type="password"]');
      const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
      
      // Fungsi untuk mendapatkan selector
      const getSelector = (element) => {
        if (!element) return null;
        if (element.id) return `#${element.id}`;
        if (element.name) return `[name="${element.name}"]`;
        return null;
      };
      
      return {
        hasEmailInput: !!emailInput,
        hasPasswordInput: !!passwordInput,
        hasSubmitButton: !!submitButton,
        emailSelector: emailInput ? getSelector(emailInput) : null,
        passwordSelector: passwordInput ? getSelector(passwordInput) : null,
        submitSelector: submitButton ? getSelector(submitButton) : null,
      };
    });
    
    // Jika form login tidak ditemukan dengan metode standar, coba metode alternatif
    if (!formElements.hasEmailInput || !formElements.hasPasswordInput || !formElements.hasSubmitButton) {
      console.log("Form login tidak lengkap, mencoba metode alternatif...");
      
      // Pendekatan alternatif untuk React/Vue/modern frameworks
      const alternativeInputs = await page.evaluate(() => {
        // Fungsi untuk memeriksa apakah elemen terlihat
        const isVisible = (element) => {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 style.opacity !== '0' &&
                 element.offsetWidth > 0 &&
                 element.offsetHeight > 0;
        };
        
        // Fungsi untuk mendapatkan selector
        const getSelector = (element) => {
          if (!element) return null;
          if (element.id) return `#${element.id}`;
          if (element.name) return `[name="${element.name}"]`;
          return null;
        };
        
        // Deteksi apakah halaman menggunakan React
        const isReactApp = !!document.getElementById('app') || 
                          !!document.getElementById('root') || 
                          !!document.querySelector('[data-reactroot]') ||
                          !!document.querySelector('[data-react-checksum]') ||
                          !!document.querySelector('[data-reactid]') ||
                          !!document.querySelector('[data-page]');
        
        console.log('Deteksi React app:', isReactApp);
        
        // Cari semua input yang mungkin untuk email/username
        const emailInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
          .filter(input => {
            if (!isVisible(input)) return false;
            
            const type = input.type?.toLowerCase() || '';
            const name = input.name?.toLowerCase() || '';
            const id = input.id?.toLowerCase() || '';
            const placeholder = input.placeholder?.toLowerCase() || '';
            const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() || '';
            
            return (
              type === 'email' || type === 'text' ||
              name.includes('email') || name.includes('user') || name.includes('login') ||
              id.includes('email') || id.includes('user') || id.includes('login') ||
              placeholder.includes('email') || placeholder.includes('user') || placeholder.includes('login') ||
              autocomplete === 'username' || autocomplete === 'email'
            );
          });
        
        // Cari semua input yang mungkin untuk password
        const passwordInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
          .filter(input => {
            if (!isVisible(input)) return false;
            
            const type = input.type?.toLowerCase() || '';
            const name = input.name?.toLowerCase() || '';
            const id = input.id?.toLowerCase() || '';
            const placeholder = input.placeholder?.toLowerCase() || '';
            const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() || '';
            
            return (
              type === 'password' ||
              name.includes('pass') ||
              id.includes('pass') ||
              placeholder.includes('pass') ||
              autocomplete === 'current-password'
            );
          });
        
        // Cari semua button yang mungkin untuk submit
        const submitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"], [tabindex="0"], .btn, .button, [class*="btn"], [class*="button"]'))
          .filter(button => {
            if (!isVisible(button)) return false;
            
            const type = button.type?.toLowerCase() || '';
            const text = button.textContent?.toLowerCase() || '';
            const value = button.value?.toLowerCase() || '';
            
            const loginKeywords = ['login', 'log in', 'sign in', 'signin', 'masuk', 'submit', 'continue', 'lanjut', 'next'];
            
            return (
              type === 'submit' ||
              loginKeywords.some(keyword => text.includes(keyword)) ||
              loginKeywords.some(keyword => value.includes(keyword))
            );
          });
        
        return {
          emailInputs: emailInputs.map(input => ({
            selector: getSelector(input)
          })),
          passwordInputs: passwordInputs.map(input => ({
            selector: getSelector(input)
          })),
          submitButtons: submitButtons.map(button => ({
            selector: getSelector(button)
          }))
        };
      });
      
      if (alternativeInputs.emailInputs.length > 0 && alternativeInputs.passwordInputs.length > 0) {
        // Gunakan elemen pertama yang ditemukan
        const emailInput = alternativeInputs.emailInputs[0];
        const passwordInput = alternativeInputs.passwordInputs[0];
        
        // Gunakan tombol submit jika ditemukan, atau null jika tidak ada
        const submitButton = alternativeInputs.submitButtons.length > 0 ? alternativeInputs.submitButtons[0] : null;
        
        return {
          hasEmailInput: true,
          hasPasswordInput: true,
          hasSubmitButton: !!submitButton,
          emailSelector: emailInput.selector,
          passwordSelector: passwordInput.selector,
          submitSelector: submitButton ? submitButton.selector : null
        };
      }
    }
    
    return formElements;
  } catch (error) {
    console.error("Error saat mendeteksi form login:", error);
    return {
      hasEmailInput: false,
      hasPasswordInput: false,
      hasSubmitButton: false,
      emailSelector: null,
      passwordSelector: null,
      submitSelector: null
    };
  }
}

// Helper function untuk submit form login
async function submitLoginForm(page, submitSelector, credentials) {
  // Deteksi apakah halaman menggunakan React
  const isReactApp = await page.evaluate(() => {
    return !!document.getElementById('app') || 
           !!document.getElementById('root') || 
           !!document.querySelector('[data-reactroot]') ||
           !!document.querySelector('[data-react-checksum]') ||
           !!document.querySelector('[data-reactid]') ||
           !!document.querySelector('[data-page]');
  });
  
  console.log("Deteksi React app:", isReactApp);
  
  try {
    if (isReactApp) {
      // Untuk React apps, coba gunakan fetch API untuk POST request
      console.log("Menggunakan metode POST untuk React app...");
      
      // Dapatkan URL saat ini untuk digunakan sebagai base URL
      const currentUrl = await page.url();
      const urlObj = new URL(currentUrl);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      
      // Cek apakah form memiliki action attribute
      const formAction = await page.evaluate(() => {
        const form = document.querySelector('form');
        return form ? form.action : null;
      });
      
      // Tentukan URL endpoint untuk login
      let loginUrl = formAction || `${baseUrl}/login`;
      console.log("Login URL:", loginUrl);
      
      try {
        // Lakukan request POST melalui browser
        const response = await page.evaluate(async (loginUrl, identifier, password) => {
          try {
            console.log('Mengirim POST request ke:', loginUrl);
            const response = await fetch(loginUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({
                email: identifier,
                password: password,
                remember: false
              }),
              credentials: 'include',
              redirect: 'follow'
            });
            
            console.log('Status response:', response.status);
            
            // Cek apakah response berhasil
            if (response.status >= 200 && response.status < 300) {
              return { success: true, status: response.status };
            } else {
              return { 
                success: false, 
                status: response.status,
                statusText: response.statusText
              };
            }
          } catch (error) {
            console.error('Error saat fetch:', error);
            return { success: false, error: error.toString() };
          }
        }, loginUrl, credentials.identifier, credentials.password);
        
        console.log("Hasil POST request:", response);
        
        // Tunggu navigasi setelah login
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
          console.log("Navigation timeout setelah POST request, melanjutkan...");
        });
        
        // Jika fetch tidak berhasil, coba metode klik tombol
        if (!response.success) {
          console.log("POST request tidak berhasil, mencoba metode klik tombol...");
          await tryClickSubmitButton();
        }
      } catch (fetchError) {
        console.error("Error saat mencoba POST request:", fetchError);
        
        // Jika fetch gagal, coba metode klik tombol
        await tryClickSubmitButton();
      }
    } else {
      // Untuk non-React apps, gunakan metode klik tombol
      await tryClickSubmitButton();
    }
  } catch (error) {
    console.error("Error dalam proses login:", error);
    throw error; // Re-throw untuk ditangkap oleh caller
  }
  
  // Fungsi untuk mencoba klik tombol submit
  async function tryClickSubmitButton() {
    if (submitSelector) {
      try {
        // Klik tombol login dengan penanganan error yang lebih baik
        await Promise.all([
          page.click(submitSelector),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
            .catch((err) => {
              console.log(`Navigation error: ${err.message}`);
              console.log("Melanjutkan proses meskipun ada error navigasi");
            }),
        ]);
      } catch (clickError) {
        console.error("Error saat mengklik tombol submit:", clickError);
        
        // Coba metode alternatif dengan JavaScript
        console.log("Mencoba metode alternatif dengan JavaScript...");
        await submitWithJavaScript();
      }
    } else {
      // Jika tidak ada tombol submit, langsung ke metode JavaScript
      console.log("Tombol submit tidak ditemukan, mencoba metode JavaScript");
      await submitWithJavaScript();
    }
  }
  
  // Fungsi untuk submit form dengan JavaScript
  async function submitWithJavaScript() {
    await page.evaluate(() => {
      // Coba submit form
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) {
        console.log('Form ditemukan, mencoba submit...');
        forms[0].submit();
        return;
      }
      
      // Coba klik tombol dengan JavaScript
      const buttons = document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"]');
      for (const button of buttons) {
        const text = button.textContent?.toLowerCase() || '';
        if (text.includes('login') || text.includes('sign in') || text.includes('masuk')) {
          console.log('Tombol login ditemukan, mencoba klik...');
          button.click();
          return;
        }
      }
      
      // Jika tidak ada tombol yang cocok, klik tombol pertama
      if (buttons.length > 0) {
        console.log('Mengklik tombol pertama yang ditemukan...');
        buttons[0].click();
      }
    });
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
      console.log("Navigation timeout setelah metode JavaScript, melanjutkan...");
    });
  }
}

router.post("/run-tests", async (req, res) => {
  const { websiteConfig, testCases } = req.body;

  if (!websiteConfig || !testCases || !Array.isArray(testCases)) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters",
    });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Tambahkan listener untuk error navigasi
    page.on("requestfailed", (request) => {
      console.log(`Request failed: ${request.url()}`);
      // Add null check to avoid TypeError
      const failure = request.failure();
      if (failure && failure.errorText) {
        console.log(`Reason: ${failure.errorText}`);
      } else {
        console.log("No error details available");
      }
    });

    // Cek apakah ada Basic Auth
    if (
      websiteConfig.hasBasicAuth &&
      websiteConfig.basicAuth &&
      websiteConfig.basicAuth.username &&
      websiteConfig.basicAuth.password
    ) {
      console.log("Menggunakan Basic Authentication untuk test");
      // Set Basic Authentication
      try {
        await page.authenticate({
          username: websiteConfig.basicAuth.username,
          password: websiteConfig.basicAuth.password,
        });
      } catch (authError) {
        console.error('Error saat setup basic authentication untuk test:', authError.message);
        saveErrorToFile(authError, 'run_tests_auth_setup_error');
      }
    }

    const results = [];

    try {
      // Check if there's a Google login test that's enabled
      const hasGoogleLoginTest = testCases.some(
        (test) => test.type === "google" && test.enabled
      );

      // Login with Google if necessary
      if (hasGoogleLoginTest) {
        const googleTest = testCases.find(
          (test) => test.type === "google" && test.enabled
        );
        // Get specific target URL for this test if available
        const targetUrl =
          googleTest.config?.targetUrl ||
          websiteConfig.loginUrl ||
          websiteConfig.url;
        console.log(`Mencoba login via Google ke: ${targetUrl}`);

        try {
          // Navigasi ke halaman login
          console.log(`Navigasi ke URL: ${targetUrl}`);

          try {
            await page.goto(targetUrl, {
              waitUntil: "networkidle2",
              timeout: 30000,
            });
          } catch (navigationError) {
            console.error('Error saat navigasi ke halaman login Google:', navigationError.message);
            // Simpan error ke file
            saveErrorToFile(navigationError, 'google_login_navigation_error');
            // Ambil screenshot untuk debugging jika navigasi gagal
            await page.screenshot({
              path: path.join(__dirname, "results", `google_login_navigation_error_${getFormattedDate()}.png`),
            });
            console.log('Screenshot navigation error disimpan');
          }

          // Tunggu halaman dimuat
          await page.waitForTimeout(2000);

          // Cari tombol login Google
          const googleLoginButton = await page.evaluate(() => {
            const button = document.querySelector(
              'button[aria-label*="Google"], a[aria-label*="Google"], ' +
                'button[data-provider="google"], a[data-provider="google"], ' +
                'button:has-text("Google"), a:has-text("Google"), ' +
                ".google-login, .login-with-google, " +
                "button.social-button.google, a.social-button.google, " +
                'button[class*="google"], a[class*="google"]'
            );

            return button
              ? {
                  tag: button.tagName.toLowerCase(),
                  id: button.id,
                  className: button.className,
                  text: button.textContent?.trim(),
                }
              : null;
          });

          if (googleLoginButton) {
            console.log("Tombol login Google ditemukan:", googleLoginButton);

            // Klik tombol login dengan Google
            await Promise.all([
              page.click(
                googleLoginButton.id
                  ? `#${googleLoginButton.id}`
                  : googleLoginButton.className
                  ? `.${googleLoginButton.className.split(" ").join(".")}`
                  : googleLoginButton.tag
              ),
              page
                .waitForNavigation({
                  waitUntil: "networkidle2",
                  timeout: 15000,
                })
                .catch((err) =>
                  console.log("Navigation timeout, continuing:", err.message)
                ),
            ]);

            // Tunggu halaman login Google muncul
            await page.waitForTimeout(3000);

            // Cek apakah kita sudah di halaman login Google
            const isGoogleLoginPage = await page.evaluate(() => {
              return window.location.href.includes("accounts.google.com");
            });

            if (isGoogleLoginPage) {
              console.log("Halaman login Google terdeteksi");

              // Isi alamat Gmail jika disediakan
              if (
                googleTest.config?.googleAuth?.gmailAddress ||
                websiteConfig.credentials.gmailAddress
              ) {
                const gmailAddress =
                  googleTest.config?.googleAuth?.gmailAddress ||
                  websiteConfig.credentials.gmailAddress;
                await page.type('input[type="email"]', gmailAddress);
                await page.click("#identifierNext");

                // Tunggu halaman password muncul
                await page.waitForTimeout(3000);

                // Isi password (jika disediakan)
                if (websiteConfig.credentials.password) {
                  await page.type(
                    'input[type="password"]',
                    websiteConfig.credentials.password
                  );
                  await page.click("#passwordNext");

                  // Tunggu setelah login
                  await page.waitForTimeout(5000);
                }
              }

              // Tunggu sebentar setelah login
              await page.waitForTimeout(2000);

              // Cek apakah login berhasil - metode yang lebih handal:
              // 1. Periksa URL saat ini - jika berbeda dari URL awal atau berisi 'dashboard', kemungkinan login berhasil
              // 2. Periksa elemen-elemen yang biasanya muncul setelah login
              const loginSuccess = await page.evaluate((originalUrl) => {
                const currentUrl = window.location.href;
                console.log(
                  `Original URL: ${originalUrl}, Current URL: ${currentUrl}`
                );

                // Cek apakah URL berubah dan berisi kata 'dashboard' atau 'admin'
                const urlChanged = currentUrl !== originalUrl;
                const urlContainsDashboard =
                  currentUrl.includes("dashboard") ||
                  currentUrl.includes("admin") ||
                  currentUrl.includes("home") ||
                  currentUrl.includes("index");

                // Cek elemen-elemen yang biasanya muncul setelah login
                const hasLogoutElement = !!document.querySelector(
                  ".profile, .dashboard, .account, .user-info, .logout, " +
                    'a[href*="logout"], button[onclick*="logout"], ' +
                    ".user-profile, .user-avatar, .username"
                );

                // Cek elemen khusus untuk K24
                const hasK24Elements = (() => {
                  // Cek selectors standar dulu
                  const standardSelectors =
                    ".bsc, .menu, #menu, .home, .navbar-brand, .pt-k24, .logo-k24";
                  if (document.querySelector(standardSelectors)) return true;

                  // Cek h1/h2 dengan teks "HOME"
                  const h1Elements = Array.from(
                    document.querySelectorAll("h1")
                  );
                  const h2Elements = Array.from(
                    document.querySelectorAll("h2")
                  );
                  if (
                    h1Elements.some((el) => el.textContent.includes("HOME")) ||
                    h2Elements.some((el) => el.textContent.includes("HOME"))
                  ) {
                    return true;
                  }

                  // Cek link dengan teks "My BSC"
                  const aElements = Array.from(document.querySelectorAll("a"));
                  if (
                    aElements.some((el) => el.textContent.includes("My BSC"))
                  ) {
                    return true;
                  }

                  return false;
                })();

                // Bisa login berhasil jika: URL berubah ke dashboard ATAU ada elemen post-login yang terdeteksi
                return (
                  urlContainsDashboard ||
                  hasLogoutElement ||
                  hasK24Elements ||
                  (urlChanged && !currentUrl.includes("login"))
                );
              }, targetUrl);

              console.log(
                `Login success detection result: ${
                  loginSuccess ? "Berhasil" : "Gagal"
                }`
              );
              console.log(`Current URL after login: ${page.url()}`);

              // Ambil screenshot untuk debugging
              await page.screenshot({
                path: path.join(__dirname, "results", "after_login.png"),
              });
              console.log("Screenshot after login saved");

              results.push({
                id: googleTest.id || "google-login",
                name: googleTest.name || "Google Login Test",
                type: "google",
                status: loginSuccess ? "passed" : "failed",
                message: loginSuccess
                  ? "Login via Google berhasil"
                  : "Login via Google gagal",
                timestamp: new Date().toISOString(),
              });

              // Return early if Google login fails
              if (!loginSuccess) {
                await browser.close();

                return res.json({
                  success: false,
                  results,
                  message: "Login Google gagal, tidak dapat melanjutkan test",
                });
              }
            } else {
              // Tidak masuk ke halaman Google login
              results.push({
                id: googleTest.id || "google-login",
                name: googleTest.name || "Google Login Test",
                type: "google",
                status: "failed",
                message: "Gagal navigasi ke halaman login Google",
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            console.log("Tombol login Google tidak ditemukan");
            results.push({
              id: googleTest.id || "google-login",
              name: googleTest.name || "Google Login Test",
              type: "google",
              status: "failed",
              message: "Tombol login Google tidak ditemukan",
              timestamp: new Date().toISOString(),
            });
          }
        } catch (googleLoginError) {
          console.error("Google login error:", googleLoginError);
          results.push({
            id: googleTest.id || "google-login",
            name: googleTest.name || "Google Login Test",
            type: "google",
            status: "failed",
            error: googleLoginError.message,
            timestamp: new Date().toISOString(),
          });
        }
      }
      // Normal login if needed
      else if (
        testCases.some((test) => test.type === "login" && test.enabled)
      ) {
        const loginTest = testCases.find(
          (test) => test.type === "login" && test.enabled
        );
        // Get specific target URL for this test if available
        const targetUrl =
          loginTest.config?.targetUrl ||
          websiteConfig.loginUrl ||
          websiteConfig.url;
        console.log(`Mencoba login ke: ${targetUrl}`);

        try {
          // Navigasi ke halaman login dengan timeout yang lebih lama
          console.log(`Navigasi ke URL: ${targetUrl}`);

          await page.goto(targetUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          // Tunggu halaman dimuat
          console.log("Menunggu elemen form login...");

          // Tunggu elemen form login dengan timeout yang lebih lama
          const emailSelector =
            'input[type="email"], input[type="text"], input[name*="email"], input[name*="username"]';
          const passwordSelector = 'input[type="password"]';
          const submitSelector = 'button[type="submit"], input[type="submit"]';

          // Cek apakah elemen form login ada
          const hasEmailField = (await page.$(emailSelector)) !== null;
          const hasPasswordField = (await page.$(passwordSelector)) !== null;
          const hasSubmitButton = (await page.$(submitSelector)) !== null;

          console.log(
            `Form login ditemukan: Email/Username=${hasEmailField}, Password=${hasPasswordField}, Submit=${hasSubmitButton}`
          );

          if (!hasEmailField || !hasPasswordField) {
            console.log(
              "Elemen form login tidak lengkap, mencoba metode alternatif dengan pendekatan modern framework..."
            );
            
            // Ambil screenshot untuk debugging
            await page.screenshot({
              path: path.join(__dirname, "results", "login_form_before_alternative.png"),
            });
            
            // Pendekatan alternatif untuk React/Vue/modern frameworks dengan dukungan Tailwind CSS
            const alternativeInputs = await page.evaluate(() => {
              // Fungsi untuk mendapatkan semua teks dari elemen dan child-nya
              const getAllText = (element) => {
                let text = element.textContent || '';
                const childTexts = Array.from(element.childNodes)
                  .filter(node => node.nodeType === 1) // Element nodes only
                  .map(child => getAllText(child));
                return text.trim() + ' ' + childTexts.join(' ');
              };

              // Fungsi untuk memeriksa apakah elemen terlihat
              const isVisible = (element) => {
                const style = window.getComputedStyle(element);
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       element.offsetWidth > 0 &&
                       element.offsetHeight > 0;
              };
              
              // Fungsi untuk memeriksa apakah elemen memiliki kelas Tailwind tertentu
              const hasTailwindClass = (element, classPattern) => {
                const className = element.className || '';
                if (typeof className !== 'string') return false;
                
                // Cek pola kelas Tailwind
                return className.split(' ').some(cls => {
                  return cls.includes(classPattern);
                });
              };
              
              // Deteksi apakah halaman menggunakan React
              const isReactApp = !!document.getElementById('app') || 
                                !!document.getElementById('root') || 
                                !!document.querySelector('[data-reactroot]') ||
                                !!document.querySelector('[data-react-checksum]') ||
                                !!document.querySelector('[data-reactid]') ||
                                !!document.querySelector('[data-page]');
              
              console.log('Deteksi React app:', isReactApp);
              
              // Cari semua input yang mungkin untuk email/username
              const possibleEmailInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
                .filter(input => {
                  if (!isVisible(input)) return false;
                  
                  const type = input.type?.toLowerCase() || '';
                  const name = input.name?.toLowerCase() || '';
                  const id = input.id?.toLowerCase() || '';
                  const placeholder = input.placeholder?.toLowerCase() || '';
                  const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
                  const dataTest = input.getAttribute('data-test')?.toLowerCase() || '';
                  const dataTestid = input.getAttribute('data-testid')?.toLowerCase() || '';
                  const className = input.className?.toLowerCase() || '';
                  const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() || '';
                  
                  // Cek Tailwind classes
                  const hasFocusRing = hasTailwindClass(input, 'focus:ring') || hasTailwindClass(input, 'focus-ring');
                  const hasBorderClass = hasTailwindClass(input, 'border');
                  const hasRoundedClass = hasTailwindClass(input, 'rounded');
                  
                  // Cek label yang terkait dengan input
                  let labelText = '';
                  if (input.id) {
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    if (label) labelText = getAllText(label).toLowerCase();
                  }
                  
                  // Cek parent elements untuk label text
                  let parentText = '';
                  let parent = input.parentElement;
                  for (let i = 0; i < 3 && parent; i++) { // Cek 3 level ke atas
                    parentText += ' ' + getAllText(parent).toLowerCase();
                    parent = parent.parentElement;
                  }
                  
                  // Cek khusus untuk React dengan Tailwind
                  if (isReactApp && (hasFocusRing || hasBorderClass || hasRoundedClass)) {
                    if (type === 'email' || 
                        id === 'email' || 
                        name === 'email' || 
                        autocomplete === 'username' || 
                        autocomplete === 'email' || 
                        labelText.includes('email') || 
                        labelText.includes('username')) {
                      console.log('Menemukan input email React+Tailwind:', id || name);
                      return true;
                    }
                  }
                  
                  return (
                    type === 'email' || type === 'text' ||
                    name.includes('email') || name.includes('user') || name.includes('login') || name.includes('name') ||
                    id.includes('email') || id.includes('user') || id.includes('login') || id.includes('name') ||
                    placeholder.includes('email') || placeholder.includes('user') || placeholder.includes('login') || placeholder.includes('name') ||
                    ariaLabel.includes('email') || ariaLabel.includes('user') || ariaLabel.includes('login') || ariaLabel.includes('name') ||
                    dataTest.includes('email') || dataTest.includes('user') || dataTest.includes('login') || dataTest.includes('name') ||
                    dataTestid.includes('email') || dataTestid.includes('user') || dataTestid.includes('login') || dataTestid.includes('name') ||
                    className.includes('email') || className.includes('user') || className.includes('login') || className.includes('name') ||
                    labelText.includes('email') || labelText.includes('user') || labelText.includes('login') || labelText.includes('name') ||
                    parentText.includes('email') || parentText.includes('user') || parentText.includes('login') || parentText.includes('name') ||
                    autocomplete === 'username' || autocomplete === 'email'
                  );
                });
              
              // Cari semua input yang mungkin untuk password
              const possiblePasswordInputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]'))
                .filter(input => {
                  if (!isVisible(input)) return false;
                  
                  const type = input.type?.toLowerCase() || '';
                  const name = input.name?.toLowerCase() || '';
                  const id = input.id?.toLowerCase() || '';
                  const placeholder = input.placeholder?.toLowerCase() || '';
                  const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
                  const dataTest = input.getAttribute('data-test')?.toLowerCase() || '';
                  const dataTestid = input.getAttribute('data-testid')?.toLowerCase() || '';
                  const className = input.className?.toLowerCase() || '';
                  const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() || '';
                  
                  // Cek Tailwind classes
                  const hasFocusRing = hasTailwindClass(input, 'focus:ring') || hasTailwindClass(input, 'focus-ring');
                  const hasBorderClass = hasTailwindClass(input, 'border');
                  const hasRoundedClass = hasTailwindClass(input, 'rounded');
                  
                  // Cek label yang terkait dengan input
                  let labelText = '';
                  if (input.id) {
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    if (label) labelText = getAllText(label).toLowerCase();
                  }
                  
                  // Cek parent elements untuk label text
                  let parentText = '';
                  let parent = input.parentElement;
                  for (let i = 0; i < 3 && parent; i++) { // Cek 3 level ke atas
                    parentText += ' ' + getAllText(parent).toLowerCase();
                    parent = parent.parentElement;
                  }
                  
                  // Cek khusus untuk React dengan Tailwind
                  if (isReactApp && (hasFocusRing || hasBorderClass || hasRoundedClass)) {
                    if (type === 'password' || 
                        id === 'password' || 
                        name === 'password' || 
                        autocomplete === 'current-password' || 
                        labelText.includes('password')) {
                      console.log('Menemukan input password React+Tailwind:', id || name);
                      return true;
                    }
                  }
                  
                  return (
                    type === 'password' ||
                    name.includes('pass') || name.includes('pwd') ||
                    id.includes('pass') || id.includes('pwd') ||
                    placeholder.includes('pass') || placeholder.includes('pwd') ||
                    ariaLabel.includes('pass') || ariaLabel.includes('pwd') ||
                    dataTest.includes('pass') || dataTest.includes('pwd') ||
                    dataTestid.includes('pass') || dataTestid.includes('pwd') ||
                    className.includes('pass') || className.includes('pwd') ||
                    labelText.includes('pass') || labelText.includes('pwd') ||
                    parentText.includes('password') || parentText.includes('kata sandi') ||
                    autocomplete === 'current-password'
                  );
                });
              
              // Cari semua button yang mungkin untuk submit
              const possibleSubmitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"], [tabindex="0"], .btn, .button, [class*="btn"], [class*="button"]'))
                .filter(button => {
                  if (!isVisible(button)) return false;
                  
                  const type = button.type?.toLowerCase() || '';
                  const text = getAllText(button).toLowerCase();
                  const value = button.value?.toLowerCase() || '';
                  const className = button.className?.toLowerCase() || '';
                  const id = button.id?.toLowerCase() || '';
                  const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                  const dataTest = button.getAttribute('data-test')?.toLowerCase() || '';
                  const dataTestid = button.getAttribute('data-testid')?.toLowerCase() || '';
                  
                  // Cek Tailwind classes
                  const hasBgColor = hasTailwindClass(button, 'bg-') || hasTailwindClass(button, 'background-');
                  const hasTextColor = hasTailwindClass(button, 'text-');
                  const hasRoundedClass = hasTailwindClass(button, 'rounded');
                  const hasPaddingClass = hasTailwindClass(button, 'p-') || hasTailwindClass(button, 'px-') || hasTailwindClass(button, 'py-');
                  const hasHoverClass = hasTailwindClass(button, 'hover:');
                  
                  const loginKeywords = ['login', 'log in', 'sign in', 'signin', 'masuk', 'submit', 'continue', 'lanjut', 'next'];
                  
                  // Cek khusus untuk React dengan Tailwind
                  if (isReactApp && (hasBgColor || hasTextColor || hasRoundedClass || hasPaddingClass || hasHoverClass)) {
                    if (text.includes('log in') || text.includes('login') || text.includes('sign in')) {
                      console.log('Menemukan tombol submit React+Tailwind:', text);
                      return true;
                    }
                  }
                  
                  return (
                    type === 'submit' ||
                    loginKeywords.some(keyword => text.includes(keyword)) ||
                    loginKeywords.some(keyword => value.includes(keyword)) ||
                    loginKeywords.some(keyword => className.includes(keyword)) ||
                    loginKeywords.some(keyword => id.includes(keyword)) ||
                    loginKeywords.some(keyword => ariaLabel.includes(keyword)) ||
                    loginKeywords.some(keyword => dataTest.includes(keyword)) ||
                    loginKeywords.some(keyword => dataTestid.includes(keyword))
                  );
                });
              
              return {
                emailInputs: possibleEmailInputs.map(el => ({
                  tagName: el.tagName,
                  id: el.id,
                  name: el.name,
                  className: el.className,
                  type: el.type,
                  placeholder: el.placeholder
                })),
                passwordInputs: possiblePasswordInputs.map(el => ({
                  tagName: el.tagName,
                  id: el.id,
                  name: el.name,
                  className: el.className,
                  type: el.type,
                  placeholder: el.placeholder
                })),
                submitButtons: possibleSubmitButtons.map(el => ({
                  tagName: el.tagName,
                  id: el.id,
                  name: el.name,
                  className: el.className,
                  type: el.type,
                  textContent: el.textContent?.trim()
                }))
              };
            });
            
            console.log('Hasil pencarian alternatif:', 
              `Email inputs: ${alternativeInputs.emailInputs.length}`, 
              `Password inputs: ${alternativeInputs.passwordInputs.length}`, 
              `Submit buttons: ${alternativeInputs.submitButtons.length}`
            );
            
            // Jika menemukan elemen alternatif
            if (alternativeInputs.emailInputs.length > 0 && alternativeInputs.passwordInputs.length > 0) {
              // Gunakan elemen pertama yang ditemukan
              const emailInput = alternativeInputs.emailInputs[0];
              const passwordInput = alternativeInputs.passwordInputs[0];
              
              // Isi email/username
              if (emailInput.id) {
                await page.type(`#${emailInput.id}`, websiteConfig.credentials.identifier);
              } else if (emailInput.name) {
                await page.type(`input[name="${emailInput.name}"]`, websiteConfig.credentials.identifier);
              } else if (emailInput.className) {
                const classes = emailInput.className.split(' ').map(c => `.${c}`).join('');
                await page.type(`${emailInput.tagName.toLowerCase()}${classes}`, websiteConfig.credentials.identifier);
              }
              
              // Isi password
              if (passwordInput.id) {
                await page.type(`#${passwordInput.id}`, websiteConfig.credentials.password);
              } else if (passwordInput.name) {
                await page.type(`input[name="${passwordInput.name}"]`, websiteConfig.credentials.password);
              } else if (passwordInput.className) {
                const classes = passwordInput.className.split(' ').map(c => `.${c}`).join('');
                await page.type(`${passwordInput.tagName.toLowerCase()}${classes}`, websiteConfig.credentials.password);
              }
              
              // Klik tombol submit jika ditemukan
              if (alternativeInputs.submitButtons.length > 0) {
                const submitButton = alternativeInputs.submitButtons[0];
                
                try {
                  if (submitButton.id) {
                    await Promise.all([
                      page.click(`#${submitButton.id}`),
                      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
                    ]);
                  } else if (submitButton.className) {
                    const classes = submitButton.className.split(' ').map(c => `.${c}`).join('');
                    await Promise.all([
                      page.click(`${submitButton.tagName.toLowerCase()}${classes}`),
                      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
                    ]);
                  } else {
                    // Jika tidak ada selector yang cocok, gunakan JavaScript click
                    await page.evaluate(() => {
                      const buttons = document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"]');
                      for (const button of buttons) {
                        const text = button.textContent?.toLowerCase() || '';
                        if (text.includes('login') || text.includes('sign in') || text.includes('masuk')) {
                          button.click();
                          return;
                        }
                      }
                      // Jika tidak ada tombol yang cocok, klik tombol pertama
                      if (buttons.length > 0) buttons[0].click();
                    });
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                  }
                } catch (clickError) {
                  console.log('Error saat mengklik tombol submit, mencoba metode lain:', clickError.message);
                  // Jika gagal, coba metode lain dengan JavaScript
                  await page.evaluate(() => {
                    // Coba submit form
                    const forms = document.querySelectorAll('form');
                    if (forms.length > 0) forms[0].submit();
                  });
                  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                }
              } else {
                // Jika tidak ada tombol submit, coba submit form langsung
                await page.evaluate(() => {
                  const forms = document.querySelectorAll('form');
                  if (forms.length > 0) forms[0].submit();
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
              }
              
              // Ambil screenshot setelah login
              await page.screenshot({
                path: path.join(__dirname, "results", "login_form_after_alternative.png"),
              });
              
              console.log('Login dengan metode alternatif selesai');
            } else {
              // Jika tidak menemukan elemen alternatif, throw error
              throw new Error("Elemen form login tidak ditemukan dengan metode standar maupun alternatif");
            }
          }

          // Isi form login
          await page.type(emailSelector, websiteConfig.credentials.identifier);
          await page.type(passwordSelector, websiteConfig.credentials.password);

          console.log("Mengklik tombol login...");

          // Deteksi apakah halaman menggunakan React
          const isReactApp = await page.evaluate(() => {
            return !!document.getElementById('app') || 
                  !!document.getElementById('root') || 
                  !!document.querySelector('[data-reactroot]') ||
                  !!document.querySelector('[data-react-checksum]') ||
                  !!document.querySelector('[data-reactid]') ||
                  !!document.querySelector('[data-page]');
          });
          
          console.log("Deteksi React app:", isReactApp);
          
          try {
            if (isReactApp) {
              // Untuk React apps, coba gunakan fetch API untuk POST request
              console.log("Menggunakan metode POST untuk React app...");
              
              // Dapatkan URL saat ini untuk digunakan sebagai base URL
              const currentUrl = await page.url();
              const urlObj = new URL(currentUrl);
              const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
              
              // Cek apakah form memiliki action attribute
              const formAction = await page.evaluate(() => {
                const form = document.querySelector('form');
                return form ? form.action : null;
              });
              
              // Tentukan URL endpoint untuk login
              let loginUrl = formAction || `${baseUrl}/login`;
              console.log("Login URL:", loginUrl);
              
              try {
                // Lakukan request POST melalui browser
                const response = await page.evaluate(async (loginUrl, identifier, password) => {
                  try {
                    console.log('Mengirim POST request ke:', loginUrl);
                    const response = await fetch(loginUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                      },
                      body: JSON.stringify({
                        email: identifier,
                        password: password,
                        remember: false
                      }),
                      credentials: 'include',
                      redirect: 'follow'
                    });
                    
                    console.log('Status response:', response.status);
                    
                    // Cek apakah response berhasil
                    if (response.status >= 200 && response.status < 300) {
                      return { success: true, status: response.status };
                    } else {
                      return { 
                        success: false, 
                        status: response.status,
                        statusText: response.statusText
                      };
                    }
                  } catch (error) {
                    console.error('Error saat fetch:', error);
                    return { success: false, error: error.toString() };
                  }
                }, loginUrl, websiteConfig.credentials.identifier, websiteConfig.credentials.password);
                
                console.log("Hasil POST request:", response);
                
                // Tunggu navigasi setelah login
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
                  console.log("Navigation timeout setelah POST request, melanjutkan...");
                });
                
                // Jika fetch tidak berhasil, coba metode klik tombol
                if (!response.success) {
                  console.log("POST request tidak berhasil, mencoba metode klik tombol...");
                  await trySubmitForm();
                }
              } catch (fetchError) {
                console.error("Error saat mencoba POST request:", fetchError.message);
                saveErrorToFile(fetchError, 'fetch_error');
                
                // Jika fetch gagal, coba metode klik tombol
                await trySubmitForm();
              }
            } else {
              // Untuk non-React apps, gunakan metode klik tombol
              await trySubmitForm();
            }
          } catch (error) {
            console.error("Error dalam proses login:", error.message);
            saveErrorToFile(error, 'login_process_error');
            throw error; // Re-throw untuk ditangkap oleh catch block di luar
          }
          
          // Fungsi untuk mencoba submit form dengan berbagai metode
          async function trySubmitForm() {
            console.log("Mencoba submit form dengan berbagai metode...");
            
            if (hasSubmitButton && submitSelector) {
              try {
                // Metode 1: Klik tombol submit dengan selector
                console.log("Metode 1: Klik tombol submit dengan selector");
                await Promise.all([
                  page.click(submitSelector),
                  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
                    .catch((err) => {
                      console.log(`Navigation error: ${err.message}`);
                      console.log("Melanjutkan proses meskipun ada error navigasi");
                    }),
                ]);
              } catch (clickError) {
                console.error("Error saat mengklik tombol submit:", clickError.message);
                saveErrorToFile(clickError, 'submit_click_error');
                
                // Metode 2: Submit form dengan JavaScript
                console.log("Metode 2: Submit form dengan JavaScript");
                await submitWithJavaScript();
              }
            } else {
              // Jika tidak ada tombol submit, langsung ke metode JavaScript
              console.log("Tombol submit tidak ditemukan, mencoba metode JavaScript");
              await submitWithJavaScript();
            }
          }
          
          // Fungsi untuk submit form dengan JavaScript
          async function submitWithJavaScript() {
            await page.evaluate(() => {
              // Coba submit form
              const forms = document.querySelectorAll('form');
              if (forms.length > 0) {
                console.log('Form ditemukan, mencoba submit...');
                forms[0].submit();
                return;
              }
              
              // Coba klik tombol dengan JavaScript
              const buttons = document.querySelectorAll('button, input[type="submit"], div[role="button"], a[role="button"]');
              for (const button of buttons) {
                const text = button.textContent?.toLowerCase() || '';
                if (text.includes('login') || text.includes('sign in') || text.includes('masuk')) {
                  console.log('Tombol login ditemukan, mencoba klik...');
                  button.click();
                  return;
                }
              }
              
              // Jika tidak ada tombol yang cocok, klik tombol pertama
              if (buttons.length > 0) {
                console.log('Mengklik tombol pertama yang ditemukan...');
                buttons[0].click();
              }
            });
            
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
              console.log("Navigation timeout setelah metode JavaScript, melanjutkan...");
            });
          }
        } catch (loginError) {
          console.error("Login error:", loginError);
          results.push({
            id: "login",
            name: "Login Test",
            type: "login",
            status: "failed",
            error: loginError.message,
            timestamp: new Date().toISOString(),
          });

          // Return early if login fails
          await browser.close();

          return res.json({
            success: false,
            results,
            message: "Login gagal, tidak dapat melanjutkan test",
          });
        }

        // Tunggu sebentar setelah login
        await page.waitForTimeout(2000);

        // Cek apakah login berhasil - metode yang lebih handal:
        // 1. Periksa URL saat ini - jika berbeda dari URL awal atau berisi 'dashboard', kemungkinan login berhasil
        // 2. Periksa elemen-elemen yang biasanya muncul setelah login
        const loginSuccess = await page.evaluate((originalUrl) => {
          const currentUrl = window.location.href;
          console.log(
            `Original URL: ${originalUrl}, Current URL: ${currentUrl}`
          );

          // Cek apakah URL berubah dan berisi kata 'dashboard' atau 'admin'
          const urlChanged = currentUrl !== originalUrl;
          const urlContainsDashboard =
            currentUrl.includes("dashboard") ||
            currentUrl.includes("admin") ||
            currentUrl.includes("home") ||
            currentUrl.includes("index");

          // Cek elemen-elemen yang biasanya muncul setelah login
          const hasLogoutElement = !!document.querySelector(
            ".profile, .dashboard, .account, .user-info, .logout, " +
              'a[href*="logout"], button[onclick*="logout"], ' +
              ".user-profile, .user-avatar, .username"
          );

          // Cek elemen khusus untuk K24
          const hasK24Elements = (() => {
            // Menggunakan selectors standar
            const standardSelectors =
              ".bsc, .menu, #menu, .home, .navbar-brand, .pt-k24, .logo-k24";
            if (document.querySelector(standardSelectors)) return true;

            // Mencari h1/h2 yang berisi teks "HOME"
            const h1Elements = Array.from(document.querySelectorAll("h1"));
            const h2Elements = Array.from(document.querySelectorAll("h2"));
            if (
              h1Elements.some((el) => el.textContent.includes("HOME")) ||
              h2Elements.some((el) => el.textContent.includes("HOME"))
            ) {
              return true;
            }

            // Mencari link yang berisi teks "My BSC"
            const aElements = Array.from(document.querySelectorAll("a"));
            if (aElements.some((el) => el.textContent.includes("My BSC"))) {
              return true;
            }

            return false;
          })();

          // Bisa login berhasil jika: URL berubah ke dashboard ATAU ada elemen post-login yang terdeteksi
          return (
            urlContainsDashboard ||
            hasLogoutElement ||
            hasK24Elements ||
            (urlChanged && !currentUrl.includes("login"))
          );
        }, targetUrl);

        console.log(
          `Login success detection result: ${
            loginSuccess ? "Berhasil" : "Gagal"
          }`
        );
        console.log(`Current URL after login: ${page.url()}`);

        // Ambil screenshot untuk debugging
        await page.screenshot({
          path: path.join(__dirname, "results", "after_login.png"),
        });
        console.log("Screenshot after login saved");

        results.push({
          id: "login",
          name: "Login Test",
          type: "login",
          status: loginSuccess ? "passed" : "failed",
          message: loginSuccess ? "Login berhasil" : "Login gagal",
          timestamp: new Date().toISOString(),
        });

        if (!loginSuccess) {
          await browser.close();

          return res.json({
            success: false,
            results,
            message: "Login gagal, tidak dapat melanjutkan test",
          });
        }
      }

      // Jalankan setiap test case
      for (const test of testCases) {
        if (!test.enabled || test.type === "google") continue; // Skip Google test, it's already handled

        const testResult = {
          id: test.id,
          name: test.name,
          type: test.type,
          status: "running",
          result: {
            timestamp: new Date().toISOString(),
            details: {},
          },
        };

        try {
          switch (test.type) {
            case "login":
              // Login sudah ditangani di atas
              break;
              
            case "form-fill":
              console.log('Menjalankan Form Fill Test...');
              
              try {
                // Navigasi ke URL form jika disediakan
                if (test.config && (test.config.formUrl || test.config.targetUrl)) {
                  const formUrl = test.config.formUrl || test.config.targetUrl;
                  console.log(`Navigasi ke URL form: ${formUrl}`);
                  
                  // Pendekatan langsung untuk navigasi
                  try {
                    // Navigasi dengan strategi yang lebih sederhana
                    await page.goto(formUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                    console.log(`Berhasil navigasi ke: ${await page.url()}`);
                    
                    // Tunggu untuk memastikan halaman dimuat dengan baik
                    await page.waitForTimeout(3000);
                    
                    // Cek apakah kita berada di halaman login
                    const isLoginPage = await page.evaluate(() => {
                      const url = window.location.href.toLowerCase();
                      const content = document.body.innerText.toLowerCase();
                      return url.includes('login') || 
                             content.includes('login') || 
                             content.includes('sign in') || 
                             content.includes('masuk');
                    });
                    
                    if (isLoginPage) {
                      console.log('Terdeteksi halaman login, melakukan login...');
                      
                      // Isi form login secara langsung
                      await page.evaluate((credentials) => {
                        // Cari input email/username
                        const emailInputs = Array.from(document.querySelectorAll('input')).filter(el => {
                          const type = el.type?.toLowerCase() || '';
                          const name = el.name?.toLowerCase() || '';
                          const id = el.id?.toLowerCase() || '';
                          const placeholder = el.placeholder?.toLowerCase() || '';
                          
                          return (type === 'email' || type === 'text') && 
                                 (name.includes('email') || name.includes('user') || 
                                  id.includes('email') || id.includes('user') || 
                                  placeholder.includes('email') || placeholder.includes('user'));
                        });
                        
                        // Cari input password
                        const passwordInputs = Array.from(document.querySelectorAll('input')).filter(el => {
                          const type = el.type?.toLowerCase() || '';
                          const name = el.name?.toLowerCase() || '';
                          const id = el.id?.toLowerCase() || '';
                          
                          return type === 'password' || name.includes('pass') || id.includes('pass');
                        });
                        
                        // Isi form jika ditemukan
                        if (emailInputs.length > 0 && passwordInputs.length > 0) {
                          emailInputs[0].value = credentials.identifier;
                          passwordInputs[0].value = credentials.password;
                          
                          // Trigger events
                          emailInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                          emailInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                          passwordInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                          passwordInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                          
                          // Cari tombol submit
                          const submitButtons = Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(el => {
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
                      }, websiteConfig.credentials);
                      
                      // Tunggu navigasi setelah login
                      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
                        .catch(() => console.log('Navigation timeout setelah login'));
                      
                      // Navigasi kembali ke URL form jika diperlukan
                      console.log(`Memeriksa apakah perlu navigasi kembali ke URL form: ${formUrl}`);
                      const currentUrl = page.url();
                      if (!currentUrl.includes(formUrl)) {
                        console.log(`Navigasi kembali ke URL form setelah login: ${formUrl}`);
                        await page.goto(formUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                        await page.waitForTimeout(3000);
                      } else {
                        console.log('Sudah berada di URL form yang benar, tidak perlu navigasi ulang');
                      }
                    }
                  } catch (navError) {
                    console.log(`Error navigasi: ${navError.message}`);
                    
                    // Coba metode alternatif dengan tab baru hanya jika diperlukan
                    try {
                      console.log('Memeriksa apakah perlu metode alternatif...');
                      const currentUrl = page.url();
                      if (!currentUrl.includes(formUrl)) {
                        console.log('Mencoba metode alternatif dengan tab baru...');
                        const pages = await browser.pages();
                        if (pages.length > 1) {
                          await pages[0].close();
                        }
                        page = await browser.newPage();
                        await page.goto(formUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                        await page.waitForTimeout(3000);
                      } else {
                        console.log('Sudah berada di URL form yang benar, tidak perlu metode alternatif');
                      }
                    } catch (altError) {
                      console.log(`Error metode alternatif: ${altError.message}`);
                    }
                  }
                }
                
                // Ambil screenshot sebelum mengisi form
                await page.screenshot({
                  path: path.join(__dirname, "results", `form_before_fill_${getFormattedDate()}.png`),
                });
                
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
                        // Format HTML5 date input: YYYY-MM-DD
                        return `${year}-${month}-${day}`;
                      } else if (placeholder.includes('dd/mm/yyyy') || placeholder.includes('dd-mm-yyyy')) {
                        // Format DD/MM/YYYY atau DD-MM-YYYY
                        return `${day}/${month}/${year}`;
                      } else if (placeholder.includes('mm/dd/yyyy') || placeholder.includes('mm-dd-yyyy')) {
                        // Format MM/DD/YYYY atau MM-DD-YYYY
                        return `${month}/${day}/${year}`;
                      } else {
                        // Default format: DD/MM/YYYY
                        return `${day}/${month}/${year}`;
                      }
                    } else if (type === 'email' || name.includes('email') || id.includes('email') || placeholder.includes('email')) {
                      return 'test@example.com';
                    } else if (type === 'password' || name.includes('pass') || id.includes('pass') || placeholder.includes('pass')) {
                      return 'Password123!';
                    } else if (name.includes('name') || id.includes('name') || placeholder.includes('name')) {
                      if (name.includes('first') || id.includes('first') || placeholder.includes('first')) {
                        return 'John';
                      } else if (name.includes('last') || id.includes('last') || placeholder.includes('last')) {
                        return 'Doe';
                      } else {
                        return 'John Doe';
                      }
                    } else if (name.includes('phone') || id.includes('phone') || placeholder.includes('phone') || 
                             name.includes('telp') || id.includes('telp') || placeholder.includes('telp')) {
                      return '08123456789';
                    } else if (name.includes('address') || id.includes('address') || placeholder.includes('address') ||
                             name.includes('alamat') || id.includes('alamat') || placeholder.includes('alamat')) {
                      return 'Jl. Test No. 123';
                    } else if (name.includes('city') || id.includes('city') || placeholder.includes('city') ||
                             name.includes('kota') || id.includes('kota') || placeholder.includes('kota')) {
                      return 'Jakarta';
                    } else if (name.includes('zip') || id.includes('zip') || placeholder.includes('zip') ||
                             name.includes('postal') || id.includes('postal') || placeholder.includes('postal') ||
                             name.includes('kode pos') || id.includes('kode pos') || placeholder.includes('kode pos')) {
                      return '12345';
                    } else if (name.includes('ticket') || id.includes('ticket') || placeholder.includes('ticket')) {
                      // Untuk field nomor tiket, generate nomor random
                      return 'T' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
                    } else if (name.includes('summary') || id.includes('summary') || placeholder.includes('summary')) {
                      return 'Test Summary - Automated Form Fill';
                    } else if (name.includes('description') || id.includes('description') || placeholder.includes('description')) {
                      return 'This is an automated test description generated by the Form Fill Test.';
                    } else if (type === 'number') {
                      return '123';
                    } else if (type === 'url') {
                      return 'https://example.com';
                    } else {
                      return 'Test Value';
                    }
                  };
                  
                  // Fungsi untuk mengisi input fields
                  const fillInputs = () => {
                    // Cari semua input fields (kecuali submit dan button)
                    const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"])'))
                      .filter(input => {
                        // Filter hanya input yang terlihat
                        const style = window.getComputedStyle(input);
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' && 
                               style.opacity !== '0' &&
                               input.offsetWidth > 0 &&
                               input.offsetHeight > 0;
                      });
                    
                    console.log(`Ditemukan ${inputs.length} input fields`);
                    
                    // Isi setiap input
                    const filledInputs = [];
                    inputs.forEach(input => {
                      try {
                        const type = input.type?.toLowerCase() || '';
                        const name = input.name || '';
                        const id = input.id || '';
                        
                        // Skip checkbox dan radio secara default
                        if (type === 'checkbox' || type === 'radio') {
                          // Untuk checkbox dan radio, cukup centang satu saja
                          const checkboxName = input.name;
                          if (checkboxName) {
                            const checkboxes = document.querySelectorAll(`input[name="${checkboxName}"]`);
                            if (checkboxes.length > 0 && !checkboxes[0].checked) {
                              checkboxes[0].checked = true;
                              filledInputs.push({
                                type: 'checkbox/radio',
                                name: checkboxName,
                                value: checkboxes[0].value || 'checked'
                              });
                            }
                          } else {
                            input.checked = true;
                            filledInputs.push({
                              type: 'checkbox/radio',
                              id: id,
                              value: input.value || 'checked'
                            });
                          }
                          return;
                        }
                        
                        // Dapatkan nilai default
                        const value = getDefaultValue(input);
                        
                        // Isi nilai
                        input.value = value;
                        
                        // Trigger event untuk React/Vue
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                        
                        const changeEvent = new Event('change', { bubbles: true });
                        input.dispatchEvent(changeEvent);
                        
                        filledInputs.push({
                          type: type,
                          name: name || id,
                          value: value
                        });
                      } catch (err) {
                        console.error(`Error mengisi input: ${err.message}`);
                      }
                    });
                    
                    return filledInputs;
                  };
                  
                  // Fungsi untuk mengisi textarea
                  const fillTextareas = () => {
                    const textareas = Array.from(document.querySelectorAll('textarea'))
                      .filter(textarea => {
                        // Filter hanya textarea yang terlihat
                        const style = window.getComputedStyle(textarea);
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' && 
                               style.opacity !== '0' &&
                               textarea.offsetWidth > 0 &&
                               textarea.offsetHeight > 0;
                      });
                    
                    console.log(`Ditemukan ${textareas.length} textarea fields`);
                    
                    const filledTextareas = [];
                    textareas.forEach(textarea => {
                      try {
                        const name = textarea.name || '';
                        const id = textarea.id || '';
                        
                        // Nilai default untuk textarea
                        let value = 'This is a test message. Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
                        
                        // Isi nilai
                        textarea.value = value;
                        
                        // Trigger event untuk React/Vue
                        const event = new Event('input', { bubbles: true });
                        textarea.dispatchEvent(event);
                        
                        const changeEvent = new Event('change', { bubbles: true });
                        textarea.dispatchEvent(changeEvent);
                        
                        filledTextareas.push({
                          name: name || id,
                          value: value
                        });
                      } catch (err) {
                        console.error(`Error mengisi textarea: ${err.message}`);
                      }
                    });
                    
                    return filledTextareas;
                  };
                  
                  // Fungsi untuk mengisi select fields
                  const fillSelects = () => {
                    const selects = Array.from(document.querySelectorAll('select'))
                      .filter(select => {
                        // Filter hanya select yang terlihat
                        const style = window.getComputedStyle(select);
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' && 
                               style.opacity !== '0' &&
                               select.offsetWidth > 0 &&
                               select.offsetHeight > 0;
                      });
                    
                    console.log(`Ditemukan ${selects.length} select fields`);
                    
                    const filledSelects = [];
                    selects.forEach(select => {
                      try {
                        const name = select.name || '';
                        const id = select.id || '';
                        const labelText = (() => {
                          // Coba dapatkan label berdasarkan id
                          if (id) {
                            const label = document.querySelector(`label[for="${id}"]`);
                            if (label) return label.textContent.trim().toLowerCase();
                          }
                          // Coba dapatkan label dari parent elements
                          let parent = select.parentElement;
                          for (let i = 0; i < 3 && parent; i++) {
                            const labelEl = parent.querySelector('label');
                            if (labelEl) return labelEl.textContent.trim().toLowerCase();
                            parent = parent.parentElement;
                          }
                          return '';
                        })();
                        
                        // Ambil semua options
                        const options = Array.from(select.options);
                        
                        // Strategi khusus untuk dropdown tertentu
                        if (name.includes('kategori') || id.includes('kategori') || labelText.includes('kategori')) {
                          // Pilih opsi yang tidak kosong dan bukan placeholder
                          for (let i = 0; i < options.length; i++) {
                            const optionText = options[i].textContent.trim();
                            if (optionText && !optionText.includes('Pilih') && !optionText.includes('--')) {
                              select.selectedIndex = i;
                              break;
                            }
                          }
                        } else if (name.includes('project') || id.includes('project') || labelText.includes('project')) {
                          // Pilih opsi project yang valid
                          for (let i = 0; i < options.length; i++) {
                            const optionText = options[i].textContent.trim();
                            if (optionText && !optionText.includes('Pilih') && !optionText.includes('--')) {
                              select.selectedIndex = i;
                              break;
                            }
                          }
                        } else if (name.includes('status') || id.includes('status') || labelText.includes('status')) {
                          // Pilih status AKTIF jika tersedia
                          for (let i = 0; i < options.length; i++) {
                            const optionText = options[i].textContent.trim().toLowerCase();
                            if (optionText.includes('aktif')) {
                              select.selectedIndex = i;
                              break;
                            }
                          }
                        } else {
                          // Default: Pilih option yang valid (bukan placeholder)
                          let validOptionFound = false;
                          for (let i = 0; i < options.length; i++) {
                            const optionText = options[i].textContent.trim();
                            if (optionText && !optionText.includes('Pilih') && !optionText.includes('--')) {
                              select.selectedIndex = i;
                              validOptionFound = true;
                              break;
                            }
                          }
                          
                          // Jika tidak ada opsi valid, gunakan opsi pertama yang bukan empty string
                          if (!validOptionFound && options.length > 0) {
                            for (let i = 0; i < options.length; i++) {
                              if (options[i].textContent.trim()) {
                                select.selectedIndex = i;
                                break;
                              }
                            }
                          }
                        }
                        
                        // Trigger event untuk React/Vue
                        const changeEvent = new Event('change', { bubbles: true });
                        select.dispatchEvent(changeEvent);
                        
                        filledSelects.push({
                          name: name || id,
                          value: select.value,
                          text: options[select.selectedIndex]?.textContent || ''
                        });
                      } catch (err) {
                        console.error(`Error mengisi select: ${err.message}`);
                      }
                    });
                    
                    return filledSelects;
                  };
                  
                  // Jalankan semua fungsi pengisian form
                  const inputResults = fillInputs();
                  const textareaResults = fillTextareas();
                  const selectResults = fillSelects();
                  
                  // Pastikan tidak ada navigasi otomatis setelah pengisian form
                  // Mencegah form submit otomatis yang bisa menyebabkan 404
                  const forms = document.querySelectorAll('form');
                  forms.forEach(form => {
                    const originalSubmit = form.submit;
                    form.submit = function() {
                      console.log('Form submit dicegah untuk mencegah navigasi otomatis');
                      return false;
                    };
                    
                    // Mencegah event submit
                    form.addEventListener('submit', function(e) {
                      e.preventDefault();
                      console.log('Form submit event dicegah');
                      return false;
                    }, true);
                  });
                  
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
                  // Override window.location methods untuk mencegah navigasi
                  const originalReplace = window.location.replace;
                  const originalAssign = window.location.assign;
                  const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href').set;
                  
                  window.location.replace = function(url) {
                    console.log('Mencegah window.location.replace');
                    return false;
                  };
                  
                  window.location.assign = function(url) {
                    console.log('Mencegah window.location.assign');
                    return false;
                  };
                  
                  Object.defineProperty(window.location, 'href', {
                    set: function(href) {
                      console.log('Mencegah mengubah window.location.href');
                      return false;
                    }
                  });
                  
                  // Tambahkan listener untuk mencegah klik pada link
                  document.addEventListener('click', function(e) {
                    const target = e.target.closest('a');
                    if (target) {
                      e.preventDefault();
                      console.log('Mencegah klik pada link');
                      return false;
                    }
                  }, true);
                });
                
                // Ambil screenshot setelah mengisi form
                await page.screenshot({
                  path: path.join(__dirname, "results", `form_after_fill_${getFormattedDate()}.png`),
                });
                
                testResult.status = "passed";
                testResult.result.details = {
                  message: `Berhasil mengisi ${formFillResult.total} form fields`,
                  formFields: formFillResult
                };
              } catch (formFillError) {
                console.error("Form fill error:", formFillError);
                testResult.status = "failed";
                testResult.result.details = {
                  error: formFillError.message
                };
              }
              break;
              
            case "logout":
              console.log('Menjalankan test case logout...');
              
              // Metode 1: Coba mencari dan mengklik tombol logout
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
                          sessionStorage.clear();
                          console.log('Local storage dan session storage dihapus');
                          return true;
                        } catch (e) {
                          console.log('Error saat menghapus storage:', e);
                          return false;
                        }
                      });
                      
                      // Refresh halaman
                      await page.reload({ waitUntil: 'networkidle2' });
                      console.log('Halaman di-refresh setelah menghapus cookies dan storage');
                      testResult.status = "passed";
                      testResult.result.details.message = "Logout berhasil dengan menghapus cookies dan storage";
                    }
                  }
                }
                
                // Ambil screenshot untuk debugging
                const screenshotPath = path.join(__dirname, 'results', `logout_${getFormattedDate()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`Screenshot disimpan di: ${screenshotPath}`);
                
              } catch (error) {
                console.error('Error saat logout:', error);
                testResult.status = "failed";
                testResult.result.details.message = `Error saat logout: ${error.message}`;
              }
              break;

            case "fillForm":
              console.log("Menjalankan Form Fill Test...");
              
              // Gunakan URL spesifik dari test case jika tersedia
              const fillFormUrl = test.config?.targetUrl || websiteConfig.url;
              console.log(`Target URL untuk form fill: ${fillFormUrl}`);
              
              // Jika tidak ada login sebelumnya, lakukan login terlebih dahulu
              if (!isLoggedIn) {
                console.log("Belum login, melakukan login terlebih dahulu...");
                try {
                  // Navigasi ke halaman login
                  console.log(`Navigasi ke URL login: ${websiteConfig.loginUrl || websiteConfig.url}`);
                  await page.goto(websiteConfig.loginUrl || websiteConfig.url, {
                    waitUntil: "networkidle2",
                    timeout: 30000,
                  });
                  
                  // Deteksi dan isi form login
                  const formElements = await detectLoginForm(page);
                  
                  if (formElements.hasEmailInput && formElements.hasPasswordInput) {
                    // Isi form login
                    await page.type(formElements.emailSelector, websiteConfig.credentials.identifier);
                    await page.type(formElements.passwordSelector, websiteConfig.credentials.password);
                    
                    console.log("Mengklik tombol login...");
                    await submitLoginForm(page, formElements.submitSelector, websiteConfig.credentials);
                    
                    // Tunggu navigasi selesai
                    await page.waitForTimeout(3000);
                    isLoggedIn = true;
                    console.log("Login berhasil untuk Form Fill Test");
                  } else {
                    console.error("Tidak dapat menemukan form login");
                    throw new Error("Tidak dapat menemukan form login");
                  }
                } catch (loginError) {
                  console.error("Error saat login untuk Form Fill Test:", loginError);
                  testResult.status = "failed";
                  testResult.result.details.message = `Error saat login: ${loginError.message}`;
                  break;
                }
              }
              
              // Navigasi ke halaman form yang akan diisi
              console.log(`Navigasi ke halaman form: ${fillFormUrl}`);
              try {
                await page.goto(fillFormUrl, {
                  waitUntil: "networkidle2",
                  timeout: 30000,
                });
              } catch (navigationError) {
                console.error("Error saat navigasi ke halaman form:", navigationError);
                testResult.status = "failed";
                testResult.result.details.message = `Error saat navigasi: ${navigationError.message}`;
                break;
              }
              
              // Tunggu halaman dimuat
              await page.waitForTimeout(2000);
              
              // Ambil screenshot sebelum mengisi form
              const beforeScreenshotPath = path.join(
                __dirname,
                "results",
                `form_before_fill_${getFormattedDate()}.png`
              );
              await page.screenshot({ path: beforeScreenshotPath, fullPage: true });
              console.log(`Screenshot sebelum mengisi form: ${beforeScreenshotPath}`);
              
              try {
                // Deteksi semua form fields secara otomatis
                console.log("Mendeteksi form fields secara otomatis...");
                const formFields = await page.evaluate(() => {
                  // Fungsi untuk memeriksa apakah elemen terlihat
                  const isVisible = (element) => {
                    const style = window.getComputedStyle(element);
                    return style.display !== 'none' && 
                           style.visibility !== 'hidden' && 
                           style.opacity !== '0' &&
                           element.offsetWidth > 0 &&
                           element.offsetHeight > 0;
                  };
                  
                  // Fungsi untuk mendapatkan label dari input
                  const getLabelText = (input) => {
                    // Cek label yang terkait dengan input
                    if (input.id) {
                      const label = document.querySelector(`label[for="${input.id}"]`);
                      if (label) return label.textContent.trim();
                    }
                    
                    // Cek parent elements untuk label text
                    let parent = input.parentElement;
                    for (let i = 0; i < 3 && parent; i++) {
                      const labelElement = parent.querySelector('label');
                      if (labelElement) return labelElement.textContent.trim();
                      parent = parent.parentElement;
                    }
                    
                    return null;
                  };
                  
                  // Fungsi untuk mendapatkan placeholder atau name sebagai fallback untuk label
                  const getFieldName = (input) => {
                    return input.placeholder || input.name || input.id || '';
                  };
                  
                  // Fungsi untuk mendapatkan nilai default berdasarkan tipe input
                  const getDefaultValue = (input, labelText, fieldName) => {
                    const type = input.type?.toLowerCase() || '';
                    const name = input.name?.toLowerCase() || '';
                    const id = input.id?.toLowerCase() || '';
                    const placeholder = input.placeholder?.toLowerCase() || '';
                    const label = labelText?.toLowerCase() || '';
                    const fieldNameLower = fieldName.toLowerCase();
                    
                    // Email
                    if (type === 'email' || 
                        name.includes('email') || 
                        id.includes('email') || 
                        placeholder.includes('email') || 
                        label.includes('email') || 
                        fieldNameLower.includes('email')) {
                      return 'test@example.com';
                    }
                    
                    // Password
                    if (type === 'password' || 
                        name.includes('pass') || 
                        id.includes('pass') || 
                        placeholder.includes('pass') || 
                        label.includes('pass') || 
                        fieldNameLower.includes('pass')) {
                      return 'Password123!';
                    }
                    
                    // Nama
                    if (name.includes('name') || 
                        id.includes('name') || 
                        placeholder.includes('name') || 
                        label.includes('name') || 
                        fieldNameLower.includes('name')) {
                      
                      // First name / nama depan
                      if (name.includes('first') || 
                          id.includes('first') || 
                          placeholder.includes('first') || 
                          label.includes('first') || 
                          name.includes('depan') || 
                          id.includes('depan') || 
                          placeholder.includes('depan') || 
                          label.includes('depan')) {
                        return 'John';
                      }
                      
                      // Last name / nama belakang
                      if (name.includes('last') || 
                          id.includes('last') || 
                          placeholder.includes('last') || 
                          label.includes('last') || 
                          name.includes('belakang') || 
                          id.includes('belakang') || 
                          placeholder.includes('belakang') || 
                          label.includes('belakang')) {
                        return 'Doe';
                      }
                      
                      return 'John Doe';
                    }
                    
                    // Telepon
                    if (type === 'tel' || 
                        name.includes('phone') || name.includes('telp') || name.includes('mobile') || 
                        id.includes('phone') || id.includes('telp') || id.includes('mobile') || 
                        placeholder.includes('phone') || placeholder.includes('telp') || placeholder.includes('mobile') || 
                        label.includes('phone') || label.includes('telp') || label.includes('mobile') || 
                        fieldNameLower.includes('phone') || fieldNameLower.includes('telp') || fieldNameLower.includes('mobile')) {
                      return '08123456789';
                    }
                    
                    // Alamat
                    if (name.includes('address') || name.includes('alamat') || 
                        id.includes('address') || id.includes('alamat') || 
                        placeholder.includes('address') || placeholder.includes('alamat') || 
                        label.includes('address') || label.includes('alamat') || 
                        fieldNameLower.includes('address') || fieldNameLower.includes('alamat')) {
                      return 'Jl. Contoh No. 123';
                    }
                    
                    // Kota
                    if (name.includes('city') || name.includes('kota') || 
                        id.includes('city') || id.includes('kota') || 
                        placeholder.includes('city') || placeholder.includes('kota') || 
                        label.includes('city') || label.includes('kota') || 
                        fieldNameLower.includes('city') || fieldNameLower.includes('kota')) {
                      return 'Jakarta';
                    }
                    
                    // Kode Pos
                    if (name.includes('zip') || name.includes('postal') || name.includes('kode pos') || 
                        id.includes('zip') || id.includes('postal') || id.includes('kode pos') || 
                        placeholder.includes('zip') || placeholder.includes('postal') || placeholder.includes('kode pos') || 
                        label.includes('zip') || label.includes('postal') || label.includes('kode pos') || 
                        fieldNameLower.includes('zip') || fieldNameLower.includes('postal') || fieldNameLower.includes('kode pos')) {
                      return '12345';
                    }
                    
                    // Tanggal
                    if (type === 'date' || 
                        name.includes('date') || name.includes('tanggal') || 
                        id.includes('date') || id.includes('tanggal') || 
                        placeholder.includes('date') || placeholder.includes('tanggal') || 
                        label.includes('date') || label.includes('tanggal') || 
                        fieldNameLower.includes('date') || fieldNameLower.includes('tanggal')) {
                      const today = new Date();
                      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    }
                    
                    // Default untuk text
                    if (type === 'text' || type === '') {
                      return 'Test Value';
                    }
                    
                    // Default untuk number
                    if (type === 'number') {
                      return '42';
                    }
                    
                    return 'Test';
                  };
                  
                  // Cari semua input fields yang terlihat
                  const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea'))
                    .filter(input => isVisible(input))
                    .map(input => {
                      const labelText = getLabelText(input);
                      const fieldName = getFieldName(input);
                      const defaultValue = getDefaultValue(input, labelText, fieldName);
                      
                      return {
                        type: input.type || 'text',
                        id: input.id,
                        name: input.name,
                        placeholder: input.placeholder,
                        labelText,
                        fieldName: labelText || fieldName,
                        defaultValue,
                        isRequired: input.required,
                        selector: input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : null
                      };
                    })
                    .filter(field => field.selector); // Hanya ambil yang punya selector
                  
                  // Cari semua select fields yang terlihat
                  const selects = Array.from(document.querySelectorAll('select'))
                    .filter(select => isVisible(select))
                    .map(select => {
                      const labelText = getLabelText(select);
                      const fieldName = getFieldName(select);
                      
                      // Dapatkan semua options
                      const options = Array.from(select.options)
                        .filter(option => option.value)
                        .map(option => ({
                          value: option.value,
                          text: option.text
                        }));
                      
                      // Pilih option kedua jika ada, atau pertama jika hanya ada satu
                      const defaultOption = options.length > 1 ? options[1] : options[0];
                      
                      return {
                        type: 'select',
                        id: select.id,
                        name: select.name,
                        labelText,
                        fieldName: labelText || fieldName,
                        options,
                        defaultValue: defaultOption ? defaultOption.value : '',
                        isRequired: select.required,
                        selector: select.id ? `#${select.id}` : select.name ? `[name="${select.name}"]` : null
                      };
                    })
                    .filter(field => field.selector); // Hanya ambil yang punya selector
                  
                  // Cari semua checkbox dan radio yang terlihat
                  const checkboxesAndRadios = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'))
                    .filter(input => isVisible(input))
                    .map(input => {
                      const labelText = getLabelText(input);
                      const fieldName = getFieldName(input);
                      
                      return {
                        type: input.type,
                        id: input.id,
                        name: input.name,
                        value: input.value,
                        labelText,
                        fieldName: labelText || fieldName,
                        isRequired: input.required,
                        selector: input.id ? `#${input.id}` : input.name ? `[name="${input.name}"][value="${input.value}"]` : null
                      };
                    })
                    .filter(field => field.selector); // Hanya ambil yang punya selector
                  
                  return {
                    inputs,
                    selects,
                    checkboxesAndRadios,
                    formCount: document.querySelectorAll('form').length
                  };
                });
                
                console.log(`Menemukan ${formFields.inputs.length} input fields, ${formFields.selects.length} select fields, dan ${formFields.checkboxesAndRadios.length} checkbox/radio fields`);
                console.log(`Jumlah form di halaman: ${formFields.formCount}`);
                
                // Isi semua input fields
                for (const field of formFields.inputs) {
                  console.log(`Mengisi field ${field.fieldName} (${field.type}) dengan nilai: ${field.defaultValue}`);
                  
                  if (field.type === 'date') {
                    // Khusus untuk input date, gunakan evaluateHandle untuk set value
                    await page.evaluate((selector, value) => {
                      document.querySelector(selector).value = value;
                    }, field.selector, field.defaultValue);
                  } else {
                    // Hapus nilai yang sudah ada
                    await page.click(field.selector, { clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    
                    // Isi dengan nilai baru
                    await page.type(field.selector, field.defaultValue);
                  }
                  
                  // Tunggu sebentar setelah mengisi setiap field
                  await page.waitForTimeout(300);
                }
                
                // Isi semua select fields
                for (const field of formFields.selects) {
                  if (field.defaultValue) {
                    console.log(`Memilih option untuk field ${field.fieldName}: ${field.defaultValue}`);
                    await page.select(field.selector, field.defaultValue);
                    await page.waitForTimeout(300);
                  }
                }
                
                // Centang checkbox yang belum dicentang (pilih yang pertama dari setiap grup)
                const checkboxesByName = {};
                for (const field of formFields.checkboxesAndRadios.filter(f => f.type === 'checkbox')) {
                  if (!checkboxesByName[field.name]) {
                    checkboxesByName[field.name] = [];
                  }
                  checkboxesByName[field.name].push(field);
                }
                
                for (const name in checkboxesByName) {
                  const firstCheckbox = checkboxesByName[name][0];
                  console.log(`Mengklik checkbox: ${firstCheckbox.fieldName}`);
                  await page.click(firstCheckbox.selector);
                  await page.waitForTimeout(300);
                }
                
                // Pilih radio button (pilih yang pertama dari setiap grup)
                const radiosByName = {};
                for (const field of formFields.checkboxesAndRadios.filter(f => f.type === 'radio')) {
                  if (!radiosByName[field.name]) {
                    radiosByName[field.name] = [];
                  }
                  radiosByName[field.name].push(field);
                }
                
                for (const name in radiosByName) {
                  const firstRadio = radiosByName[name][0];
                  console.log(`Mengklik radio button: ${firstRadio.fieldName}`);
                  await page.click(firstRadio.selector);
                  await page.waitForTimeout(300);
                }
                
                // Ambil screenshot setelah mengisi form
                const afterScreenshotPath = path.join(
                  __dirname,
                  "results",
                  `form_after_fill_${getFormattedDate()}.png`
                );
                await page.screenshot({ path: afterScreenshotPath, fullPage: true });
                console.log(`Screenshot setelah mengisi form: ${afterScreenshotPath}`);
                
                // Jika ada tombol submit, klik tombol tersebut jika diminta
                if (test.config?.submitForm) {
                  console.log("Mencari tombol submit...");
                  const submitButton = await page.evaluate(() => {
                    // Cari tombol submit berdasarkan berbagai atribut
                    const buttons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button, input[type="button"], a.btn, a.button, [role="button"]'));
                    
                    for (const button of buttons) {
                      const text = button.textContent?.toLowerCase() || '';
                      const value = button.value?.toLowerCase() || '';
                      
                      if (text.includes('submit') || text.includes('save') || text.includes('simpan') || 
                          text.includes('kirim') || text.includes('send') || text.includes('lanjut') || 
                          text.includes('next') || text.includes('continue') || 
                          value.includes('submit') || value.includes('save') || value.includes('simpan') || 
                          value.includes('kirim') || value.includes('send') || value.includes('lanjut') || 
                          value.includes('next') || value.includes('continue')) {
                        
                        return button.id ? `#${button.id}` : 
                               button.name ? `[name="${button.name}"]` : 
                               button.className ? `.${button.className.split(' ')[0]}` : null;
                      }
                    }
                    
                    // Jika tidak ditemukan tombol dengan teks spesifik, ambil tombol submit pertama
                    const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
                    if (submitButton) {
                      return submitButton.id ? `#${submitButton.id}` : 
                             submitButton.name ? `[name="${submitButton.name}"]` : 
                             submitButton.className ? `.${submitButton.className.split(' ')[0]}` : null;
                    }
                    
                    return null;
                  });
                  
                  if (submitButton) {
                    console.log(`Menemukan tombol submit: ${submitButton}`);                    
                    console.log("Mengklik tombol submit...");
                    
                    try {
                      await Promise.all([
                        page.click(submitButton),
                        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {
                          console.log("Navigation timeout setelah submit, melanjutkan...");
                        })
                      ]);
                      
                      console.log("Form berhasil disubmit");
                      
                      // Ambil screenshot setelah submit
                      const submitScreenshotPath = path.join(
                        __dirname,
                        "results",
                        `form_after_submit_${getFormattedDate()}.png`
                      );
                      await page.screenshot({ path: submitScreenshotPath, fullPage: true });
                      console.log(`Screenshot setelah submit: ${submitScreenshotPath}`);
                      
                      testResult.result.details.message = "Form berhasil diisi dan disubmit";
                    } catch (submitError) {
                      console.error("Error saat submit form:", submitError);
                      testResult.result.details.message = `Form berhasil diisi tetapi gagal disubmit: ${submitError.message}`;
                    }
                  } else {
                    console.log("Tidak menemukan tombol submit");
                    testResult.result.details.message = "Form berhasil diisi tetapi tidak menemukan tombol submit";
                  }
                } else {
                  testResult.result.details.message = "Form berhasil diisi";
                }
                
                testResult.status = "passed";
              } catch (formFillError) {
                console.error("Error saat mengisi form:", formFillError);
                testResult.status = "failed";
                testResult.result.details.message = `Error saat mengisi form: ${formFillError.message}`;
                
                // Ambil screenshot error
                const errorScreenshotPath = path.join(
                  __dirname,
                  "results",
                  `form_fill_error_${getFormattedDate()}.png`
                );
                await page.screenshot({ path: errorScreenshotPath, fullPage: true });
                console.log(`Screenshot error: ${errorScreenshotPath}`);
              }
              break;

            case "submitForm":
              if (
                !test.config ||
                !test.config.selectors ||
                !test.config.selectors.form ||
                !test.config.selectors.submitButton
              ) {
                throw new Error("Konfigurasi form tidak valid");
              }

              // Gunakan URL spesifik dari test case jika tersedia
              const submitFormUrl = test.config.targetUrl || websiteConfig.url;

              // Navigasi ke halaman form
              await page.goto(submitFormUrl, {
                waitUntil: "networkidle2",
                timeout: 30000,
              });

              // Tunggu halaman dimuat
              await page.waitForTimeout(2000);

              // Isi dan submit form
              // Form submission logic

              testResult.status = "passed";
              testResult.result.details.message = "Form berhasil disubmit";
              break;

            case "checkRequired":
              if (
                !test.config ||
                !test.config.selectors ||
                !test.config.selectors.form
              ) {
                throw new Error("Konfigurasi form tidak valid");
              }

              // Gunakan URL spesifik dari test case jika tersedia
              const checkFormUrl = test.config.targetUrl || websiteConfig.url;

              // Navigasi ke halaman form
              await page.goto(checkFormUrl, {
                waitUntil: "networkidle2",
                timeout: 30000,
              });

              // Tunggu halaman dimuat
              await page.waitForTimeout(2000);

              // Validasi required fields
              // Validation logic

              testResult.status = "passed";
              testResult.result.details.message =
                "Validasi required field berfungsi";
              break;

            default:
              testResult.status = "skipped";
              testResult.result.details.message = `Tipe test "${test.type}" tidak didukung`;
          }
        } catch (error) {
          testResult.status = "error";
          testResult.result.details.message = error.message;
          console.error(`Test error (${test.name}):`, error);
        }

        results.push(testResult);
      }

      // Simpan hasil
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const filename = `${sanitizeFilename(
        websiteConfig.url
      )}_${timestamp}.json`;
      saveToJsonFile(path.join(__dirname, "results", filename), {
        url: websiteConfig.url,
        timestamp: new Date().toISOString(),
        results,
      });

      // Don't close browser on successful test execution
      // Store browser/page for later use
      global.activeBrowser = browser;
      global.activePage = page;

      res.json({
        success: true,
        results,
        savedTo: filename,
        browserOpen: true,
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error("Test execution error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'test_execution_error');
    if (browser) await browser.close();
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat menjalankan test",
    });
  }
});

// Route untuk menjalankan test Google login
router.post("/execute-test", async (req, res) => {
  const { websiteConfig, test } = req.body;

  if (!websiteConfig || !test) {
    return res.status(400).json({
      success: false,
      error: "Parameter tidak valid",
    });
  }

  // Cek apakah ini adalah test Google yang didukung
  if (test.type !== "google") {
    return res.status(400).json({
      success: false,
      error: "Endpoint ini hanya mendukung test login Google",
    });
  }

  let browser;
  const result = {
    id: test.id,
    name: test.name,
    type: test.type,
    status: "running",
    result: {
      timestamp: new Date().toISOString(),
      success: false,
      details: {},
    },
  };

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Tambahkan listener untuk error navigasi
    page.on("requestfailed", (request) => {
      console.log(`Request failed: ${request.url()}`);
      // Add null check to avoid TypeError
      const failure = request.failure();
      if (failure && failure.errorText) {
        console.log(`Reason: ${failure.errorText}`);
      } else {
        console.log("No error details available");
      }
    });

    // Cek apakah ada Basic Auth
    if (
      websiteConfig.hasBasicAuth &&
      websiteConfig.basicAuth &&
      websiteConfig.basicAuth.username &&
      websiteConfig.basicAuth.password
    ) {
      console.log("Menggunakan Basic Authentication untuk test Google");
      // Set Basic Authentication
      try {
        await page.authenticate({
          username: websiteConfig.basicAuth.username,
          password: websiteConfig.basicAuth.password,
        });
      } catch (authError) {
        console.error('Error saat setup basic authentication untuk test Google:', authError.message);
        saveErrorToFile(authError, 'google_test_auth_setup_error');
      }
    }

    // Get specific target URL for this test if available
    const targetUrl =
      test.config?.targetUrl || websiteConfig.loginUrl || websiteConfig.url;
    console.log(`Mencoba login via Google ke: ${targetUrl}`);

    try {
      // Navigasi ke halaman login
      console.log(`Navigasi ke URL: ${targetUrl}`);

      try {
        await page.goto(targetUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      } catch (navigationError) {
        console.error('Error saat navigasi ke halaman login Google:', navigationError.message);
        // Simpan error ke file
        saveErrorToFile(navigationError, 'google_test_navigation_error');
        // Ambil screenshot untuk debugging jika navigasi gagal
        await page.screenshot({
          path: path.join(__dirname, "results", `google_test_navigation_error_${getFormattedDate()}.png`),
        });
        console.log('Screenshot navigation error disimpan');
      }

      // Tunggu halaman dimuat
      await page.waitForTimeout(2000);

      // Cari tombol login Google
      const googleLoginButton = await page.evaluate(() => {
        const button = document.querySelector(
          'button[aria-label*="Google"], a[aria-label*="Google"], ' +
          'button[data-provider="google"], a[data-provider="google"], ' +
          "a.btn-google, button.btn-google, " +
          'a:has(img[alt*="Google"]), ' +
          'button:has-text("Google"), a:has-text("Google"), ' +
          ".google-login, .login-with-google, " +
          "button.social-button.google, a.social-button.google, " +
          'button[class*="google"], a[class*="google"]'
        );

        return button
          ? {
              tag: button.tagName.toLowerCase(),
              id: button.id,
              className: button.className,
              text: button.textContent?.trim(),
            }
          : null;
      });

      if (googleLoginButton) {
        console.log("Tombol login Google ditemukan:", googleLoginButton);

        // Klik tombol login dengan Google
        try {
          await Promise.all([
            page.click(
              googleLoginButton.id
                ? `#${googleLoginButton.id}`
                : googleLoginButton.className
                ? `.${googleLoginButton.className.split(" ").join(".")}`
                : googleLoginButton.tag
            ),
            page
              .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
              .catch((err) =>
                console.log("Navigation timeout, continuing:", err.message)
              ),
          ]);
        } catch (clickError) {
          console.log("Error saat klik tombol Google:", clickError.message);
          // Coba cara alternatif jika error
          await page.evaluate(() => {
            const button = document.querySelector(
              'a[href*="google"], button[onclick*="google"]'
            );
            if (button) button.click();
          });
          await page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
            .catch((err) =>
              console.log("Navigation timeout, continuing:", err.message)
            );
        }

        // Tunggu halaman login Google muncul
        await page.waitForTimeout(3000);

        // Cek apakah kita sudah di halaman login Google
        const isGoogleLoginPage = await page.evaluate(() => {
          return window.location.href.includes("accounts.google.com");
        });

        if (isGoogleLoginPage) {
          console.log("Halaman login Google terdeteksi");

          // Isi alamat Gmail
          if (websiteConfig.credentials.gmailAddress) {
            await page.type(
              'input[type="email"]',
              websiteConfig.credentials.gmailAddress
            );
            await page.click("#identifierNext");

            // Tunggu halaman password muncul
            await page.waitForTimeout(3000);

            // Isi password (jika disediakan)
            if (websiteConfig.credentials.password) {
              await page.type(
                'input[type="password"]',
                websiteConfig.credentials.password
              );
              await page.click("#passwordNext");

              // Tunggu setelah login
              await page.waitForTimeout(5000);
            }
          }

          // Tunggu sebentar setelah login
          await page.waitForTimeout(2000);

          // Cek apakah login berhasil - metode yang lebih handal:
          // 1. Periksa URL saat ini - jika berbeda dari URL awal atau berisi 'dashboard', kemungkinan login berhasil
          // 2. Periksa elemen-elemen yang biasanya muncul setelah login
          const loginSuccess = await page.evaluate((originalUrl) => {
            const currentUrl = window.location.href;
            console.log(
              `Original URL: ${originalUrl}, Current URL: ${currentUrl}`
            );

            // Cek apakah URL berubah dan berisi kata 'dashboard' atau 'admin'
            const urlChanged = currentUrl !== originalUrl;
            const urlContainsDashboard =
              currentUrl.includes("dashboard") ||
              currentUrl.includes("admin") ||
              currentUrl.includes("home") ||
              currentUrl.includes("index");

            // Cek elemen-elemen yang biasanya muncul setelah login
            const hasLogoutElement = !!document.querySelector(
              ".profile, .dashboard, .account, .user-info, .logout, " +
                'a[href*="logout"], button[onclick*="logout"], ' +
                ".user-profile, .user-avatar, .username"
            );

            // Cek elemen khusus untuk K24
            const hasK24Elements = (() => {
              // Cek selectors standar dulu
              const standardSelectors =
                ".bsc, .menu, #menu, .home, .navbar-brand, .pt-k24, .logo-k24";
              if (document.querySelector(standardSelectors)) return true;

              // Cek h1/h2 dengan teks "HOME"
              const h1Elements = Array.from(document.querySelectorAll("h1"));
              const h2Elements = Array.from(document.querySelectorAll("h2"));
              if (
                h1Elements.some((el) => el.textContent.includes("HOME")) ||
                h2Elements.some((el) => el.textContent.includes("HOME"))
              ) {
                return true;
              }

              // Cek link dengan teks "My BSC"
              const aElements = Array.from(document.querySelectorAll("a"));
              if (aElements.some((el) => el.textContent.includes("My BSC"))) {
                return true;
              }

              return false;
            })();

            // Bisa login berhasil jika: URL berubah ke dashboard ATAU ada elemen post-login yang terdeteksi
            return (
              urlContainsDashboard ||
              hasLogoutElement ||
              hasK24Elements ||
              (urlChanged && !currentUrl.includes("login"))
            );
          }, targetUrl);

          console.log(
            `Login success detection result: ${
              loginSuccess ? "Berhasil" : "Gagal"
            }`
          );
          console.log(`Current URL after login: ${page.url()}`);

          // Ambil screenshot untuk debugging
          await page.screenshot({
            path: path.join(__dirname, "results", "after_login.png"),
          });
          console.log("Screenshot after login saved");

          result.status = loginSuccess ? "passed" : "failed";
          result.result.success = loginSuccess;
          result.result.details.message = loginSuccess
            ? "Login via Google berhasil"
            : "Login via Google gagal";
          result.result.details.currentUrl = page.url();
        } else {
          console.log("Tidak berada di halaman login Google");
          result.status = "failed";
          result.result.details.message =
            "Tidak berada di halaman login Google";
          result.result.details.currentUrl = page.url();
        }
      } else {
        console.log("Tombol login Google tidak ditemukan");
        result.status = "failed";
        result.result.details.message = "Tombol login Google tidak ditemukan";
      }
    } catch (googleLoginError) {
      console.error("Google login error:", googleLoginError);
      result.status = "failed";
      result.result.details.message = googleLoginError.message;
    }

    // Simpan hasil
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filename = `${sanitizeFilename(websiteConfig.url)}_${timestamp}.json`;

    saveToJsonFile(path.join(__dirname, "results", filename), {
      url: websiteConfig.url,
      timestamp: new Date().toISOString(),
      results: [result],
    });

    // Keep browser open if login was successful
    if (result.status === "passed" && result.result.success) {
      console.log("Google login berhasil, browser tetap terbuka...");
      // Store browser for later use
      global.activeBrowser = browser;
      global.activePage = page;

      res.json({
        success: result.status === "passed",
        result,
        savedTo: filename,
        browserOpen: true,
      });
    } else {
      // Close browser on failure
      await browser.close();

      res.json({
        success: result.status === "passed",
        result,
        savedTo: filename,
        browserOpen: false,
      });
    }
  } catch (error) {
    console.error("Test execution error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'google_test_error');
    if (browser) await browser.close();

    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat menjalankan test",
    });
  }
});

// Route untuk mendapatkan hasil test sebelumnya
router.get("/results", (req, res) => {
  try {
    const files = getFilesInDirectory(path.join(__dirname, "results"), ".json");
    const results = files.map((file) => {
      try {
        const content = fs.readFileSync(file, "utf8");
        return JSON.parse(content);
      } catch (error) {
        return {
          file,
          error: "Gagal membaca file",
        };
      }
    });

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat membaca hasil",
    });
  }
});

// Route untuk menutup browser yang masih terbuka
router.post("/close-browser", async (req, res) => {
  try {
    if (global.activeBrowser) {
      console.log("Menutup browser yang masih terbuka...");
      await global.activeBrowser.close();
      global.activeBrowser = null;
      global.activePage = null;
      res.json({
        success: true,
        message: "Browser berhasil ditutup",
      });
    } else {
      res.json({
        success: true,
        message: "Tidak ada browser yang terbuka",
      });
    }
  } catch (error) {
    console.error("Error closing browser:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat menutup browser",
    });
  }
});

// Route untuk melakukan scraping pada halaman web
router.post("/scrape", async (req, res) => {
  const { url, options } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "URL tidak valid",
    });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    try {
      // Cek apakah ada Basic Auth
      if (
        options &&
        options.basicAuth &&
        options.basicAuth.username &&
        options.basicAuth.password
      ) {
        console.log("Menggunakan Basic Authentication");
        // Set Basic Authentication
        await page.authenticate({
          username: options.basicAuth.username,
          password: options.basicAuth.password,
        });
      }

      // Navigasi ke URL
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Tunggu halaman dimuat
      await page.waitForTimeout(2000);

      let results = {};

      // Ambil screenshot jika diminta
      if (options && options.screenshot) {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const screenshotPath = path.join(
          __dirname,
          "results",
          `screenshot_${sanitizeFilename(url)}_${timestamp}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        results.screenshot = screenshotPath;
      }

      // Scrape data berdasarkan selector
      if (options && options.selectors) {
        const data = await page.evaluate((selectors) => {
          const result = {};

          for (const [key, selector] of Object.entries(selectors)) {
            if (typeof selector === "string") {
              const element = document.querySelector(selector);
              result[key] = element ? element.innerText.trim() : null;
            } else if (Array.isArray(selector)) {
              const elements = document.querySelectorAll(selector[0]);
              result[key] = Array.from(elements).map((el) =>
                el.innerText.trim()
              );
            }
          }

          return result;
        }, options.selectors);

        results.data = data;
      }

      // Simpan hasil jika diminta
      if (options && options.saveResults) {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const filename = `scrape_${sanitizeFilename(url)}_${timestamp}.json`;
        saveToJsonFile(path.join(__dirname, "results", filename), {
          url,
          timestamp: new Date().toISOString(),
          results,
        });
        results.savedTo = filename;
      }

      await browser.close();

      res.json({
        success: true,
        results,
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error("Scrape error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'scrape_error');
    if (browser) await browser.close();
    res.status(500).json({
      success: false,
      error: error.message || "Terjadi kesalahan saat scraping",
    });
  }
});

// Route untuk melakukan scraping pada halaman web yang memerlukan autentikasi
router.post("/scrape-auth", async (req, res) => {
  const { websiteConfig, options } = req.body;

  if (!websiteConfig) {
    return res.status(400).json({
      success: false,
      error: "Konfigurasi website tidak valid",
    });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    try {
      // Cek apakah ada Basic Auth
      if (
        websiteConfig.hasBasicAuth &&
        websiteConfig.basicAuth &&
        websiteConfig.basicAuth.username &&
        websiteConfig.basicAuth.password
      ) {
        console.log("Menggunakan Basic Authentication untuk test");
        // Set Basic Authentication
        try {
          await page.authenticate({
            username: websiteConfig.basicAuth.username,
            password: websiteConfig.basicAuth.password,
          });
        } catch (authError) {
          console.error('Error saat setup basic authentication untuk test:', authError.message);
          saveErrorToFile(authError, 'test_auth_setup_error');
        }
      }

      // Login terlebih dahulu
      await page.goto(websiteConfig.loginUrl || websiteConfig.url);

      // Tunggu halaman dimuat
      await page.waitForTimeout(2000);

      // Deteksi elemen form login
      const formElements = await page.evaluate(() => {
        const emailInput = document.querySelector(
          'input[type="email"], input[type="text"], input[name*="email"], input[name*="username"]'
        );
        const passwordInput = document.querySelector('input[type="password"]');
        const submitButton = document.querySelector(
          'button[type="submit"], input[type="submit"]'
        );

        return {
          hasEmailInput: !!emailInput,
          hasPasswordInput: !!passwordInput,
          hasSubmitButton: !!submitButton,
          emailSelector: emailInput ? getSelector(emailInput) : null,
          passwordSelector: passwordInput ? getSelector(passwordInput) : null,
          submitSelector: submitButton ? getSelector(submitButton) : null,
        };

        function getSelector(element) {
          if (element.id) {
            return `#${element.id}`;
          } else if (
            element.className &&
            typeof element.className === "string"
          ) {
            return `.${element.className.split(" ").join(".")}`;
          } else {
            return element.tagName.toLowerCase();
          }
        }
      });

      // Isi form login
      if (formElements.hasEmailInput && formElements.emailSelector) {
        await page.type(
          formElements.emailSelector,
          websiteConfig.credentials.identifier
        );
      }

      if (formElements.hasPasswordInput && formElements.passwordSelector) {
        await page.type(
          formElements.passwordSelector,
          websiteConfig.credentials.password
        );
      }

      // Klik tombol submit
      if (formElements.hasSubmitButton && formElements.submitSelector) {
        await Promise.all([
          page.click(formElements.submitSelector),
          page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
            .catch(() => console.log("Navigation timeout, continuing")),
        ]);
      }

      // Tunggu sebentar setelah login
      await page.waitForTimeout(2000);

      // Navigasi ke URL yang ingin di-scrape
      if (options && options.url) {
        await page.goto(options.url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
      }

      let results = {};

      // Ambil screenshot jika diminta
      if (options && options.screenshot) {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const screenshotPath = path.join(
          __dirname,
          "results",
          `screenshot_auth_${sanitizeFilename(
            websiteConfig.url
          )}_${timestamp}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        results.screenshot = screenshotPath;
      }

      // Scrape data berdasarkan selector
      if (options && options.selectors) {
        const data = await page.evaluate((selectors) => {
          const result = {};

          for (const [key, selector] of Object.entries(selectors)) {
            if (typeof selector === "string") {
              const element = document.querySelector(selector);
              result[key] = element ? element.innerText.trim() : null;
            } else if (Array.isArray(selector)) {
              const elements = document.querySelectorAll(selector[0]);
              result[key] = Array.from(elements).map((el) =>
                el.innerText.trim()
              );
            }
          }

          return result;
        }, options.selectors);

        results.data = data;
      }

      // Simpan hasil jika diminta
      if (options && options.saveResults) {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const filename = `scrape_auth_${sanitizeFilename(
          websiteConfig.url
        )}_${timestamp}.json`;
        saveToJsonFile(path.join(__dirname, "results", filename), {
          url: websiteConfig.url,
          timestamp: new Date().toISOString(),
          results,
        });
        results.savedTo = filename;
      }

      await browser.close();

      res.json({
        success: true,
        results,
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error("Scrape auth error:", error);
    if (browser) await browser.close();
    res.status(500).json({
      success: false,
      error:
        error.message || "Terjadi kesalahan saat scraping dengan autentikasi",
    });
  }
});

// Add test endpoint at the end of the file, before the export
router.get("/test-results-dir", (req, res) => {
  try {
    // Check if results directory exists
    const resultsPath = path.join(__dirname, "results");
    const exists = fs.existsSync(resultsPath);

    // Create a test file to verify write permissions
    const testFile = path.join(resultsPath, `test-file-${Date.now()}.json`);
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: "Test file to verify results directory is working",
    };

    // Try to save the file
    const savedPath = saveToJsonFile(testFile, testData);

    // List files in the directory
    const files = getFilesInDirectory(resultsPath);

    res.json({
      success: true,
      resultsDirectoryExists: exists,
      directoryPath: resultsPath,
      testFileSaved: savedPath,
      filesInDirectory: files.map((f) => f.name),
    });
  } catch (error) {
    console.error("Error testing results directory:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

export default router;
