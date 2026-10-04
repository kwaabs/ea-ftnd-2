// Loads a static image (the ECG logo) into a data URL + natural pixel size
// for embedding in the PDF/PPTX cover. No canvas/re-encoding involved
// (unlike captureElementAsPngDataUrl's SVG path) since the source is
// already a raster image -- just fetch + base64-encode it as-is.
export async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load image: ${url}`)
  const blob = await res.blob()

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Failed to read image blob: ${url}`))
    reader.readAsDataURL(blob)
  })

  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error(`Failed to decode image: ${url}`))
    img.src = dataUrl
  })

  return { dataUrl, width, height }
}
