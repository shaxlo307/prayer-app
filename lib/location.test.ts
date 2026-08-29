import * as Location from 'expo-location';

import { isValidManualCity, requestDeviceLocation } from './location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mockRequestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;

describe('requestDeviceLocation', () => {
  beforeEach(() => {
    mockRequestPermission.mockReset();
    mockGetPosition.mockReset();
  });

  it('returns granted coordinates when permission is granted and position succeeds', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'granted' });
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 41.311, longitude: 69.24 },
    });

    const result = await requestDeviceLocation();

    expect(result).toEqual({
      status: 'granted',
      coords: { latitude: 41.311, longitude: 69.24 },
    });
  });

  it('returns denied when the user rejects the permission prompt', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied' });

    const result = await requestDeviceLocation();

    expect(result).toEqual({ status: 'denied' });
    expect(mockGetPosition).not.toHaveBeenCalled();
  });

  it('returns unavailable (not a throw) if the permission request itself errors', async () => {
    mockRequestPermission.mockRejectedValue(new Error('Location services disabled'));

    const result = await requestDeviceLocation();

    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toContain('Location services disabled');
    }
  });

  it('returns unavailable (not a throw) if getting the position fails after permission is granted', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'granted' });
    mockGetPosition.mockRejectedValue(new Error('GPS timeout'));

    const result = await requestDeviceLocation();

    expect(result.status).toBe('unavailable');
  });
});

describe('isValidManualCity', () => {
  it('accepts a filled-in city and country', () => {
    expect(isValidManualCity({ city: 'Tashkent', country: 'Uzbekistan' })).toBe(true);
  });

  it('rejects a missing country', () => {
    expect(isValidManualCity({ city: 'Tashkent' })).toBe(false);
  });

  it('rejects a missing city', () => {
    expect(isValidManualCity({ country: 'Uzbekistan' })).toBe(false);
  });

  it('rejects whitespace-only values', () => {
    expect(isValidManualCity({ city: '   ', country: 'Uzbekistan' })).toBe(false);
  });
});
