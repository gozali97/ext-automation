import type { WebsiteConfig, LogoutResponse } from "./types";

/**
 * Enhanced logout functionality that:
 * 1. Searches for common logout links with '/logout' in URLs
 * 2. Tries to click found elements to perform a proper logout
 * 3. Falls back to cookie/site data clearing if no logout link found
 */
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

    const url = new URL(tab.url);
    const origin = url.origin;
    
    // First, try to find and click a logout link
    let logoutLinkClicked = false;
    
    try {
      // Check if scripting API is available
      if (!chrome.scripting) {
        debugLog("chrome.scripting API not available for logout");
        // We'll fall back to clearing cookies and site data
      } else {
        debugLog("Executing logout script to find logout links");
        
        const scriptResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Utility function to check if an element is visible
            const isVisible = (element: HTMLElement): boolean => {
              const style = window.getComputedStyle(element);
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0' &&
                     element.offsetWidth > 0 &&
                     element.offsetHeight > 0;
            };
            
            // Log event for debugging
            console.log("Searching for logout links");
            
            // Helper function to gather all potential logout elements
            const findLogoutElements = (): HTMLElement[] => {
              const candidates: HTMLElement[] = [];
              
              // 1. Common logout link text patterns
              const logoutTexts = [
                'logout',
                'log out',
                'sign out',
                'signout',
                'keluar', // Indonesian
                'salir', // Spanish
                'sair', // Portuguese
                'выход', // Russian
                '退出', // Chinese
                'déconnexion', // French
                'abmelden', // German
                'ログアウト' // Japanese
              ];
              
              // Find elements containing these texts
              document.querySelectorAll('a, button, input[type="button"], input[type="submit"], div[role="button"], span[role="button"]')
                .forEach(el => {
                  const text = el.textContent?.toLowerCase().trim() || '';
                  if (logoutTexts.some(logoutText => text.includes(logoutText))) {
                    if (el instanceof HTMLElement && isVisible(el)) {
                      candidates.push(el);
                    }
                  }
                });
              
              // 2. Links with logout in href
              document.querySelectorAll('a[href*="logout" i], a[href*="sign-out" i], a[href*="signout" i], a[href*="/exit" i], a[href*="keluar" i]')
                .forEach(el => {
                  if (el instanceof HTMLElement && isVisible(el)) {
                    candidates.push(el);
                  }
                });
                
              // 3. Find links with '/logout' or similar in their URLs
              document.querySelectorAll('a')
                .forEach(el => {
                  const href = el.getAttribute('href');
                  if (href && (
                      href.includes('/logout') || 
                      href.includes('/signout') || 
                      href.includes('/sign-out') || 
                      href.includes('/exit') || 
                      href.includes('/keluar')
                    )) {
                    if (isVisible(el)) {
                      candidates.push(el);
                    }
                  }
                });
                
              // 4. Special cases for framework-specific components
              // React/Angular/Vue components often use divs with click handlers
              document.querySelectorAll('div[class*="logout" i], div[class*="signout" i], span[class*="logout" i]')
                .forEach(el => {
                  if (el instanceof HTMLElement && isVisible(el)) {
                    candidates.push(el);
                  }
                });
              
              // 5. Forms with logout action
              document.querySelectorAll('form[action*="logout" i], form[action*="signout" i]')
                .forEach(form => {
                  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                  if (submitBtn instanceof HTMLElement && isVisible(submitBtn)) {
                    candidates.push(submitBtn);
                  } else if (form instanceof HTMLFormElement) {
                    candidates.push(form);
                  }
                });
                
              console.log("Found", candidates.length, "potential logout elements:", candidates);
              return candidates;
            };
            
            // Find potential logout elements
            const logoutElements = findLogoutElements();
            
            // Try clicking each element until we find one that works
            if (logoutElements.length > 0) {
              // Sort by likelihood (links with 'logout' in href first)
              logoutElements.sort((a, b) => {
                const aHref = a instanceof HTMLAnchorElement ? a.href : '';
                const bHref = b instanceof HTMLAnchorElement ? b.href : '';
                
                const aContainsLogout = aHref.includes('logout') || aHref.includes('signout');
                const bContainsLogout = bHref.includes('logout') || bHref.includes('signout');
                
                if (aContainsLogout && !bContainsLogout) return -1;
                if (!aContainsLogout && bContainsLogout) return 1;
                return 0;
              });
              
              // Click the first element
              const elementToClick = logoutElements[0];
              console.log("Clicking logout element:", elementToClick);
              
              if (elementToClick instanceof HTMLFormElement) {
                elementToClick.submit();
              } else {
                elementToClick.click();
              }
              
              return { 
                success: true, 
                message: "Clicked logout element: " + (elementToClick.outerHTML.substring(0, 100)) 
              };
            }
            
            return { success: false, message: "No logout elements found" };
          }
        });
        
        debugLog("Logout script result:", scriptResult);
        
        if (scriptResult && scriptResult[0]?.result?.success) {
          logoutLinkClicked = true;
          // Wait for potential page navigation after clicking logout
          await new Promise(resolve => setTimeout(resolve, 2000));
          debugLog("Waiting after clicking logout element");
        } else {
          debugLog("No logout elements found, falling back to cookie clearing");
        }
      }
    } catch (error) {
      debugLog("Error finding/clicking logout elements:", error);
      // Continue with cookie clearing as fallback
    }
    
    // Even if we clicked a logout button, also clear cookies and site data as a fallback
    debugLog(`Starting site data clearing for ${url.hostname} (${origin})`);
    
    // Clear cookies
    const cookies = await chrome.cookies.getAll({ domain: url.hostname });
    debugLog(`Found ${cookies.length} cookies to remove for ${url.hostname}`);
    
    for (const cookie of cookies) {
      debugLog(`Removing cookie: ${cookie.name} (${cookie.domain})`);
      await chrome.cookies.remove({
        url: origin,
        name: cookie.name
      });
      debugLog(`Removed cookie: ${cookie.name}`);
    }
    
    // Clear site data (requires "browsingData" permission in manifest)
    if (chrome.browsingData) {
      debugLog(`Clearing browsing data for ${origin}`);
      await chrome.browsingData.remove({
        origins: [origin]
      }, {
        cache: true,
        cookies: true,
        localStorage: true
      });
      debugLog(`Cleared browsing data for ${origin}`);
    } else {
      debugLog("chrome.browsingData API not available");
    }
    
    // Reload the page to show logout effect
    debugLog(`Reloading tab ${tab.id}`);
    await chrome.tabs.reload(tab.id);
    
    // Additional delay to ensure the page has refreshed
    await new Promise(resolve => setTimeout(resolve, 1000));
    debugLog("Logout complete - returning success");
    
    return {
      success: true,
      message: logoutLinkClicked 
        ? "Logout successful - clicked logout element and cleared site data" 
        : "Logout successful - cleared site data"
    };
  } catch (error) {
    debugLog("Logout error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Helper function to create a fallback config when one is missing
 */
export function createFallbackConfig(url: string): WebsiteConfig {
  return {
    url: url,
    credentials: { 
      type: 'email', 
      identifier: '', 
      password: '' 
    }
  };
}

/**
 * Handler for logout messages - can be used in both event listeners
 */
export async function handleLogoutMessage(
  message: any, 
  tab: chrome.tabs.Tab, 
  sendResponse: (response: any) => void
) {
  if (!tab?.url || !tab.id) {
    console.log("No active tab found for logout");
    sendResponse({ 
      success: false, 
      error: "No active tab"
    });
    return;
  }

  try {
    // Get config from the message or create fallback
    let config = message.config;
    
    // If no config provided or it's missing url, use current tab URL
    if (!config || !config.url) {
      console.log("No config in logout message, creating minimal config");
      config = createFallbackConfig(tab.url);
    }
    
    console.log("Performing logout with config:", config);
    
    // Perform logout
    const logoutResult = await performLogout(tab, config);
    console.log("Logout result:", logoutResult);
    
    sendResponse(logoutResult);
  } catch (error) {
    console.error("Logout error in handler:", error);
    sendResponse({
      success: false,
      error: typeof error === 'object' ? (error as Error).message : String(error)
    });
  }
} 