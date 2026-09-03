import { suggestBulughAge, validateQadaSetup } from './qadaSetup';

const VALID = {
  birthDate: '2000-01-15',
  bulughAge: '12',
  gender: 'male',
  practiceStartDate: '2015-06-01',
};

describe('validateQadaSetup', () => {
  it('returns shaped values for fully valid input', () => {
    const result = validateQadaSetup(VALID);
    expect(result.errors).toBeUndefined();
    expect(result.values).toEqual({
      birth_date: '2000-01-15',
      bulugh_age: 12,
      gender: 'male',
      practice_start_date: '2015-06-01',
    });
  });

  it('accepts female gender too', () => {
    const result = validateQadaSetup({ ...VALID, gender: 'female' });
    expect(result.values?.gender).toBe('female');
  });

  it('rejects a malformed birth date', () => {
    const result = validateQadaSetup({ ...VALID, birthDate: '01/15/2000' });
    expect(result.errors?.birthDate).toBeTruthy();
    expect(result.values).toBeUndefined();
  });

  it('rejects a birth date that does not exist on the calendar (e.g. Feb 31)', () => {
    const result = validateQadaSetup({ ...VALID, birthDate: '2000-02-31' });
    expect(result.errors?.birthDate).toBeTruthy();
  });

  it('rejects a birth date in the future', () => {
    const result = validateQadaSetup({ ...VALID, birthDate: '2099-01-01' });
    expect(result.errors?.birthDate).toBe('Birth date cannot be in the future.');
  });

  it('rejects a non-numeric bulugh age', () => {
    const result = validateQadaSetup({ ...VALID, bulughAge: 'twelve' });
    expect(result.errors?.bulughAge).toBeTruthy();
  });

  it('rejects a zero or negative bulugh age', () => {
    expect(validateQadaSetup({ ...VALID, bulughAge: '0' }).errors?.bulughAge).toBeTruthy();
    expect(validateQadaSetup({ ...VALID, bulughAge: '-3' }).errors?.bulughAge).toBeTruthy();
  });

  it('rejects a non-integer bulugh age', () => {
    const result = validateQadaSetup({ ...VALID, bulughAge: '12.5' });
    expect(result.errors?.bulughAge).toBeTruthy();
  });

  it('rejects an empty bulugh age', () => {
    const result = validateQadaSetup({ ...VALID, bulughAge: '   ' });
    expect(result.errors?.bulughAge).toBeTruthy();
  });

  it('rejects a missing/invalid gender', () => {
    expect(validateQadaSetup({ ...VALID, gender: '' }).errors?.gender).toBeTruthy();
    expect(validateQadaSetup({ ...VALID, gender: 'other' }).errors?.gender).toBeTruthy();
  });

  it('rejects a malformed practice start date', () => {
    const result = validateQadaSetup({ ...VALID, practiceStartDate: 'not-a-date' });
    expect(result.errors?.practiceStartDate).toBeTruthy();
  });

  it('rejects a practice start date in the future', () => {
    const result = validateQadaSetup({ ...VALID, practiceStartDate: '2099-01-01' });
    expect(result.errors?.practiceStartDate).toBe(
      'Practice start date cannot be in the future.'
    );
  });

  it('rejects a practice start date before the birth date', () => {
    const result = validateQadaSetup({
      ...VALID,
      birthDate: '2010-01-01',
      practiceStartDate: '2005-01-01',
    });
    expect(result.errors?.practiceStartDate).toBe(
      'Practice start date cannot be before birth date.'
    );
  });

  it('allows the practice start date to equal the birth date', () => {
    const result = validateQadaSetup({
      ...VALID,
      birthDate: '2010-01-01',
      practiceStartDate: '2010-01-01',
    });
    expect(result.errors).toBeUndefined();
  });

  it('reports every invalid field at once, not just the first', () => {
    const result = validateQadaSetup({
      birthDate: '',
      bulughAge: '',
      gender: '',
      practiceStartDate: '',
    });
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(
      ['birthDate', 'bulughAge', 'gender', 'practiceStartDate'].sort()
    );
  });
});

describe('suggestBulughAge', () => {
  it('returns null when no gender is chosen yet', () => {
    expect(suggestBulughAge('hanafi', '')).toBeNull();
  });

  it('suggests 9 for female regardless of madhhab', () => {
    expect(suggestBulughAge('hanafi', 'female')).toBe(9);
    expect(suggestBulughAge('shafi', 'female')).toBe(9);
  });

  it('suggests 12 for male + Hanafi', () => {
    expect(suggestBulughAge('hanafi', 'male')).toBe(12);
  });

  it('suggests 15 for male + Shafi/Maliki/Hanbali (grouped as "shafi")', () => {
    expect(suggestBulughAge('shafi', 'male')).toBe(15);
  });
});
