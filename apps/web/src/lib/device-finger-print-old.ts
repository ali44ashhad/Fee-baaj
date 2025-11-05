'use client';

/* import FingerprintJS from '@fingerprintjs/fingerprintjs'

// Cache the FingerprintJS agent
let fpPromise: Promise<any> | null = null

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server-side-render'
  }
  
  try {
    // Initialize FingerprintJS if not already done
    if (!fpPromise) {
      fpPromise = FingerprintJS.load()
    }
    
    // Get the visitor identifier
    const fp = await fpPromise
    const result = await fp.get()
    
    return result.visitorId
  } catch (error) {
    console.error('Error generating device fingerprint:', error)
    
    // Fallback to a basic fingerprint if FingerprintJS fails
    const fallbackComponents = [
      navigator.userAgent,
      screen.width,
      screen.height,
      navigator.language,
    ]
    
    return btoa(fallbackComponents.join('|')).substring(0, 32)
  }
} */

// Update the getDeviceFingerprint function to focus more on hardware-specific identifiers
// This will help identify the same physical device across different browsers

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return 'server-side-render';
  }

  try {
    // Check if we have a cached fingerprint
    const cachedFingerprint = sessionStorage.getItem('device_fingerprint');
    if (cachedFingerprint) {
      return cachedFingerprint;
    }

    // Collect hardware-specific components for fingerprinting
    // These are more likely to be consistent across browsers on the same device
    const components = [
      // Device-specific information
      navigator.userAgent,
      navigator.platform,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      screen.pixelDepth,
      navigator.hardwareConcurrency || '',
      (navigator as any).deviceMemory || '',
      Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Hardware-based canvas fingerprinting
      await getHardwareRenderedCanvas(),

      // WebGL information (GPU details)
      await getWebGLInfo(),

      // Device orientation capability
      'DeviceOrientationEvent' in window ? '1' : '0',
      'DeviceMotionEvent' in window ? '1' : '0',

      // Touch capability
      'ontouchstart' in window ? '1' : '0',
      navigator.maxTouchPoints || 0,
    ].filter(Boolean);

    // Create a hash from the components
    const fingerprint = components.join('|');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));

    // Convert hash to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Store in sessionStorage for performance in subsequent calls
    sessionStorage.setItem('device_fingerprint', hashHex);

    return hashHex;
  } catch (error) {
    console.error('Error generating device fingerprint:', error);

    // Fallback to a less reliable but functional fingerprint
    const fallbackComponents = [navigator.userAgent, screen.width, screen.height, navigator.language];

    return btoa(fallbackComponents.join('|')).substring(0, 32);
  }
}

// Hardware-rendered canvas fingerprinting
async function getHardwareRenderedCanvas(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';

    // Set canvas dimensions
    canvas.width = 200;
    canvas.height = 50;

    // Draw complex shapes that will use hardware acceleration
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 200, 0);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#8e44ad');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 200, 50);

    // Draw text with specific styling
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText('DeviceFingerprint', 10, 15);

    // Draw complex shapes
    ctx.beginPath();
    ctx.arc(160, 25, 15, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    // Get the data URL
    return canvas.toDataURL();
  } catch (e) {
    return '';
  }
}

async function getWebGLInfo(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext 
      || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    
    if (!gl) return '';

    // Get WebGL renderer and vendor info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';

    return `${vendor}|${renderer}`;
  } catch (e) {
    return '';
  }
}


// Check if the app is running as an installed PWA
export function isPWA(): boolean {
  // Different browsers have different ways to detect if the app is running as a PWA
  // This is a simplified check that works for most cases

  // Check for display-mode: standalone
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // iOS Safari doesn't support matchMedia for display-mode
  // so we check for the navigator.standalone property
  const isIOSStandalone = 'standalone' in navigator && (navigator as any).standalone === true;

  return isStandalone || isIOSStandalone;
}
