import { PublicClientApplication, Configuration, BrowserCacheLocation } from "@azure/msal-browser"

const msalConfig: Configuration = {
    auth: {
      clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
      redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000",
      navigateToLoginRequestUrl: true, // returns user to original page after login
    },
    cache: {
      cacheLocation: BrowserCacheLocation.SessionStorage,
      storeAuthStateInCookie: false,
    },
    system: {
      allowNativeBroker: false,
    },
  }

export const msalInstance = new PublicClientApplication(msalConfig)

// Initialize MSAL before anything uses it
await msalInstance.initialize()

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
}