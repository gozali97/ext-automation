/**
 * File ini berisi fungsi-fungsi untuk berkomunikasi dengan background script
 * untuk operasi yang memerlukan izin khusus seperti chrome.cookies API
 */

import type { Cookie } from './CookieManager';

/**
 * Fungsi untuk mengimpor cookies melalui background script
 * @param cookies Array cookie yang akan diimpor
 * @returns Promise dengan hasil impor
 */
export function importCookiesViaBackground(cookies: Cookie[]): Promise<{success: boolean, completedCount: number, errorCount: number}> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Mengirim permintaan importCookies ke background script');
      
      // Kirim pesan ke background script
      chrome.runtime.sendMessage({
        action: 'importCookies',
        cookies: cookies
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background script:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (!response) {
          console.error('No response from background script');
          reject(new Error('No response from background script'));
          return;
        }
        
        console.log('Response from background script:', response);
        resolve(response);
      });
    } catch (error) {
      console.error('Error importing cookies via background:', error);
      reject(error);
    }
  });
}

/**
 * Fungsi untuk menghapus cookies melalui background script
 * @returns Promise dengan hasil penghapusan
 */
export function removeCookiesViaBackground(): Promise<{success: boolean, removedCount: number}> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Mengirim permintaan removeCookies ke background script');
      
      // Kirim pesan ke background script
      chrome.runtime.sendMessage({
        action: 'removeCookies'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background script:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (!response) {
          console.error('No response from background script');
          reject(new Error('No response from background script'));
          return;
        }
        
        console.log('Response from background script:', response);
        resolve(response);
      });
    } catch (error) {
      console.error('Error removing cookies via background:', error);
      reject(error);
    }
  });
}
