import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import "~style.css"

function IndexSidePanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const storage = new Storage()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const config = await storage.get("config")
      if (!config) {
        setIsAuthenticated(false)
        setLoading(false)
        return
      }

      // Check cookies in active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const cookies = await chrome.cookies.getAll({ url: tab.url })
        
        // Verify if authentication cookie exists
        const authCookie = cookies.find(cookie => cookie.name === "session" || cookie.name === "auth")
        setIsAuthenticated(!!authCookie)
      }
    } catch (error) {
      console.error("Error checking auth status:", error)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto py-6 px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            Automation App
          </h1>
          
          <div className="space-y-6">
            {isAuthenticated ? (
              <div>
                <p className="text-green-600">✓ Authenticated</p>
                <button 
                  onClick={() => setIsAuthenticated(false)}
                  className="button-primary mt-4"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div>
                <p className="text-red-600">✗ Not authenticated</p>
                <button 
                  onClick={() => setIsAuthenticated(true)}
                  className="button-primary mt-4"
                >
                  Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexSidePanel 