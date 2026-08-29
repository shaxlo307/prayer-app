import * as SecureStore from 'expo-secure-store';

import { api } from './api';
import { getOrCreateSession } from './session';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('./api', () => ({
  api: { registerDevice: jest.fn() },
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockRegisterDevice = api.registerDevice as jest.Mock;

describe('getOrCreateSession concurrency', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockRegisterDevice.mockReset();
  });

  it('only registers once when called concurrently on a fresh install', async () => {
    // Simulates multiple screens (home, history, day-detail) each calling
    // getOrCreateSession() independently on mount, before any session is
    // stored yet — this used to create two separate throwaway accounts.
    mockGetItem.mockResolvedValue(null);
    let resolveRegister: (value: unknown) => void;
    mockRegisterDevice.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      })
    );

    const call1 = getOrCreateSession();
    const call2 = getOrCreateSession();
    const call3 = getOrCreateSession();

    resolveRegister!({
      username: 'device-only-one',
      password: 'pw',
      profile: { id: 1 },
    });

    const [s1, s2, s3] = await Promise.all([call1, call2, call3]);

    expect(mockRegisterDevice).toHaveBeenCalledTimes(1);
    expect(s1).toEqual(s2);
    expect(s2).toEqual(s3);
    expect(s1.username).toBe('device-only-one');
  });

  it('allows a fresh registration again after the in-flight one settles', async () => {
    mockGetItem.mockResolvedValue(null);
    mockRegisterDevice
      .mockResolvedValueOnce({ username: 'first', password: 'pw1', profile: { id: 1 } })
      .mockResolvedValueOnce({ username: 'second', password: 'pw2', profile: { id: 2 } });

    const first = await getOrCreateSession();
    expect(first.username).toBe('first');

    // Second call happens after the first fully resolved — since
    // getItemAsync is still mocked to return null (simulating storage not
    // actually persisting in this test), it should register again rather
    // than reuse a stale in-flight promise.
    const second = await getOrCreateSession();
    expect(second.username).toBe('second');
    expect(mockRegisterDevice).toHaveBeenCalledTimes(2);
  });
});

describe('getOrCreateSession', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockRegisterDevice.mockReset();
  });

  it('returns the existing session without registering a new one', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'device_session_username') return Promise.resolve('device-abc');
      if (key === 'device_session_password') return Promise.resolve('secret123');
      if (key === 'device_session_profile_id') return Promise.resolve('7');
      return Promise.resolve(null);
    });

    const session = await getOrCreateSession();

    expect(session).toEqual({ username: 'device-abc', password: 'secret123', profileId: 7 });
    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });

  it('registers a new device account when no session is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    mockRegisterDevice.mockResolvedValue({
      username: 'device-xyz',
      password: 'newpass456',
      profile: { id: 12 },
    });

    const session = await getOrCreateSession();

    expect(session).toEqual({ username: 'device-xyz', password: 'newpass456', profileId: 12 });
    expect(mockSetItem).toHaveBeenCalledWith('device_session_username', 'device-xyz');
    expect(mockSetItem).toHaveBeenCalledWith('device_session_password', 'newpass456');
    expect(mockSetItem).toHaveBeenCalledWith('device_session_profile_id', '12');
  });

  it('registers a new session if the stored profile id is corrupted (not a number)', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'device_session_username') return Promise.resolve('device-abc');
      if (key === 'device_session_password') return Promise.resolve('secret123');
      if (key === 'device_session_profile_id') return Promise.resolve('not-a-number');
      return Promise.resolve(null);
    });
    mockRegisterDevice.mockResolvedValue({
      username: 'device-new',
      password: 'freshpass',
      profile: { id: 3 },
    });

    const session = await getOrCreateSession();

    expect(session.username).toBe('device-new');
    expect(mockRegisterDevice).toHaveBeenCalledTimes(1);
  });

  it('registers a new session if any one of the three stored values is missing', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'device_session_username') return Promise.resolve('device-abc');
      if (key === 'device_session_password') return Promise.resolve(null); // missing
      if (key === 'device_session_profile_id') return Promise.resolve('7');
      return Promise.resolve(null);
    });
    mockRegisterDevice.mockResolvedValue({
      username: 'device-recovered',
      password: 'pass',
      profile: { id: 9 },
    });

    const session = await getOrCreateSession();

    expect(session.username).toBe('device-recovered');
  });
});
