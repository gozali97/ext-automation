// Credit Monitor untuk menangkap permintaan ke consume-credits API dan video generator
import { calculateTotalCredits } from "~utils/modelCredits";
import type { ToolType } from "~utils/modelCredits";
import { getTokenData } from "~utils/storage";
import { apiService } from "~utils/api";
const API_BASE_URL = 'https://api.digitalpanel.id';


/**
 * Inisialisasi monitor kredit untuk menangkap permintaan ke consume-credits API
 */
// Fungsi untuk menangkap character count dari AI Voice Generator
function createVoiceGeneratorContentScript() {
  // Buat content script untuk memantau perubahan DOM
  const script = `
    (function() {
      // Log untuk debugging
      console.log('[Voice Generator Script] Content script loaded');
      
      // Variabel untuk menyimpan nilai terakhir
      let lastCharacterCount = 0;
      
      // Fungsi untuk mengirim data ke background
      function sendCharacterCount(count) {
        if (count !== lastCharacterCount) {
          lastCharacterCount = count;
          console.log('[Voice Generator Script] Sending character count:', count);
          chrome.runtime.sendMessage({
            action: 'voiceGeneratorCharacterCount',
            count: count
          });
        }
      }
      
      // Observer untuk memantau perubahan DOM
      const observer = new MutationObserver(function(mutations) {
        const lengthElement = document.getElementById('current-length');
        if (lengthElement) {
          const count = parseInt(lengthElement.textContent || '0', 10);
          sendCharacterCount(count);
        }
      });
      
      // Fungsi untuk memulai observasi
      function startObserving() {
        const lengthElement = document.getElementById('current-length');
        if (lengthElement) {
          // Kirim nilai awal
          const count = parseInt(lengthElement.textContent || '0', 10);
          sendCharacterCount(count);
          
          // Mulai observasi
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
          });
          console.log('[Voice Generator Script] Started observing DOM changes');
        } else {
          // Coba lagi setelah beberapa waktu
          setTimeout(startObserving, 1000);
        }
      }
      
      // Mulai observasi ketika DOM sudah siap
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
      } else {
        startObserving();
      }
    })();
  `;
  
  return script;
}

export function initializeCreditMonitor(): void {
  console.log("Initializing credit monitor for consume-credits API and video generator");
  
  // Variabel untuk menyimpan character count dari AI Voice Generator
  let voiceGeneratorCharacterCount = 0;
  
  // Listener untuk pesan dari content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'voiceGeneratorCharacterCount') {
      voiceGeneratorCharacterCount = message.count;
      console.log('[Voice Generator] Updated character count:', voiceGeneratorCharacterCount);
    }
    return true;
  });
  
  // Inject content script ke halaman AI Voice Generator
  chrome.webNavigation?.onCompleted.addListener(async (details) => {
    if (details.url.includes('freepik.com/audio/ai-voice-generator')) {
      try {
        console.log('[Voice Generator] Injecting content script to tab:', details.tabId);
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          func: () => {
            // Log untuk debugging
            console.log('[Voice Generator Script] Content script loaded');
            
            // Variabel untuk menyimpan nilai terakhir
            let lastCharacterCount = 0;
            
            // Fungsi untuk mengirim data ke background
            function sendCharacterCount(count) {
              if (count !== lastCharacterCount) {
                lastCharacterCount = count;
                console.log('[Voice Generator Script] Sending character count:', count);
                chrome.runtime.sendMessage({
                  action: 'voiceGeneratorCharacterCount',
                  count: count
                });
              }
            }
            
            // Observer untuk memantau perubahan DOM
            const observer = new MutationObserver(function() {
              const lengthElement = document.getElementById('current-length');
              if (lengthElement) {
                const count = parseInt(lengthElement.textContent || '0', 10);
                sendCharacterCount(count);
              }
            });
            
            // Fungsi untuk memulai observasi
            function startObserving() {
              const lengthElement = document.getElementById('current-length');
              if (lengthElement) {
                // Kirim nilai awal
                const count = parseInt(lengthElement.textContent || '0', 10);
                sendCharacterCount(count);
                
                // Mulai observasi
                observer.observe(document.body, {
                  childList: true,
                  subtree: true,
                  characterData: true
                });
                console.log('[Voice Generator Script] Started observing DOM changes');
              } else {
                // Coba lagi setelah beberapa waktu
                setTimeout(startObserving, 1000);
              }
            }
            
            // Mulai observasi ketika DOM sudah siap
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', startObserving);
            } else {
              startObserving();
            }
          }
        });
      } catch (error) {
        console.error('[Voice Generator] Error injecting content script:', error);
      }
    }
  }, { url: [{ urlContains: 'freepik.com/audio/ai-voice-generator' }] });
  
  // Menangkap permintaan ke consume-credits API
  chrome.webRequest.onBeforeRequest.addListener(
    function(details): chrome.webRequest.BlockingResponse {
      // Cek apakah URL cocok dengan yang diinginkan
      if (details.url.includes("/pikaso/api/v2/consume-credits") && details.requestBody?.raw) {
        try {
          const decoder = new TextDecoder("utf-8");
          const rawData = details.requestBody.raw[0].bytes;
          const bodyString = decoder.decode(rawData);
          const payload = JSON.parse(bodyString);
          
          console.log("Consume-credits payload:", payload); 
          
          // Hitung kredit yang akan digunakan
          if (payload.tool && payload.mode) {
            const totalCredits = calculateTotalCredits({
              tool: payload.tool as ToolType,
              mode: payload.mode,
              generations: payload.generations || 1
            });
            
            console.log(`Credits to be used: ${totalCredits} (${payload.tool}, ${payload.mode}, ${payload.generations || 1} generations)`);
            
            // Mulai proses pengecekan kredit secara async
            checkCreditsAndProcess(details.tabId, totalCredits, payload);
            
            // Sementara izinkan request untuk dilanjutkan
            // Jika kredit tidak mencukupi, request akan dibatalkan oleh background script
            return { cancel: false };
          }
        } catch (error) {
          console.error("Error parsing consume-credits payload:", error);
        }
      }
      
      return { cancel: false };
    },
    { urls: ["*://*.freepik.com/pikaso/api/v2/consume-credits*"] },
    ["requestBody"]
  );

  // Fungsi helper untuk melakukan pengecekan kredit dan pemrosesan
  async function checkCreditsAndProcess(tabId: number, totalCredits: number, payload: any) {
    try {
      const tokenData = await getTokenData();
      if (!tokenData?.token) {
        console.error("No token available");
        return;
      }

      // Fetch active services untuk mendapatkan prompt balance
      const services = await apiService.fetchActiveServices(tokenData.token);
      const aiService = services.find(service => 
        service.service_type_id === 5 && 
        service.redeems?.[0]?.prompt_balance
      );

      if (!aiService) {
        console.error("No AI service found");
        return;
      }

      const promptBalance = parseInt(aiService.redeems[0].prompt_balance) || 0;
      console.log("Current prompt balance:", promptBalance);

      // Cek apakah kredit mencukupi
      if (totalCredits > promptBalance) {
        console.log("Insufficient credits. Required:", totalCredits, "Available:", promptBalance);
        
        // Kirim pesan ke content script untuk menampilkan popup
        if (tabId > 0) {
          chrome.tabs.sendMessage(tabId, {
            action: "showInsufficientCreditsPopup",
            required: totalCredits,
            available: promptBalance
          }).catch(error => {
            console.error("Error sending message to content script:", error);
          });
        }
        
        // Cancel request melalui background script
        chrome.tabs.sendMessage(tabId, {
          action: "cancelGeneration",
          reason: "insufficient_credits"
        }).catch(error => {
          console.error("Error sending cancel message:", error);
        });
        
        return;
      }

      // Jika kredit mencukupi, kirim data penggunaan prompt ke API
      if (payload.tool === 'text-to-image' && payload.mode) {
        const promptUsageData = {
          mode: payload.mode,
          category: "image",
          generations: payload.generations || 1
        };

        const response = await fetch(`${API_BASE_URL}/api/v2/prompt-usage`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(promptUsageData)
        });

        const data = await response.json();
        if (data.status === 'success') {
          console.log("Prompt usage updated successfully");
          chrome.runtime.sendMessage({
            action: "refreshServices",
            token: tokenData.token
          });
        }
      }
    } catch (error) {
      console.error("Error in checkCreditsAndProcess:", error);
    }
  }

  // Menangkap respons dari consume-credits API
  chrome.webRequest.onCompleted.addListener(
    function(details) {
      if (details.url.includes("/pikaso/api/v2/consume-credits")) {
        console.log("Consume-credits API request completed:", details.url);
        console.log("Status code:", details.statusCode);
        
        // Kirim data ke content script
        if (details.tabId > 0) {
          chrome.tabs.sendMessage(details.tabId, {
            action: "consumeCreditsResponse",
            success: details.statusCode >= 200 && details.statusCode < 300,
            statusCode: details.statusCode,
            requestId: details.requestId
          }).catch(error => {
            console.error("Error sending response to content script:", error);
          });
        }
      }
    },
    { urls: ["*://*.freepik.com/pikaso/api/v2/consume-credits*"] },
    ["responseHeaders"]
  );

  // Menangkap error pada consume-credits API
  chrome.webRequest.onErrorOccurred.addListener(
    function(details) {
      if (details.url.includes("/pikaso/api/v2/consume-credits")) {
        console.log("Error in consume-credits API request:", details.url);
        console.log("Error:", details.error);
        
        // Kirim data ke content script
        if (details.tabId > 0) {
          chrome.tabs.sendMessage(details.tabId, {
            action: "consumeCreditsError",
            error: details.error,
            requestId: details.requestId
          }).catch(error => {
            console.error("Error sending error to content script:", error);
          });
        }
      }
    },
    { urls: ["*://*.freepik.com/pikaso/api/v2/consume-credits*"] }
  );
  
    // Tracking untuk request yang valid
  const processedRequests = new Set<string>();

  // Monitor untuk AI Voice Generator
  chrome.webRequest.onBeforeRequest.addListener(
    function(details): chrome.webRequest.BlockingResponse {
      // Process request asynchronously without blocking
      (async () => {
      if (details.method === 'POST') {
        try {
          // Get token data
          const tokenData = await getTokenData();
          if (!tokenData?.token) {
            console.warn('[Voice Generator] No token available');
            return { cancel: false };
          }

          // Ambil character count dari localStorage yang disimpan oleh content script
          let characterCount = 0;
          
          try {
            // Ambil data dari storage
            const data = await chrome.storage.local.get('voice_generator_character_count');
            characterCount = data.voice_generator_character_count || 0;
            console.log('[Voice Generator] Retrieved character count from storage:', characterCount);
          } catch (error) {
            console.warn('[Voice Generator] Error getting character count from storage:', error);
          }
          
          // Jika character count dari storage tidak tersedia, coba ambil dari request body
          if (characterCount === 0 && details.requestBody?.raw?.[0]?.bytes) {
            try {
              const decoder = new TextDecoder("utf-8");
              const rawData = details.requestBody.raw[0].bytes;
              const bodyString = decoder.decode(rawData);
              const payload = JSON.parse(bodyString);
              
              // Try to extract character count from payload
              if (payload.text) {
                characterCount = payload.text.length;
                console.log('[Voice Generator] Character count from payload:', characterCount);
              }
            } catch (error) {
              console.warn('[Voice Generator] Error parsing request body:', error);
            }
          }

          // Calculate generations
          const charactersPerUnit = 80;
          const generationsPerUnit = 50;
          const units = Math.ceil(characterCount / charactersPerUnit);
          const generations = units * generationsPerUnit;

          console.log('[Voice Generator] Calculated generations:', {
            characterCount,
            units,
            generations
          });

          // Prepare usage data
          const promptUsageData = {
            mode: 'voice',
            category: 'audio',
            generations: generations
          };

          console.log('[Voice Generator] Sending prompt usage:', promptUsageData);

          // Send usage data
          const response = await fetch(`${API_BASE_URL}/api/v2/prompt-usage`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenData.token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(promptUsageData)
          });

          console.log('[Voice Generator] Response:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
          }

          const data = await response.json();
          if (data.status === 'success') {
            console.log('[Voice Generator] Usage updated successfully');
            chrome.runtime.sendMessage({
              action: 'refreshServices',
              token: tokenData.token
            }).catch(err => {
              console.warn('[Voice Generator] Error refreshing services:', err);
            });
          } else {
            console.warn('[Voice Generator] Update failed:', data);
          }

        } catch (error) {
          console.error('[Voice Generator] Error:', error);
        }
      }
      })().catch(error => {
        console.error('[Voice Generator] Async processing error:', error);
      });
      
      return { cancel: false };
    },
    { urls: ["*://*.freepik.com/audio/ai-voice-generator/generate*"] },
    ["requestBody"]
  );

  // Monitor untuk Video Generator Credits
  chrome.webRequest.onBeforeRequest.addListener(
    function(details): chrome.webRequest.BlockingResponse {
      // Skip jika bukan method POST
      if (details.method !== 'POST') {
        return { cancel: false };
      }

      if (!details.requestBody?.raw?.[0]?.bytes) {
        console.warn("[Video Generator] No request body available");
        return { cancel: false };
      }

      try {
        // Parse request body
        const decoder = new TextDecoder("utf-8");
        const rawData = details.requestBody.raw[0].bytes;
        const bodyString = decoder.decode(rawData);
        const payload = JSON.parse(bodyString);

        // Validasi payload
        if (!payload?.video?.clips?.[0]) {
          console.warn("[Video Generator] Invalid payload structure");
          return { cancel: false };
        }
``
        // Check untuk duplikasi
        if (processedRequests.has(details.requestId)) {
          console.log("[Video Generator] Duplicate request detected, skipping");
          return { cancel: false };
        }

        // Extract data
        const videoData = payload.video;
        const clipData = videoData.clips[0];

        // Validate required fields
        const requiredFields = ['prompt', 'duration', 'mode', 'model'];
        const missingFields = requiredFields.filter(field => !clipData[field]);
        if (missingFields.length > 0) {
          console.error("[Video Generator] Missing required fields:", missingFields);
          return { cancel: false };
        }

        // Mark request as processed
        processedRequests.add(details.requestId);

        // Log request details
        console.log("[Video Generator] Valid Request Detected:", {
          requestId: details.requestId,
          family: videoData.family,
          clipInfo: {
            prompt: clipData.prompt,
            duration: clipData.duration,
            resolution: clipData.resolution || "720p",
            mode: clipData.mode,
            model: clipData.model,
            api: clipData.api
          }
        });

        // Process video generator request in background without blocking
        processVideoGeneratorRequest(details.requestId, clipData, tokenData => {
          if (tokenData) {
            chrome.runtime.sendMessage({
              action: 'refreshServices',
              token: tokenData
            }).catch(err => {
              console.warn('[Video Generator] Error refreshing services:', err);
            });
          }
        });

      } catch (error) {
        console.error("[Video Generator] Error processing request:", error);
        // Remove from tracking if error occurs
        processedRequests.delete(details.requestId);
      }

      // Never block the request
      return { cancel: false };
    },
    { urls: ["*://*.freepik.com/pikaso/api/video/generate*"] },
    ["requestBody"]
  );

  // Separate async function to process video generator requests
  async function processVideoGeneratorRequest(requestId: string, clipData: any, callback?: (token: string | null) => void) {
    try {
      // Get token data
      const tokenData = await getTokenData();
      if (!tokenData?.token) {
        throw new Error("No token available");
      }

      // Prepare prompt usage data
      const promptUsageData = {
        mode: clipData.mode,
        model: clipData.model,
        category: "video",
        resolution: clipData.resolution,
        duration: clipData.duration,
        aspect_ratio: clipData.aspectRatio,
        api: clipData.api
      };

      // Debug token
      console.log('[Video Generator] Using token:', {
        tokenExists: !!tokenData.token,
        tokenLength: tokenData.token?.length,
        source: tokenData.source
      });

      // Debug prompt usage data
      console.log('[Video Generator] Sending prompt usage:', promptUsageData);

      // Update prompt usage
      const response = await fetch(`${API_BASE_URL}/api/v2/prompt-usage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(promptUsageData)
      });

      console.log('[Video Generator] Prompt usage response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Video Generator] Prompt usage response data:', data);

      if (data.status === 'success') {
        console.log('[Video Generator] Prompt usage updated successfully');
        if (callback) callback(tokenData.token);
      } else {
        console.warn('[Video Generator] Prompt usage update failed:', data);
        if (callback) callback(null);
      }

      // Calculate credits
      const creditInfo = {
        baseCredits: 1,
        durationMultiplier: clipData.duration / 5,
        resolutionMultiplier: clipData.resolution === "720p" ? 1 : 1.5,
        totalEstimatedCredits: 0
      };

      creditInfo.totalEstimatedCredits =
        Math.round(
          (creditInfo.baseCredits *
          creditInfo.durationMultiplier *
          creditInfo.resolutionMultiplier) * 100
        ) / 100; // Round to 2 decimal places

      console.log("[Video Generator] Credit Estimation:", {
        requestId: requestId,
        credits: creditInfo
      });

    } catch (error) {
      console.error("[Video Generator] Error processing prompt usage:", error);
      if (callback) callback(null);
    }
  }

  // Monitor response dari Video Generator dengan response body
  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      if (details.method === 'POST' && details.requestBody?.raw) {
        try {
          const decoder = new TextDecoder("utf-8");
          const rawData = details.requestBody.raw[0].bytes;
          const bodyString = decoder.decode(rawData);
          const payload = JSON.parse(bodyString);

          console.log("[Video Generator] Request Payload:", {
            requestId: details.requestId,
            url: details.url,
            payload: payload
          });

          // Simpan requestId untuk tracking
          processedRequests.add(details.requestId);
        } catch (error) {
          console.error("[Video Generator] Error parsing request payload:", error);
        }
      }
      return { cancel: false };
    },
    { urls: ["*://*.freepik.com/pikaso/api/video/generate*"] },
    ["requestBody"]
  );

  // Monitor response headers dan status
  chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
      if (processedRequests.has(details.requestId)) {
        const responseHeaders: {[key: string]: string} = {};
        details.responseHeaders?.forEach(header => {
          if (header.name && header.value) {
            responseHeaders[header.name.toLowerCase()] = header.value;
          }
        });

        console.log("[Video Generator] Response Headers:", {
          requestId: details.requestId,
          statusCode: details.statusCode,
          headers: responseHeaders
        });
      }
      return { responseHeaders: details.responseHeaders };
    },
    { urls: ["*://*.freepik.com/pikaso/api/video/generate*"] },
    ["responseHeaders", "blocking"]
  );

  // Monitor completed requests untuk mendapatkan final status
  chrome.webRequest.onCompleted.addListener(
    function(details) {
      if (processedRequests.has(details.requestId)) {
        console.log("[Video Generator] Request Completed:", {
          requestId: details.requestId,
          url: details.url,
          statusCode: details.statusCode,
          timeStamp: new Date(details.timeStamp).toISOString()
        });

        // Hapus dari tracking setelah selesai
        processedRequests.delete(details.requestId);
      }
    },
    { urls: ["*://*.freepik.com/pikaso/api/video/generate*"] }
  );

  // Monitor error requests
  chrome.webRequest.onErrorOccurred.addListener(
    function(details) {
      if (processedRequests.has(details.requestId)) {
        console.error("[Video Generator] Request Failed:", {
          requestId: details.requestId,
          url: details.url,
          error: details.error,
          timeStamp: new Date(details.timeStamp).toISOString()
        });

        // Hapus dari tracking setelah error
        processedRequests.delete(details.requestId);    
      }
    },
    { urls: ["*://*.freepik.com/pikaso/api/video/generate*"] }
  );

  console.log("Credit monitor initialized successfully");
}
