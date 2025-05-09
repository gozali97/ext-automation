import React, { useEffect, useState } from "react"
import type { TokenData, NotificationPreferences } from "~utils/storage"
import { getNotificationPreferences, saveNotificationPreferences } from "~utils/storage"

interface StatusIndicatorProps {
  status: string
  isLoggedIn: boolean
  isRefreshing: boolean
  tokenData: TokenData | null
  onRefresh: () => void
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  isLoggedIn,
  isRefreshing,
  tokenData,
  onRefresh
}) => {
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({ soundEnabled: true });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getNotificationPreferences();
        setNotificationPrefs(prefs);
      } catch (error) {
        console.error("Error loading notification preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Toggle sound notifications
  const toggleSoundNotifications = async () => {
    try {
      const newPrefs = { 
        ...notificationPrefs, 
        soundEnabled: !notificationPrefs.soundEnabled 
      };
      await saveNotificationPreferences(newPrefs);
      setNotificationPrefs(newPrefs);
    } catch (error) {
      console.error("Error saving notification preferences:", error);
    }
  };

  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div style={{ 
      borderRadius: 8, 
      backgroundColor: isLoggedIn ? "#ECFDF5" : "#FEF2F2", 
      padding: 12,
      marginBottom: 16,
      position: "relative",
      border: `1px solid ${isLoggedIn ? "#D1FAE5" : "#FEE2E2"}`
    }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between" 
      }}>
        <span style={{ 
          fontWeight: 600, 
          color: isLoggedIn ? "#065F46" : "#991B1B",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <div style={{ 
            width: 12, 
            height: 12, 
            borderRadius: "50%", 
            backgroundColor: isLoggedIn ? "#10B981" : "#EF4444" 
          }} />
          Status: {status}
        </span>
        
        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: "#F9FAFB",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isRefreshing ? "default" : "pointer",
            padding: 0,
            transition: "all 0.2s ease"
          }}
          title="Refresh connection status"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke={isRefreshing ? "#2563EB" : "#6B7280"} 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              animation: isRefreshing ? "spin 1s linear infinite" : "none",
              // Tambahkan animationPlayState untuk menghentikan animasi jika tidak refreshing
              animationPlayState: isRefreshing ? "running" : "paused"
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      
      {isLoggedIn && (
        <div style={{
          marginTop: 8,
          fontSize: "0.8rem",
          color: "#065F46"
        }}>
          <div style={{display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Koneksi aman dengan Digital Panel</span>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Terakhir diperbarui: {tokenData?.timestamp ? formatDate(tokenData.timestamp) : "Unknown"}</span>
          </div>
          
          {/* Sound notification toggle */}
          <div style={{
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            marginTop: "8px",
            padding: "4px 0"
          }}>
            <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                {notificationPrefs.soundEnabled && (
                  <>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </>
                )}
                {!notificationPrefs.soundEnabled && (
                  <line x1="23" y1="9" x2="17" y2="15"></line>
                )}
              </svg>
              <span>Notifikasi Suara</span>
            </div>
            
            <button 
              onClick={toggleSoundNotifications}
              disabled={isLoading}
              style={{
                width: "36px",
                height: "20px",
                borderRadius: "10px",
                backgroundColor: notificationPrefs.soundEnabled ? "#10B981" : "#E5E7EB",
                position: "relative",
                transition: "background-color 0.2s",
                border: "none",
                cursor: "pointer",
                padding: 0
              }}
            >
              <div 
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  position: "absolute",
                  top: "2px",
                  left: notificationPrefs.soundEnabled ? "18px" : "2px",
                  transition: "left 0.2s"
                }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StatusIndicator
