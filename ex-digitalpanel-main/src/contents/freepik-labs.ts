import type { PlasmoCSConfig } from "plasmo"
import { checkFreepikSubscription, fetchCookiesFromAPI, importCookies, removeCookies } from "~components/freepik/CookieManager"
import { showSubscriptionPopup, removeSubscriptionPopup } from "~components/freepik/SubscriptionPopup"
import { calculateTotalCredits } from "~utils/modelCredits"
import type { ToolType } from "~utils/modelCredits"

export const config: PlasmoCSConfig = {
  matches: ["*://*.freepik.com/*"],
  all_frames: true
}

// Variabel global
let isProcessing = false;
let hasValidSubscription = false;
let subscriptionChecked = false;
let cookiesImported = false;
let generateLimit = 0;
let creditUsed = 0; // Diubah dari generateCount menjadi creditUsed
let creditUsageMonitorActive = false;

/**
 * Fungsi untuk memeriksa langganan Freepik dan mendapatkan limit
 * @returns Promise dengan hasil pemeriksaan, limit, dan active_period
 */
function checkFreepikSubscriptionWithLimit(): Promise<{ hasSubscription: boolean, limit: number, active_period?: number, promptBalance?: number }> {
  return new Promise((resolve) => {
    console.log('Checking Freepik subscription with background script...');
    // Kirim pesan ke background script untuk memeriksa langganan
    chrome.runtime.sendMessage({ 
      action: 'checkFreepikSubscription'
    }, (response) => {
      console.log('Received subscription check response:', response);
      
      if (!response) {
        console.error('No response from background script');
        resolve({ hasSubscription: false, limit: 0 });
        return;
      }
      
      if (response.success && response.hasSubscription) {
        // Get prompt balance from response
        const promptBalance = response.promptBalance || 0;
        console.log('Prompt balance from response:', promptBalance);
        
        // Save prompt balance to localStorage
        try {
          localStorage.setItem('pikaso_prompt_balance', promptBalance.toString());
          console.log('Saved prompt balance to localStorage:', promptBalance);
        } catch (e) {
          console.error('Error saving prompt balance to localStorage:', e);
        }
        
        resolve({ 
          hasSubscription: true, 
          limit: response.limit || 0,
          active_period: response.active_period || 1,
          promptBalance: promptBalance
        });
      } else {
        console.log('Subscription check failed or no subscription:', response);
        resolve({ hasSubscription: false, limit: 0 });
      }
    });
  });
}

/**
 * Fungsi untuk memeriksa langganan dan mengimpor cookies jika valid
 */
async function checkSubscriptionAndImportCookies(): Promise<void> {
  // Jika sudah dalam proses atau sudah selesai, jangan lakukan lagi
  if (isProcessing || (subscriptionChecked && (cookiesImported || !hasValidSubscription))) return;
  
  isProcessing = true;
  
  try {
    // Jika langganan belum diperiksa, periksa sekarang
    if (!subscriptionChecked) {
      console.log('Memeriksa langganan Freepik...');
      
      // Periksa apakah pengguna memiliki langganan Freepik dengan limit 30
      const subscriptionData = await checkFreepikSubscriptionWithLimit();
      console.log('Subscription data received:', subscriptionData);
      
      // Set hasValidSubscription berdasarkan response
      hasValidSubscription = subscriptionData.hasSubscription;
      
      // Hitung generate limit menggunakan rumus (active_period x limit) x 6
      if (subscriptionData.hasSubscription && subscriptionData.limit && subscriptionData.active_period) {
        generateLimit = (subscriptionData.active_period * subscriptionData.limit) * 6;
      } else {
        generateLimit = subscriptionData.limit || 0;
      }
      
      // Update generateLimit dari promptBalance jika ada
      if (subscriptionData.promptBalance) {
        generateLimit = Math.max(generateLimit, subscriptionData.promptBalance);
      }
      
      subscriptionChecked = true;
      
      console.log('Hasil pemeriksaan langganan:', hasValidSubscription ? 'Valid' : 'Tidak valid');
      console.log('Generate limit:', generateLimit);
      
      // Ambil credit used dari localStorage jika ada
      try {
        const savedCredit = localStorage.getItem('pikaso_credit_used');
        if (savedCredit) {
          creditUsed = parseInt(savedCredit, 10);
          console.log('Credit used from localStorage:', creditUsed);
        }
      } catch (e) {
        console.error('Error reading credit used from localStorage:', e);
      }
    }
    
    // Jika langganan valid dan cookies belum diimpor, impor sekarang
    if (hasValidSubscription && !cookiesImported) {
      console.log('Valid subscription, proceeding with cookie import');
      
      // Periksa apakah cookies sudah ada di browser
      const hasCookies = checkIfCookiesExist();
      
      if (hasCookies) {
        console.log('Cookies already exist in browser');
        cookiesImported = true;
      } else {
        // Ambil data cookie dari API
        const cookiesData = await fetchCookiesFromAPI();
        
        if (cookiesData && cookiesData.length > 0) {
          // Impor cookies ke browser
          await importCookies(cookiesData[0]);
          console.log('Cookies berhasil diimpor');
          
          cookiesImported = true;
          
          // Simpan status cookiesImported ke localStorage
          try {
            localStorage.setItem('pikaso_cookies_imported', 'true');
            localStorage.setItem('pikaso_cookies_timestamp', Date.now().toString());
          } catch (e) {
            console.error('Error saving to localStorage:', e);
          }
          
          // Refresh halaman agar cookies diterapkan, tapi hanya sekali
          window.location.href = window.location.href + (window.location.search ? '&' : '?') + 'pikaso_refresh=true';
        } else {
          console.error('Tidak ada data cookie yang ditemukan');
          showSubscriptionPopup({
            title: 'Data Cookie Tidak Ditemukan',
            message: 'Maaf, tidak ada data cookie yang tersedia saat ini. Silakan coba lagi nanti atau hubungi kami untuk bantuan.',
            contactUrl: 'https://wa.link/jui1ef'
          });
        }
      }
    } else if (!hasValidSubscription && subscriptionChecked) {
      console.log('Langganan tidak valid, menampilkan popup...');
      
      // Tampilkan popup bahwa langganan tidak valid
      showSubscriptionPopup({
        title: 'Anda memerlukan langganan AI Point',
        message: 'Untuk menikmati fitur AI yang luar biasa, Anda perlu berlangganan AI Point pada Digital Panel. Dapatkan akses penuh dan jelajahi potensi tak terbatas bersama kami!'
      });
    }
  } catch (error) {
    console.error('Error saat memeriksa langganan atau mengimpor cookies:', error);
    
    // Tampilkan popup error
    showSubscriptionPopup({
      title: 'Terjadi Kesalahan',
      message: 'Maaf, terjadi kesalahan saat memeriksa langganan atau mengimpor cookies. Silakan coba lagi nanti atau hubungi kami untuk bantuan.'
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Fungsi untuk mendeteksi ketika pengguna keluar dari halaman pikaso
 */
function setupExitDetection(): void {
  // Periksa URL saat ini, jika bukan di /pikaso, hapus cookies jika pernah diimpor
  if (!window.location.href.includes('/pikaso')) {
    console.log('Not on pikaso page, checking if cookies need to be removed');
    
    // Periksa apakah cookies pernah diimpor
    const cookiesWereImported = checkIfCookiesWereImported();
    
    if (cookiesWereImported) {
      console.log('Cookies were previously imported, removing them');
      
      // Hapus cookies
      removeCookies();
      
      // Hapus status cookies dari localStorage
      try {
        localStorage.removeItem('pikaso_cookies_imported');
        localStorage.removeItem('pikaso_cookies_timestamp');
      } catch (e) {
        console.error('Error removing from localStorage:', e);
      }
    } else {
      console.log('Cookies were never imported, no need to remove');
    }
    
    // Reset status
    cookiesImported = false;
    
    return; // Tidak perlu setup event listeners jika tidak di halaman pikaso
  }
  
  // Gunakan event beforeunload untuk mendeteksi ketika pengguna meninggalkan halaman
  window.addEventListener('beforeunload', async (event) => {
    // Periksa apakah URL saat ini masih mengandung 'pikaso'
    if (!window.location.href.includes('/pikaso')) {
      // Periksa apakah cookies pernah diimpor
      const cookiesWereImported = checkIfCookiesWereImported();
      
      if (cookiesWereImported) {
        console.log('Leaving pikaso page, removing imported cookies');
        // Hapus cookies jika pengguna keluar dari halaman pikaso dan cookies pernah diimpor
        try {
          await removeCookies();
          
          // Hapus status cookies dari localStorage
          localStorage.removeItem('pikaso_cookies_imported');
          localStorage.removeItem('pikaso_cookies_timestamp');
        } catch (error) {
          console.error('Error removing cookies on page unload:', error);
        }
      }
    }
  });
  
  // Gunakan history API untuk mendeteksi perubahan URL
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    checkUrlAndRemoveCookiesIfNeeded();
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    checkUrlAndRemoveCookiesIfNeeded();
  };
  
  // Tambahkan event listener untuk popstate (ketika pengguna menggunakan tombol back/forward)
  window.addEventListener('popstate', () => {
    checkUrlAndRemoveCookiesIfNeeded();
  });
  
  // Fungsi untuk memeriksa URL dan menghapus cookies jika diperlukan
  async function checkUrlAndRemoveCookiesIfNeeded() {
    if (!window.location.href.includes('/pikaso')) {
      console.log('URL changed, no longer on pikaso page');
      
      // Periksa apakah cookies pernah diimpor
      const cookiesWereImported = checkIfCookiesWereImported();
      
      if (cookiesWereImported) {
        console.log('Cookies were previously imported, removing them');
        try {
          // Hapus cookies
          await removeCookies();
          
          // Hapus status cookies dari localStorage
          localStorage.removeItem('pikaso_cookies_imported');
          localStorage.removeItem('pikaso_cookies_timestamp');
        } catch (error) {
          console.error('Error removing cookies on URL change:', error);
        }
      } else {
        console.log('Cookies were never imported, no need to remove');
      }
      
      // Reset status
      cookiesImported = false;
    }
  }
}

/**
 * Fungsi untuk memeriksa apakah cookies sudah ada di browser
 */
function checkIfCookiesExist(): boolean {
  // Periksa localStorage terlebih dahulu
  try {
    const cookiesImported = localStorage.getItem('pikaso_cookies_imported');
    const timestamp = localStorage.getItem('pikaso_cookies_timestamp');
    
    if (cookiesImported === 'true' && timestamp) {
      // Periksa apakah timestamp masih valid (kurang dari 1 jam)
      const now = Date.now();
      const cookieTime = parseInt(timestamp);
      const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik
      
      if (now - cookieTime < oneHour) {
        console.log('Cookies sudah diimpor dalam 1 jam terakhir');
        return true;
      }
    }
  } catch (e) {
    console.error('Error checking localStorage:', e);
  }
  
  // Periksa document.cookie
  const cookies = document.cookie.split(';');
  const freepikCookies = cookies.filter(cookie => {
    const cookieName = cookie.split('=')[0].trim();
    return cookieName.includes('freepik') || 
           cookieName.includes('GR_TOKEN') || 
           cookieName.includes('UID') || 
           cookieName.includes('GRID');
  });
  
  return freepikCookies.length > 0;
}

/**
 * Fungsi untuk memeriksa apakah cookies pernah diimpor
 */
function checkIfCookiesWereImported(): boolean {
  // Periksa variabel global
  if (cookiesImported) {
    return true;
  }
  
  // Periksa localStorage
  try {
    const cookiesImportedFlag = localStorage.getItem('pikaso_cookies_imported');
    if (cookiesImportedFlag === 'true') {
      return true;
    }
  } catch (e) {
    console.error('Error checking localStorage:', e);
  }
  
  return false;
}

/**
 * Fungsi untuk mencari tombol generate
 */
function findGenerateButton(): HTMLButtonElement | null {
  // Coba cari tombol dengan data-cy="generate-button"
  let button = document.querySelector('button[data-cy="generate-button"]') as HTMLButtonElement;
  
  // Jika tidak ditemukan, coba cari tombol dengan data-cy="generate-img-button"
  if (!button) {
    button = document.querySelector('button[data-cy="generate-img-button"]') as HTMLButtonElement;
  }
  
  return button;
}

/**
 * Fungsi untuk memperbarui status tombol generate
 */
function updateGenerateButtonStatus(): void {
  const generateButton = findGenerateButton();
  if (!generateButton) return;

  // Jika credit used sudah mencapai atau melebihi limit, nonaktifkan tombol
  if (creditUsed >= generateLimit) {
    console.log('Credit limit reached, disabling button');
    generateButton.disabled = true;
    generateButton.classList.add('cursor-not-allowed');
    generateButton.classList.add('bg-neutral-800');
    generateButton.classList.add('text-neutral-300');
    generateButton.title = `Limit kredit (${generateLimit}) sudah habis`;
  
  } else {
    console.log(`Credit limit not reached (${creditUsed}/${generateLimit}), button enabled`);
    generateButton.disabled = false;
    generateButton.classList.remove('cursor-not-allowed');
    generateButton.classList.remove('bg-neutral-800');
    generateButton.classList.remove('text-neutral-300');
    generateButton.title = `Sisa kredit: ${generateLimit - creditUsed}`;
  }
}

/**
 * Fungsi untuk mendeteksi dan menangani klik pada tombol generate
 */
function setupGenerateButtonDetection(): void {
  console.log('Setting up generate button detection');
  
  // Mulai monitoring penggunaan kredit jika belum aktif
  if (!creditUsageMonitorActive) {
    console.log('Starting credit usage monitor');
    setupCreditUsageMonitor();
  } else {
    console.log('Credit usage monitor already active');
  }
  
  // Gunakan MutationObserver untuk mendeteksi ketika tombol generate ditambahkan ke DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const generateButton = findGenerateButton();
        if (generateButton) {
          console.log('Generate button found');
          
          // Update status tombol
          updateGenerateButtonStatus();
        }
      }
    }
  });
  
  // Mulai observasi
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Cek apakah tombol sudah ada di DOM
  const existingButton = findGenerateButton();
  if (existingButton) {
    console.log('Generate button already exists');
    updateGenerateButtonStatus();
  }
}

/**
 * Fungsi untuk memonitor penggunaan kredit melalui permintaan API
 */
function setupCreditUsageMonitor(): void {
  // Pastikan kita berada di domain Freepik
  if (!window.location.hostname.includes('freepik.com')) {
    console.log('Not on Freepik domain, skipping credit usage monitor');
    return;
  }
  
  console.log('Setting up credit usage monitor on Freepik domain');
  
  // Tandai monitor sebagai aktif
  creditUsageMonitorActive = true;
  
  // Tidak perlu lagi intercept XMLHttpRequest dan fetch
  // karena sekarang kita menggunakan chrome.webRequest di background script
  console.log('Credit usage monitoring is now handled by background script via chrome.webRequest API');
}

/**
 * Fungsi untuk menginisialisasi ekstensi
 */
function initializeExtension(): void {
  console.log('Freepik Labs content script loaded');
  
  // Reset status saat inisialisasi
  cookiesImported = false;
  
  // Setup deteksi ketika pengguna keluar dari halaman pikaso
  setupExitDetection();
  
  // Setup deteksi tombol generate
  setupGenerateButtonDetection();
  
  
  // Jika bukan di halaman pikaso, tidak perlu melakukan apa-apa lagi
  if (!window.location.href.includes('/pikaso')) {
    console.log('Not on pikaso page, not importing cookies');
    return;
  }
  
  // Periksa apakah ini adalah refresh setelah mengimpor cookies
  const urlParams = new URLSearchParams(window.location.search);
  const isRefresh = urlParams.get('pikaso_refresh');
  
  if (isRefresh === 'true') {
    console.log('Halaman di-refresh setelah mengimpor cookies, tidak perlu mengimpor lagi');
    cookiesImported = true;
    
    // Hapus parameter refresh dari URL
    const newUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, newUrl);
  } else {
    // Periksa langganan dan impor cookies
    checkSubscriptionAndImportCookies();
  }
}

// Jalankan inisialisasi
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Fungsi untuk mereset credit used (bisa dipanggil dari popup atau background)
function resetCreditUsed(): void {
  creditUsed = 0;
  try {
    localStorage.setItem('pikaso_credit_used', '0');
    console.log('Credit used reset to 0');
    
    // Update status tombol jika ada
    const generateButton = findGenerateButton();
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.classList.remove('cursor-not-allowed');
      generateButton.classList.remove('bg-neutral-800');
      generateButton.classList.remove('text-neutral-300');
      generateButton.title = `Sisa kredit: ${generateLimit}`;
    }
  } catch (e) {
    console.error('Error resetting credit used:', e);
  }
}

// Tambahkan listener untuk pesan dari background atau popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'resetGenerateCount' || message.action === 'resetCreditUsed') {
    resetCreditUsed();
    sendResponse({ success: true });
  }
  
  // Handle showInsufficientCreditsPopup message
  if (message.action === 'showInsufficientCreditsPopup') {
    console.log('Showing insufficient credits popup');
    showSubscriptionPopup({
      title: 'Kredit Tidak Mencukupi',
      message: `Kredit yang tersedia (${message.available}) tidak mencukupi untuk operasi ini. Dibutuhkan ${message.required} kredit.`
    });
    sendResponse({ success: true });
  }
  
  // Menangani pesan dari background script tentang consume-credits API
  if (message.action === 'consumeCreditsRequest') {
    console.log('Received consume-credits request data from background:', message.payload);
    console.log('Total credits calculated in background:', message.totalCredits);
    
    // Gunakan totalCredits yang dihitung di background script
    const totalCredits = message.totalCredits;
    
    // Tambahkan kredit yang digunakan ke total
    creditUsed += totalCredits;
    console.log(`Total credits used increased to ${creditUsed}`);
    
    // Simpan total kredit ke localStorage
    try {
      localStorage.setItem('pikaso_credit_used', creditUsed.toString());
    } catch (e) {
      console.error('Error saving credit used to localStorage:', e);
    }
    
    // Periksa apakah sudah mencapai limit kredit
    if (creditUsed >= generateLimit) {
      console.log('Credit limit reached, showing popup');
      
      // Tampilkan popup bahwa limit sudah habis
      showSubscriptionPopup({
        title: 'Limit Kredit Habis',
        message: `Anda telah mencapai limit kredit (${generateLimit}). Silakan upgrade langganan Anda untuk mendapatkan limit lebih banyak.`
      });
    }
    
    // Update status tombol generate jika ada
    const generateButton = findGenerateButton();
    if (generateButton) {
      updateGenerateButtonStatus();
    }
  }
  
  // Menangani pesan dari background script tentang respons consume-credits API
  if (message.action === 'consumeCreditsResponse') {
    console.log('Received consume-credits response from background:', message);
    
    if (message.success) {
      console.log('Credit usage request successful, request ID:', message.requestId);
    } else {
      console.log('Credit usage request failed, status code:', message.statusCode);
    }
  }
  
  // Menangani pesan dari background script tentang error consume-credits API
  if (message.action === 'consumeCreditsError') {
    console.log('Received consume-credits error from background:', message);
    console.log('Error in credit usage request:', message.error);
  }
  
  return true;
});
