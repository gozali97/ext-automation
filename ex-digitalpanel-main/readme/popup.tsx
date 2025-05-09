import { useEffect, useState } from "react"
import { clearDigitalPanelData, getDigitalPanelToken, getTokenData } from "./utils/storage"
import type { TokenData } from "./utils/storage"

function IndexPopup() {
  const [status, setStatus] = useState<string>("Loading...")
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [showToken, setShowToken] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Check if user is logged in to Digital Panel
  const checkLoginStatus = async () => {
    setIsRefreshing(true)
    setStatus("Checking connection...")
    try {
      // First try to get from localStorage directly
      if (chrome.tabs) {
        // Create a tab to digital panel to check for token
        chrome.tabs.query({url: "https://app.digitalpanel.id/*"}, (tabs) => {
          // If already have a tab open to digitalpanel, use it
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "checkTokenInPage" },
              (response) => {
                // This might not get a response if the content script hasn't loaded
                if (response && response.success) {
                  console.log("Got token from page")
                }
              }
            )
          }
        })
      }
      
      // Then check storage for token
      const tokenData = await getTokenData()
      if (tokenData?.token) {
        setTokenData(tokenData)
        setIsLoggedIn(true)
        setStatus("Connected to Digital Panel")
      } else {
        setIsLoggedIn(false)
        setStatus("Not connected to Digital Panel")
      }
    } catch (error) {
      console.error("Error checking login status:", error)
      setStatus("Error checking connection")
    } finally {
      setIsRefreshing(false)
    }
  }
  
  // Check login status on component mount
  useEffect(() => {
    checkLoginStatus()
  }, [])

  // Copy token to clipboard
  const copyToken = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(err => console.error('Failed to copy token:', err))
    }
  }

  // Handle login to Digital Panel
  const handleLogin = () => {
    // Save current tab before redirecting
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0]?.url) {
        chrome.runtime.sendMessage({
          action: 'saveOriginalTab',
          tabId: tabs[0].id,
          tabUrl: tabs[0].url
        })
      }
      
      // Open Digital Panel login page
      chrome.tabs.create({ url: 'https://app.digitalpanel.id/signin' })
    })
  }

  // Handle logout from Digital Panel
  const handleLogout = async () => {
    await clearDigitalPanelData()
    setTokenData(null)
    setIsLoggedIn(false)
    setStatus("Not connected to Digital Panel")
  }

  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div
      style={{
        padding: 16,
        width: 300,
        fontFamily: "Arial, sans-serif"
      }}>
      <h2 style={{ 
        color: "#2563EB", 
        fontSize: "1.5rem", 
        marginTop: 0,
        marginBottom: "1rem",
        textAlign: "center" 
      }}>
        Digital Panel Downloader
      </h2>
      
      <div style={{ 
        borderRadius: 8, 
        backgroundColor: isLoggedIn ? "#ECFDF5" : "#FEF2F2", 
        padding: 12,
        marginBottom: 10,
        position: "relative"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between" 
        }}>
          <span style={{ 
            fontWeight: 500, 
            color: isLoggedIn ? "#065F46" : "#991B1B" 
          }}>
            Status: {status}
          </span>
          <div style={{ 
            width: 10, 
            height: 10, 
            borderRadius: "50%", 
            backgroundColor: isLoggedIn ? "#10B981" : "#EF4444" 
          }} />
        </div>
        
        <button 
          onClick={checkLoginStatus}
          disabled={isRefreshing}
          style={{
            position: "absolute",
            right: -5,
            top: -5,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: "#F3F4F6",
            border: "1px solid #D1D5DB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isRefreshing ? "default" : "pointer",
            padding: 0
          }}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              animation: isRefreshing ? "spin 1s linear infinite" : "none"
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      {!isLoggedIn ? (
        <div>
          <p style={{ 
            fontSize: "0.8rem", 
            marginBottom: 12,
            color: "#991B1B",
            padding: "8px",
            backgroundColor: "#FEF2F2",
            borderRadius: "4px",
            border: "1px solid #FEE2E2"
          }}>
            Jika Anda sudah login di website Digital Panel tapi masih muncul "Not connected", silakan klik tombol Refresh di atas atau gunakan tombol Login di bawah.
          </p>
        
          <button
            onClick={handleLogin}
            style={{
              backgroundColor: "#2563EB",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              width: "100%",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}>
            Login to Digital Panel
          </button>
        </div>
      ) : (
        <div>
          <p style={{ 
            fontSize: "0.875rem", 
            marginBottom: 16,
            color: "#4B5563"
          }}>
            You are logged in to Digital Panel. You can now use the extension on freepik.com.
          </p>
          
          {tokenData && (
            <div style={{
              backgroundColor: "#F3F4F6",
              borderRadius: 4,
              padding: 8,
              marginBottom: 12,
              fontSize: "0.75rem"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                marginBottom: 4,
                alignItems: "center"
              }}>
                <span style={{ fontWeight: 500 }}>Token Source:</span>
                <span>{tokenData.source}</span>
              </div>
              {tokenData.timestamp && (
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  marginBottom: 4
                }}>
                  <span style={{ fontWeight: 500 }}>Retrieved:</span>
                  <span>{formatDate(tokenData.timestamp)}</span>
                </div>
              )}
              <div>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  marginBottom: 4,
                  alignItems: "center"
                }}>
                  <span style={{ fontWeight: 500 }}>Token:</span>
                  <button 
                    onClick={() => setShowToken(!showToken)}
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#2563EB",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      padding: 0
                    }}
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>
                {showToken && (
                  <div style={{
                    position: "relative",
                    marginTop: 4
                  }}>
                    <textarea
                      readOnly
                      value={tokenData.token}
                      style={{
                        width: "100%",
                        padding: 4,
                        borderRadius: 4,
                        border: "1px solid #D1D5DB",
                        fontSize: "0.75rem",
                        height: 60,
                        resize: "none"
                      }}
                    />
                    <button
                      onClick={copyToken}
                      style={{
                        position: "absolute",
                        right: 4,
                        top: 4,
                        backgroundColor: copied ? "#10B981" : "#2563EB",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: "0.65rem",
                        cursor: "pointer"
                      }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => chrome.tabs.create({ url: 'https://app.digitalpanel.id/dashboard' })}
              style={{
                backgroundColor: "#2563EB",
                color: "white",
                border: "none",
                borderRadius: 4,
                padding: "8px 16px",
                flex: 1,
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}>
              Open Digital Panel
            </button>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: "#F3F4F6",
                color: "#111827",
                border: "1px solid #D1D5DB",
                borderRadius: 4,
                padding: "8px 16px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}>
              Logout
            </button>
          </div>
        </div>
      )}
      
      <div style={{ 
        marginTop: 16, 
        fontSize: "0.75rem", 
        color: "#6B7280",
        textAlign: "center" 
      }}>
        <p style={{ margin: "8px 0 0 0" }}>Download resources from freepik.com via Digital Panel</p>
      </div>
    </div>
  )
}

export default IndexPopup 