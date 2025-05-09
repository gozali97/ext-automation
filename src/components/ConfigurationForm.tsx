import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { WebsiteConfig } from "../types"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Radio } from "./ui/radio"
import { Card } from "./ui/card"
import { Typography } from "./ui/typography"
import { Eye, EyeOff, ChevronDown, ChevronUp, Lock, Globe, Key } from "lucide-react"

interface ConfigurationFormProps {
  onSave: (config: WebsiteConfig) => void
  initialConfig: WebsiteConfig | null
  currentUrl?: string
}

export function ConfigurationForm({ onSave, initialConfig, currentUrl }: ConfigurationFormProps) {
  const [url, setUrl] = useState(initialConfig?.url || currentUrl || '')
  const [credentialType, setCredentialType] = useState<'email' | 'username'>(
    initialConfig?.credentials?.type || 'email'
  )
  const [identifier, setIdentifier] = useState(initialConfig?.credentials?.identifier || '')
  const [password, setPassword] = useState(initialConfig?.credentials?.password || '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const storage = new Storage()

  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const savedConfig = await storage.get<WebsiteConfig>("config")
        if (savedConfig) {
          setUrl(savedConfig.url)
          setCredentialType(savedConfig.credentials.type)
          setIdentifier(savedConfig.credentials.identifier)
          setPassword(savedConfig.credentials.password)
        }
        setLoading(false)
      } catch (err) {
        console.error("Error loading config:", err)
        setError("Failed to load saved configuration")
        setLoading(false)
      }
    }
    loadSavedConfig()

    // Listen for tab changes
    const handleTabChange = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.url) {
          const url = new URL(tab.url)
          setUrl(url.origin)
        }
      } catch (err) {
        console.error("Error getting active tab:", err)
      }
    }

    chrome.tabs.onActivated.addListener(handleTabChange)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        handleTabChange()
      }
    })

    handleTabChange()

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange)
      chrome.tabs.onUpdated.removeListener(handleTabChange)
    }
  }, [])

  useEffect(() => {
    if (currentUrl) {
      setUrl(currentUrl)
    }
  }, [currentUrl])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Ensure URL has protocol
    let formattedUrl = url
    if (!url.startsWith('http')) {
      formattedUrl = `https://${url}`
    }

    // Create configuration object
    const config: WebsiteConfig = {
      url: formattedUrl,
      loginUrl: '', // This will be dynamically set when detecting the form
      credentials: {
        type: credentialType,
        identifier,
        password
      }
    }

    onSave(config)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Authentication Details</h2>
        <p className="text-sm text-gray-500">Configure your login credentials</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Website Information</h3>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
              🌐
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="example.com"
              required
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Login Method</h3>
          <div className="flex justify-center gap-8">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                checked={credentialType === 'email'}
                onChange={() => setCredentialType('email')}
              />
              <span className="ml-2">Email</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                checked={credentialType === 'username'}
                onChange={() => setCredentialType('username')}
              />
              <span className="ml-2">Username</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {credentialType === 'email' ? 'Email Address' : 'Username'}
          </label>
          <input
            type={credentialType === 'email' ? 'email' : 'text'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => {
                const input = document.querySelector('input[type="password"]') as HTMLInputElement
                if (input) {
                  input.type = input.type === 'password' ? 'text' : 'password'
                }
              }}
            >
              👁️
            </button>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-500 flex items-center"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-4 p-4 bg-gray-50 rounded-md">
              {/* Add advanced settings here if needed */}
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Configuration
        </button>
      </form>
    </div>
  )
} 