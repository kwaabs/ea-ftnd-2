export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.error("No data to export")
    return
  }

  // Get headers from first object
  const headers = Object.keys(data[0])

  // Create CSV content
  const csvContent = [
    headers.join(","), // Header row
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          // Handle values with commas or quotes
          if (value === null || value === undefined) return ""
          const stringValue = String(value)
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        })
        .join(","),
    ),
  ].join("\n")

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportToExcel(data: any[], filename: string, sheetName = "Sheet1") {
  if (!data || data.length === 0) {
    console.error("No data to export")
    return
  }

  // Dynamically import xlsx to avoid bundling it on every page
  const XLSX = await import("xlsx")

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data)

  // Create workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Generate Excel file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
