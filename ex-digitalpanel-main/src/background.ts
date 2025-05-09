// Background script for Digital Panel Extension
// Implementasi WebSocket langsung tanpa Pusher.js

// Import required modules at the top level
import { apiService } from "~utils/api";
import { storeDigitalPanelToken, storeUserId, storeOriginalTab, getDigitalPanelToken, getOriginalTab, getTokenData } from "~utils/storage";
import { initializeCreditMonitor } from "~utils/creditMonitor";

console.log("Digital Panel Extension Background Script Loaded");

// Digital Panel API constants
const API_BASE_URL = 'https://api.digitalpanel.id';

// WebSocket constants
const WS_HOST = 'socket.digitalpanel.id';
const WS_PORT = '2087';
const WS_APP_KEY = 'k96fb34aa1623a718b629a5db09591946';
const ECHO_AUTH_HOST = 'https://api.digitalpanel.id';
const ECHO_AUTH_ENDPOINT = '/api/b/broadcasting/auth';

// WebSocket service variables
let ws: WebSocket | null = null;
let authToken: string | null = null;
let userId: string | null = null;
let reconnectTimer: any = null;
let heartbeatInterval: any = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 5000; // 5 seconds

// Variabel untuk debounce fetchUserProfileAndConnect
let fetchProfileDebounceTimer: number | null = null;

// WebSocket connection status
let isConnecting = false;
let isConnected = false;

// Flag to track if we've already fetched the user profile
let userProfileFetched = false;

// Flag to track if service worker heartbeat is running
let isHeartbeatRunning = false;

// Function to initialize WebSocket
function initializeWebSocket(token: string, userIdParam: string) {
  // Prevent multiple connection attempts
  if (isConnecting || isConnected) {
    console.log('WebSocket already connecting or connected, skipping initialization');
    return;
  }
  
  try {
    console.log('Initializing WebSocket connection', {
      tokenPrefix: token.substring(0, 10) + '...',
      userId: userIdParam
    });

    // Store token and userId for later use
    authToken = token;
    userId = userIdParam;
    
    // Set connecting flag
    isConnecting = true;

    // Close existing connection if any
    disconnectWebSocket();

    // Create WebSocket connection
    const wsUrl = `wss://${WS_HOST}:${WS_PORT}/app/${WS_APP_KEY}?protocol=7&client=js&version=7.0.3&flash=false`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    ws = new WebSocket(wsUrl);
    
    // Setup event handlers
    ws.onopen = handleWebSocketOpen;
    ws.onmessage = handleWebSocketMessage;
    ws.onerror = handleWebSocketError;
    ws.onclose = handleWebSocketClose;
    
    // Start heartbeat
    startHeartbeat();
    
  } catch (error) {
    console.error("Error initializing WebSocket:", error);
    isConnecting = false;
    scheduleReconnect();
  }
}

// Function to handle WebSocket open event
function handleWebSocketOpen() {
  console.log('WebSocket connection established');
  // Reset reconnect attempts on successful connection
  reconnectAttempts = 0;
  // The server will send a connection_established event with a socket_id
  // We'll handle that in the message handler
}

// Function to subscribe to channels
function subscribeToChannels(socketId: string) {
  if (!ws || !userId || !authToken) {
    console.error('Cannot subscribe to channels: WebSocket, userId, or authToken is null');
    return;
  }
  
  try {
    console.log('Subscribing to channels with socket ID:', socketId);
    
    // Subscribe to setting channel
    subscribeToChannel('setting');
    
    // Subscribe to private channel
    subscribeToPrivateChannel(`App.Models.User.${userId}`, socketId);
    
  } catch (error) {
    console.error('Error subscribing to channels:', error);
  }
}

// Function to subscribe to a public channel
function subscribeToChannel(channelName: string) {
  console.log(`Subscribing to channel: ${channelName}`);
  
  sendWebSocketMessage({
    event: 'pusher:subscribe',
    data: {
      channel: channelName
    }
  });
}

// Function to subscribe to a private channel
function subscribeToPrivateChannel(channelName: string, socketId: string) {
  if (!authToken) {
    console.error('Cannot subscribe to private channel: authToken is null');
    return;
  }
  
  const privateChannelName = `private-${channelName}`;
  console.log(`Subscribing to private channel: ${privateChannelName} with socket ID: ${socketId}`);
  
  // First, get auth signature from server
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  fetch(`${ECHO_AUTH_HOST}${ECHO_AUTH_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Origin': 'https://app.digitalpanel.id',
      'x-host-origin': 'https://app.digitalpanel.id'
    },
    body: new URLSearchParams({
      socket_id: socketId,
      channel_name: privateChannelName
    }).toString(),
    signal: controller.signal
  })
  .then(response => response.json())
  .then(authData => {
    clearTimeout(timeoutId);
    console.log('Auth data received:', authData);
    
    // Now subscribe with auth data
    sendWebSocketMessage({
      event: 'pusher:subscribe',
      data: {
        channel: privateChannelName,
        auth: authData.auth
      }
    });
  })
  .catch(error => {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('Fetch request timed out for private channel auth');
    } else {
      console.error('Error getting auth for private channel:', error);
    }
  });
}

// Function to handle WebSocket message event
function handleWebSocketMessage(event: MessageEvent) {
  try {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);
    
    // Handle different event types
    if (data.event === 'pusher:connection_established') {
      // Extract socket ID from the connection established message
      const socketId = JSON.parse(data.data).socket_id;
      console.log('Connection established, socket ID:', socketId);
      
      // Update connection status
      isConnecting = false;
      isConnected = true;
      
      // Now that we have a socket ID, subscribe to channels
      subscribeToChannels(socketId);
    } 
    else if (data.event === 'pusher_internal:subscription_succeeded') {
      console.log('Successfully subscribed to channel:', data.channel);
    }
    else if (data.event === 'pusher:error') {
      console.error('Pusher error:', data.data);
    }
    // Handle notification events
    else if (data.event === 'Illuminate\\Notifications\\Events\\BroadcastNotificationCreated' || 
             data.event === '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated') {
      console.log('Notification received:', data);
      processNotification(data.data);
    }
    // Handle setting events
    else if (data.event === '.SettingEvent') {
      console.log('Setting event received:', data);
      processSettingEvent(data.data);
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error);
  }
}

// Function to process setting event
function processSettingEvent(data: any) {
  try {
    const settings = data?.settings;
    if (settings) {
      const siteMaintenance = settings.find((setting: any) => setting?.key === 'site_maintenance');
      if (siteMaintenance) {
        const maintenanceValue = JSON.parse(siteMaintenance.val);
        if (maintenanceValue === 1) {
          showNotification('Maintenance', 'Site maintenance is ongoing');
        } else {
          showNotification('Maintenance', 'Site maintenance has finished');
        }
      }
    }
  } catch (error) {
    console.error('Error processing setting event:', error);
  }
}

// Function to process notification
function processNotification(notification: any) {
  try {
    console.log('Processing notification:', notification);
    
    // Parse data if it's a string
    let parsedData = notification;
    if (typeof notification === 'string') {
      try {
        parsedData = JSON.parse(notification);
      } catch (e) {
        console.error('Failed to parse notification data:', e);
      }
    }
    
    // Extract notification type
    const notificationType = parsedData.type;
    if (!notificationType) {
      console.error('No notification type found in:', parsedData);
      return;
    }
    
    console.log('Processing notification type:', notificationType);
    
    // Handle different notification types
    if (notificationType === "App\\Notifications\\UserNotification") {
      showNotification(parsedData.data.title, parsedData.data.message);
    }
    
    if (notificationType === "App\\Notifications\\OrderNotification") {
      showNotification(parsedData.data.title, parsedData.data.message);
    }
    
    if (notificationType === "App\\Notifications\\DownloadNotification") {
      console.log('Processing download notification');
      
      const data = parsedData?.data?.data;
      
      // Basic notification
      let notificationMessage = parsedData.data.message;
      
      // Auto download for completed downloads
      if (data?.download_status_id == 4) {
        console.log('Download is ready, starting auto download');
        
        // Play notification sound
        playNotificationSound();
        
        // Show notification
        showNotification(parsedData.data.title, notificationMessage);
        
        // Gunakan getDigitalPanelToken untuk mendapatkan token langsung dari storage
        getDigitalPanelToken().then(token => {
          if (token) {
            // Start download automatically in new tab
            const downloadUrl = `${API_BASE_URL}/api/v2/downloads/${data?.id}/file/${data?.downloaded?.file_name}?_token=${token}`;
            console.log('Starting automatic download:', downloadUrl);
            
            // First open a new tab to the download URL, but keep current tab active
            chrome.tabs.create({ url: downloadUrl, active: false }, (tab) => {
              console.log('Download tab created:', tab?.id);
              
              // Keep tab open for user to see download progress
              // User can close it manually when done
            });
          } else {
            console.error('No token available for download');
            showNotification('Error', 'No authentication token available');
          }
        }).catch(error => {
          console.error('Error getting token for download:', error);
          showNotification('Error', 'Failed to get authentication token');
        });
      } else {
        console.log('Download not ready yet, status:', data?.download_status_id);
        showNotification(parsedData.data.title, notificationMessage);
      }
    }
    
    if (notificationType === "App\\Notifications\\PointDownloadNotification") {
      const data = parsedData?.data?.data;
      
      // Basic notification
      let notificationMessage = parsedData.data.message;
      
      // Show notification
      showNotification(parsedData.data.title, notificationMessage);
      
      // Auto download for completed downloads
      if (data?.point_download_status_id == 4 && data?.download_url !== null) {
        // Gunakan getDigitalPanelToken untuk mendapatkan token langsung dari storage
        getDigitalPanelToken().then(token => {
          if (token) {
            let downloadUrl = data.download_url;
            
            // Check if URL already has token parameter
            if (!downloadUrl.includes('_token=')) {
              // Add token parameter
              const separator = downloadUrl.includes('?') ? '&' : '?';
              downloadUrl = `${downloadUrl}${separator}_token=${token}`;
            }
            
            // Play notification sound
            playNotificationSound();
            
            console.log('Starting automatic download:', downloadUrl);
            
            // Open in new tab, but keep current tab active
            chrome.tabs.create({ url: downloadUrl, active: false }, (tab) => {
              console.log('Download tab created:', tab?.id);
            });
          } else {
            console.error('No token available for download');
            showNotification('Error', 'No authentication token available');
          }
        }).catch(error => {
          console.error('Error getting token for download:', error);
          showNotification('Error', 'Failed to get authentication token');
        });
      }
      
      if (data?.point_download_status_id == 7 && data?.downloaded?.file_name !== null) {
        // Gunakan getDigitalPanelToken untuk mendapatkan token langsung dari storage
        getDigitalPanelToken().then(token => {
          if (token) {
            const downloadUrl = `${API_BASE_URL}/v2/point_downloads/${data?.id}/file/${data?.downloaded?.file_name}?_token=${token}`;
            
            // Play notification sound
            playNotificationSound();
            
            console.log('Starting automatic download:', downloadUrl);
            
            // Open in new tab, but keep current tab active
            chrome.tabs.create({ url: downloadUrl, active: false }, (tab) => {
              console.log('Download tab created:', tab?.id);
            });
          } else {
            console.error('No token available for download');
            showNotification('Error', 'No authentication token available');
          }
        }).catch(error => {
          console.error('Error getting token for download:', error);
          showNotification('Error', 'Failed to get authentication token');
        });
      }
    }
    
    if (notificationType === "App\\Notifications\\UserBannedNotification") {
      showNotification(parsedData.data.title, parsedData.data.message);
    }
  } catch (error) {
    console.error('Error processing notification:', error);
  }
}

// Function to handle WebSocket error event
function handleWebSocketError(error: Event) {
  console.error('WebSocket error:', error);
}

// Function to handle WebSocket close event
function handleWebSocketClose(event: CloseEvent) {
  console.log('WebSocket connection closed:', event);
  
  // Update connection status
  isConnecting = false;
  isConnected = false;
  
  // Stop heartbeat
  stopHeartbeat();
  
  // Schedule reconnect only if it was an unexpected close
  if (event.code !== 1000) { // 1000 is normal closure
    scheduleReconnect();
  }
}

// Function to send WebSocket message
function sendWebSocketMessage(message: any) {
  if (!ws) {
    console.error('Cannot send message: WebSocket is null');
    return;
  }
  
  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
  }
}

// Function to start heartbeat
function startHeartbeat() {
  // Clear existing interval
  stopHeartbeat();
  
  // Send ping every 30 seconds to keep connection alive
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending ping');
      sendWebSocketMessage({
        event: 'pusher:ping',
        data: {}
      });
    }
  }, 30000);
}

// Function to stop heartbeat
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Function to disconnect WebSocket
function disconnectWebSocket() {
  // Stop heartbeat
  stopHeartbeat();
  
  // Close WebSocket
  if (ws) {
    console.log('Disconnecting WebSocket');
    ws.close(1000, "Normal closure"); // Use normal closure code
    ws = null;
  }

  // Clear reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Reset connection status
  isConnecting = false;
  isConnected = false;
}

// Function to schedule reconnect with exponential backoff
function scheduleReconnect() {
  // Don't reconnect if already connecting or connected
  if (isConnecting || isConnected) return;
  
  if (!authToken || !userId) return;
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  // Check if we've exceeded max attempts
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
    reconnectAttempts = 0; // Reset for future attempts if needed
    return;
  }
  
  // Calculate delay with exponential backoff (5s, 10s, 20s, 40s, etc.)
  const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
  const cappedDelay = Math.min(delay, 300000); // Cap at 5 minutes
  
  const token = authToken;
  const userIdParam = userId;
  
  console.log(`Scheduling WebSocket reconnection in ${cappedDelay/1000} seconds (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  reconnectTimer = setTimeout(() => {
    console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
    reconnectAttempts++;
    initializeWebSocket(token, userIdParam);
  }, cappedDelay);
}

// Function to debounce calls
function debounce(func: Function, wait: number) {
  let timeout: any = null;
  return function(...args: any[]) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Setup a service worker heartbeat ping
function setupServiceWorkerHeartbeat() {
  let swHeartbeatInterval: any = null;
  
  const startServiceWorkerHeartbeat = () => {
    // Prevent multiple heartbeats
    if (isHeartbeatRunning) {
      console.log('Heartbeat already running, skipping setup');
      return;
    }
    
    // Clear any existing interval
    if (swHeartbeatInterval) {
      clearInterval(swHeartbeatInterval);
    }
    
    console.log('Starting service worker heartbeat');
    isHeartbeatRunning = true;
    
    // Set up a new interval to ping every 25 seconds
    // Service workers typically have a 30 second idle timeout
    swHeartbeatInterval = setInterval(() => {
      console.log('Service worker heartbeat');
      // Check chrome.storage is available
      if (chrome.storage) {
        chrome.storage.local.get(['heartbeat'], (result) => {
          const timestamp = Date.now();
          chrome.storage.local.set({ 'heartbeat': timestamp });
        });
      }
    }, 25000);
  };
  
  // Start the heartbeat
  startServiceWorkerHeartbeat();
  
  // Use a debounced version for event listeners to prevent multiple calls
  const debouncedStart = debounce(startServiceWorkerHeartbeat, 1000);
  
  // Register for wakeup events
  chrome.runtime.onStartup.addListener(debouncedStart);
  chrome.runtime.onInstalled.addListener(debouncedStart);
}

// Start the service worker heartbeat
setupServiceWorkerHeartbeat();

// Variabel untuk melacak token terakhir yang diproses
let lastProcessedToken: string | null = null;
let lastProcessedTime = 0;
const TOKEN_PROCESS_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam (1/4 dari periode pembaruan 24 jam)

// Function to fetch user profile and initialize connection
function fetchUserProfileAndConnect(token: string) {
  const now = Date.now();
  
  // Cek apakah token sama dengan yang terakhir diproses dan masih dalam interval
  if (token === lastProcessedToken && (now - lastProcessedTime) < TOKEN_PROCESS_INTERVAL) {
    console.log('Token sama dengan yang terakhir diproses dan masih dalam interval, melewati proses');
    return;
  }
  
  // Update token terakhir yang diproses dan waktu
  lastProcessedToken = token;
  lastProcessedTime = now;
  
  // Prevent multiple fetches
  if (userProfileFetched) {
    console.log('User profile already fetched, skipping');
    return;
  }
  
  // Get user ID from storage
  chrome.storage.local.get(['digitalPanelUserId'], (result) => {
    const storedUserId = result.digitalPanelUserId;
    if (storedUserId) {
      console.log('Using stored user ID:', storedUserId);
      initializeWebSocket(token, storedUserId);
    } else {
      // If no user ID in storage, fetch user profile
      console.log('No stored user ID, fetching profile from API');
      userProfileFetched = true; // Set flag to prevent multiple fetches
      
      // Set a timeout to reset the flag if fetch takes too long
      const fetchTimeoutId = setTimeout(() => {
        console.log('User profile fetch timeout, resetting flag');
        userProfileFetched = false;
      }, 30000); // 30 second timeout
      
      apiService.fetchUserProfile(token)
        .then(profile => {
          clearTimeout(fetchTimeoutId);
          if (profile && profile.id) {
            storeUserId(profile.id.toString());
            console.log("User profile fetched and stored successfully");
            
            // Initialize WebSocket connection
            initializeWebSocket(token, profile.id.toString());
          } else {
            console.error("Invalid user profile data");
            userProfileFetched = false; // Reset flag on invalid data
          }
        })
        .catch(error => {
          clearTimeout(fetchTimeoutId);
          console.error("Error fetching user profile:", error);
          userProfileFetched = false; // Reset flag on error
        });
    }
  });
}

// Initialize WebSocket connection on startup if token is available
getDigitalPanelToken().then(token => {
  if (token) {
    fetchUserProfileAndConnect(token);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  
  // Handle importing cookies
  if (message.action === "importCookies") {
    console.log("Background script received importCookies request");
    
    if (!message.cookies || !Array.isArray(message.cookies)) {
      console.error("Invalid cookies data");
      sendResponse({ success: false, error: "Invalid cookies data" });
      return true;
    }
    
    const cookies = message.cookies;
    let completedCount = 0;
    let errorCount = 0;
    
    // Process each cookie
    cookies.forEach(cookie => {
      try {
        // Buat URL yang lebih spesifik berdasarkan domain cookie
        let url;
        if (cookie.domain.startsWith('.')) {
          // Untuk domain yang dimulai dengan titik (misalnya .freepik.com)
          url = `https://www${cookie.domain}${cookie.path || '/'}`;
        } else {
          // Untuk domain tanpa titik di awal (misalnya www.freepik.com)
          url = `https://${cookie.domain}${cookie.path || '/'}`;
        }
        
        console.log(`Setting cookie: ${cookie.name} for domain ${cookie.domain} with URL ${url}`);
        
        // Use chrome.cookies API to set cookie with exact parameters from the cookie data
        chrome.cookies.set({
          url: url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure !== undefined ? cookie.secure : true,
          httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
          sameSite: 'no_restriction'
        }, (result) => {
          if (chrome.runtime.lastError) {
            console.error(`Error setting cookie ${cookie.name}:`, chrome.runtime.lastError);
            errorCount++;
          } else {
            console.log(`Cookie ${cookie.name} set successfully`);
            completedCount++;
          }
          
          // Check if all cookies have been processed
          if (completedCount + errorCount === cookies.length) {
            console.log(`Cookies import completed: ${completedCount} successful, ${errorCount} failed`);
            sendResponse({ 
              success: true, 
              completedCount, 
              errorCount 
            });
          }
        });
      } catch (error) {
        console.error(`Error processing cookie ${cookie.name}:`, error);
        errorCount++;
        
        // Check if all cookies have been processed
        if (completedCount + errorCount === cookies.length) {
          console.log(`Cookies import completed: ${completedCount} successful, ${errorCount} failed`);
          sendResponse({ 
            success: true, 
            completedCount, 
            errorCount 
          });
        }
      }
    });
    
    return true; // Keep the message channel open for async response
  }
  
  // Handle removing cookies
  if (message.action === "removeCookies") {
    console.log("Background script received removeCookies request");
    
    // Get all cookies for domain freepik.com
    chrome.cookies.getAll({ domain: 'freepik.com' }, (cookies) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting cookies:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      // If no cookies, respond immediately
      if (!cookies || cookies.length === 0) {
        console.log('No cookies found for freepik.com domain');
        sendResponse({ success: true, removedCount: 0 });
        return;
      }
      
      console.log(`Found ${cookies.length} cookies for freepik.com domain`);
      
      // Hapus semua cookies, bukan hanya cookies penting
      console.log(`Removing all ${cookies.length} cookies for freepik.com domain`);
      
      let completedCount = 0;
      const totalCookies = cookies.length;
      
      // If no cookies, respond immediately
      if (totalCookies === 0) {
        console.log('No cookies found to remove');
        sendResponse({ success: true, removedCount: 0 });
        return;
      }
      
      // Remove each cookie
      cookies.forEach(cookie => {
        console.log(`Removing important cookie: ${cookie.name}`);
        
        // Create URL based on cookie domain
        const protocol = cookie.secure ? 'https://' : 'http://';
        let url;
        
        if (cookie.domain.startsWith('.')) {
          url = `${protocol}www${cookie.domain}${cookie.path}`;
        } else {
          url = `${protocol}${cookie.domain}${cookie.path}`;
        }
        
        console.log(`Using URL for removal: ${url}`);
        
        // Remove cookie
        chrome.cookies.remove({
          url: url,
          name: cookie.name,
          storeId: cookie.storeId
        }, (details) => {
          if (chrome.runtime.lastError) {
            console.error(`Error removing cookie ${cookie.name}:`, chrome.runtime.lastError);
            
            // Try alternative URL
            const altUrl = `https://www.freepik.com${cookie.path}`;
            console.log(`Trying alternative URL: ${altUrl}`);
            
            chrome.cookies.remove({
              url: altUrl,
              name: cookie.name,
              storeId: cookie.storeId
            }, (altDetails) => {
              completedCount++;
              
              if (chrome.runtime.lastError) {
                console.error(`Error removing cookie ${cookie.name} with alternative URL:`, chrome.runtime.lastError);
              } else {
                console.log(`Cookie ${cookie.name} removed successfully with alternative URL`);
              }
              
              // Check if all cookies have been processed
              if (completedCount === totalCookies) {
                console.log('All important cookies removed');
                sendResponse({ success: true, removedCount: completedCount });
              }
            });
          } else {
            console.log(`Cookie ${cookie.name} removed successfully`);
            completedCount++;
            
            // Check if all cookies have been processed
            if (completedCount === totalCookies) {
              console.log('All important cookies removed');
              sendResponse({ success: true, removedCount: completedCount });
            }
          }
        });
      });
    });
    
    return true; // Keep the message channel open for async response
  }

// Handle storing token from content script
if (message.action === "storeToken") {
  // Cek apakah token sama dengan yang terakhir diproses dan masih dalam interval
  const now = Date.now();
  const TOKEN_PROCESS_INTERVAL_SHORT = 10 * 60 * 1000; // 10 menit (interval lebih pendek untuk mencegah loop)
  
  if (message.token === lastProcessedToken && (now - lastProcessedTime) < TOKEN_PROCESS_INTERVAL_SHORT) {
    console.log("Token sama dengan yang terakhir diproses dan masih dalam interval pendek, melewati penyimpanan");
    sendResponse({ success: true });
    return true;
  }
  
  // Update token terakhir yang diproses dan waktu
  lastProcessedToken = message.token;
  lastProcessedTime = now;
  
  
  storeDigitalPanelToken(message.token, message.source)
    .then(() => {
      console.log("Token stored successfully");
      sendResponse({ success: true });
      
      // Gunakan debounce untuk fetchUserProfileAndConnect
      if (fetchProfileDebounceTimer) {
        clearTimeout(fetchProfileDebounceTimer);
      }
      
      fetchProfileDebounceTimer = setTimeout(() => {
        // Use the token directly instead of fetching it again
        fetchUserProfileAndConnect(message.token);
        fetchProfileDebounceTimer = null;
      }, 500) as unknown as number;
      
      // Tidak perlu me-reload sidepanel karena sudah ada listener di sidePanel.tsx
      // yang akan mendeteksi perubahan token di storage dan me-refresh status secara otomatis
    })
    .catch(error => {
      console.error("Error storing token:", error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // Keep the message channel open for async response
}

  // Handle storing user info
  if (message.action === "storeUserInfo") {
    storeUserId(message.userId)
      .then(() => {
        console.log("User ID stored successfully");
        sendResponse({ success: true });
        
        // Initialize WebSocket connection if we have a token
        getDigitalPanelToken().then(token => {
          if (token) {
            // Use the stored user ID directly
            initializeWebSocket(token, message.userId);
          }
        });
      })
      .catch(error => {
        console.error("Error storing user ID:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }

  // Handle saving original tab before redirecting to login
  if (message.action === "saveOriginalTab") {
    storeOriginalTab(message.tabId, message.tabUrl)
      .then(() => {
        console.log("Original tab stored successfully");
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error("Error storing original tab:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }

  // Handle returning to original tab after login
  if (message.action === "returnToOriginalTab") {
    getOriginalTab()
      .then(originalTab => {
        if (originalTab && originalTab.id) {
          console.log("Returning to original tab:", originalTab);
          
          // Activate the original tab
          chrome.tabs.update(originalTab.id, { active: true }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error("Error returning to original tab:", chrome.runtime.lastError);
              // If tab doesn't exist anymore, create a new one with the URL
              chrome.tabs.create({ url: originalTab.url });
            }
          });
          
          // Close the current tab (login tab)
          if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
          }
          
          sendResponse({ success: true });
        } else {
          console.log("No original tab found");
          sendResponse({ success: false, error: "No original tab found" });
        }
      })
      .catch(error => {
        console.error("Error getting original tab:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }

  // Handle checking Freepik subscription
  if (message.action === "checkFreepikSubscription") {
    console.log("Checking Freepik subscription...");
    getTokenData()
      .then(tokenData => {
        if (!tokenData || !tokenData.token) {
          console.error("No token available for subscription check");
          sendResponse({ 
            success: false, 
            hasSubscription: false,
            error: "Not logged in to Digital Panel" 
          });
          return;
        }
        
        // Fetch user's active services to check for Freepik subscription
        apiService.fetchActiveServices(tokenData.token)
          .then(services => {
            console.log("Active services:", services);
            
            // Find Freepik subscription with service_type_id === 5 (AI service)
            const freepikSubscription = services.find(service => 
              service.name.toLowerCase().includes('freepik') && 
              service.service_type_id === 5
            );
            
            if (freepikSubscription) {
              console.log("Found Freepik subscription:", freepikSubscription);
              
              // Get prompt balance from redeems
              const promptBalance = freepikSubscription.redeems?.[0]?.prompt_balance;
              console.log("Prompt balance:", promptBalance);

              chrome.storage.local.set({ prompt_balance: promptBalance.toString() }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Error saving prompt_balance:', chrome.runtime.lastError);
                } else {
                  console.log('Prompt balance saved:', promptBalance);
                }
              });
              
              sendResponse({
                success: true,
                hasSubscription: true,
                limit: freepikSubscription.limit,
                active_period: freepikSubscription.active_period || 1,
                promptBalance: parseInt(promptBalance) || 0,
                service: freepikSubscription
              });
            } else {
              console.log("No valid Freepik subscription found");
              sendResponse({
                success: true,
                hasSubscription: false,
                limit: 0
              });
            }
          })
          .catch(error => {
            console.error("Error fetching active services:", error);
            sendResponse({ 
              success: false, 
              hasSubscription: false,
              error: error.message || "Failed to fetch active services" 
            });
          });
      })
      .catch(error => {
        console.error("Error getting token for subscription check:", error);
        sendResponse({ 
          success: false, 
          hasSubscription: false,
          error: error.message || "Failed to get authentication token" 
        });
      });
    
    return true;
  }

  // Handle sending data to Digital Panel (from freepik.ts)
  if (message.action === "sendDataToDigitalPanel") {
    getDigitalPanelToken()
      .then(token => {
        if (!token) {
          console.error("No token available for download request");
          sendResponse({ 
            success: false, 
            error: "Not logged in to Digital Panel" 
          });
          return;
        }
        
        const pageUrl = message.payload.page_url;
        
        apiService.sendDownloadRequest(token, pageUrl)
          .then(response => {
            console.log("Download request successful:", response);
            sendResponse({ 
              success: true, 
              data: response 
            });
          })
          .catch(error => {
            console.error("Error sending download request:", error);
            sendResponse({ 
              success: false, 
              error: error.message || "Failed to send download request" 
            });
          });
      })
      .catch(error => {
        console.error("Error getting token for download request:", error);
        sendResponse({ 
          success: false, 
          error: error.message || "Failed to get authentication token" 
        });
      });
    
    return true;
  }
  
  // Handle opening download tab
  if (message.action === "openDownloadTab") {
    console.log('Opening download tab:', message.url);
    
    // Open in new tab, but keep current tab active
    chrome.tabs.create({ url: message.url, active: false }, (tab) => {
      console.log('Download tab created:', tab?.id);
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle processing download (from API response)
  if (message.action === "processDownload") {
    console.log('Processing download from API response:', message.downloadData);
    
    try {
      const data = message.downloadData;
      
      if (!data) {
        console.error('No download data provided');
        sendResponse({ success: false, error: 'No download data provided' });
        return true;
      }
      
      // Play notification sound
      playNotificationSound();
      
      // Show notification
      showNotification('Download Siap', 'File anda siap untuk diunduh');
      
      // Gunakan getDigitalPanelToken untuk mendapatkan token langsung dari storage
      getDigitalPanelToken().then(token => {
        if (token) {
          // Construct download URL
          let downloadUrl = '';
          
          // If download_file is already a complete URL, use it directly but ensure it has token
          if (data.download_file && data.download_file.startsWith('http')) {
            downloadUrl = data.download_file;
            
            // Check if URL already has token parameter
            if (!downloadUrl.includes('_token=')) {
              // Add token parameter
              const separator = downloadUrl.includes('?') ? '&' : '?';
              downloadUrl = `${downloadUrl}${separator}_token=${token}`;
            }
          } else {
            // Otherwise construct URL in the same way as websocket handler
            downloadUrl = `${API_BASE_URL}/api/v2/downloads/${data.id}/file/${data.downloaded?.file_name}?_token=${token}`;
          }
          
          console.log('Starting automatic download:', downloadUrl);
          
          // Open in new tab, but keep current tab active
          chrome.tabs.create({ url: downloadUrl, active: false }, (tab) => {
            console.log('Download tab created:', tab?.id);
          });
        } else {
          console.error('No token available for download');
          showNotification('Error', 'No authentication token available');
        }
      }).catch(error => {
        console.error('Error getting token for download:', error);
        showNotification('Error', 'Failed to get authentication token');
      });
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error processing download:', error);
      sendResponse({ success: false, error: 'Error processing download' });
    }
    
    return true;
  }
});

// Function to play notification sound
function playNotificationSound() {
  try {
    console.log('Playing notification sound');
    
    // Dalam service worker, kita tidak bisa menggunakan Audio API langsung
    // Kita bisa menggunakan chrome.tts API jika tersedia
    if (chrome.tts) {
      chrome.tts.speak('Notification', {
        'rate': 1.0,
        'pitch': 1.0,
        'volume': 1.0
      });
    }
    
    // Kita juga bisa mencoba memainkan suara dengan mengirim pesan ke tab yang kita kontrol
    // Ini adalah pendekatan alternatif jika tts tidak tersedia atau tidak berfungsi
    chrome.tabs.query({url: chrome.runtime.getURL("*")}, function(tabs) {
      if (tabs.length > 0) {
        // Kirim pesan ke tab ekstensi kita sendiri
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "playNotificationSound"
        }).catch(error => {
          console.error('Error sending message to extension tab:', error);
        });
      }
    });
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

// Show simple notification
function showNotification(title: string, message: string) {
  try {
    // Create notification with unique ID
    const notificationId = `dp-notification-${Date.now()}`;
    
    // Create basic notification
    chrome.notifications.create(
      notificationId, 
      {
        type: "basic",
        iconUrl: "/assets/icon.png",
        title: title,
        message: message,
        priority: 2,
        requireInteraction: true // Keep notification visible until user dismisses it
      }
    );
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Register side panel
if (chrome.sidePanel) {
  // Set default options for side panel
  chrome.sidePanel.setOptions({
    enabled: true,
    path: "sidepanel.html"
  });
  
  // Allow users to open the side panel by clicking on the action toolbar icon
  chrome.sidePanel.setPanelBehavior({ 
    openPanelOnActionClick: true 
  }).catch((error) => console.error("Error setting panel behavior:", error));
}

// Handle action click to open side panel
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel) {
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      console.error("Error opening side panel:", error);
    });
  }
});

// Inisialisasi credit monitor
initializeCreditMonitor();

console.log("Background script ready.");
