import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { ConfigurationForm } from "./components/ConfigurationForm"
import { TestCaseList } from "./components/TestCaseList"
import TestRunner from "./components/TestRunner"
import ServerStatus from "./components/ServerStatus"
import type { AuthState, WebsiteConfig, TestCase, WebsiteInfo } from "./types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs"
import { WebsiteInfoCard } from "./components/WebsiteInfoCard"
import "~style.css"

const DEFAULT_TEST_CASES: Omit<TestCase, 'id'>[] = [
  {
    name: 'Login Test',
    description: 'Verify login functionality with provided credentials',
    type: 'login',
    enabled: false,
    status: 'idle'
  },
  {
    name: 'Google Login Test',
    description: 'Login to website using Google account',
    type: 'google',
    enabled: false,
    status: 'idle'
  },
  {
    name: 'Logout Test',
    description: 'Verify logout functionality works correctly',
    type: 'logout',
    enabled: false,
    status: 'idle'
  },
  {
    name: 'Form Fill Test',
    description: 'Automatically fill form fields with test data',
    type: 'form-fill',
    enabled: false,
    status: 'idle'
  },
  {
    name: 'Form Submit Test',
    description: 'Test form submission and validate response',
    type: 'submitForm',
    enabled: false,
    status: 'idle'
  },
  {
    name: 'Required Fields Test',
    description: 'Check all required fields are properly validated',
    type: 'checkRequired',
    enabled: false,
    status: 'idle'
  }
]

function IndexSidePanel() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    loginAttemptStatus: 'idle'
  })
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<WebsiteConfig | null>(null)
  const [activeTests, setActiveTests] = useState<TestCase[]>([])
  const [currentUrl, setCurrentUrl] = useState<string>()
  const [activeTab, setActiveTab] = useState('tests')
  const [error, setError] = useState<string | null>(null)
  const [websiteInfo, setWebsiteInfo] = useState<WebsiteInfo | null>(null)
  const storage = new Storage()

  useEffect(() => {
    loadConfig()
    loadTests()
    getActiveTabInfo()
  }, [])

  // Add event listener for tab changes
  useEffect(() => {
    const handleTabChange = () => {
      getActiveTabInfo()
    }

    // Listen for tab updates
    if (chrome.tabs) {
      chrome.tabs.onActivated.addListener(handleTabChange)
      chrome.tabs.onUpdated.addListener(handleTabChange)
    }

    return () => {
      if (chrome.tabs) {
        chrome.tabs.onActivated.removeListener(handleTabChange)
        chrome.tabs.onUpdated.removeListener(handleTabChange)
      }
    }
  }, [])

  const getCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.url) {
      setCurrentUrl(tab.url)
      // Check if we have cookies for this domain
      const cookies = await chrome.cookies.getAll({ url: tab.url })
      if (cookies.length > 0) {
        const domain = new URL(tab.url).hostname
        const savedConfig = await storage.get<WebsiteConfig>(`config_${domain}`)
        if (savedConfig) {
          savedConfig.savedCookies = cookies
          await storage.set(`config_${domain}`, savedConfig)
        }
      }
    }
  }

  const getActiveTabInfo = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        setCurrentUrl(tab.url)
        
        // Create website info object
        const url = new URL(tab.url)
        const info: WebsiteInfo = {
          url: tab.url,
          hostname: url.hostname,
          favicon: tab.favIconUrl || `${url.origin}/favicon.ico`,
          title: tab.title || url.hostname,
          isLoginPage: url.pathname.toLowerCase().includes('login') || 
                      url.pathname.toLowerCase().includes('signin') ||
                      url.pathname.toLowerCase().includes('auth')
        }
        
        setWebsiteInfo(info)
        
        // Check cookies for domain as in getCurrentTab function
        const cookies = await chrome.cookies.getAll({ url: tab.url })
        if (cookies.length > 0) {
          const domain = url.hostname
          const savedConfig = await storage.get<WebsiteConfig>(`config_${domain}`)
          if (savedConfig) {
            savedConfig.savedCookies = cookies
            await storage.set(`config_${domain}`, savedConfig)
          }
        }
      }
    } catch (error) {
      console.error("Error getting active tab info:", error)
    }
  }

  const loadConfig = async () => {
    try {
      const savedConfig = await storage.get<WebsiteConfig>("config")
      if (savedConfig) {
        setConfig(savedConfig)
      }
    } catch (error) {
      console.error("Error loading config:", error)
      setError("Failed to load configuration")
    } finally {
      setLoading(false)
    }
  }

  const loadTests = async () => {
    try {
      // Always initialize with default test cases first
      const initializedTests = DEFAULT_TEST_CASES.map((test, index) => ({
        ...test,
        id: `test-${index}`,
        enabled: false,
        status: 'idle' as const
      }))

      // Try to load saved test states
      const savedTests = await storage.get<TestCase[]>("tests")
      if (savedTests?.length > 0) {
        // Merge saved states with default test cases
        const mergedTests = initializedTests.map(test => {
          const savedTest = savedTests.find(saved => saved.type === test.type)
          return savedTest ? { ...test, ...savedTest } : test
        })
        setActiveTests(mergedTests)
        await storage.set("tests", mergedTests)
      } else {
        // Use default test cases if no saved state
        setActiveTests(initializedTests)
        await storage.set("tests", initializedTests)
      }
    } catch (error) {
      console.error("Error loading tests:", error)
      setError("Failed to load tests")
      // Fall back to default test cases on error
      const defaultTests = DEFAULT_TEST_CASES.map((test, index) => ({
        ...test,
        id: `test-${index}`,
        enabled: false,
        status: 'idle' as const
      }))
      setActiveTests(defaultTests)
    }
  }

  const handleTestUpdate = async (updatedTest: TestCase) => {
    const updatedTests = activeTests.map(test => 
      test.id === updatedTest.id ? updatedTest : test
    )
    setActiveTests(updatedTests)
    await storage.set("tests", updatedTests)
  }

  const handleConfigSave = async (newConfig: WebsiteConfig) => {
    try {
      // Save the config
      await storage.set("config", newConfig)
      setConfig(newConfig)
      setError(null)

      // If we have a current URL, also save as domain-specific config
      if (currentUrl) {
        const domain = new URL(currentUrl).hostname
        await storage.set(`config_${domain}`, newConfig)
      }
      
      // Switch to tests tab after successful configuration
      setActiveTab('tests')
    } catch (error) {
      console.error("Error saving config:", error)
      setError("Failed to save configuration")
    }
  }

  const clearTestResults = async () => {
    const clearedTests = activeTests.map(test => ({
      ...test,
      status: 'idle' as const,
      result: undefined
    }));
    
    setActiveTests(clearedTests);
    await storage.set("tests", clearedTests);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-8 h-8 rounded-full border-b-2 border-blue-500 animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-4 mx-auto max-w-md">

      {error && (
        <div className="relative px-4 py-3 mb-4 text-red-700 bg-red-100 rounded border border-red-400" role="alert">
          <span className="block sm:inline">{error}</span>
          <span className="absolute top-0 right-0 bottom-0 px-4 py-3">
            <button onClick={() => setError(null)} className="text-red-700">
              <span className="sr-only">Close</span>
              <span aria-hidden="true">&times;</span>
            </button>
          </span>
        </div>
      )}

      {/* Server Status component to show backend connection status */}
      <div className="mb-4">
        <ServerStatus />
      </div>

      {/* Add WebsiteInfoCard at the top of the UI */}
      {websiteInfo && (
        <WebsiteInfoCard
          url={websiteInfo.url}
          hostname={websiteInfo.hostname}
          title={websiteInfo.title}
          favicon={websiteInfo.favicon}
        />
      )}

      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="tests">
          {/* Node.js Backend Test Runner */}
          <div className="mb-4">
            <TestRunner 
              config={config} 
              tests={activeTests} 
            />
          </div>
          
          {/* Configure test cases */}
          <div className="mt-6">
            <TestCaseList 
              tests={activeTests} 
              onTestUpdate={handleTestUpdate}
              onRunTests={() => {}} /* This is now handled by TestRunner */
              clearResults={clearTestResults}
            />
          </div>
        </TabsContent>

        <TabsContent value="config">
          <ConfigurationForm 
            onSave={handleConfigSave} 
            initialConfig={config} 
            currentUrl={currentUrl}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default IndexSidePanel 