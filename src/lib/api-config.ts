// Centralized API configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8780",
  apiVersion: "v1",

  // Construct full API path
  getApiPath: (endpoint: string) => {
    const base = API_CONFIG.baseUrl
    const version = API_CONFIG.apiVersion
    // Remove leading slash from endpoint if present
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint
    return `${base}/api/${version}/${cleanEndpoint}`
  },
}

export const API_BASE_URL = `${API_CONFIG.baseUrl}/api/${API_CONFIG.apiVersion}`

// Common fetch wrapper with error handling
export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = API_CONFIG.getApiPath(endpoint)

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}
