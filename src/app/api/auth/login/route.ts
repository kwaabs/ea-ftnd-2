// import { type NextRequest, NextResponse } from "next/server"
//
// // This is a placeholder route for your backend team to implement
// // Replace this with actual authentication logic when backend is ready
// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json()
//     const { email, password } = body
//
//     // TODO: Replace with actual authentication logic
//     // For now, we'll use mock authentication for demonstration
//     // Your backend team should implement:
//     // 1. Validate credentials against database
//     // 2. Generate JWT token or session
//     // 3. Return user data
//
//     // Mock authentication - REPLACE THIS
//     if (password === "demo123" || email.includes("@")) {
//       const user = {
//         id: "user-" + Math.random().toString(36).substring(7),
//         email: email,
//         name: email.split("@")[0],
//         role: "admin",
//       }
//
//       // Set session cookie (your backend team should implement proper session management)
//       const response = NextResponse.json({ user, success: true })
//       response.cookies.set("session", JSON.stringify(user), {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === "production",
//         sameSite: "lax",
//         maxAge: 60 * 60 * 24 * 7, // 1 week
//       })
//
//       return response
//     }
//
//     return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
//   } catch (error) {
//     console.error("[v0] Login error:", error)
//     return NextResponse.json({ message: "Internal server error" }, { status: 500 })
//   }
// }


import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

// This is a placeholder route for your backend team to implement
// Replace this with actual authentication logic when backend is ready
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // TODO: Replace with actual authentication logic
    // For now, we'll use mock authentication for demonstration
    // Your backend team should implement:
    // 1. Validate credentials against database
    // 2. Generate JWT token or session
    // 3. Return user data

    // Mock authentication - REPLACE THIS
    if (password === "demo123" || email.includes("@")) {
      const user = {
        id: "user-" + Math.random().toString(36).substring(7),
        email: email,
        name: email.split("@")[0],
        role: "admin",
      }

      // Generate JWT with 24-hour expiration
      const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"
      const expiresIn = 24 * 60 * 60 // 24 hours in seconds
      const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn }
      )

      // Calculate expiration timestamp (in milliseconds)
      const expiresAt = Date.now() + expiresIn * 1000

      const response = NextResponse.json({
        user,
        token,
        expiresAt,
        success: true
      })

      // Set HTTP-only cookie with token (24 hours)
      response.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: expiresIn,
      })

      return response
    }

    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
