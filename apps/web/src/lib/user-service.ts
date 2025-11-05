'use server';

import { cookies } from 'next/headers';
import { getDeviceFingerprint } from './device-fingerprint';
import { isUniqueDevice, registerDeviceFingerprint } from './referral-service';

type UserData = {
  name: string;
  email: string;
  password: string;
  referralCode?: string | null;
  isPwaInstalled?: boolean;
};

// Helper functions
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function createUser(userData: UserData) {
  try {
    // Get device fingerprint
    const deviceFingerprint = await getDeviceFingerprint();

    // Check if this device is unique
    const isUnique = await isUniqueDevice(deviceFingerprint);

    // Check if this is a valid referral (unique device + PWA installed)
    const isValidReferral = isUnique && userData.isPwaInstalled && userData.referralCode;

    // Create the user in your database
    // This would connect to your actual database
    const userId = `user-${Math.random().toString(36).substring(2, 15)}`;

    // Register the device fingerprint
    await registerDeviceFingerprint(deviceFingerprint, userId, !!userData.isPwaInstalled);

    // Generate referral code for the new user
    const newUserReferralCode: string = generateReferralCode();
    // Store user info in cookies (in a real app, use a proper auth system)
    (await cookies()).set('user_email', userData.email);
    (await cookies()).set('user_referral_code', newUserReferralCode);

    // If this is a valid referral, process it
    if (isValidReferral) {
      await processReferral(userData.referralCode!, deviceFingerprint, userId);
    }

    return {
      success: true,
      isUniqueDevice: isUnique,
      isValidReferral,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }
}

export async function getUserReferralData() {
  // In a real app, fetch this from your database
  // For demo purposes, we'll return mock data
  return {
    referralCode: (await cookies()).get('user_referral_code')?.value || generateReferralCode(),
    referralCount: 5,
    rewards: 500,
  };
}

async function processReferral(referralCode: string, deviceFingerprint: string, userId: string) {
  // In a real app, you would:
  // 1. Verify the referral code is valid
  // 2. Check if this device has been used for a referral before
  // 3. Credit the referrer with a successful referral
  // 4. Credit the new user with a welcome bonus

  console.log(`Processing referral: ${referralCode} from device: ${deviceFingerprint} for user: ${userId}`);

  // For demo purposes, we'll just log it
  return { success: true };
}
