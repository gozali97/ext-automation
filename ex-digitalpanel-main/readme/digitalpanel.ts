// Content script for app.digitalpanel.id
// This script checks for a token in localStorage and handles redirection to signin page if needed

export {}

// Function to check and store token from localStorage
function checkAndStoreToken() {
  console.log("Checking for token in digitalpanel.id localStorage");
  
  // Find all possible token keys
  const tokenKeys = ['token', 'accessToken', 'access_token', 'authToken', 'auth_token'];
  let token = null;
  let tokenSource = null;
  
  // Try each possible token key
  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      token = value;
      tokenSource = key;
      console.log(`Found token with key "${key}" in localStorage`);
      break;
    }
  }
  
  // If still no token, check for user object which might contain token
  if (!token) {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
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
      }
    );
    
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
      console.log("On digitalpanel domain without token - redirecting to signin");
      window.location.href = 'https://app.digitalpanel.id/signin';
    }
    
    return false;
  }
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

// Listen for messages from popup to check for token
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkTokenInPage') {
    console.log("Received request to check token in page");
    const hasToken = checkAndStoreToken();
    sendResponse({ success: hasToken });
  }
  return true;
});

// Ensure this script only runs on digitalpanel domain
if (window.location.hostname.includes('digitalpanel.id')) {
  console.log("Running digitalpanel content script on correct domain");
  
  // Run the function when page loads
  checkAndStoreToken();
  
  // Add event listener for localStorage changes
  window.addEventListener('storage', (event) => {
    // Check for token on any localStorage change that could be related to auth
    const tokenRelatedKeys = ['token', 'user', 'accessToken', 'access_token', 'auth', 'login', 'session'];
    if (tokenRelatedKeys.some(key => event.key?.includes(key))) {
      console.log(`localStorage changed for key: ${event.key}`);
      checkAndStoreToken();
    }
  });
  
  // Check token whenever page changes (for SPAs)
  let lastUrl = location.href; 
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log("URL changed, checking for token");
      checkAndStoreToken();
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Add event listener for login success
  document.addEventListener('login-success', () => {
    console.log("Login success event detected");
    setTimeout(() => {
      checkAndStoreToken();
      // Return to original tab after successful login
      chrome.runtime.sendMessage({ action: 'returnToOriginalTab' });
    }, 1000); // Wait a bit for token to be stored in localStorage
  });
  
  // Add event listener for login form
  if (window.location.href.includes('/signin')) {
    const checkForLoginForm = setInterval(() => {
      const loginForm = document.querySelector('form');
      if (loginForm) {
        clearInterval(checkForLoginForm);
        loginForm.addEventListener('submit', () => {
          console.log("Login form submitted");
          // Wait for login process to complete
          setTimeout(() => {
            checkAndStoreToken();
            // Try to return to original tab after successful login
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'returnToOriginalTab' });
            }, 1000);
          }, 2000);
        });
      }
    }, 500);
  }

  // Listen for storage changes
  window.addEventListener('storage', (event) => {
    if (event.key === 'user') {
      checkAndStoreUserInfo();
    }
  });

  // Check on initial load
  checkAndStoreUserInfo();
} else {
  console.log("Not running digitalpanel content script on non-digitalpanel domain");
} 