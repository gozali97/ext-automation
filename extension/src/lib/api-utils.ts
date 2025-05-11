import { Storage } from "@plasmohq/storage"

const storage = new Storage()

export async function getAPIToken(domain: string): Promise<string | null> {
  return await storage.get(`api_token_${domain}`)
}

export async function saveAPIToken(domain: string, token: string) {
  await storage.set(`api_token_${domain}`, token)
}

export async function removeAPIToken(domain: string) {
  await storage.remove(`api_token_${domain}`)
}

export async function addAuthHeader(headers: HeadersInit, url: string): Promise<HeadersInit> {
  try {
    const domain = new URL(url).hostname
    const token = await getAPIToken(domain)
    
    if (token) {
      return {
        ...headers,
        'Authorization': `Bearer ${token}`
      }
    }
  } catch (error) {
    console.error("Error adding auth header:", error)
  }
  
  return headers
}

export function isAPIEndpoint(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('api-') || 
           urlObj.pathname.includes('/api/') ||
           url.includes('api.')
  } catch (error) {
    return false
  }
}

export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await addAuthHeader(
    options.headers || {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    url
  )
  
  return fetch(url, {
    ...options,
    headers
  })
} 