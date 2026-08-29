import { fetchPrayerTimesByCity, fetchPrayerTimesByCoords, formatPrayerTime, PrayerTimesError } from './prayerTimes';

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

const SAMPLE_ALADHAN_RESPONSE = {
  code: 200,
  status: 'OK',
  data: {
    timings: {
      Fajr: '05:21',
      Sunrise: '06:58',
      Dhuhr: '12:12',
      Asr: '15:11',
      Sunset: '17:25',
      Maghrib: '17:25',
      Isha: '19:02',
      Imsak: '05:11',
    },
  },
};

describe('fetchPrayerTimesByCoords', () => {
  it('parses the 5 prayer times from a successful response', async () => {
    mockFetchOnce(200, SAMPLE_ALADHAN_RESPONSE);

    const result = await fetchPrayerTimesByCoords({
      latitude: 41.31,
      longitude: 69.24,
      calculationMethod: 2,
      madhhab: 'hanafi',
      date: new Date('2026-08-18'),
    });

    expect(result).toEqual({
      fajr: '05:21',
      dhuhr: '12:12',
      asr: '15:11',
      maghrib: '17:25',
      isha: '19:02',
    });
  });

  it('sends school=1 for hanafi and school=0 for shafi', async () => {
    mockFetchOnce(200, SAMPLE_ALADHAN_RESPONSE);
    await fetchPrayerTimesByCoords({
      latitude: 1,
      longitude: 1,
      calculationMethod: 2,
      madhhab: 'hanafi',
    });
    let url = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('school=1');

    mockFetchOnce(200, SAMPLE_ALADHAN_RESPONSE);
    await fetchPrayerTimesByCoords({
      latitude: 1,
      longitude: 1,
      calculationMethod: 2,
      madhhab: 'shafi',
    });
    url = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('school=0');
  });

  it('sends the calculation method and date in DD-MM-YYYY format', async () => {
    mockFetchOnce(200, SAMPLE_ALADHAN_RESPONSE);
    await fetchPrayerTimesByCoords({
      latitude: 1,
      longitude: 1,
      calculationMethod: 3,
      madhhab: 'shafi',
      date: new Date(2026, 7, 5), // August 5, 2026 (month is 0-indexed)
    });
    const url = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/timings/05-08-2026');
    expect(url).toContain('method=3');
  });

  it('throws PrayerTimesError when the API returns a non-200 code', async () => {
    mockFetchOnce(200, { code: 400, status: 'Bad Request' });
    await expect(
      fetchPrayerTimesByCoords({ latitude: 1, longitude: 1, calculationMethod: 2, madhhab: 'hanafi' })
    ).rejects.toThrow(PrayerTimesError);
  });

  it('throws PrayerTimesError when the HTTP request itself fails', async () => {
    mockFetchOnce(500, {});
    await expect(
      fetchPrayerTimesByCoords({ latitude: 1, longitude: 1, calculationMethod: 2, madhhab: 'hanafi' })
    ).rejects.toThrow(PrayerTimesError);
  });

  it('throws PrayerTimesError when fetch itself rejects (offline)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));
    await expect(
      fetchPrayerTimesByCoords({ latitude: 1, longitude: 1, calculationMethod: 2, madhhab: 'hanafi' })
    ).rejects.toThrow(PrayerTimesError);
  });
});

describe('fetchPrayerTimesByCity', () => {
  it('builds the timingsByCity URL with city and country', async () => {
    mockFetchOnce(200, SAMPLE_ALADHAN_RESPONSE);
    await fetchPrayerTimesByCity({
      city: 'Tashkent',
      country: 'Uzbekistan',
      calculationMethod: 2,
      madhhab: 'hanafi',
    });
    const url = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/timingsByCity/');
    expect(url).toContain('city=Tashkent');
    expect(url).toContain('country=Uzbekistan');
  });

  it('parses the response the same way as fetchByCoords', async () => {
    mockFetchOnce(200, SAMPLE_ALADHAN_RESPONSE);
    const result = await fetchPrayerTimesByCity({
      city: 'Tashkent',
      country: 'Uzbekistan',
      calculationMethod: 2,
      madhhab: 'shafi',
    });
    expect(result.fajr).toBe('05:21');
    expect(result.isha).toBe('19:02');
  });
});

describe('formatPrayerTime', () => {
  it('converts morning times to 12-hour AM format', () => {
    expect(formatPrayerTime('05:21')).toBe('5:21 AM');
  });

  it('converts afternoon times to 12-hour PM format', () => {
    expect(formatPrayerTime('15:11')).toBe('3:11 PM');
  });

  it('converts noon (12:xx) to 12 PM, not 0 PM', () => {
    expect(formatPrayerTime('12:12')).toBe('12:12 PM');
  });

  it('converts midnight (00:xx) to 12 AM, not 0 AM', () => {
    expect(formatPrayerTime('00:05')).toBe('12:05 AM');
  });

  it('converts evening times correctly', () => {
    expect(formatPrayerTime('19:02')).toBe('7:02 PM');
  });
});
