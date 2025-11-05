'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download, AlertTriangle } from 'lucide-react';
import { isPWA } from '@/lib/device-fingerprint';
// Import webRoutes but we'll use a hardcoded path as fallback
import webRoutes from '@/lib/webRoutes';

export default function Install() {
  // Get the params safely
  const params = useParams();
  // Make sure we have a string, not an array or undefined
  const code = params && typeof params.code === 'string' ? params.code : '';

  const router = useRouter();
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop' | null>(null);

  // Define a safe auth route path - use hardcoded fallback if webRoutes.auth is undefined
  const authPath = typeof webRoutes?.auth === 'string' ? webRoutes.auth : '/auth';

  // Safe redirect function
  const safeRedirect = () => {
    try {
      console.log(`Redirecting to: ${authPath}`);
      // Use window.location for a hard redirect as a fallback
      window.location.href = authPath;
    } catch (error) {
      console.error('Error during redirect:', error);
      // Ultimate fallback - hardcoded path
      window.location.href = '/auth';
    }
  };

  // Handle immediate PWA detection and device type detection
  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    // Check if mobile device (iOS or Android)
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setIsMobileDevice(true);
      setDeviceType('ios');
      setShowIOSInstructions(true);
    } else if (/android/i.test(userAgent)) {
      setIsMobileDevice(true);
      setDeviceType('android');
      setShowAndroidInstructions(true);
    } else {
      setIsMobileDevice(false);
      setDeviceType('desktop');
    }

    // Check if already running as PWA
    if (isPWA()) {
      setIsInstalled(true);
      setRedirecting(true);

      // If we're already in the PWA, redirect to auth immediately
      console.log('PWA detected, redirecting to auth...');
      safeRedirect();
    }
  }, []);

  // Handle installation events - only for mobile devices
  useEffect(() => {
    // Only proceed with installation logic for mobile devices
    if (!isMobileDevice) return;

    // Store installation state
    localStorage.setItem('pwa_installing', 'true');

    // Store referral code if available
    if (code) {
      localStorage.setItem('pendingReferralCode', code);
    }

    // Check if we just installed the PWA
    const wasInstalling = localStorage.getItem('pwa_installing');
    const isNowInstalled = localStorage.getItem('pwa_installed');

    if (wasInstalling && isNowInstalled) {
      // Clear the flags
      localStorage.removeItem('pwa_installing');
      setRedirecting(true);

      // Redirect to auth immediately
      console.log('Installation detected from localStorage, redirecting...');
      safeRedirect();
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Only allow installation on mobile devices
      if (!isMobileDevice) {
        e.preventDefault();
        return;
      }

      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      console.log('PWA was installed via appinstalled event');
      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
      setRedirecting(true);

      // Mark as installed
      localStorage.setItem('pwa_installed', 'true');
      localStorage.removeItem('pwa_installing');

      // Redirect to auth page immediately
      safeRedirect();
    };

    // Set up event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check frequently for installation state changes (helps with iOS)
    const checkInterval = setInterval(() => {
      if (isPWA() && !isInstalled && !redirecting) {
        console.log('PWA detected via interval check, redirecting...');
        setIsInstalled(true);
        setRedirecting(true);
        clearInterval(checkInterval);
        safeRedirect();
      }
    }, 1000); // Check every second

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(checkInterval);
    };
  }, [code, isInstalled, redirecting, authPath, isMobileDevice]);

  // Handle visibility change (when user returns to the app after installation)
  useEffect(() => {
    // Only proceed with visibility change logic for mobile devices
    if (!isMobileDevice) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !redirecting) {
        // When user comes back to the page, check if it's now a PWA
        if (isPWA()) {
          console.log('PWA detected on visibility change, redirecting...');
          setIsInstalled(true);
          setRedirecting(true);
          safeRedirect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [redirecting, authPath, isMobileDevice]);

  // Handle install button click
  const handleInstallClick = async () => {
    // Only allow installation on mobile devices
    if (!isMobileDevice) {
      alert('Installation is only available on mobile devices.');
      return;
    }

    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);

      if (outcome === 'accepted') {
        // User accepted the install prompt
        setIsInstalled(true);
        localStorage.setItem('pwa_installed', 'true');
      }

      // We've used the prompt, and can't use it again, discard it
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

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
              <p className="font-medium">Great! You're using the installed app.</p>
              <p>Redirecting to signup...</p>
              {/* No button here - automatic redirect */}
            </div>
          ) : deviceType === 'desktop' ? (
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
                  <li>Better user experience on mobile devices</li>
                  <li>Access to mobile-specific features</li>
                  <li>Optimized for on-the-go learning</li>
                </ul>
              </div>

              {showIOSInstructions && (
                <div className="space-y-2">
                  <p className="font-medium">Install on iOS:</p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>
                      Tap the{' '}
                      <span className="inline-flex items-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-1.5m-15 0h7.5m-7.5 0c-.621 0-1.125-.504-1.125-.125V9.75m0 10.125c0 .621.504 1.125 1.125 1.125M18 11.25v-5.625c0-.621-.504-1.125-1.125-1.125h-1.5v1.5h-1.5v-1.5h-1.5v1.5h-1.5v-1.5h-1.5c-.621 0-1.125.504-1.125 1.125v5.625c0 .621.504 1.125 1.125 1.125h7.5c.621 0 1.125-.504 1.125-.125z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>{' '}
                        Share
                      </span>{' '}
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
          {!isInstalled && (
            <>
              {deviceType === 'desktop' ? (
                <Link href="/">Continue to Website</Link>
              ) : (
                <Button
                  onClick={handleInstallClick}
                  className="w-full"
                  disabled={!isInstallable && !showIOSInstructions && !showAndroidInstructions}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install App
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
