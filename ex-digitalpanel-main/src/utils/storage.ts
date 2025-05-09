// Utility functions for Chrome storage

export interface TokenData {
  token: string;
  source: string;
  timestamp: number;
  userId?: string;
}

// Sound notification preferences
export interface NotificationPreferences {
  soundEnabled: boolean;
}

// Store Digital Panel token
export async function storeDigitalPanelToken(token: string, source: string): Promise<void> {
  try {
    if (!token) {
      throw new Error('[Token] Cannot store empty token');
    }

    // Cek apakah token sudah ada di storage
    const existingData = await chrome.storage.local.get('digitalPanelToken');
    const existingToken = existingData.digitalPanelToken?.token;
    const existingTimestamp = existingData.digitalPanelToken?.timestamp || 0;
    const now = Date.now();
    
    // Jika token sama dengan yang sudah ada dan belum 12 jam, skip penyimpanan
    const TOKEN_REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 jam dalam milidetik
    
    if (existingToken === token && (now - existingTimestamp) < TOKEN_REFRESH_INTERVAL) {
      console.log('[Token] Skipping storage - token is still valid for', {
        remainingTime: Math.round((TOKEN_REFRESH_INTERVAL - (now - existingTimestamp)) / (60 * 1000)), // dalam menit
        source
      });
      return;
    }
    
    const tokenData: TokenData = {
      token,
      source,
      timestamp: now
    };
    
    await chrome.storage.local.set({ digitalPanelToken: tokenData });
    console.log('[Token] Stored successfully:', {
      source,
      timestamp: new Date(now).toISOString()
    });
  } catch (error) {
    console.error('[Token] Error storing token:', error);
    throw error;
  }
}

// Get Digital Paneltoken
export async function getDigitalPanelToken(): Promise<string | null> {
  try {
    const data = await chrome.storage.local.get('digitalPanelToken');
    console.log('[Token Debug] Current storage state:', {
      hasToken: !!data.digitalPanelToken?.token,
      tokenSource: data.digitalPanelToken?.source,
      lastUpdated: data.digitalPanelToken?.timestamp ? 
        new Date(data.digitalPanelToken.timestamp).toISOString() : 'never'
    });
    
    if (data.digitalPanelToken?.token) {
      return data.digitalPanelToken.token;
    }
    return null;
  } catch (error) {
    console.error('[Token] Error getting token:', error);
    return null;
  }
}

// Get full token data
export async function getTokenData(): Promise<TokenData | null> {
  try {
    const data = await chrome.storage.local.get('digitalPanelToken');
    if (data.digitalPanelToken) {
      console.log('[Token] Found token data:', {
        source: data.digitalPanelToken.source,
        timestamp: new Date(data.digitalPanelToken.timestamp).toISOString()
      });
      return data.digitalPanelToken as TokenData;
    }
    console.warn('[Token] No token data found in storage');
    return null;
  } catch (error) {
    console.error('[Token] Error getting token data:', error);
    return null;
  }
}

// Store user ID
export async function storeUserId(userId: string): Promise<void> {
  try {
    const tokenData = await getTokenData();
    if (tokenData) {
      const updatedTokenData: TokenData = {
        ...tokenData,
        userId
      };
      await chrome.storage.local.set({ digitalPanelToken: updatedTokenData });
      console.log('User ID stored successfully');
    }
  } catch (error) {
    console.error('Error storing user ID:', error);
  }
}

// Store original tab information
export async function storeOriginalTab(tabId: number, tabUrl: string): Promise<void> {
  try {
    await chrome.storage.local.set({ 
      originalTab: { 
        id: tabId, 
        url: tabUrl,
        timestamp: Date.now()
      } 
    });
    console.log('Original tab stored successfully');
  } catch (error) {
    console.error('Error storing original tab:', error);
  }
}

// Get original tab information
export async function getOriginalTab(): Promise<{ id: number; url: string } | null> {
  try {
    const data = await chrome.storage.local.get('originalTab');
    if (data.originalTab) {
      return data.originalTab;
    }
    return null;
  } catch (error) {
    console.error('Error getting original tab:', error);
    return null;
  }
}

// Clear Digital Panel data
export async function clearDigitalPanelData(): Promise<void> {
  try {
    await chrome.storage.local.remove(['digitalPanelToken', 'originalTab']);
    console.log('Digital Panel data cleared successfully');
  } catch (error) {
    console.error('Error clearing Digital Panel data:', error);
  }
}

// Get notification preferences
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const data = await chrome.storage.local.get('notificationPreferences');
    if (data.notificationPreferences) {
      return data.notificationPreferences as NotificationPreferences;
    }
    // Default preferences if not set
    return { soundEnabled: true };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    // Default preferences on error
    return { soundEnabled: true };
  }
}

// Save notification preferences
export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  try {
    await chrome.storage.local.set({ notificationPreferences: preferences });
    console.log('Notification preferences saved successfully');
  } catch (error) {
    console.error('Error saving notification preferences:', error);
  }
}
