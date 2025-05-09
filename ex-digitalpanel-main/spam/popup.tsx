import { useEffect, useState } from "react"
import { clearDigitalPanelData, getTokenData } from "~utils/storage"
import type { TokenData } from "~utils/storage"
import { apiService } from "~utils/api"
import type { ActiveService } from "~components/ActiveServices"
import TabNavigation from "~components/TabNavigation"
import StatusTab from "~components/StatusTab"
import ServicesTab from "~components/ServicesTab"

function IndexPopup() {
  const [status, setStatus] = useState<string>("Loading...")
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("status") // "status", "services"
  const [activeServices, setActiveServices] = useState<ActiveService[]>([])
  const [loadingServices, setLoadingServices] = useState<boolean>(false)

  // Fetch active services
  const fetchServices = async (token: string) => {
    if (!token) return
    
    setLoadingServices(true)
    try {
      const services = await apiService.fetchActiveServices(token)
      setActiveServices(services)
    } catch (error) {
      console.error("Error fetching services:", error)
    } finally {
      setLoadingServices(false)
    }
  }

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
        
        // Fetch active services when logged in
        fetchServices(tokenData.token)
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

  useEffect(() => {
    // Listener untuk pesan dari background script
    const messageListener = (message: any) => {
      if (message.action === "refreshServices" && message.token) {
        fetchServices(message.token);
      }
    };

    // Daftarkan listener
    chrome.runtime.onMessage.addListener(messageListener);

    // Cleanup listener saat komponen unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);  // Empty dependency array karena fetchServices adalah stabil

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

  // Handle opening dashboard
  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: 'https://app.digitalpanel.id/dashboard' })
  }

  return (
    <div style={{ padding: "16px", maxWidth: "400px" }}>
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {activeTab === "status" ? (
        <StatusTab 
          status={status}
          isLoggedIn={isLoggedIn}
          isRefreshing={isRefreshing}
          tokenData={tokenData}
          onRefresh={checkLoginStatus}
          onLogin={handleLogin}
          onOpenDashboard={handleOpenDashboard}
          onLogout={handleLogout}
        />
      ) : (
        <ServicesTab 
          isLoggedIn={isLoggedIn}
          loadingServices={loadingServices}
          activeServices={activeServices}
          onRefreshServices={() => fetchServices(tokenData?.token || "")}
        />
      )}
    </div>
  )
}

export default IndexPopup
