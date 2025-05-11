import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { WebsiteConfig } from "../types"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Radio } from "./ui/radio"
import { Card } from "./ui/card"
import { Typography } from "./ui/typography"
import { Eye, EyeOff, ChevronDown, ChevronUp, Lock, Globe, Key, Mail } from "lucide-react"

interface ConfigurationFormProps {
  onSave: (config: WebsiteConfig) => void
  initialConfig: WebsiteConfig | null
  currentUrl?: string
}

export function ConfigurationForm({ onSave, initialConfig, currentUrl }: ConfigurationFormProps) {
  const [url, setUrl] = useState(initialConfig?.url || currentUrl || '')
  const [credentialType, setCredentialType] = useState<'email' | 'username' | 'basic' | 'google'>(
    initialConfig?.credentials?.type || 'email'
  )
  const [identifier, setIdentifier] = useState(initialConfig?.credentials?.identifier || '')
  const [password, setPassword] = useState(initialConfig?.credentials?.password || '')
  const [gmailAddress, setGmailAddress] = useState(initialConfig?.credentials?.gmailAddress || '')
  const [hasBasicAuth, setHasBasicAuth] = useState(initialConfig?.hasBasicAuth || false)
  const [basicAuthUsername, setBasicAuthUsername] = useState(initialConfig?.basicAuth?.username || '')
  const [basicAuthPassword, setBasicAuthPassword] = useState(initialConfig?.basicAuth?.password || '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showBasicAuthPassword, setShowBasicAuthPassword] = useState(false)
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
          setGmailAddress(savedConfig.credentials.gmailAddress || '')
          setHasBasicAuth(savedConfig.hasBasicAuth || false)
          if (savedConfig.basicAuth) {
            setBasicAuthUsername(savedConfig.basicAuth.username || '')
            setBasicAuthPassword(savedConfig.basicAuth.password || '')
          }
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
        password,
        gmailAddress: credentialType === 'google' ? gmailAddress : undefined
      },
      hasBasicAuth: hasBasicAuth,
      basicAuth: hasBasicAuth ? {
        username: basicAuthUsername,
        password: basicAuthPassword
      } : undefined
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
          
          <div className="flex items-center space-x-2 py-6">
            <input
              type="checkbox"
              id="hasBasicAuth"
              checked={hasBasicAuth}
              onChange={(e) => setHasBasicAuth(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="hasBasicAuth" className="text-sm font-medium">
              Website menggunakan Basic Authentication
            </label>
          </div>
          
          {hasBasicAuth && (
            <div className="p-3 border rounded-md bg-gray-50 space-y-3">
              <Typography variant="h4">Basic Authentication</Typography>
              
              <div className="flex flex-col space-y-2">
                <Typography variant="small">Username</Typography>
                <div className="flex items-center space-x-2">
                  <Key className="h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Username untuk Basic Auth"
                    value={basicAuthUsername}
                    onChange={(e) => setBasicAuthUsername(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Typography variant="small">Password</Typography>
                <div className="flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-gray-500" />
                  <Input
                    type={showBasicAuthPassword ? "text" : "password"}
                    placeholder="Password untuk Basic Auth"
                    value={basicAuthPassword}
                    onChange={(e) => setBasicAuthPassword(e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBasicAuthPassword(!showBasicAuthPassword)}
                    className="p-1 rounded-md hover:bg-gray-100"
                  >
                    {showBasicAuthPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Login Method</h3>
          <div className="flex flex-col gap-4">
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
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio"
                checked={credentialType === 'google'}
                onChange={() => setCredentialType('google')}
              />
              <span className="ml-2">Login Via Google</span>
            </label>
          </div>
        </div>

        {credentialType === 'google' ? (
          <div>
            <label className="block text-sm font-medium mb-1">Gmail Address</label>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <Input
                type="email"
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                className="flex-1"
                placeholder="your.email@gmail.com"
                required={credentialType === 'google'}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Input alamat Gmail yang akan digunakan untuk login via Google
            </p>
          </div>
        ) : (
          <>
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        )}

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

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  )
} 