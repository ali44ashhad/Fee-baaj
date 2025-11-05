"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Download, AlertTriangle } from "lucide-react"
import {
  isPWA,
  isMobileDevice,
  getDeviceFingerprint,
  isInInstallProcess,
  resetPWAState,
} from "@/lib/device-fingerprint"
import webRoutes from "@/lib/webRoutes"

export default function Install() {
  // Get the params safely
  const params = useParams()
  // Make sure we have a string, not an array or undefined
  const code = params && typeof params.code === "string" ? params.code : ""

  const router = useRouter()
  const [isInstalled, setIsInstalled] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [deviceType, setDeviceType] = useState<"ios" | "android" | "desktop" | null>(null)
  const [installationStarted, setInstallationStarted] = useState(false)
  const [fingerprint, setFingerprint] = useState<string | null>(null)

  // Define a safe auth route path - use hardcoded fallback if webRoutes.auth is undefined
  const authPath = typeof webRoutes?.auth === "string" ? webRoutes.auth : "/auth"

  // Safe redirect function with referral code
  const safeRedirect = () => {
    try {
      // Get the stored referral code
      const storedReferralCode = localStorage.getItem("pendingReferralCode") || code

      // Construct the redirect URL with referral code if available
      const redirectUrl = storedReferralCode ? `${authPath}?ref=${encodeURIComponent(storedReferralCode)}` : authPath

      console.log(`Redirecting to: ${redirectUrl}`)

      // Use router for client-side navigation
      router.push(redirectUrl)
    } catch (error) {
      console.error("Error during redirect:", error)
      // Ultimate fallback - hardcoded path
      window.location.href = "/auth"
    }
  }

  // Initialize device fingerprint and store with referral code
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        // Generate fingerprint
        const deviceFingerprint = await getDeviceFingerprint()
        setFingerprint(deviceFingerprint)

        // Store referral code in multiple places for redundancy
        if (code) {
          console.log(`Storing referral code: ${code}`)
          localStorage.setItem("pendingReferralCode", code)
          sessionStorage.setItem("pendingReferralCode", code)

          // Store fingerprint with referral code
          localStorage.setItem("referralFingerprint", deviceFingerprint)
        }
      } catch (error) {
        console.error("Error initializing fingerprint:", error)
      }
    }

    initFingerprint()
  }, [code])

  // Handle immediate PWA detection and device type detection
  useEffect(() => {
    // Check if mobile device
    const mobile = isMobileDevice()
    setIsMobile(mobile)

    if (!mobile) {
      setDeviceType("desktop")
      return
    }

    // Detect specific mobile platform
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera

    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setDeviceType("ios")
      setShowIOSInstructions(true)
    } else {
      setDeviceType("android")
      setShowAndroidInstructions(true)
    }

    // Check if already running as PWA - but don't redirect immediately
    // This prevents premature redirects during installation
    if (isPWA() && !isInInstallProcess()) {
      console.log("PWA detected on initial load, but waiting for user action")
      setIsInstalled(true)
    }
  }, [])

  // Handle installation events - only for mobile devices
  useEffect(() => {
    // Only proceed with installation logic for mobile devices
    if (!isMobile) return

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Only allow installation on mobile devices
      if (!isMobile) {
        e.preventDefault()
        return
      }

      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      console.log("PWA was installed via appinstalled event")
      // Clear the deferredPrompt
      setDeferredPrompt(null)
      setIsInstallable(false)
      setIsInstalled(true)

      // Mark as installed
      localStorage.setItem("pwa_installed", "true")
      localStorage.removeItem("pwa_installing")

      // Don't redirect automatically - let the user click a button
      // This ensures the installation is fully complete before redirecting
    }

    // Set up event listeners
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [isMobile])

  // Handle visibility change (when user returns to the app after installation)
  useEffect(() => {
    // Only proceed with visibility change logic for mobile devices
    if (!isMobile) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // When user comes back to the page, check if it's now a PWA
        if (isPWA() && installationStarted) {
          console.log("PWA detected on visibility change after installation started")
          setIsInstalled(true)
          // Don't redirect automatically - let the user click a button
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isMobile, installationStarted])

  // Handle install button click
  const handleInstallClick = async () => {
    // Only allow installation on mobile devices
    if (!isMobile) {
      alert("Installation is only available on mobile devices.")
      return
    }

    // Mark that installation has started
    setInstallationStarted(true)
    localStorage.setItem("pwa_installing", "true")

    // Store referral code again to be safe
    if (code) {
      localStorage.setItem("pendingReferralCode", code)
      sessionStorage.setItem("pendingReferralCode", code)

      // Store fingerprint with referral code if available
      if (fingerprint) {
        localStorage.setItem("referralFingerprint", fingerprint)
      }
    }

    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt()

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice
      console.log(`User response to the install prompt: ${outcome}`)

      if (outcome === "accepted") {
        // User accepted the install prompt
        setIsInstalled(true)
        localStorage.setItem("pwa_installed", "true")
      }

      // We've used the prompt, and can't use it again, discard it
      setDeferredPrompt(null)
      setIsInstallable(false)
    }
  }

  // Handle continue button click after installation
  const handleContinueClick = () => {
    if (isInstalled) {
      setRedirecting(true)
      safeRedirect()
    }
  }

  const handleResetPWA = () => {
    resetPWAState()
    window.location.reload()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Install Our App</CardTitle>
          <CardDescription>You've been invited! Install our app to get started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <p className="font-medium">Great! You've successfully installed the app.</p>
              <p>Click the button below to continue to signup.</p>
              {/* Debug info - remove in production */}
              <div className="text-xs text-gray-500 mt-4">
                <p>Referral code: {code || localStorage.getItem("pendingReferralCode") || "None"}</p>
                <p>isPWA: {isPWA() ? "Yes" : "No"}</p>
              </div>
            </div>
          ) : deviceType === "desktop" ? (
            <div className="text-center space-y-4">
              <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
              <p className="font-medium">Mobile Device Required</p>
              <p className="text-sm text-gray-600">
                Our app can only be installed on iOS and Android devices. Please open this page on your mobile device to
                install the app and participate in the referral program.
              </p>
              <div className="bg-amber-50 p-4 rounded-md text-sm text-amber-800 mt-4">
                <p className="font-medium mb-2">Why mobile only?</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Better user experience on mobile devices</li>
                  <li>Access to mobile-specific features</li>
                  <li>Optimized for on-the-go learning</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-md">
                <p className="font-medium">Why install our app?</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Faster access and better performance</li>
                  <li>• Works offline</li>
                  <li>• Receive notifications</li>
                  <li>• Earn referral rewards</li>
                </ul>
              </div>

              {showIOSInstructions && (
                <div className="space-y-2">
                  <p className="font-medium">Install on iOS:</p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>
                      Tap the{" "}
                      <span className="inline-flex items-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-1.5m-15 0h7.5m-7.5 0c-.621 0-1.125-.504-1.125-.125V9.75m0 10.125c0 .621.504 1.125 1.125 1.125M18 11.25v-5.625c0-.621-.504-1.125-1.125-1.125h-1.5v1.5h-1.5v-1.5h-1.5v1.5h-1.5v-1.5h-1.5c-.621 0-1.125.504-1.125 1.125v5.625c0 .621.504 1.125 1.125 1.125h7.5c.621 0 1.125-.504 1.125-.125z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>{" "}
                        Share
                      </span>{" "}
                      button
                    </li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" in the top-right corner</li>
                    <li>Open the app from your home screen</li>
                  </ol>
                </div>
              )}

              {showAndroidInstructions && (
                <div className="space-y-2">
                  <p className="font-medium">Install on Android:</p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>Tap the three dots menu in the top-right</li>
                    <li>Tap "Install app" or "Add to Home screen"</li>
                    <li>Follow the on-screen instructions</li>
                    <li>Open the app from your home screen</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {isInstalled ? (
            <Button
              onClick={handleContinueClick}
              className="w-full flex justify-center items-center gap-2 text-lg"
              disabled={redirecting}
            >
              {redirecting ? "Redirecting..." : "Continue to Signup"}
            </Button>
          ) : (
            <>
              {deviceType === "desktop" ? (
                <Link href="/" className="bg-primary w-full p-2 rounded-lg text-white text-center text-lg">
                  Continue to Website
                </Link>
              ) : (
                <Button
                  onClick={handleInstallClick}
                  className="w-full flex justify-center items-center gap-2 text-lg"
                  disabled={!isInstallable && !showIOSInstructions && !showAndroidInstructions}
                >
                  <Download className="h-5 w-5" />
                  <span>Install App</span>
                </Button>
              )}
            </>
          )}
        </CardFooter>
        {/* Debug controls - remove in production */}
        <div className="border-t pt-3 mt-3">
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium">Debug Controls</summary>
            <div className="mt-2 space-y-2">
              <div>
                <p>PWA Status: {isPWA() ? "Detected as PWA" : "Not detected as PWA"}</p>
                <p>Referral Code: {code || localStorage.getItem("pendingReferralCode") || "None"}</p>
                <p>Installation Flag: {localStorage.getItem("pwa_installed") || "Not set"}</p>
              </div>
              <button onClick={handleResetPWA} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                Reset PWA State
              </button>
            </div>
          </details>
        </div>
      </Card>
    </main>
  )
}

