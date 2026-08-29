/**
 * Client for the Aladhan API (https://aladhan.com), used to calculate real
 * prayer times by location + madhhab + calculation method.
 *
 * Verified directly against the live API on Day 9:
 *   GET https://api.aladhan.com/v1/timings/{DD-MM-YYYY}?latitude=&longitude=&method=&school=
 *   -> { code: 200, status: "OK", data: { timings: { Fajr, Sunrise, Dhuhr,
 *        Asr, Sunset, Maghrib, Isha, Imsak, ... } (all "HH:MM" 24h, already
 *        in local time for that location), date: {...}, meta: {...} } }
 *
 * `school` (0 = Shafi/default, 1 = Hanafi) only affects Asr's calculation —
 * this is the one place madhhab actually changes the output.
 */

import type { Madhhab } from './api';

const ALADHAN_BASE_URL = 'https://api.aladhan.com/v1';

export interface DailyPrayerTimes {
  fajr: string; // "HH:MM", 24-hour, local to the given location
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export class PrayerTimesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrayerTimesError';
  }
}

/** Aladhan's "school" query param: 0 = Shafi (also covers Maliki/Hanbali in
 * our combined `shafi` madhhab option), 1 = Hanafi. */
function schoolForMadhhab(madhhab: Madhhab): 0 | 1 {
  return madhhab === 'hanafi' ? 1 : 0;
}

/** Formats a Date as Aladhan's expected DD-MM-YYYY path param. */
function formatDateParam(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

interface AladhanTimingsResponse {
  code: number;
  status: string;
  data?: {
    timings: {
      Fajr: string;
      Dhuhr: string;
      Asr: string;
      Maghrib: string;
      Isha: string;
      [key: string]: string;
    };
  };
}

function extractTimings(json: AladhanTimingsResponse): DailyPrayerTimes {
  if (json.code !== 200 || !json.data) {
    throw new PrayerTimesError(`Aladhan API returned status "${json.status}" (code ${json.code})`);
  }
  const t = json.data.timings;
  return {
    fajr: t.Fajr,
    dhuhr: t.Dhuhr,
    asr: t.Asr,
    maghrib: t.Maghrib,
    isha: t.Isha,
  };
}

export interface FetchByCoordsParams {
  latitude: number;
  longitude: number;
  date?: Date;
  calculationMethod: number;
  madhhab: Madhhab;
}

export async function fetchPrayerTimesByCoords({
  latitude,
  longitude,
  date = new Date(),
  calculationMethod,
  madhhab,
}: FetchByCoordsParams): Promise<DailyPrayerTimes> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    method: String(calculationMethod),
    school: String(schoolForMadhhab(madhhab)),
  });

  let response: Response;
  try {
    response = await fetch(`${ALADHAN_BASE_URL}/timings/${formatDateParam(date)}?${params}`);
  } catch {
    throw new PrayerTimesError('Could not reach the prayer times service. Check your connection.');
  }

  if (!response.ok) {
    throw new PrayerTimesError(`Prayer times request failed with status ${response.status}`);
  }

  return extractTimings(await response.json());
}

export interface FetchByCityParams {
  city: string;
  country: string;
  date?: Date;
  calculationMethod: number;
  madhhab: Madhhab;
}

/**
 * Manual-location fallback: Aladhan geocodes the city/country string itself,
 * so we don't need our own geocoding service for the "type your city"
 * fallback in the location permission flow.
 */
export async function fetchPrayerTimesByCity({
  city,
  country,
  date = new Date(),
  calculationMethod,
  madhhab,
}: FetchByCityParams): Promise<DailyPrayerTimes> {
  const params = new URLSearchParams({
    city,
    country,
    method: String(calculationMethod),
    school: String(schoolForMadhhab(madhhab)),
  });

  let response: Response;
  try {
    response = await fetch(
      `${ALADHAN_BASE_URL}/timingsByCity/${formatDateParam(date)}?${params}`
    );
  } catch {
    throw new PrayerTimesError('Could not reach the prayer times service. Check your connection.');
  }

  if (!response.ok) {
    throw new PrayerTimesError(`Prayer times request failed with status ${response.status}`);
  }

  return extractTimings(await response.json());
}

/** Converts Aladhan's "HH:MM" (24h) into a display string like "5:12 AM". */
export function formatPrayerTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}
