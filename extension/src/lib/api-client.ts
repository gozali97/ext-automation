// api-client.ts - Klien API untuk berkomunikasi dengan backend Node.js
import type { WebsiteConfig, LoginResponse, LogoutResponse, TestCase } from "../types";

// URL backend
const API_BASE_URL = "http://localhost:3000/api";

/**
 * Memeriksa status server backend
 * @returns Status server
 */
export async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`);
    return await response.json();
  } catch (error) {
    console.error("Error checking server status:", error);
    return {
      status: "offline",
      message: "Tidak dapat terhubung ke server",
      error: error.message
    };
  }
}

/**
 * Melakukan login melalui backend
 * @param config - Konfigurasi website
 * @returns Hasil login
 */
export async function performLogin(config: WebsiteConfig): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ websiteConfig: config })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Melakukan logout melalui backend
 * @param config - Konfigurasi website
 * @returns Hasil logout
 */
export async function performLogout(config: WebsiteConfig): Promise<LogoutResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ websiteConfig: config })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Logout error:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Menjalankan test case melalui backend
 * @param config - Konfigurasi website
 * @param testCases - Daftar test case yang akan dijalankan
 * @returns Hasil test
 */
export async function runTests(config: WebsiteConfig, testCases: TestCase[]) {
  try {
    const response = await fetch(`${API_BASE_URL}/run-tests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        websiteConfig: config,
        testCases: testCases.filter(test => test.enabled)
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Test execution error:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Mendapatkan hasil test sebelumnya
 * @returns Daftar hasil test
 */
export async function getTestResults() {
  try {
    const response = await fetch(`${API_BASE_URL}/results`);
    return await response.json();
  } catch (error) {
    console.error("Error getting test results:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Melakukan scraping pada halaman web
 * @param url - URL halaman web yang akan di-scrape
 * @param options - Opsi scraping
 * @returns Hasil scraping
 */
export async function scrapeWebsite(url: string, options: any = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url, options })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Scraping error:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Melakukan scraping pada halaman web yang memerlukan autentikasi
 * @param config - Konfigurasi website
 * @param options - Opsi scraping
 * @returns Hasil scraping
 */
export async function scrapeAuthWebsite(config: WebsiteConfig, options: any = {}) {
  try {
    // Jika website menggunakan Basic Auth, tambahkan ke options
    if (config.hasBasicAuth && config.basicAuth) {
      options.basicAuth = config.basicAuth;
    }
    
    const response = await fetch(`${API_BASE_URL}/scrape-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ websiteConfig: config, options })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Authenticated scraping error:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Mengeksekusi Google login test melalui endpoint khusus
 * @param config - Konfigurasi website
 * @param test - Test case Google login
 * @returns Hasil test
 */
export async function executeGoogleTest(config: WebsiteConfig, test: TestCase) {
  try {
    const response = await fetch(`${API_BASE_URL}/execute-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        websiteConfig: config,
        test
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Google login test execution error:", error);
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}

/**
 * Menutup browser yang masih terbuka di backend
 * @returns Status penutupan browser
 */
export async function closeBrowser() {
  try {
    // Use a timeout to prevent hanging if the server doesn't respond
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${API_BASE_URL}/close-browser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal
    }).catch(err => {
      // If the error is because the server closed the connection after browser closed,
      // consider this a success
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
        console.log('Browser likely closed successfully, connection terminated');
        return new Response(JSON.stringify({
          success: true,
          message: "Browser likely closed successfully"
        }));
      }
      throw err;
    });
    
    clearTimeout(timeoutId);
    
    // If we get here, the server responded normally
    return await response.json();
  } catch (error) {
    console.error("Close browser error:", error);
    
    // If the error is because the connection was closed, consider it a success
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      return {
        success: true,
        message: "Browser likely closed successfully, connection terminated"
      };
    }
    
    return {
      success: false,
      error: `Tidak dapat terhubung ke server: ${error.message}`
    };
  }
}
