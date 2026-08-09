export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false

  try {
    const canvas = document.createElement("canvas")
    return Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: true }),
    )
  } catch {
    return false
  }
}

export function WebGLFallback({ label = "Map" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-80 items-center justify-center rounded-lg border border-border bg-muted/30 p-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="font-medium text-foreground">{label} unavailable</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This browser or preview environment has WebGL disabled. Enable hardware acceleration or open the app in a browser with WebGL support to view the interactive map.
        </p>
      </div>
    </div>
  )
}
