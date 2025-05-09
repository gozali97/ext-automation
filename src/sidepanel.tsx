import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { ConfigurationForm } from "./components/ConfigurationForm"
import { TestCaseList } from "./components/TestCaseList"
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
    name: 'Logout Test',
    description: 'Verify logout functionality works correctly',
    type: 'logout',
    enabled: false,
    status: 'idle'
  },
  {
    name: 'Form Fill Test',
    description: 'Automatically fill form fields with test data',
    type: 'fillForm',
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
  const [port, setPort] = useState<chrome.runtime.Port | null>(null)
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
    // Connect to background script
    const port = chrome.runtime.connect({ name: 'sidepanel' })
    setPort(port)

    // Set up message listeners
    port.onMessage.addListener((message) => {
      console.log("Received message in sidepanel:", message);
      switch (message.type) {
        case "AUTH_STATUS":
          setAuthState(prev => ({
            ...prev,
            isAuthenticated: message.isAuthenticated,
            currentWebsite: message.currentWebsite
          }))
          break
        case "LOGIN_RESULT":
          setAuthState(prev => ({
            ...prev,
            loginAttemptStatus: message.success ? 'success' : 'error',
            error: message.error
          }))
          break
        case "LOGOUT_RESULT":
          console.log("Received logout result:", message);
          setAuthState(prev => ({
            ...prev,
            isAuthenticated: !message.success,
            loginAttemptStatus: message.success ? 'idle' : 'error',
            error: message.error
          }))
          break
        case "ERROR":
          console.error("Background script error:", message.error)
          setError(message.error)
          break
      }
    })

    // Clean up on unmount
    return () => {
      port.disconnect()
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadTests()
    checkAuthStatus()
    getActiveTabInfo()
  }, [port])

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

  const checkAuthStatus = () => {
    if (!port) return
    port.postMessage({ type: "CHECK_AUTH_STATUS" })
  }

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

  const executeTest = async (test: TestCase): Promise<TestCase> => {
    const updatedTest = { ...test, status: 'running' as const }
    handleTestUpdate(updatedTest)

    try {
      let result: TestCase['result']

      switch (test.type) {
        case 'login':
          result = await handleLogin()
          break
        case 'logout':
          result = await handleLogout()
          break
        case 'fillForm':
          result = await handleFormFill()
          break
        case 'submitForm':
          result = await handleFormSubmit()
          break
        case 'checkRequired':
          result = await handleRequiredFieldsCheck()
          break
        default:
          throw new Error('Unknown test type')
      }

      return {
        ...updatedTest,
        status: result.success ? 'success' : 'failed',
        result
      }
    } catch (error) {
      return {
        ...updatedTest,
        status: 'failed',
        result: {
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message
        }
      }
    }
  }

  const handleRunTests = async (selectedTests: TestCase[]) => {
    if (!config) {
      setError("Please configure the website settings before running tests")
      setActiveTab('config')
      return
    }

    setError(null)
    for (const test of selectedTests) {
      const result = await executeTest(test)
      await handleTestUpdate(result)

      // If it's a login test and it failed, stop the execution
      if (test.type === 'login' && !result.result?.success) {
        break
      }
    }
  }

  const handleLogin = async (): Promise<TestCase['result']> => {
    if (!config || !port) {
      throw new Error('No configuration found or port not connected')
    }

    try {
      port.postMessage({ 
        type: "PERFORM_LOGIN",
        config
      })

      // Wait for response
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Login timeout')), 30000)
        
        const handleMessage = (message: any) => {
          if (message.type === "LOGIN_RESULT") {
            clearTimeout(timeout)
            port.onMessage.removeListener(handleMessage)
            resolve(message)
          } else if (message.type === "ERROR") {
            clearTimeout(timeout)
            port.onMessage.removeListener(handleMessage)
            reject(new Error(message.error))
          }
        }

        port.onMessage.addListener(handleMessage)
      })

      if (response.success) {
        // Save cookies after successful login
        const cookies = await chrome.cookies.getAll({ url: config.url })
        const updatedConfig = {
          ...config,
          savedCookies: cookies,
          lastLogin: {
            url: config.url,
            timestamp: new Date().toISOString(),
            credentials: config,
            request: response.request,
            response: {
              ...response,
              cookies
            }
          }
        }
        await storage.set("config", updatedConfig)
        setConfig(updatedConfig)

        return {
          timestamp: new Date().toISOString(),
          success: true,
          payload: response.request,
          response: {
            status: 200,
            data: response,
            cookies
          }
        }
      } else {
        throw new Error(response.error || 'Login failed')
      }
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`)
    }
  }

  const handleFormFill = async (): Promise<TestCase['result']> => {
    // Implement form fill logic
    throw new Error('Not implemented')
  }

  const handleFormSubmit = async (): Promise<TestCase['result']> => {
    // Implement form submit logic
    throw new Error('Not implemented')
  }

  const handleRequiredFieldsCheck = async (): Promise<TestCase['result']> => {
    // Implement required fields check logic
    throw new Error('Not implemented')
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

      // Check auth status after saving config
      await checkAuthStatus()
      
      // Switch to tests tab after successful configuration
      setActiveTab('tests')
    } catch (error) {
      console.error("Error saving config:", error)
      setError("Failed to save configuration")
    }
  }

  const handleLogout = async () => {
    if (!port) {
      setError('Connection to background script not available');
      return {
        timestamp: new Date().toISOString(),
        success: false,
        error: 'Connection to background script not available'
      };
    }
    
    setAuthState(prev => ({
      ...prev,
      loginAttemptStatus: 'loading'
    }));
    
    console.log("Starting logout process with config:", config);
    
    try {
      // If we don't have a config, create a minimal one for logout
      const logoutConfig = config || { 
        url: currentUrl,
        credentials: { type: 'email', identifier: '', password: '' }
      };
      
      port.postMessage({ 
        type: "PERFORM_LOGOUT",
        config: logoutConfig
      });
      
      console.log("Sent PERFORM_LOGOUT message");
      
      // Wait for response
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("Logout timeout reached");
          reject(new Error('Logout timeout'))
        }, 30000);
        
        const handleMessage = (message: any) => {
          console.log("Received message during logout:", message);
          if (message.type === "LOGOUT_RESULT") {
            clearTimeout(timeout);
            port.onMessage.removeListener(handleMessage);
            resolve(message);
          } else if (message.type === "ERROR") {
            clearTimeout(timeout);
            port.onMessage.removeListener(handleMessage);
            reject(new Error(message.error));
          }
        };
        
        port.onMessage.addListener(handleMessage);
      });
      
      console.log("Received logout response:", response);
      
      if (response.success) {
        // Clear local state after successful logout
        await storage.remove("config");
        setConfig(null);
        setAuthState({
          isAuthenticated: false,
          loginAttemptStatus: 'idle'
        });
        
        return {
          timestamp: new Date().toISOString(),
          success: true,
          message: response.message || "Logout successful",
          response: {
            status: 200,
            data: response
          }
        };
      } else {
        throw new Error(response.error || 'Logout failed');
      }
    } catch (error) {
      console.error("Logout error:", error);
      
      setAuthState(prev => ({
        ...prev,
        loginAttemptStatus: 'error',
        error: error.message
      }));
      
      setError(error.message);
      
      return {
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        response: {
          status: 500,
          data: { error: error.message }
        }
      };
    }
  };

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-md mx-auto">

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <button onClick={() => setError(null)} className="text-red-700">
              <span className="sr-only">Close</span>
              <span aria-hidden="true">&times;</span>
            </button>
          </span>
        </div>
      )}

      {/* Add WebsiteInfoCard at the top of the UI */}
      {websiteInfo && (
        <WebsiteInfoCard
          url={websiteInfo.url}
          hostname={websiteInfo.hostname}
          title={websiteInfo.title}
          favicon={websiteInfo.favicon}
        />
      )}

      {authState.isAuthenticated && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>Authenticated on {authState.currentWebsite?.hostname}</span>
          <button 
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
            disabled={authState.loginAttemptStatus === 'loading'}
          >
            {authState.loginAttemptStatus === 'loading' ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      )}

      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="tests">
          <TestCaseList 
            tests={activeTests} 
            onTestUpdate={handleTestUpdate}
            onRunTests={handleRunTests}
            clearResults={clearTestResults}
          />
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