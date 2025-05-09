import { Storage } from "@plasmohq/storage"
import type { WebsiteConfig, WebsiteInfo, LoginResponse, TestCase, LoginInfo, LogoutResponse } from "./types"
import { performLogout as performLogoutUtil, handleLogoutMessage } from "./logout-utils"
import { 
  getAPIToken, 
  saveAPIToken, 
  removeAPIToken, 
  isAPIEndpoint, 
  makeAuthenticatedRequest 
} from "./lib/api-utils"

const storage = new Storage()
let debugMode = true

// Debug logging function
const debugLog = (...args: any[]) => {
  if (debugMode) {
    console.log("[Debug]", ...args)
  }
}

// Store network requests for analysis
let networkRequests = new Map<string, any[]>()

// Function to initialize navigation monitoring
function initializeNavigationMonitoring() {
  debugLog("Initializing navigation monitoring")
  
  // Monitor form submissions through content script messages
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'FORM_SUBMIT' && sender.tab?.id) {
      debugLog('Form submission captured:', message.data)
      const requests = networkRequests.get(sender.tab.id.toString()) || []
      requests.push({
        type: 'form_submit',
        ...message.data,
        timestamp: Date.now()
      })
      networkRequests.set(sender.tab.id.toString(), requests)
    }
    return true
  })

  // Monitor navigation events
  if (chrome.webNavigation) {
    chrome.webNavigation.onCompleted.addListener((details) => {
      debugLog("Navigation completed:", details)
      const requests = networkRequests.get(details.tabId.toString()) || []
      requests.push({
        type: 'navigation',
        url: details.url,
        timestamp: Date.now()
      })
      networkRequests.set(details.tabId.toString(), requests)
    })
  }
}

// Initialize monitoring when extension loads
initializeNavigationMonitoring()

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  debugLog("Extension icon clicked")
  if (chrome.sidePanel) {
    await chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

// Function to get website info
async function getWebsiteInfo(tab: chrome.tabs.Tab): Promise<WebsiteInfo | null> {
  if (!tab.url) return null

  try {
    const url = new URL(tab.url)
    return {
      url: tab.url,
      hostname: url.hostname,
      favicon: tab.favIconUrl || `${url.origin}/favicon.ico`,
      title: tab.title || url.hostname,
      isLoginPage: url.pathname.toLowerCase().includes('login') ||
                  url.pathname.toLowerCase().includes('signin') ||
                  url.pathname.toLowerCase().includes('auth')
    }
  } catch (error) {
    console.error("Error getting website info:", error)
    return null
  }
}

// Function to ensure URL has protocol
function ensureUrlProtocol(url: string): string {
  if (!url.startsWith('http')) {
    return `https://${url}`
  }
  return url
}

// Function to request permissions for a tab
async function requestTabPermissions(tab: chrome.tabs.Tab): Promise<boolean> {
  try {
    // Request host permission for the current tab
    const origin = new URL(tab.url).origin;
    const granted = await chrome.permissions.request({
      origins: [origin + "/*"]
    });
    
    if (!granted) {
      debugLog("Permissions not granted for:", origin);
      return false;
    }
    
    return true;
  } catch (error) {
    debugLog("Error requesting permissions:", error);
    return false;
  }
}

// Function to check if scripting API is available and request it if not
async function ensureScriptingPermission(): Promise<boolean> {
  // Check if scripting API exists
  if (!chrome.scripting) {
    debugLog("chrome.scripting API not available. Make sure it's included in manifest permissions.");
    return false;
  }

  try {
    // Try to explicitly request scripting permission (in case it's there but not granted)
    const granted = await chrome.permissions.request({
      permissions: ['scripting']
    });
    
    if (!granted) {
      debugLog("Scripting permission explicitly denied by user");
      return false;
    }
    
    debugLog("Scripting permission explicitly granted");
    return true;
  } catch (error) {
    debugLog("Error requesting scripting permission:", error);
    return false;
  }
}

// Function to inject content script manually if scripting API is not available
async function injectContentScriptManually(tab: chrome.tabs.Tab): Promise<boolean> {
  try {
    if (!tab.id) return false;
    
    // Try using executeScript from tabs API (older way)
    await chrome.tabs.executeScript(tab.id, {
      code: `
        if (!window.formInterceptorInjected) {
          window.formInterceptorInjected = true;
          
          // Simple form interceptor functionality
          function interceptForms() {
            console.log("Manual form interceptor injected");
            const form = document.querySelector('form');
            if (!form) {
              console.error("No form found on page");
              return;
            }
            
            // Find inputs
            const usernameInput = form.querySelector('input[name="LoginForm[username]"], input[type="text"], input[type="email"], input[name*="username"], input[name*="email"]');
            const passwordInput = form.querySelector('input[name="LoginForm[password]"], input[type="password"]');
            const submitButton = form.querySelector('input[name="yt0"], button[type="submit"], input[type="submit"]');
            
            if (!usernameInput || !passwordInput || !submitButton) {
              console.error("Could not find all required form elements");
              return;
            }
            
            // We'll receive a message with credentials
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
              if (message.type === 'FILL_LOGIN_FORM') {
                console.log("Filling form manually");
                
                // Fill credentials
                usernameInput.value = message.config.credentials.identifier;
                passwordInput.value = message.config.credentials.password;
                
                // Click submit
                submitButton.click();
                
                // Report success and form action
                const formAction = form.action || window.location.href;
                sendResponse({ 
                  success: true, 
                  formAction: formAction,
                  url: window.location.origin
                });
                
                return true;
              }
            });
          }
          
          // Run on document ready
          if (document.readyState === "complete") {
            interceptForms();
          } else {
            document.addEventListener("DOMContentLoaded", interceptForms);
          }
        }
      `
    });
    
    debugLog("Manually injected content script");
    return true;
  } catch (error) {
    debugLog("Failed to manually inject content script:", error);
    return false;
  }
}

// Update the existing checkScriptingPermission function
async function checkScriptingPermission(): Promise<boolean> {
  if (!chrome.scripting) {
    debugLog("chrome.scripting API not available. Make sure it's included in manifest permissions.");
    return false;
  }
  
  // Check if we have access to executeScript method
  if (typeof chrome.scripting.executeScript !== 'function') {
    debugLog("chrome.scripting.executeScript function not available.");
    return false;
  }
  
  return true;
}

// Function to detect login URL and form info from current page (with fallback)
async function detectLoginInfo(tab: chrome.tabs.Tab): Promise<{ loginUrl: string, formInfo: any } | null> {
  if (!tab.id || !tab.url) return null;

  try {
    // Try to ensure we have scripting permission
    await ensureScriptingPermission();
    
    // Check if scripting API is available
    const hasScriptingApi = await checkScriptingPermission();
    if (!hasScriptingApi) {
      debugLog("chrome.scripting API not available, using fallback approach");
      
      // Fallback: manually inject our script and extract basic info
      const injected = await injectContentScriptManually(tab);
      if (!injected) {
        throw new Error("Could not inject content script manually");
      }
      
      // Use tab URL to construct a basic formInfo
      const url = new URL(tab.url);
      const isK24 = url.hostname.includes('project.k24.co.id');
      
      // Create a basic form info with best guesses
      const formInfo = {
        action: isK24 ? `${url.origin}/scp` : `${url.origin}/login`,
        method: 'POST',
        inputs: []
      };
      
      return {
        loginUrl: formInfo.action,
        formInfo
      };
    }

    // Request permissions first
    const hasPermission = await requestTabPermissions(tab);
    if (!hasPermission) {
      throw new Error("Permission denied for the current website");
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const form = document.querySelector('form');
        if (!form) return null;

        // Get form details
        const formAction = (form as HTMLFormElement).action || window.location.href;
        
        // Special handling for project.k24.co.id
        let absoluteAction = formAction;
        if (window.location.hostname.includes('project.k24.co.id')) {
          // If form action is relative (e.g., "/scp"), make it absolute
          if (formAction.startsWith('/')) {
            absoluteAction = `${window.location.origin}${formAction}`;
          } else if (!formAction.startsWith('http')) {
            absoluteAction = `${window.location.origin}/${formAction}`;
          }
        } else {
          // For other sites, ensure the action URL is absolute
          absoluteAction = new URL(formAction, window.location.href).href;
        }
        
        const formInfo = {
          action: absoluteAction,
          method: (form as HTMLFormElement).method || 'POST',
          inputs: Array.from(form.querySelectorAll('input')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          }))
        };
        
        return {
          loginUrl: absoluteAction,
          formInfo
        };
      }
    });

    debugLog("Detected login info:", result[0]?.result);
    return result[0]?.result || null;
  } catch (error) {
    debugLog("Error detecting login info:", error);
    
    // Fallback: return a basic form info based on the URL
    if (tab.url) {
      const url = new URL(tab.url);
      const isK24 = url.hostname.includes('project.k24.co.id');
      
      const formInfo = {
        action: isK24 ? `${url.origin}/scp` : `${url.origin}/login`,
        method: 'POST',
        inputs: []
      };
      
      return {
        loginUrl: formInfo.action,
        formInfo
      };
    }
    
    return null;
  }
}

// Function to perform login
async function performLogin(tab: chrome.tabs.Tab, config: WebsiteConfig): Promise<LoginResponse> {
  try {
    // Check if this is an API endpoint using utility function
    if (isAPIEndpoint(config.url)) {
      console.log("Detected API endpoint, using direct API login");
      return await performAPILogin(config);
    }

    // If we're not on the login page and login URL is configured, navigate to it
    const websiteInfo = await getWebsiteInfo(tab)
    if (websiteInfo && !websiteInfo.isLoginPage) {
      let loginUrl = config.loginUrl

      if (!loginUrl) {
        // Try to detect the login URL
        const loginInfo = await detectLoginInfo(tab)
        if (loginInfo) {
          loginUrl = loginInfo.formInfo.action
        } else {
          // If we can't detect it, use the default
          const configUrl = new URL(config.url)
          loginUrl = `${configUrl.origin}/auth/login`
        }
      } else {
        // Ensure the login URL is from the same origin
        const configUrl = new URL(config.url)
        loginUrl = loginUrl.startsWith('http') 
          ? loginUrl 
          : `${configUrl.origin}${loginUrl.startsWith('/') ? '' : '/'}${loginUrl}`
      }

      await chrome.tabs.update(tab.id, { url: loginUrl })
      
      // Wait for page load
      return new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener)
            // Now perform the login
            performLoginOnPage(tab, config).then(resolve)
          }
        })
      })
    }

    return performLoginOnPage(tab, config)
  } catch (error) {
    console.error("Login error:", error)
    return {
      success: false,
      error: "Failed to perform login"
    }
  }
}

// Function to perform login on the current page
async function performLoginOnPage(tab: chrome.tabs.Tab, config: WebsiteConfig): Promise<LoginResponse> {
  if (!tab.id) return { success: false, error: "Invalid tab" }

  try {
    // Check if scripting API is available
    const hasScriptingApi = await checkScriptingPermission();
    
    if (!hasScriptingApi) {
      debugLog("chrome.scripting API not available, using fallback approach");
      
      // Try to inject our script manually
      const injected = await injectContentScriptManually(tab);
      if (!injected) {
        throw new Error("Could not inject content script manually");
      }
      
      // Send credentials directly to the page
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'FILL_LOGIN_FORM',
        config
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to fill login form');
      }
      
      return {
        success: true,
        message: "Login attempted using fallback method"
      };
    }

    // Inject the form interceptor content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contents/formInterceptor.js']
      });
    } catch (scriptError) {
      debugLog("Error injecting content script:", scriptError);
      throw new Error("Failed to inject login script. Make sure 'scripting' permission is in manifest.json");
    }

    // Send credentials to the content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_LOGIN_FORM',
      config
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to fill login form');
    }

    // Wait for login completion or error
    return new Promise((resolve) => {
      const listener = (message: any, sender: chrome.runtime.MessageSender) => {
        if (sender.tab?.id !== tab.id) return

        if (message.type === 'LOGIN_COMPLETED') {
          chrome.runtime.onMessage.removeListener(listener)
          resolve({
            success: message.success,
            error: message.success ? undefined : 'Login failed'
          })
        }

        if (message.type === 'LOGIN_ERROR') {
          chrome.runtime.onMessage.removeListener(listener)
          resolve({
            success: false,
            error: message.error
          })
        }
      }

      chrome.runtime.onMessage.addListener(listener)

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener)
        resolve({
          success: false,
          error: 'Login timeout'
        })
      }, 30000)
    })
  } catch (error) {
    console.error("Login script error:", error)
    return {
      success: false,
      error: error.message || "Failed to execute login script"
    }
  }
}

// Function to check authentication status
async function checkAuthStatus(tab: chrome.tabs.Tab) {
  if (!tab.url) return { isAuthenticated: false }

  try {
    const config = await storage.get<WebsiteConfig>("config")
    const websiteInfo = await getWebsiteInfo(tab)
    
    if (!config || !websiteInfo) {
      return { 
        isAuthenticated: false,
        currentWebsite: websiteInfo
      }
    }

    try {
      const tabUrl = new URL(tab.url)
      const configUrl = new URL(config.url)

      // Check if domains match
      if (tabUrl.hostname !== configUrl.hostname) {
        return { 
          isAuthenticated: false,
          currentWebsite: websiteInfo,
          error: "Current tab doesn't match configured website"
        }
      }

      // Get saved login info
      const loginInfo = await storage.get<LoginInfo>('lastLoginInfo')
      const savedCookies = await storage.get('savedCookies')

      // Check if we have valid login info and cookies
      const isAuthenticated = loginInfo && savedCookies && 
        document.cookie.split(';').some(cookie => 
          savedCookies.includes(cookie.trim())
        )

      return {
        isAuthenticated,
        website: configUrl.hostname,
        currentWebsite: websiteInfo,
        lastLogin: loginInfo?.timestamp
      }
    } catch (urlError) {
      console.error("Invalid URL:", urlError)
      return {
        isAuthenticated: false,
        currentWebsite: websiteInfo,
        error: "Invalid URL format"
      }
    }
  } catch (error) {
    console.error("Error checking auth status:", error)
    return { 
      isAuthenticated: false,
      error: "Failed to check authentication status"
    }
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const authStatus = await checkAuthStatus(tab)
    
    // Broadcast website and authentication state
    try {
      await chrome.runtime.sendMessage({
        type: "AUTH_STATE_CHANGED",
        payload: authStatus
      })
    } catch (e) {
      // Ignore message sending errors when no receivers
      if (!e.message.includes("Could not establish connection")) {
        console.error("Error sending message:", e)
      }
    }
  }
})

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (tab.url) {
    const authStatus = await checkAuthStatus(tab)
    
    // Broadcast website and authentication state
    try {
      await chrome.runtime.sendMessage({
        type: "AUTH_STATE_CHANGED",
        payload: authStatus
      })
    } catch (e) {
      // Ignore message sending errors when no receivers
      if (!e.message.includes("Could not establish connection")) {
        console.error("Error sending message:", e)
      }
    }
  }
})

// Function to run tests
async function runTests(tests: TestCase[], tab: chrome.tabs.Tab): Promise<Record<string, any>> {
  const results: Record<string, any> = {}

  for (const test of tests) {
    try {
      switch (test.type) {
        case 'login':
          const config = await storage.get<WebsiteConfig>("config")
          if (!config) throw new Error('No configuration found')
          
          const loginResult = await performLogin(tab, config)
          results[test.id] = loginResult
          break

        case 'fillForm':
          // Inject form test script
          const formResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const forms = document.querySelectorAll('form')
              const formData: Record<string, any> = {}

              forms.forEach((form, index) => {
                const inputs = form.querySelectorAll('input, select, textarea')
                formData[`form_${index}`] = {
                  action: (form as HTMLFormElement).action,
                  method: (form as HTMLFormElement).method,
                  fields: Array.from(inputs).map(input => ({
                    type: (input as HTMLInputElement).type,
                    name: (input as HTMLInputElement).name,
                    id: input.id,
                    required: (input as HTMLInputElement).required
                  }))
                }
              })

              return formData
            }
          })
          results[test.id] = formResult[0].result
          break

        case 'submitForm':
          // Not implemented yet
          results[test.id] = {
            success: false,
            error: 'Not implemented'
          }
          break

        case 'checkRequired':
          // Inject validation test script
          const validationResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const forms = document.querySelectorAll('form')
              const validationData: Record<string, any> = {}

              forms.forEach((form, index) => {
                const requiredFields = form.querySelectorAll('[required]')
                validationData[`form_${index}`] = {
                  requiredFields: Array.from(requiredFields).map(field => ({
                    type: (field as HTMLInputElement).type,
                    name: (field as HTMLInputElement).name,
                    id: field.id
                  })),
                  hasValidation: form.hasAttribute('novalidate') === false
                }
              })

              return validationData
            }
          })
          results[test.id] = validationResult[0].result
          break

        default:
          throw new Error(`Unknown test type: ${test.type}`)
      }
    } catch (error) {
      results[test.id] = {
        success: false,
        error: error.message
      }
    }
  }

  return results
}

// Function to be injected into the page
async function injectLoginScript(config: WebsiteConfig) {
  try {
    // Wait for form elements to be available
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Find form elements using standard selectors
    const form = document.querySelector('form')
    if (!form) throw new Error("Login form not found")

    // Try to find the identifier input (email or username)
    let identifierInput: HTMLInputElement | null = null
    if (config.credentials.type === 'email') {
      identifierInput = document.querySelector('input[type="email"], input[name="email"]')
    } else {
      identifierInput = document.querySelector('input[name="username"], input[type="text"]')
    }

    // Find password input
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement

    // Find submit button
    const submitButton = document.querySelector('button[type="submit"], input[type="submit"], button:contains("Login"), input[value="Login"]') as HTMLElement

    if (!identifierInput) throw new Error("Email/Username field not found")
    if (!passwordInput) throw new Error("Password field not found")
    if (!submitButton) throw new Error("Submit button not found")

    // Fill in credentials
    identifierInput.value = config.credentials.identifier
    passwordInput.value = config.credentials.password

    // Submit form
    if (submitButton instanceof HTMLElement) {
      submitButton.click()
    } else {
      (form as HTMLFormElement).submit()
    }

    return {
      success: true,
      message: "Login attempt successful"
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// Update message listener to handle test execution
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_AUTH_STATUS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.url || !tab.id) {
        sendResponse({ 
          isAuthenticated: false, 
          error: "No active tab",
          currentWebsite: null
        });
        return;
      }

      try {
        // Try to ensure we have scripting permission
        await ensureScriptingPermission();
        
        // Check if scripting API is available
        const hasScriptingApi = await checkScriptingPermission();
        if (!hasScriptingApi) {
          debugLog("chrome.scripting API not available for CHECK_AUTH_STATUS, using fallback");
          
          // Try to inject our script manually
          const injected = await injectContentScriptManually(tab);
          
          // Even if injection fails, we'll try to proceed with basic form detection
          // Detect login form info using fallback
          const loginInfo = await detectLoginInfo(tab);
          if (loginInfo) {
            message.config.loginUrl = loginInfo.formInfo.action;
            message.config.url = new URL(tab.url).origin;
            // Save the updated config with the correct login URL
            await storage.set("config", message.config);
            debugLog("Updated config with fallback detected URLs:", message.config);
          }
          
          // Attempt login with the updated config
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'FILL_LOGIN_FORM',
            config: message.config
          }).catch(err => {
            debugLog("Error sending message to content script:", err);
            return null;
          });
          
          if (response && response.success) {
            sendResponse({ success: true });
          } else {
            sendResponse({ 
              success: false, 
              error: "Login failed using fallback method"
            });
          }
          return;
        }

        // Regular flow with scripting API
        // Request permissions first
        const hasPermission = await requestTabPermissions(tab);
        if (!hasPermission) {
          throw new Error("Permission denied for the current website");
        }

        // Clear previous requests for this tab
        networkRequests.set(tab.id.toString(), []);

        // Detect login form info
        const loginInfo = await detectLoginInfo(tab);
        if (loginInfo) {
          message.config.loginUrl = loginInfo.formInfo.action;
          // Save the updated config with the correct login URL
          await storage.set("config", message.config);
        }

        debugLog("Updated login config:", message.config);

        // Inject the login script
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (config) => {
            console.log("Executing login script with config:", config);
            
            // Helper function to find input field by various attributes
            const findInput = (selectors: string[], form: HTMLFormElement): HTMLInputElement | null => {
              for (const selector of selectors) {
                const input = form.querySelector(selector) as HTMLInputElement;
                if (input) return input;
              }
              return null;
            };

            try {
              // Find the login form
              const form = document.querySelector('form') as HTMLFormElement;
              if (!form) throw new Error("Login form not found");

              console.log("Found form:", form);

              // Build dynamic selectors for username/email
              const usernameSelectors = [
                'input[name*="username" i]',
                'input[name*="email" i]',
                'input[name*="login" i]',
                'input[name*="user" i]',
                'input[type="text"]',
                'input[type="email"]'
              ];

              // Find username/email input
              const usernameInput = findInput(usernameSelectors, form);
              if (!usernameInput) throw new Error("Username/email field not found");
              console.log("Found username input:", usernameInput);

              // Find password input
              const passwordInput = form.querySelector('input[type="password"]') as HTMLInputElement;
              if (!passwordInput) throw new Error("Password field not found");
              console.log("Found password input:", passwordInput);

              // Build dynamic selectors for submit button
              const submitSelectors = [
                'input[type="submit"]',
                'button[type="submit"]',
                'input[name="yt0"]',
                'button:contains("Login")',
                'button:contains("Sign in")',
                'input[value*="Login" i]',
                'input[value*="Sign in" i]'
              ];

              // Find submit button
              const submitButton = findInput(submitSelectors, form) || form.querySelector(submitSelectors.join(','));
              if (!submitButton) throw new Error("Submit button not found");
              console.log("Found submit button:", submitButton);

              // Fill credentials
              usernameInput.value = config.credentials.identifier;
              usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
              usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
              
              passwordInput.value = config.credentials.password;
              passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

              console.log("Filled credentials");

              // Capture form data before submit
              const formData = new FormData(form);
              const data: Record<string, any> = {};
              formData.forEach((value, key) => {
                data[key] = value;
              });

              // Send form data to background script
              chrome.runtime.sendMessage({
                type: 'FORM_SUBMIT',
                data: {
                  url: window.location.href,
                  method: form.method || 'POST',
                  action: form.action || window.location.href,
                  formData: data
                }
              });

              // Submit form
              if (submitButton instanceof HTMLElement) {
                submitButton.click();
              } else {
                form.submit();
              }
              console.log("Form submitted");

              return { success: true, formData: data };
            } catch (error) {
              console.error("Login script error:", error);
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          },
          args: [message.config]
        });

        debugLog("Login script execution result:", result);

        // Wait for form submission and navigation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const requests = networkRequests.get(tab.id.toString()) || [];
        debugLog("Captured requests:", requests);

        const formSubmission = requests.find(req => req.type === 'form_submit');
        if (formSubmission) {
          sendResponse({
            success: true,
            request: formSubmission
          });
        } else {
          throw new Error("Form submission not captured");
        }
      } catch (error) {
        debugLog("Login error:", error);
        sendResponse({
          success: false,
          error: typeof error === 'object' ? (error as Error).message : String(error)
        });
      }
    });

    return true;
  }

  if (message.type === "PERFORM_LOGIN") {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.url || !tab.id) {
        sendResponse({ 
          success: false, 
          error: "No active tab"
        });
        return;
      }

      try {
        // Try to ensure we have scripting permission
        await ensureScriptingPermission();

        // Check if scripting API is available
        const hasScriptingApi = await checkScriptingPermission();
        
        if (!hasScriptingApi) {
          debugLog("chrome.scripting API not available for PERFORM_LOGIN, using fallback approach");
          
          // Try to inject our script manually
          const injected = await injectContentScriptManually(tab);
          
          // Even if injection fails, we'll try to proceed with basic form detection
          // Detect login form info using fallback
          const loginInfo = await detectLoginInfo(tab);
          if (loginInfo) {
            message.config.loginUrl = loginInfo.formInfo.action;
            message.config.url = new URL(tab.url).origin;
            // Save the updated config with the correct login URL
            await storage.set("config", message.config);
            debugLog("Updated config with fallback detected URLs:", message.config);
          }
          
          // Attempt login with the updated config
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'FILL_LOGIN_FORM',
            config: message.config
          }).catch(err => {
            debugLog("Error sending message to content script:", err);
            return null;
          });
          
          if (response && response.success) {
            sendResponse({
              success: true,
              message: "Login attempted using fallback method"
            });
          } else {
            sendResponse({ 
              success: false, 
              error: "Login failed using fallback method"
            });
          }
          return;
        }

        // Regular flow with scripting API available
        // Clear previous requests for this tab
        networkRequests.set(tab.id.toString(), []);

        // Inject the login script
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (config) => {
            console.log("Executing login script with config:", config);
            
            // Helper function to find input field by various attributes
            const findInput = (selectors: string[], form: HTMLFormElement): HTMLInputElement | null => {
              for (const selector of selectors) {
                const input = form.querySelector(selector) as HTMLInputElement;
                if (input) return input;
              }
              return null;
            };

            try {
              // Find the login form
              const form = document.querySelector('form') as HTMLFormElement;
              if (!form) throw new Error("Login form not found");

              console.log("Found form:", form);

              // Build dynamic selectors for username/email
              const usernameSelectors = [
                'input[name*="username" i]',
                'input[name*="email" i]',
                'input[name*="login" i]',
                'input[name*="user" i]',
                'input[type="text"]',
                'input[type="email"]'
              ];

              // Find username/email input
              const usernameInput = findInput(usernameSelectors, form);
              if (!usernameInput) throw new Error("Username/email field not found");
              console.log("Found username input:", usernameInput);

              // Find password input
              const passwordInput = form.querySelector('input[type="password"]') as HTMLInputElement;
              if (!passwordInput) throw new Error("Password field not found");
              console.log("Found password input:", passwordInput);

              // Build dynamic selectors for submit button
              const submitSelectors = [
                'input[type="submit"]',
                'button[type="submit"]',
                'input[name="yt0"]',
                'button:contains("Login")',
                'button:contains("Sign in")',
                'input[value*="Login" i]',
                'input[value*="Sign in" i]'
              ];

              // Find submit button
              const submitButton = findInput(submitSelectors, form) || form.querySelector(submitSelectors.join(','));
              if (!submitButton) throw new Error("Submit button not found");
              console.log("Found submit button:", submitButton);

              // Fill credentials
              usernameInput.value = config.credentials.identifier;
              usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
              usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
              
              passwordInput.value = config.credentials.password;
              passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

              console.log("Filled credentials");

              // Submit form
              if (submitButton instanceof HTMLElement) {
                submitButton.click();
              } else {
                form.submit();
              }
              console.log("Clicked submit button");

              return { success: true }
            } catch (error) {
              console.error("Login script error:", error);
              return { success: false, error: error.message }
            }
          },
          args: [message.config]
        });

        debugLog("Login script execution result:", result);

        // Wait for navigation and analyze requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        const requests = networkRequests.get(tab.id.toString()) || [];
        const loginRequest = requests.find(req => 
          req.method === "POST" && (
            req.url.includes("login") || 
            req.url.includes("auth") || 
            req.url === message.config.url
          )
        );

        debugLog("Captured requests:", requests);
        debugLog("Login request:", loginRequest);

        if (loginRequest) {
          sendResponse({
            success: true,
            request: loginRequest
          });
        } else {
          throw new Error("Login request not captured");
        }
      } catch (error) {
        debugLog("Login error:", error);
        sendResponse({
          success: false,
          error: typeof error === 'object' ? (error as Error).message : String(error)
        });
      }
    });

    return true;
  }

  if (message.type === "RUN_TESTS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.url) {
        sendResponse({ 
          success: false, 
          error: "No active tab"
        })
        return
      }

      try {
        const results = await runTests(message.tests, tab)
        sendResponse({
          success: true,
          results
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        })
      }
    })

    return true // Keep message channel open for async response
  }

  if (message.type === "PERFORM_LOGOUT") {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      // Use the centralized logout message handler, but don't try to use port
      await handleLogoutMessage(message, tab, sendResponse);
    });

    return true;
  }
})

// Keep track of active ports
let ports: { [key: string]: chrome.runtime.Port } = {}

// Handle port connections
chrome.runtime.onConnect.addListener((port) => {
  const portId = port.name || 'default'
  ports[portId] = port
  debugLog("Port connected:", portId)

  port.onDisconnect.addListener(() => {
    debugLog("Port disconnected:", portId)
    delete ports[portId]
  })

  port.onMessage.addListener(async (message) => {
    debugLog("Received message:", message)
    try {
      const storage = new Storage()
      
      switch (message.type) {
        case "CHECK_AUTH_STATUS":
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (!tab?.url) {
            port.postMessage({ type: "AUTH_STATUS", isAuthenticated: false })
            return
          }
          // Check authentication status
          const domain = new URL(tab.url).hostname
          const config = await storage.get<WebsiteConfig>(`config_${domain}`)
          const cookies = await chrome.cookies.getAll({ url: tab.url })
          
          debugLog("Auth check:", { domain, hasCookies: cookies.length > 0, hasConfig: !!config })
          
          port.postMessage({
            type: "AUTH_STATUS",
            isAuthenticated: cookies.length > 0 && !!config,
            currentWebsite: domain
          })
          break

        case "PERFORM_LOGIN":
          const { config: loginConfig } = message
          debugLog("Performing login with config:", loginConfig)

          try {
            // Try to ensure we have scripting permission
            await ensureScriptingPermission();
            
            // Check if scripting API is available
            const hasScriptingApi = await checkScriptingPermission();
            if (!hasScriptingApi) {
              debugLog("chrome.scripting API not available for port PERFORM_LOGIN, using fallback");
              
              // Clear previous requests for this tab
              const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
              if (!activeTab?.id) throw new Error("No active tab")
              
              // Try to inject our script manually
              const injected = await injectContentScriptManually(activeTab);
              
              // Detect login form info using fallback
              const loginInfo = await detectLoginInfo(activeTab);
              if (loginInfo) {
                message.config.loginUrl = loginInfo.formInfo.action;
                message.config.url = new URL(activeTab.url).origin;
                // Save the updated config
                await storage.set("config", message.config);
                debugLog("Updated config with fallback detected URLs:", message.config);
              }
              
              // Attempt login with the updated config
              const response = await chrome.tabs.sendMessage(activeTab.id, {
                type: 'FILL_LOGIN_FORM',
                config: message.config
              }).catch(err => {
                debugLog("Error sending message to content script:", err);
                return null;
              });
              
              if (response && response.success) {
                port.postMessage({
                  type: "LOGIN_RESULT",
                  success: true,
                  message: "Login attempted using fallback method"
                });
              } else {
                port.postMessage({
                  type: "LOGIN_RESULT",
                  success: false,
                  error: "Login failed using fallback method"
                });
              }
              return;
            }

            // Regular flow with scripting API available
            // Clear previous requests for this tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!activeTab?.id) throw new Error("No active tab")
            networkRequests.set(activeTab.id.toString(), [])

            // Inject the login script
            const result = await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: async (config) => {
                console.log("Executing login script with config:", config)
                
                // Wait for form elements
                const waitForElement = async (selector: string, timeout = 5000) => {
                  const start = Date.now()
                  while (Date.now() - start < timeout) {
                    const element = document.querySelector(selector)
                    if (element) return element
                    await new Promise(resolve => setTimeout(resolve, 100))
                  }
                  throw new Error(`Timeout waiting for element: ${selector}`)
                }

                try {
                  // Find the login form
                  const form = await waitForElement('form')
                  if (!form) throw new Error("Login form not found")

                  // Find username/email input
                  const usernameInput = await waitForElement('input[type="text"], input[type="email"], input[name*="username"], input[name*="email"]')
                  if (!usernameInput) throw new Error("Username/email input not found")

                  // Find password input
                  const passwordInput = await waitForElement('input[type="password"]')
                  if (!passwordInput) throw new Error("Password input not found")

                  // Find submit button
                  const submitButton = await waitForElement('button[type="submit"], input[type="submit"], button:contains("Login"), input[value="Login"]')
                  if (!submitButton) throw new Error("Submit button not found")

                  console.log("Found form elements:", { form, usernameInput, passwordInput, submitButton })

                  // Fill credentials
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(usernameInput, config.credentials.identifier)
                  usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
                  
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(passwordInput, config.credentials.password)
                  passwordInput.dispatchEvent(new Event('input', { bubbles: true }))

                  console.log("Filled credentials")

                  // Submit form
                  if (submitButton instanceof HTMLElement) {
                    submitButton.click()
                  } else {
                    (form as HTMLFormElement).submit()
                  }
                  console.log("Clicked submit button")

                  return { success: true }
                } catch (error) {
                  console.error("Login script error:", error)
                  return { success: false, error: error.message }
                }
              },
              args: [loginConfig]
            })

            debugLog("Login script execution result:", result)

            // Wait for navigation and analyze requests
            await new Promise(resolve => setTimeout(resolve, 2000))
            const requests = networkRequests.get(activeTab.id.toString()) || []
            const loginRequest = requests.find(req => 
              req.method === "POST" && (
                req.url.includes("login") || 
                req.url.includes("auth") || 
                req.url === loginConfig.url
              )
            )

            debugLog("Captured requests:", requests)
            debugLog("Login request:", loginRequest)

            if (loginRequest) {
              port.postMessage({
                type: "LOGIN_RESULT",
                success: true,
                request: loginRequest
              })
            } else {
              throw new Error("Login request not captured")
            }
          } catch (error) {
            debugLog("Login error:", error)
            port.postMessage({
              type: "LOGIN_RESULT",
              success: false,
              error: error.message
            })
          }
          break

        case "PERFORM_LOGOUT":
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          
          if (!activeTab?.url || !activeTab.id) {
            debugLog("No active tab found for logout");
            port.postMessage({
              type: "LOGOUT_RESULT",
              success: false,
              error: "No active tab"
            });
            return;
          }
          
          try {
            // Get config from the message or create a minimal one
            let config = message.config;
            if (!config || !config.url) {
              config = {
                url: activeTab.url,
                credentials: { type: 'email', identifier: '', password: '' }
              };
            }
            
            // Perform logout using the imported utility function
            const logoutResult = await performLogoutUtil(activeTab, config);
            
            port.postMessage({
              type: "LOGOUT_RESULT",
              ...logoutResult
            });
          } catch (error) {
            debugLog("Logout error:", error);
            port.postMessage({
              type: "LOGOUT_RESULT",
              success: false,
              error: typeof error === 'object' ? (error as Error).message : String(error)
            });
          }
          break
      }
    } catch (error) {
      debugLog("Error handling message:", error)
      port.postMessage({
        type: "ERROR",
        error: error.message
      })
    }
  })
})

// Export for type checking
export {}

// Update performAPILogin to use utility functions
async function performAPILogin(config: WebsiteConfig): Promise<LoginResponse> {
  try {
    const loginUrl = config.loginUrl || `${config.url}/login`;
    console.log("Attempting API login to:", loginUrl);

    // Prepare login payload
    const loginPayload = {
      email: config.credentials.identifier,
      password: config.credentials.password
    };

    // Make login request
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(loginPayload)
    });

    console.log("API login response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("API login successful, response:", data);

    // Get cookies after successful login
    const cookies = await chrome.cookies.getAll({ url: config.url });

    // Save API token if present
    const token = data.token || data.access_token;
    if (token) {
      const domain = new URL(config.url).hostname;
      await saveAPIToken(domain, token);
    }

    return {
      success: true,
      message: "API login successful",
      redirectUrl: data.redirect_url,
      cookieData: {
        cookies,
        token,
        userData: data.user || data
      }
    };
  } catch (error) {
    console.error("API login error:", error);
    return {
      success: false,
      error: error.message || "API login failed"
    };
  }
}

// Update performAPILogout to use utility functions
async function performAPILogout(config: WebsiteConfig): Promise<LogoutResponse> {
  try {
    const domain = new URL(config.url).hostname;
    const token = await getAPIToken(domain);
    
    if (!token) {
      console.log("No API token found, considering already logged out");
      return {
        success: true,
        message: "Already logged out (no token found)"
      };
    }

    const logoutUrl = `${config.url}/logout`;
    console.log("Attempting API logout at:", logoutUrl);

    // Make logout request using utility function
    const response = await makeAuthenticatedRequest(logoutUrl, {
      method: 'POST'
    });

    // Even if the logout request fails, we'll clear the token
    await removeAPIToken(domain);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn("API logout returned error:", errorData);
      // Still return success since we cleared the token
      return {
        success: true,
        message: "Logged out (token cleared)"
      };
    }

    return {
      success: true,
      message: "API logout successful"
    };
  } catch (error) {
    console.error("API logout error:", error);
    // Even on error, try to clear the token
    try {
      const domain = new URL(config.url).hostname;
      await removeAPIToken(domain);
    } catch (e) {
      console.error("Error clearing token:", e);
    }
    return {
      success: false,
      error: error.message || "API logout failed"
    };
  }
}

// Update performLogout to use isAPIEndpoint utility
export async function performLogout(tab: chrome.tabs.Tab, config: WebsiteConfig): Promise<LogoutResponse> {
  const debugLog = (...args: any[]) => {
    console.log("[Logout Debug]", ...args);
  };

  if (!tab.id) {
    debugLog("Invalid tab ID in performLogout");
    return { success: false, error: "Invalid tab" };
  }

  try {
    debugLog("Performing logout for tab:", tab.id, "with config:", config);
    
    if (!tab.url) {
      debugLog("Missing tab URL in performLogout");
      return { success: false, error: "Invalid tab URL" };
    }

    // Check if this is an API endpoint using utility function
    if (isAPIEndpoint(config.url)) {
      debugLog("Detected API endpoint, using API logout");
      return await performAPILogout(config);
    }

    // ... rest of the existing logout code for regular web pages ...
  } catch (error) {
    debugLog("Logout error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 