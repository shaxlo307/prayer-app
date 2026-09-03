/**
 * Pure logic for the Day 13 qada setup form (birth date, bulugh age,
 * gender, practice-start date). Kept dependency-free from React/RN, same
 * pattern as lib/location.ts's isValidManualCity and lib/calendar.ts, so
 * it's trivial to unit test and reusable if a second entry point (e.g. an
 * edit-profile screen) needs the same rules later.
 *
 * These four fields already exist on the backend Profile model (added in
 * the Day 7.5 reconciliation) — this module only validates/shapes the
 * values the UI collects before they're PATCHed to /api/profiles/{id}/.
 */

import type { Madhhab } from './api';
import { parseISODate, toISODate } from './calendar';

export interface QadaSetupInput {
  birthDate: string;
  bulughAge: string;
  gender: string;
  practiceStartDate: string;
}

export interface QadaSetupValues {
  birth_date: string;
  bulugh_age: number;
  gender: 'male' | 'female';
  practice_start_date: string;
}

export type QadaSetupFieldErrors = Partial<Record<keyof QadaSetupInput, string>>;

export type QadaSetupResult =
  | { values: QadaSetupValues; errors?: undefined }
  | { values?: undefined; errors: QadaSetupFieldErrors };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = parseISODate(value);
  if (isNaN(parsed.getTime())) return false;
  // Guards against e.g. "2026-02-31" silently rolling over to March 3rd —
  // parseISODate/Date will "succeed" but round-tripping through toISODate
  // reveals the date didn't actually match what was typed.
  return toISODate(parsed) === value;
}

/**
 * Validates and shapes qada setup form input. Returns `{ values }` when
 * every field is valid and internally consistent, or `{ errors }` keyed by
 * field name otherwise — never both, so callers can branch on which key is
 * present rather than checking emptiness.
 */
export function validateQadaSetup(input: QadaSetupInput): QadaSetupResult {
  const errors: QadaSetupFieldErrors = {};
  const todayIso = toISODate(new Date());

  const birthDateValid = isValidCalendarDate(input.birthDate);
  if (!birthDateValid) {
    errors.birthDate = 'Enter a valid birth date (YYYY-MM-DD).';
  } else if (input.birthDate > todayIso) {
    errors.birthDate = 'Birth date cannot be in the future.';
  }

  const bulughAgeTrimmed = input.bulughAge.trim();
  const bulughAgeNum = Number(bulughAgeTrimmed);
  const bulughAgeValid =
    bulughAgeTrimmed !== '' && Number.isInteger(bulughAgeNum) && bulughAgeNum > 0;
  if (!bulughAgeValid) {
    errors.bulughAge = 'Enter a whole number greater than 0.';
  }

  if (input.gender !== 'male' && input.gender !== 'female') {
    errors.gender = 'Select a gender.';
  }

  const practiceStartValid = isValidCalendarDate(input.practiceStartDate);
  if (!practiceStartValid) {
    errors.practiceStartDate = 'Enter a valid practice start date (YYYY-MM-DD).';
  } else {
    if (input.practiceStartDate > todayIso) {
      errors.practiceStartDate = 'Practice start date cannot be in the future.';
    } else if (birthDateValid && input.practiceStartDate < input.birthDate) {
      errors.practiceStartDate = 'Practice start date cannot be before birth date.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      birth_date: input.birthDate,
      bulugh_age: bulughAgeNum,
      gender: input.gender as 'male' | 'female',
      practice_start_date: input.practiceStartDate,
    },
  };
}

/**
 * Suggests a default bulugh (religious maturity) age per the spec's
 * "default suggested by madhhab norms, editable" requirement — never
 * final, the person can always type over it. Values follow the common
 * convention used by existing qada calculators:
 * - Hanafi: 12 (male), 9 (female)
 * - Shafi'i/Maliki/Hanbali (grouped as "shafi" in this app's Madhhab enum
 *   per the Day 7.5 reconciliation): 15 (male), 9 (female)
 *
 * Returns null when gender isn't chosen yet — there's no reasonable
 * default to suggest until then, and the caller should leave the field
 * blank rather than guess.
 */
export function suggestBulughAge(
  madhhab: Madhhab,
  gender: 'male' | 'female' | ''
): number | null {
  if (gender === '') return null;
  if (gender === 'female') return 9;
  return madhhab === 'hanafi' ? 12 : 15;
}
