import { useState } from "react"
import type { WebsiteConfig, TestCase } from "../types"
import { runTests, executeGoogleTest, closeBrowser } from "../lib/api-client"
import { Play, X, RefreshCw } from "lucide-react"

interface TestRunnerProps {
  config: WebsiteConfig
  tests: TestCase[]
}

function TestRunner({ config, tests }: TestRunnerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBrowserOpen, setIsBrowserOpen] = useState(false)
  const [isClosingBrowser, setIsClosingBrowser] = useState(false)

  const handleRunTests = async () => {
    if (!config) {
      setError("Please configure website settings first")
      return
    }

    const enabledTests = tests.filter(test => test.enabled)
    if (enabledTests.length === 0) {
      setError("Please select at least one test to run")
      return
    }

    setIsRunning(true)
    setError(null)

    try {
      // First, check if there's a Google login test
      const googleTest = enabledTests.find(test => test.type === 'google')
      
      if (googleTest) {
        // Execute Google test first using the dedicated endpoint
        const googleResult = await executeGoogleTest(config, googleTest)
        
        if (!googleResult.success) {
          setResults(googleResult)
          setIsRunning(false)
          return
        }
        
        // Check if browser is still open
        // Assume browser is open after running Google test unless explicitly stated otherwise
        setIsBrowserOpen(googleResult.browserOpen !== false)
      }
      
      // Run the remaining tests using the standard endpoint
      const nonGoogleTests = enabledTests.filter(test => test.type !== 'google')
      
      if (nonGoogleTests.length > 0) {
        const result = await runTests(config, nonGoogleTests)
        
        // If we already ran a Google test, combine the results
        if (googleTest && results) {
          setResults({
            ...result,
            results: [...(results.results || []), ...(result.results || [])]
          })
        } else {
          setResults(result)
        }
        
        // Check if browser is still open
        // Assume browser is open after running tests unless explicitly stated otherwise
        setIsBrowserOpen(result.browserOpen !== false)
      }
    } catch (error) {
      console.error("Test execution error:", error)
      setError(error.message)
    } finally {
      setIsRunning(false)
    }
  }
  
  const handleCloseBrowser = async () => {
    try {
      setIsClosingBrowser(true)
      setError(null)
      
      // Show a message that we're closing the browser
      console.log('Attempting to close browser...')
      
      // Add a timeout to ensure we don't hang indefinitely
      const timeoutPromise = new Promise<{success: boolean, message: string}>((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'Browser closed (timeout triggered)'
          })
        }, 5000) // 5 second timeout
      })
      
      // Race between the actual close and the timeout
      const result = await Promise.race([
        closeBrowser(),
        timeoutPromise
      ])
      
      console.log('Browser close result:', result)
      
      if (result.success) {
        setIsBrowserOpen(false)
        // Clear any previous results to avoid confusion
        setResults(null)
      } else {
        setError(result.error || "Failed to close browser")
      }
    } catch (error) {
      console.error("Error closing browser:", error)
      // Even if there's an error, assume the browser is closed
      // This prevents the extension from getting stuck
      setIsBrowserOpen(false)
      setError(`Error: ${error.message}. Browser may still be closed.`)
    } finally {
      setIsClosingBrowser(false)
    }
  }
  
  const handleRestart = () => {
    setResults(null)
    setError(null)
    setIsBrowserOpen(false)
    console.log('Test results cleared')
  }

  return (
    <div className="p-5 mx-auto max-w-md bg-white rounded-xl shadow-md">
      <h2 className="mb-5 text-xl font-bold text-center text-gray-800">WEB SCRAPPING AUTOMATION</h2>
      
      {error && (
        <div className="px-3 py-2 mb-4 text-sm text-red-700 bg-red-50 rounded-md">
          {error}
        </div>
      )}
      
      <div className="flex flex-col gap-2 mb-5">
        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex gap-2 justify-center items-center px-4 py-3 font-medium text-white bg-blue-500 rounded-md transition-colors hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          <Play size={16} />
          {isRunning ? "Running Tests..." : "Run Tests Web Scraping"}
        </button>
        
        {/* <button
          onClick={handleCloseBrowser}
          disabled={!isBrowserOpen || isClosingBrowser}
          className={`flex justify-center gap-2 items-center py-3 px-4 font-medium text-white rounded-md transition-colors ${isBrowserOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          <X size={16} />
          {isClosingBrowser ? "Closing..." : "Close Browser"}
        </button> */}
        
        <button
          onClick={handleRestart}
          disabled={!results}
          className={`flex justify-center gap-2 items-center py-3 px-4 font-medium text-white rounded-md transition-colors ${results ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          <RefreshCw size={16} />
          Restart
        </button>
      </div>
      
      {isRunning && (
        <div className="flex justify-center items-center p-3 mb-4">
          <div className="mr-2 w-4 h-4 rounded-full border-2 border-blue-500 animate-spin border-b-transparent"></div>
          <span className="text-sm text-blue-700">Running tests...</span>
        </div>
      )}
      
      {results && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-semibold text-gray-800">Test Results</h3>
            <div className="flex gap-2 items-center">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${results.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {results.success ? "Successful" : "Failed"}
              </span>
              {results.browserOpen && (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                  Browser Open
                </span>
              )}
            </div>
          </div>
          
          {results.results && (
            <div className="space-y-2">
              {results.results.map((result: any, index: number) => {
                let bgColor, icon;
                
                switch(result.status) {
                  case 'passed':
                    bgColor = 'bg-green-50';
                    icon = <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
                    break;
                  case 'failed':
                    bgColor = 'bg-red-50';
                    icon = <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;
                    break;
                  case 'running':
                    bgColor = 'bg-yellow-50';
                    icon = <svg className="w-5 h-5 text-yellow-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
                    break;
                  default:
                    bgColor = 'bg-gray-50';
                    icon = <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
                }
                
                return (
                  <div key={index} className={`p-3 rounded-md ${bgColor}`}>
                    <div className="flex gap-2 items-center">
                      {icon}
                      <span className="font-medium">{result.name}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${result.status === 'passed' ? 'bg-green-100 text-green-700' : result.status === 'failed' ? 'bg-red-100 text-red-700' : result.status === 'running' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                        {result.status}
                      </span>
                    </div>
                    {(result.message || result.result?.details?.message) && (
                      <div className="mt-2 ml-7 text-sm text-gray-600">
                        {result.message && <p>{result.message}</p>}
                        {result.result?.details?.message && <p>{result.result.details.message}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TestRunner
