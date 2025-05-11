// test-utils.js - Utility functions for test cases

import fs from "fs";
import path from "path";
import { getFormattedDate } from "./utils.js";

// Fungsi untuk menyimpan error ke file
export const saveErrorToFile = (error, prefix = 'error') => {
  try {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      code: error.code || '',
      name: error.name || ''
    };
    
    const errorFilename = `${prefix}_${getFormattedDate()}.json`;
    const errorFilePath = path.join(process.cwd(), "results", errorFilename);
    
    fs.writeFileSync(errorFilePath, JSON.stringify(errorDetails, null, 2));
    console.log(`Error details saved to ${errorFilePath}`);
  } catch (saveError) {
    console.error('Failed to save error details:', saveError);
  }
};

// Fungsi untuk memeriksa apakah elemen terlihat
export function isVisible(element) {
  return new Promise(resolve => {
    const isStyleVisible = window.getComputedStyle(element).display !== 'none' && 
                          window.getComputedStyle(element).visibility !== 'hidden' && 
                          window.getComputedStyle(element).opacity !== '0';
    
    const rect = element.getBoundingClientRect();
    const hasSize = rect.width > 0 && rect.height > 0;
    
    resolve(isStyleVisible && hasSize);
  });
}

// Fungsi untuk mendapatkan semua teks dari elemen dan child-nya
export function getAllText(element) {
  return element.textContent.trim().toLowerCase();
}

// Fungsi untuk memeriksa apakah elemen memiliki kelas Tailwind tertentu
export function hasTailwindClass(element, classPattern) {
  if (!element.className) return false;
  
  const classStr = typeof element.className === 'string' 
    ? element.className 
    : element.className.baseVal || '';
    
  return new RegExp(classPattern).test(classStr);
}

// Fungsi untuk mendapatkan selector dari elemen
export function getSelector(element) {
  // Coba dapatkan selector berdasarkan ID
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Coba dapatkan selector berdasarkan class
  if (element.className && typeof element.className === 'string' && element.className.trim()) {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  
  // Fallback ke tag name
  return element.tagName.toLowerCase();
}

// Fungsi untuk mencari elemen dengan teks tertentu
export function findElementByText(selector, textList) {
  const elements = document.querySelectorAll(selector);
  
  for (const element of elements) {
    const text = element.textContent.trim().toLowerCase();
    for (const searchText of textList) {
      if (text.includes(searchText.toLowerCase())) {
        return element;
      }
    }
  }
  
  return null;
}

// Fungsi untuk mendapatkan label dari input
export function getLabelText(input) {
  // Coba dapatkan label dari atribut id
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent.trim();
  }
  
  // Coba dapatkan label dari parent elements
  let parent = input.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    const labelEl = parent.querySelector('label');
    if (labelEl) return labelEl.textContent.trim();
    parent = parent.parentElement;
  }
  
  return '';
}

// Fungsi untuk mendapatkan placeholder atau name sebagai fallback untuk label
export function getFieldName(input) {
  return input.placeholder || input.name || '';
}

// Fungsi untuk mendeteksi form login
export async function detectLoginForm(page) {
  return await page.evaluate(() => {
    // Deteksi elemen form login
    const formElements = {
      hasForm: false,
      hasEmailInput: false,
      hasPasswordInput: false,
      hasSubmitButton: false,
      emailSelector: null,
      passwordSelector: null,
      submitSelector: null
    };
    
    // Fungsi untuk mendapatkan selector dari elemen
    const getSelector = (element) => {
      // Coba dapatkan selector berdasarkan ID
      if (element.id) {
        return `#${element.id}`;
      }
      
      // Coba dapatkan selector berdasarkan class
      if (element.className && typeof element.className === 'string' && element.className.trim()) {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0) {
          return `.${classes[0]}`;
        }
      }
      
      // Fallback ke tag name
      return element.tagName.toLowerCase();
    };
    
    // Fungsi untuk mendapatkan semua teks dari elemen dan child-nya
    const getAllText = (element) => {
      return element.textContent.trim().toLowerCase();
    };
    
    // Fungsi untuk memeriksa apakah elemen terlihat
    const isVisible = (element) => {
      const isStyleVisible = window.getComputedStyle(element).display !== 'none' && 
                            window.getComputedStyle(element).visibility !== 'hidden' && 
                            window.getComputedStyle(element).opacity !== '0';
      
      const rect = element.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      
      return isStyleVisible && hasSize;
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
    
    // Cari form login
    const forms = Array.from(document.querySelectorAll('form'));
    const loginForm = forms.find(form => {
      const formText = getAllText(form).toLowerCase();
      return formText.includes('login') || 
            formText.includes('sign in') || 
            formText.includes('masuk') || 
            formText.includes('log in');
    });
    
    if (loginForm) {
      formElements.hasForm = true;
      
      // Cari input email/username
      const emailInput = loginForm.querySelector('input[type="email"], input[name*="email"], input[name*="username"], input[id*="email"], input[id*="username"], input[placeholder*="email"], input[placeholder*="username"]');
      
      if (emailInput) {
        formElements.hasEmailInput = true;
        formElements.emailSelector = getSelector(emailInput);
      }
      
      // Cari input password
      const passwordInput = loginForm.querySelector('input[type="password"], input[name*="password"], input[id*="password"], input[placeholder*="password"]');
      
      if (passwordInput) {
        formElements.hasPasswordInput = true;
        formElements.passwordSelector = getSelector(passwordInput);
      }
      
      // Cari tombol submit
      const submitButton = loginForm.querySelector('button[type="submit"], input[type="submit"], button:not([type]), button, input[type="button"]');
      
      if (submitButton) {
        formElements.hasSubmitButton = true;
        formElements.submitSelector = getSelector(submitButton);
      }
    } else {
      // Jika tidak ada form yang jelas, coba cari elemen input secara terpisah
      console.log('Tidak menemukan form login yang jelas, mencari elemen secara terpisah...');
      
      // Cari semua input yang terlihat
      const visibleInputs = Array.from(document.querySelectorAll('input')).filter(isVisible);
      
      // Cari input email/username
      const possibleEmailInputs = visibleInputs.filter(input => {
        const type = input.type?.toLowerCase() || '';
        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        
        return type === 'email' || 
              name.includes('email') || name.includes('username') || name.includes('user') || 
              id.includes('email') || id.includes('username') || id.includes('user') || 
              placeholder.includes('email') || placeholder.includes('username') || placeholder.includes('user');
      });
      
      // Cari input password
      const possiblePasswordInputs = visibleInputs.filter(input => {
        const type = input.type?.toLowerCase() || '';
        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        
        return type === 'password' || 
              name.includes('password') || name.includes('pass') || 
              id.includes('password') || id.includes('pass') || 
              placeholder.includes('password') || placeholder.includes('pass');
      });
      
      // Cari tombol submit
      const possibleSubmitButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button, [role="button"]')).filter(button => {
        if (!isVisible(button)) return false;
        
        const type = button.type?.toLowerCase() || '';
        const text = button.textContent?.toLowerCase() || '';
        const value = button.value?.toLowerCase() || '';
        const className = button.className?.toLowerCase() || '';
        
        return type === 'submit' || 
              text.includes('login') || text.includes('sign in') || text.includes('masuk') || 
              value.includes('login') || value.includes('sign in') || value.includes('masuk') || 
              className.includes('login') || className.includes('signin') || 
              hasTailwindClass(button, 'btn|button');
      });
      
      if (possibleEmailInputs.length > 0) {
        formElements.hasEmailInput = true;
        formElements.emailSelector = getSelector(possibleEmailInputs[0]);
      }
      
      if (possiblePasswordInputs.length > 0) {
        formElements.hasPasswordInput = true;
        formElements.passwordSelector = getSelector(possiblePasswordInputs[0]);
      }
      
      if (possibleSubmitButtons.length > 0) {
        formElements.hasSubmitButton = true;
        formElements.submitSelector = getSelector(possibleSubmitButtons[0]);
      }
    }
    
    return formElements;
  });
}

// Helper function untuk submit form login
export async function submitLoginForm(page, submitSelector, credentials) {
  return await page.evaluate((submitSelector, credentials) => {
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
    
    // Fungsi untuk mencoba submit form dengan berbagai metode
    const trySubmitForm = () => {
      // Coba metode 1: Klik tombol submit
      const submitButton = document.querySelector(submitSelector);
      if (submitButton && isVisible(submitButton)) {
        console.log('Mengklik tombol submit...');
        submitButton.click();
        return true;
      }
      
      // Coba metode 2: Submit form langsung
      const form = document.querySelector('form');
      if (form) {
        console.log('Submit form langsung...');
        form.submit();
        return true;
      }
      
      return false;
    };
    
    // Fungsi untuk submit form dengan JavaScript
    const submitWithJavaScript = () => {
      // Cari semua form
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) {
        console.log('Mencoba submit form dengan JavaScript...');
        forms[0].submit();
        return true;
      }
      
      // Jika tidak ada form, coba klik tombol yang mungkin adalah tombol login
      const possibleButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button, [role="button"]')).filter(button => {
        if (!isVisible(button)) return false;
        
        const text = button.textContent?.toLowerCase() || '';
        const value = button.value?.toLowerCase() || '';
        
        return text.includes('login') || text.includes('sign in') || text.includes('masuk') || 
              value.includes('login') || value.includes('sign in') || value.includes('masuk');
      });
      
      if (possibleButtons.length > 0) {
        console.log('Mengklik tombol yang mungkin adalah tombol login...');
        possibleButtons[0].click();
        return true;
      }
      
      return false;
    };
    
    // Coba submit form
    if (!trySubmitForm()) {
      // Jika gagal, coba metode JavaScript
      return submitWithJavaScript();
    }
    
    return true;
  }, submitSelector, credentials);
}
