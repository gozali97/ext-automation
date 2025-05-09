export interface ConfigData {
  websiteUrl: string
  authType: "email" | "username"
  identifier: string
  password: string
}

export interface AuthResponse {
  success: boolean
  message: string
  error?: string
} 