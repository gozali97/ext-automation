import type { PlasmoCSConfig } from "plasmo"

// export const config: PlasmoCSConfig = {
//   matches: [  "*://*.freepik.com/*",
//     "*://*.motionarray.com/*",
//     "*://*.elements.envato.com/*",
//     "https://app.digitalpanel.id/*"],
//   all_frames: true
// }

// Check if sound notifications are enabled
async function isSoundEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('notificationPreferences');
    if (result.notificationPreferences) {
      return result.notificationPreferences.soundEnabled;
    }
    return true; // Default to enabled if preference not set
  } catch (error) {
    console.error('Error checking sound notification preferences:', error);
    return true; // Default to enabled on error
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);

  // Handle playing notification sound
  if (message.action === "playNotificationSound") {
    // Check if sound is enabled before playing
    isSoundEnabled().then(soundEnabled => {
      if (!soundEnabled) {
        console.log('Sound notifications are disabled. Skipping playback.');
        sendResponse({ success: true, skipped: true });
        return;
      }
      
      try {
        console.log('Playing notification sound in content script');
        
        // Create audio element with fixed path to notification sound
        const audio = new Audio(chrome.runtime.getURL('assets/notification.mp3'));
        
        // Play the sound
        audio.play().then(() => {
          console.log('Notification sound played successfully');
          sendResponse({ success: true });
        }).catch(error => {
          console.error('Error playing notification sound:', error);
          sendResponse({ success: false, error: error.message });
        });
      } catch (error) {
        console.error('Error creating audio element:', error);
        sendResponse({ success: false, error: error.message });
      }
    }).catch(error => {
      console.error('Error checking sound preferences:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  // Default return for unhandled messages
  return false;
});

console.log("Digital Panel notification handler content script loaded");
