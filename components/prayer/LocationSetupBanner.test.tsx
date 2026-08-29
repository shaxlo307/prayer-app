import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { requestDeviceLocation } from '@/lib/location';

import { LocationSetupBanner } from './LocationSetupBanner';

jest.mock('@/lib/location', () => ({
  requestDeviceLocation: jest.fn(),
  isValidManualCity: jest.requireActual('@/lib/location').isValidManualCity,
}));

const mockRequestDeviceLocation = requestDeviceLocation as jest.Mock;

describe('LocationSetupBanner', () => {
  beforeEach(() => {
    mockRequestDeviceLocation.mockReset();
  });

  it('calls onLocationResolved with coords when GPS is granted', async () => {
    mockRequestDeviceLocation.mockResolvedValue({
      status: 'granted',
      coords: { latitude: 41.31, longitude: 69.24 },
    });
    const onLocationResolved = jest.fn();
    await render(<LocationSetupBanner onLocationResolved={onLocationResolved} />);

    await fireEvent.press(screen.getByText('Use my location'));

    await waitFor(() => {
      expect(onLocationResolved).toHaveBeenCalledWith({
        type: 'coords',
        coords: { latitude: 41.31, longitude: 69.24 },
      });
    });
  });

  it('falls back to the manual form when GPS permission is denied', async () => {
    mockRequestDeviceLocation.mockResolvedValue({ status: 'denied' });
    const onLocationResolved = jest.fn();
    await render(<LocationSetupBanner onLocationResolved={onLocationResolved} />);

    await fireEvent.press(screen.getByText('Use my location'));

    await waitFor(() => {
      expect(screen.getByLabelText('City')).toBeTruthy();
      expect(screen.getByLabelText('Country')).toBeTruthy();
    });
    expect(onLocationResolved).not.toHaveBeenCalled();
  });

  it('falls back to the manual form and shows an error when GPS is unavailable', async () => {
    mockRequestDeviceLocation.mockResolvedValue({ status: 'unavailable', reason: 'GPS off' });
    await render(<LocationSetupBanner onLocationResolved={jest.fn()} />);

    await fireEvent.press(screen.getByText('Use my location'));

    await waitFor(() => {
      expect(screen.getByText(/Could not get your location/)).toBeTruthy();
    });
  });

  it('submits a manual city/country and calls onLocationResolved', async () => {
    mockRequestDeviceLocation.mockResolvedValue({ status: 'denied' });
    const onLocationResolved = jest.fn();
    await render(<LocationSetupBanner onLocationResolved={onLocationResolved} />);

    await fireEvent.press(screen.getByText('Use my location'));
    await waitFor(() => screen.getByLabelText('City'));

    await fireEvent.changeText(screen.getByLabelText('City'), 'Tashkent');
    await fireEvent.changeText(screen.getByLabelText('Country'), 'Uzbekistan');
    await fireEvent.press(screen.getByText('Set location'));

    expect(onLocationResolved).toHaveBeenCalledWith({
      type: 'city',
      city: 'Tashkent',
      country: 'Uzbekistan',
    });
  });

  it('shows a validation error when submitting the manual form incomplete', async () => {
    mockRequestDeviceLocation.mockResolvedValue({ status: 'denied' });
    const onLocationResolved = jest.fn();
    await render(<LocationSetupBanner onLocationResolved={onLocationResolved} />);

    await fireEvent.press(screen.getByText('Use my location'));
    await waitFor(() => screen.getByLabelText('City'));
    await fireEvent.press(screen.getByText('Set location'));

    expect(screen.getByText('Enter both a city and a country.')).toBeTruthy();
    expect(onLocationResolved).not.toHaveBeenCalled();
  });
});
