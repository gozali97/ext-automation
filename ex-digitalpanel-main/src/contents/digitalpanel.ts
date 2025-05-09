import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["*://*.digitalpanel.id/*"],
  all_frames: true
}

// Variabel global
let observers: { popup: MutationObserver | null } = { popup: null };
let intervals: { buttonCheck: number | null } = { buttonCheck: null };

// Versi sederhana dari content script untuk app.digitalpanel.id

// Flag untuk mencegah multiple calls bersamaan
let isCheckingToken = false;
let tokenCheckThrottle: number | null = null;

// Simpan token terakhir yang dikirim untuk mencegah pengiriman berulang
let lastSentToken: string | null = null;
let lastTokenSentTime = 0;
const TOKEN_SEND_COOLDOWN = 3600000; // 1 jam cooldown (1/24 dari periode pembaruan 24 jam)

// Function to check and store token from localStorage
function checkAndStoreToken() {
  // Prevent concurrent checks
  if (isCheckingToken) {
    console.log("Already checking token, skipping");
    return false;
  }
  
  isCheckingToken = true;
  console.log("Checking for token in localStorage, hostname:", window.location.hostname);
  
  // Debug: Log all localStorage keys
  console.log("All localStorage keys:", Object.keys(localStorage));
  
  // Find all possible token keys
  const tokenKeys = ['token', 'accessToken', 'access_token', 'authToken', 'auth_token', 'jwt'];
  let token = null;
  let tokenSource = null;
  
  // Try each possible token key
  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`Found token with key "${key}"`, value);
      token = value;
      tokenSource = key;
      break;
    }
  }
  
  // If still no token, check for user object which might contain token
  if (!token) {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        console.log("Found user data:", userData);
        const user = JSON.parse(userData);
        if (user && user.token) {
          token = user.token;
          tokenSource = 'user.token';
          console.log('Found token in user object');
        } else if (user && user.access_token) {
          token = user.access_token;
          tokenSource = 'user.access_token';
          console.log('Found access_token in user object');
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }
  
  if (token) {
    // Cek apakah token sama dengan yang terakhir dikirim dan masih dalam cooldown
    const now = Date.now();
    const isSameToken = token === lastSentToken;
    const isWithinCooldown = now - lastTokenSentTime < TOKEN_SEND_COOLDOWN;
    
    if (isSameToken && isWithinCooldown) {
      console.log('Token sama dengan yang terakhir dikirim dan masih dalam cooldown, melewati pengiriman');
      isCheckingToken = false;
      return true;
    }
    
    // Update token terakhir dan waktu pengiriman
    lastSentToken = token;
    lastTokenSentTime = now;
    
    // If token found, send to background script for storage
    chrome.runtime.sendMessage(
      { action: 'storeToken', token, source: `localStorage-${tokenSource}` },
      (response) => {
        if (response && response.success) {
          console.log('Token successfully sent to background script');
          
          // If on signin page and token found, return to original tab
          if (window.location.href.includes('/signin')) {
            chrome.runtime.sendMessage({ action: 'returnToOriginalTab' });
          }
        }
        
        // Reset flag after operation completes
        isCheckingToken = false;
      }
    );
    
    // Tambahkan timeout untuk reset flag jika callback tidak dipanggil
    setTimeout(() => {
      if (isCheckingToken) {
        console.log('Token check timeout, resetting flag');
        isCheckingToken = false;
      }
    }, 5000); // 5 detik timeout
    
    // Also try to get user ID if available
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.id) {
          chrome.runtime.sendMessage(
            { action: 'storeUserInfo', userId: user.id },
            (response) => {
              if (response && response.success) {
                console.log('User ID successfully sent to background script');
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    
    return true;
  } else {
    console.log('No token found in localStorage');
    
    // ONLY redirect if we're on digitalpanel.id domain but not on signin page
    if (window.location.hostname.includes('digitalpanel.id') && !window.location.href.includes('/signin')) {
      // Check if we've redirected too many times
      const redirectCount = parseInt(sessionStorage.getItem('dp_redirect_count') || '0');
      const lastRedirectTime = parseInt(sessionStorage.getItem('dp_last_redirect') || '0');
      const now = Date.now();
      
      // Reset counter if last redirect was more than 5 minutes ago
      if (now - lastRedirectTime > 5 * 60 * 1000) {
        sessionStorage.setItem('dp_redirect_count', '0');
        sessionStorage.setItem('dp_last_redirect', now.toString());
      }
      
      // Only redirect if we haven't exceeded max redirects (e.g., 3 times in 5 minutes)
      if (redirectCount < 3) {
        console.log("On digitalpanel domain without token - redirecting to signin");
        sessionStorage.setItem('dp_redirect_count', (redirectCount + 1).toString());
        sessionStorage.setItem('dp_last_redirect', now.toString());
        window.location.href = 'https://app.digitalpanel.id/signin';
      } else {
        console.error("Too many redirects, stopping redirect loop");
        // Optionally show error message to user
      }
    }
    
    // Reset flag
    isCheckingToken = false;
    return false;
  }
}

// Throttled version of checkAndStoreToken
function throttledCheckAndStoreToken() {
  // Clear any existing throttle
  if (tokenCheckThrottle) {
    clearTimeout(tokenCheckThrottle);
  }
  
  // Set throttle to prevent multiple checks
  tokenCheckThrottle = setTimeout(() => {
    // Cek apakah sudah ada token yang dikirim dalam 5 detik terakhir
    const now = Date.now();
    if (now - lastTokenSentTime < 5000) {
      console.log('Throttling: token check terlalu sering, melewati');
      tokenCheckThrottle = null;
      return;
    }
    
    checkAndStoreToken();
    tokenCheckThrottle = null;
  }, 500) as unknown as number; // Tambah throttle delay dari 300ms ke 500ms
}

// Function to check and store user info
function checkAndStoreUserInfo() {
  // Check if user info exists in localStorage
  const userInfo = localStorage.getItem('user');
  if (userInfo) {
    try {
      const user = JSON.parse(userInfo);
      if (user && user.id) {
        // Store user ID in extension storage
        chrome.runtime.sendMessage({
          action: 'storeUserInfo',
          userId: user.id.toString()
        }, (response) => {
          if (response && response.success) {
            console.log('User ID stored successfully');
          } else {
            console.error('Failed to store user ID');
          }
        });
      }
    } catch (error) {
      console.error('Error parsing user info:', error);
    }
  }
}

// Function to clear tokens from localStorage
function clearTokensFromPage() {
  console.log("Clearing tokens from digitalpanel.id localStorage");
  
  // Reset token tracking variables
  lastSentToken = null;
  lastTokenSentTime = 0;
  
  // Clear all possible token keys
  const tokenKeys = ['token', 'accessToken', 'access_token', 'authToken', 'auth_token'];
  let tokensCleared = false;
  
  // Try each possible token key
  for (const key of tokenKeys) {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`Removed token with key "${key}" from localStorage`);
      tokensCleared = true;
    }
  }
  
  // Also check for user object which might contain token
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      localStorage.removeItem('user');
      console.log('Removed user object from localStorage');
      tokensCleared = true;
    }
  } catch (error) {
    console.error('Error removing user data:', error);
  }
  
  return tokensCleared;
}

// Listen for messages from popup to check for token or clear tokens
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkTokenInPage') {
    console.log("Received request to check token in page");
    const hasToken = checkAndStoreToken();
    sendResponse({ success: hasToken });
  } 
  else if (message.action === 'clearTokensFromPage') {
    console.log("Received request to clear tokens from page");
    const cleared = clearTokensFromPage();
    sendResponse({ success: cleared });
    
    // Reload the page to ensure UI updates correctly
    if (cleared) {
      console.log("Tokens cleared, reloading page");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }
  return true;
});

// Ensure this script only runs on digitalpanel domain
if (window.location.hostname.includes('digitalpanel.id')) {
  console.log("Running content script on:", window.location.hostname);
  
  // Run the function when page loads
  setTimeout(() => {
    console.log("Checking token after page load");
    checkAndStoreToken();
  }, 2000); // Tunggu 2 detik setelah page load
  
  // Add event listener for localStorage changes
  window.addEventListener('storage', (event) => {
    // Check for token on any localStorage change that could be related to auth
    const tokenRelatedKeys = ['token', 'user', 'accessToken', 'access_token', 'auth', 'login', 'session', 'jwt'];
    if (tokenRelatedKeys.some(key => event.key?.includes(key))) {
      console.log(`localStorage changed for key: ${event.key}`);
      throttledCheckAndStoreToken();
    }
  });

  // Add event listener for login form specifically for https://api.digitalpanel.id
  if (window.location.hostname.includes('digitalpanel.id') && window.location.href.includes('/signin')) {
    console.log("Setting up login form listener for digitalpanel.id");
    const checkForLoginForm = setInterval(() => {
      const loginForm = document.querySelector('form');
      if (loginForm) {
        clearInterval(checkForLoginForm);
        console.log("Found login form, adding submit listener");
        loginForm.addEventListener('submit', () => {
          console.log("Login form submitted on digitalpanel.id");
          // Wait for login process to complete
          setTimeout(() => {
            console.log("Checking for token after login submission");
            checkAndStoreToken();
            // Try to return to original tab after successful login
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'returnToOriginalTab' });
              chrome.runtime.sendMessage({ action: 'reloadSidePanel' });
            }, 1000);
          }, 2000);
        });
      }
    }, 500);
  }

  // Check token whenever page changes (for SPAs)
  let lastUrl = location.href; 
  
  // Use a more targeted MutationObserver
  const observer = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log("URL changed, checking for token");
      setTimeout(() => {
        checkAndStoreToken();
      }, 1000);
    }
  });
  
  // Observe only body instead of entire document
  const targetNode = document.body || document.documentElement;
  observer.observe(targetNode, { 
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  // Initial check for user info
  setTimeout(() => {
    console.log("Performing initial user info check");
    checkAndStoreUserInfo();
  }, 1500);
} else {
  console.log("Not running content script on non-matching domain:", window.location.hostname);
}
