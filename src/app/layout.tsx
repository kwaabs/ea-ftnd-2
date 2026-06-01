import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
// import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import "./nprogress.css"
import { QueryProvider } from "@/components/providers/query-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import Providers from "@/components/providers/msal-provider" // adjust path as needed
import { ProgressProvider } from "@/components/providers/progress-provider"
import { DesktopWarningBanner } from "@/components/layout/desktop-warning-banner"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Energy Accounting Dashboard",
  description: "Professional dashboard with analytics and mapping",
  generator: "jdanso@ecggh.com",
  icons: {
    icon: [
      {
        url: "/favicon_32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon_32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/favicon_32x32.png",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // <html lang="en">
    //   <body className={`font-sans antialiased min-w-[1200px]`}>
    //     <DesktopWarningBanner />
    //     <QueryProvider>
    //       <AuthProvider>
    //         <ProgressProvider>
    //           {children}
    //         </ProgressProvider>
    //       </AuthProvider>
    //     </QueryProvider>
    //     {/*<Analytics />*/}
    //   </body>
    // </html>
    <html lang="en">
  <body className={`font-sans antialiased min-w-[1200px]`}>
    <DesktopWarningBanner />
    <Providers>
      <QueryProvider>
        <AuthProvider>
          <ProgressProvider>
            {children}
          </ProgressProvider>
        </AuthProvider>
      </QueryProvider>
    </Providers>
  </body>
</html>
  )
}
