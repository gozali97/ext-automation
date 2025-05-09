/**
 * Interface untuk data cookie dari API
 */
export interface CookieData {
  Email: string;
  Cookies: string;
  Headers: string;
  Expired: string;
}

/**
 * Interface untuk cookie yang akan diimpor
 */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

/**
 * Fungsi untuk mengambil data cookie dari API
 * @returns Promise dengan data cookie
 */

/**
 * Load cookies from local JSON file
 * @returns Promise with cookie data
 */
export async function fetchCookiesFromAPI(): Promise<CookieData[]> {
  try {
    console.log('Loading cookies from local file');
    
    // In a browser extension context, we need to use chrome.runtime.getURL
    // to get the correct path to our assets
    const url = chrome.runtime.getURL('assets/cookiesFreepik.json');
    console.log('Attempting to load cookies from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load cookie file: ${response.status}`);
    }
    
    const cookiesData = await response.json();
    
    // Validate the data
    if (!cookiesData || !Array.isArray(cookiesData) || cookiesData.length === 0) {
      throw new Error('Cookie data is empty or invalid');
    }
    
    console.log('Cookies data loaded successfully from local file');
    
    // Map the data to normalize field names
    return cookiesData.map((item: any) => {
      // Create a standardized CookieData object
      const cookieData: CookieData = {
        Email: item.email || item.Email || '',
        Cookies: item.cookies || item.Cookies || '[]',
        Headers: item.Headers || item.headers || '{}',
        Expired: item.Expired || item.expired || ''
      };
      
      return cookieData;
    });
  } catch (error) {
    console.error('Error loading cookies from local file:', error);
    
    // Hardcoded fallback as a last resort
    console.log('Using hardcoded fallback cookie data');
  }
}

// Import fungsi dari BackgroundCommunicator
import { importCookiesViaBackground, removeCookiesViaBackground } from './BackgroundCommunicator';

/**
 * Fungsi untuk mengimpor cookies ke browser
 * @param cookieData Data cookie dari API
 */
export function importCookies(cookieData: CookieData): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Parse cookies string menjadi array cookie
      let cookiesArray: Cookie[];
      
      try {
        // First attempt: direct parsing
        cookiesArray = JSON.parse(cookieData.Cookies);
      } catch (parseError) {
        console.log('Initial JSON parse failed, trying to fix format...', parseError);
        
        try {
          // Second attempt: handle double-escaped JSON
          // Replace escaped quotes and backslashes
          const fixedJson = cookieData.Cookies
            .replace(/\\\\\//g, '/') // Replace \/ with /
            .replace(/\\"/g, '"')     // Replace \" with "
            .replace(/\\\\/g, '\\');  // Replace \\ with \
          
          cookiesArray = JSON.parse(fixedJson);
          console.log('Successfully parsed cookies after fixing format');
        } catch (secondError) {
          console.error('Second parse attempt failed:', secondError);
          
          // Third attempt: try parsing with eval (as a last resort)
          try {
            // This is a potentially risky approach but may work for malformed JSON
            // eslint-disable-next-line no-eval
            const evalResult = eval('(' + cookieData.Cookies + ')');
            if (Array.isArray(evalResult)) {
              cookiesArray = evalResult;
              console.log('Successfully parsed cookies using eval fallback');
            } else {
              throw new Error('Eval result is not an array');
            }
          } catch (evalError) {
            console.error('All parsing attempts failed:', evalError);
            cookiesArray = [];
          }
        }
      }
      
      console.log(`Importing ${cookiesArray.length} cookies`);
      
      // Jika tidak ada cookies, resolve langsung
      if (cookiesArray.length === 0) {
        console.log('No cookies to import');
        resolve();
        return;
      }
      
      // Parse headers jika tersedia
      let headers = {};
      if (cookieData.Headers) {
        try {
          headers = JSON.parse(cookieData.Headers);
          console.log('Headers parsed successfully:', headers);
        } catch (e) {
          console.error('Error parsing headers:', e);
        }
      }
      
      // Coba impor cookies melalui background script
      importCookiesViaBackground(cookiesArray)
        .then(result => {
          console.log('Cookies imported via background script:', result);
          
          if (result.completedCount === 0 && result.errorCount > 0) {
            showErrorPopup('Gagal mengimpor cookies');
          }
          
          resolve();
        })
        .catch(error => {
          console.error('Error importing cookies via background:', error);
          
          // Fallback ke document.cookie jika background script gagal
          try {
            console.log('Mencoba menggunakan document.cookie sebagai fallback');
            
            // Hanya set cookie untuk domain saat ini
            const currentDomain = window.location.hostname;
            
            // Filter cookies yang bisa diset melalui document.cookie (hanya untuk domain saat ini)
            const validCookies = cookiesArray.filter(cookie => {
              return currentDomain.endsWith(cookie.domain.replace(/^\./, ''));
            });
            
            console.log(`Found ${validCookies.length} cookies that can be set via document.cookie`);
            
            // Set cookies menggunakan document.cookie
            validCookies.forEach(cookie => {
              try {
                const cookieStr = `${cookie.name}=${cookie.value}; path=${cookie.path || '/'}`;
                document.cookie = cookieStr;
                console.log(`Set cookie via document.cookie: ${cookieStr}`);
              } catch (e) {
                console.error(`Error setting cookie ${cookie.name} via document.cookie:`, e);
              }
            });
            
            resolve();
          } catch (e) {
            console.error('Error using document.cookie fallback:', e);
            showErrorPopup('Izin Tidak Mencukupi');
            resolve();
          }
        });
    } catch (error) {
      console.error('Error importing cookies:', error);
      reject(error);
    }
  });
}


/**
 * Fungsi untuk menghapus cookies
 */
export function removeCookies(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Removing cookies via background script');
      
      // Coba hapus cookies melalui background script
      removeCookiesViaBackground()
        .then(result => {
          console.log('Cookies removed via background script:', result);
          resolve();
        })
        .catch(error => {
          console.error('Error removing cookies via background:', error);
          
          // Fallback ke document.cookie jika background script gagal
          try {
            console.log('Mencoba menggunakan document.cookie sebagai fallback untuk menghapus cookies');
            
            // Definisikan paths dan domains
            const paths = ['/', '/pikaso', '/user', '/profile', '/account'];
            const domains = ['www.freepik.com', '.www.freepik.com', 'freepik.com', '.freepik.com'];
            
            // Fokus pada penghapusan cookies GR_REFRESH dan GR_TOKEN
            const importantCookies = ['GR_REFRESH', 'GR_TOKEN'];
            console.log(`Focusing on removing important cookies: ${importantCookies.join(', ')}`);
            
            // Hapus cookies penting dengan berbagai kombinasi domain dan path
            importantCookies.forEach(cookieName => {
              // Hapus dengan domain .freepik.com dan path /
              document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.freepik.com`;
              console.log(`Removed cookie with specific domain/path: ${cookieName}`);
              
              // Coba juga dengan berbagai kombinasi lain
              paths.forEach(path => {
                domains.forEach(domain => {
                  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain}`;
                });
                // Juga coba tanpa domain
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
              });
              
              // Coba dengan atribut tambahan
              document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.freepik.com; secure=false; samesite=none`;
              document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.freepik.com; secure=false`;
              
              console.log(`Explicitly removed important cookie: ${cookieName}`);
            });
            
            resolve();
          } catch (e) {
            console.error('Error using document.cookie fallback for removal:', e);
            resolve();
          }
        });
    } catch (error) {
      console.error('Error removing cookies:', error);
      resolve(); // Resolve daripada reject untuk mencegah crash
    }
  });
}

/**
 * Fungsi untuk memeriksa apakah pengguna memiliki langganan Freepik dengan limit 30
 * @returns Promise dengan hasil pemeriksaan
 */
export function checkFreepikSubscription(): Promise<boolean> {
  return new Promise((resolve) => {
    // Kirim pesan ke background script untuk memeriksa langganan
    chrome.runtime.sendMessage({ 
      action: 'checkFreepikSubscription'
    }, (response) => {
      if (!response) {
        console.error('No response from background script');
        resolve(false);
        return;
      }
      
      if (response.success && response.hasSubscription && response.limit >= 30) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Fungsi untuk menampilkan popup error ketika cookies API tidak tersedia
 */
function showErrorPopup(title: string = 'Izin Tidak Mencukupi'): void {
  // Cek apakah fungsi showSubscriptionPopup tersedia
  try {
    // Import secara dinamis untuk menghindari circular dependency
    import('~components/freepik/SubscriptionPopup').then(({ showSubscriptionPopup }) => {
      showSubscriptionPopup({
        title: title,
        message: 'chrome.cookies API tidak tersedia. Pastikan izin cookies dan host_permissions sudah ditambahkan di manifest.'
      });
    }).catch(err => {
      console.error('Error importing SubscriptionPopup:', err);
    });
  } catch (error) {
    console.error('Error showing error popup:', error);
    
    // Fallback jika import gagal, tampilkan alert sederhana
    alert('chrome.cookies API tidak tersedia. Pastikan izin cookies dan host_permissions sudah ditambahkan di manifest.');
  }
}
