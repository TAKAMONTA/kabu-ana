import { Capacitor } from '@capacitor/core';

/**
 * iOS ネイティブ環境かどうかを判定
 */
export function isIOSNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Android ネイティブ環境かどうかを判定
 */
export function isAndroidNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * ネイティブ環境（iOS or Android）かどうかを判定
 */
export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}
