export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.error("No data to export")
    return
  }

  const headers = Object.keys(data[0])

  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
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

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportToExcel(data: any[], filename: string, sheetName = "Sheet1") {
  if (!data || data.length === 0) {
    console.error("No data to export")
    return
  }

  const XLSX = await import("xlsx")
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement("a")
  link.download = filename
  link.href = dataUrl
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** Rasterize an SVG element to PNG via canvas (reliable for Recharts). */
async function exportSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  options?: { backgroundColor?: string; pixelRatio?: number },
) {
  const rect = svg.getBoundingClientRect()
  const width = Math.max(rect.width || svg.clientWidth || 0, 1)
  const height = Math.max(rect.height || svg.clientHeight || 0, 1)
  const scale = options?.pixelRatio ?? 2
  const bg = options?.backgroundColor ?? "#ffffff"

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`)
  }

  // Inline CSS custom properties that Recharts may rely on for text color
  clone.style.background = bg
  clone.style.color = "#0f172a"

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  try {
    const img = new Image()
    img.decoding = "sync"
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("Failed to load SVG for PNG export"))
      img.src = url
    })

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context unavailable")

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.drawImage(img, 0, 0, width, height)

    triggerDownload(canvas.toDataURL("image/png"), `${filename}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Capture a chart/diagram container as PNG.
 * Prefers SVG→canvas for Recharts (avoids Tailwind oklch parse errors).
 * Falls back to html-to-image for HTML+SVG diagrams (e.g. energy flow).
 */
export async function exportElementAsPng(
  element: HTMLElement | null | undefined,
  filename: string,
  options?: { backgroundColor?: string; pixelRatio?: number },
) {
  if (!element) {
    throw new Error("No element to export as image")
  }

  const bg = options?.backgroundColor ?? "#ffffff"
  const pixelRatio = options?.pixelRatio ?? 2

  // Recharts: single SVG fills the container — capture it directly
  const svgs = Array.from(element.querySelectorAll("svg")) as SVGSVGElement[]
  const primarySvg =
    svgs.length === 1
      ? svgs[0]
      : svgs.find((s) => {
          const r = s.getBoundingClientRect()
          return r.width > 100 && r.height > 100
        })

  // If the container is mostly one chart SVG (not a complex HTML diagram), use SVG path
  const hasComplexHtml =
    element.querySelectorAll("button, a, table, input, [class*='rounded']").length > 3

  if (primarySvg && !hasComplexHtml) {
    await exportSvgAsPng(primarySvg, filename, { backgroundColor: bg, pixelRatio })
    return
  }

  // HTML diagrams (energy flow cards + pipes): modern-screenshot handles Tailwind oklch
  const { domToPng } = await import("modern-screenshot")
  const rect = element.getBoundingClientRect()

  const dataUrl = await domToPng(element, {
    scale: pixelRatio,
    backgroundColor: bg,
    width: Math.max(rect.width, element.scrollWidth, 1),
    height: Math.max(rect.height, element.scrollHeight, 1),
    style: {
      transform: "none",
      color: "#0f172a",
    },
  })

  triggerDownload(dataUrl, `${filename}.png`)
}
