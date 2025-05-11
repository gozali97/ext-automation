export interface ConfigData {
  websiteUrl: string
  authType: "email" | "username" | "basic" | "google"
  identifier: string
  password: string
  gmailAddress?: string
  lastUpdated?: string
  targetWebsites?: string[]
  basicAuth?: {
    username: string
    password: string
  }
}

export interface AuthResponse {
  success: boolean
  message: string
  error?: string
  redirectUrl?: string
  cookieData?: any
}

export interface LoginCredentials {
  type: "email" | "username" | "basic" | "google"
  identifier: string
  password: string
  gmailAddress?: string
  basicAuth?: {
    username: string
    password: string
  }
}

export interface WebsiteConfig {
  url: string
  loginUrl?: string
  credentials: LoginCredentials
  savedCookies?: chrome.cookies.Cookie[]
  lastLogin?: LoginInfo
  testHistory?: {
    timestamp: string
    testId: string
    result: TestCase['result']
  }[]
  hasBasicAuth?: boolean
  basicAuth?: {
    username: string
    password: string
  }
}

export interface WebsiteInfo {
  url: string
  hostname: string
  favicon?: string
  title: string
  isLoginPage: boolean
}

export interface AuthState {
  isAuthenticated: boolean
  loginAttemptStatus: 'idle' | 'loading' | 'success' | 'error'
  error?: string
  website?: string
  currentWebsite?: {
    url: string
    hostname: string
    title?: string
    favicon?: string
  }
}

export interface ConfigurationState {
  websites: WebsiteConfig[]
  activeWebsite?: string
}

export interface LoginResponse {
  success: boolean
  error?: string
  redirectUrl?: string
  message?: string
  cookieData?: {
    cookies: chrome.cookies.Cookie[]
    token?: string
    userData?: any
  }
}

export interface LogoutResponse {
  success: boolean
  error?: string
  message?: string
}

export interface LoginInfo {
  url: string
  timestamp: string
  credentials: WebsiteConfig
  request: {
    url: string
    method: string
    payload: Record<string, any>
  }
  response: {
    status: number
    data: any
    cookies: chrome.cookies.Cookie[]
  }
}

export interface TestCase {
  id: string
  name: string
  description: string
  type: 'login' | 'logout' | 'fillForm' | 'form-fill' | 'submitForm' | 'checkRequired' | 'google'
  enabled: boolean
  status: 'idle' | 'running' | 'success' | 'failed'
  config?: {
    targetUrl?: string
    selectors?: {
      form?: string
      submitButton?: string
      requiredFields?: string[]
    }
    validation?: {
      rules?: string[]
      messages?: Record<string, string>
    }
    googleAuth?: {
      selector?: string
    }
  }
  result?: {
    timestamp: string
    success: boolean
    error?: string
    payload?: Record<string, any>
    response?: {
      status: number
      data: any
      cookies?: chrome.cookies.Cookie[]
    }
  }
}