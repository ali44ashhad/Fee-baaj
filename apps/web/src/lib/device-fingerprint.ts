"use client"

// Enhanced device fingerprinting solution that's consistent across browsers on the same device
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") {
    return "server-side-render"
  }

  try {
    // Check if we have a cached fingerprint
    const cachedFingerprint = localStorage.getItem("device_fingerprint")
    if (cachedFingerprint) {
      return cachedFingerprint
    }

    // Collect hardware-specific components for fingerprinting
    const components = [
      // Device-specific information
      navigator.userAgent,
      navigator.platform,
      screen.width,
      screen.height,
      screen.colorDepth,
      navigator.hardwareConcurrency || "",
      (navigator as any).deviceMemory || "",
      Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Hardware-rendered canvas fingerprinting
      await getHardwareRenderedCanvas(),

      // WebGL information (GPU details)
      await getWebGLInfo(),

      // Device orientation capability
      "DeviceOrientationEvent" in window ? "1" : "0",
      "DeviceMotionEvent" in window ? "1" : "0",

      // Touch capability
      "ontouchstart" in window ? "1" : "0",
      navigator.maxTouchPoints || 0,
    ].filter(Boolean)

    // Create a hash from the components
    const fingerprint = components.join("|")
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint))

    // Convert hash to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    // Store in localStorage for persistence
    localStorage.setItem("device_fingerprint", hashHex)

    // Also store in sessionStorage as backup
    sessionStorage.setItem("device_fingerprint", hashHex)

    return hashHex
  } catch (error) {
    console.error("Error generating device fingerprint:", error)

    // Fallback to a less reliable but functional fingerprint
    const fallbackComponents = [navigator.userAgent, screen.width, screen.height, navigator.language]
    return btoa(fallbackComponents.join("|")).substring(0, 32)
  }
}

// Hardware-rendered canvas fingerprinting
async function getHardwareRenderedCanvas(): Promise<string> {
  try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return ""

    // Set canvas dimensions
    canvas.width = 200
    canvas.height = 50

    // Draw complex shapes that will use hardware acceleration
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 200, 0)
    gradient.addColorStop(0, "#3498db")
    gradient.addColorStop(1, "#8e44ad")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 200, 50)

    // Draw text with specific styling
    ctx.fillStyle = "#fff"
    ctx.font = "16px Arial"
    ctx.textBaseline = "top"
    ctx.shadowColor = "rgba(0,0,0,0.5)"
    ctx.shadowBlur = 5
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    ctx.fillText("DeviceFingerprint", 10, 15)

    // Draw complex shapes
    ctx.beginPath()
    ctx.arc(160, 25, 15, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = "rgba(255,255,255,0.8)"
    ctx.fill()

    // Get the data URL
    return canvas.toDataURL()
  } catch (e) {
    return ""
  }
}

// Get WebGL information (GPU details)
async function getWebGLInfo(): Promise<string> {
  try {
    const canvas = document.createElement("canvas")
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext)

    if (!gl) return ""

    // Get WebGL renderer and vendor info
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info")
    if (!debugInfo) return ""

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || ""
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ""

    return `${vendor}|${renderer}`
  } catch (e) {
    return ""
  }
}

// Replace the entire isPWA function with this more reliable version
export function isPWA(): boolean {
  if (typeof window === "undefined") return false

  try {
    // Primary checks that are most reliable
    const primaryChecks = [
      // Standard check for display-mode: standalone
      window.matchMedia("(display-mode: standalone)").matches,

      // iOS Safari check
      "standalone" in navigator && (navigator as any).standalone === true,
    ]

    // If any primary check passes, it's definitely a PWA
    if (primaryChecks.some((check) => check === true)) {
      return true
    }

    // Secondary checks - only use if primary checks fail
    // These are less reliable but can help in edge cases
    const secondaryChecks = [
      // Check for PWA context
      window.matchMedia("(display-mode: fullscreen)").matches,
      window.matchMedia("(display-mode: minimal-ui)").matches,

      // Check for absence of browser UI elements
      window.navigator.userAgent.includes("wv"), // Android WebView

      // Check window dimensions vs screen dimensions (PWAs often take full screen)
      Math.abs(window.outerWidth - window.screen.width) < 10 &&
        Math.abs(window.outerHeight - window.screen.height) < 150,
    ]

    // For secondary checks, we need more evidence - require at least 2 checks to pass
    const secondaryChecksPassed = secondaryChecks.filter((check) => check === true).length >= 2

    // Final decision combines localStorage flag with secondary checks
    const storedFlag = localStorage.getItem("pwa_installed") === "true"

    // Only return true if we have both the stored flag AND secondary evidence
    // This prevents false positives after uninstallation
    return storedFlag && secondaryChecksPassed
  } catch (error) {
    console.error("Error in isPWA detection:", error)
    return false
  }
}

// Add this new function to reset PWA state
export function resetPWAState(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem("pwa_installed")
    localStorage.removeItem("pwa_installing")
    sessionStorage.removeItem("pwa_installed")
    sessionStorage.removeItem("pwa_installing")
    console.log("PWA installation state has been reset")
  } catch (error) {
    console.error("Error resetting PWA state:", error)
  }
}

// Check if the device is mobile (not desktop)
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false

  // Check for mobile user agent patterns
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera

  // Regular expressions for mobile detection
  const mobileRegex =
    /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i
  const tabletRegex = /android|ipad|playbook|silk/i

  // Additional checks for iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream

  // Check for touch capability
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0

  // Screen size check (rough estimate for mobile devices)
  const isSmallScreen = window.innerWidth <= 1024

  return mobileRegex.test(userAgent) || tabletRegex.test(userAgent) || isIOS || (hasTouch && isSmallScreen)
}

// Function to safely check if we're in the installation process
export function isInInstallProcess(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem("pwa_installing") === "true"
}

