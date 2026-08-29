/**
 * Location permission flow: GPS first, manual city/country fallback if
 * denied or unavailable. Per the app spec's edge-case rules, this never
 * blocks app usage — callers should show a non-blocking banner instead,
 * not a gate.
 */

import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type DeviceLocationResult =
  | { status: 'granted'; coords: Coordinates }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

/**
 * Requests foreground location permission and, if granted, the current
 * position. Never throws — every failure mode is represented in the
 * returned union so callers can fall back to manual city entry.
 */
export async function requestDeviceLocation(): Promise<DeviceLocationResult> {
  let permission: Location.LocationPermissionResponse;
  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch (err) {
    return { status: 'unavailable', reason: err instanceof Error ? err.message : 'Unknown error' };
  }

  if (permission.status !== 'granted') {
    return { status: 'denied' };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: 'granted',
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch (err) {
    return { status: 'unavailable', reason: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export interface ManualCityLocation {
  city: string;
  country: string;
}

/** Basic validation for the manual-entry fallback form. */
export function isValidManualCity(input: Partial<ManualCityLocation>): input is ManualCityLocation {
  return Boolean(input.city?.trim()) && Boolean(input.country?.trim());
}
