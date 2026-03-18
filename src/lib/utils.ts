import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number | string | undefined | null, decimals?: number): string {
  if (num === undefined || num === null || num === "") return "0"

  const numValue = typeof num === "string" ? Number.parseFloat(num) : num

  if (isNaN(numValue)) return "0"

  if (decimals !== undefined) {
    return numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  return numValue.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export function formatApiDate(date: string | Date | undefined | null): string {
  if (!date) return ""

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, "0")
    const day = String(dateObj.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  } catch (error) {
    console.error("[v0] Error formatting date:", error)
    return ""
  }
}

export function toProperCase(str: string | undefined | null): string {
  if (!str) return ""
  return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
}
