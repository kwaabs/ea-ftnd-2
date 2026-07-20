import { PublicClientApplication, Configuration, BrowserCacheLocation } from "@azure/msal-browser"

const msalConfig: Configuration = {
    auth: {
      clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
      // Must match Azure app registration exactly (origin only — not deep paths).
      // App restores the deep link after backend login via auth-return-url.
      redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000",
      navigateToLoginRequestUrl: false,
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