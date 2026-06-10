/**
 * Shared TLE international-designator parsing.
 *
 * Cleanup history: the NORAD 2-digit-year pivot (57-99 → 19xx, 00-56 → 20xx)
 * was hand-copied in 5 places (satellite-store, SatellitePropagator ×2,
 * SatelliteTooltip, fleet ingest-helpers) and could drift independently.
 */
import { describe, it, expect } from 'vitest';
import { pivotTwoDigitYear, parseLaunchYear, parseLaunchInfoFromLine1 } from '../lib/satellites/tle-parse';

// Real Starlink TLE line 1 (STARLINK-1007, launched 2019, launch 74, piece A)
const LINE1 = '1 44713U 19074A   26010.91667824  .00001764  00000-0  13315-3 0  9995';

describe('pivotTwoDigitYear', () => {
  it('maps 57-99 to 1957-1999', () => {
    expect(pivotTwoDigitYear(57)).toBe(1957);
    expect(pivotTwoDigitYear(99)).toBe(1999);
  });

  it('maps 00-56 to 2000-2056', () => {
    expect(pivotTwoDigitYear(0)).toBe(2000);
    expect(pivotTwoDigitYear(24)).toBe(2024);
  });
});

describe('parseLaunchYear', () => {
  it('parses the launch year from TLE line 1', () => {
    expect(parseLaunchYear(LINE1)).toBe(2019);
  });

  it('returns 0 for malformed designators', () => {
    expect(parseLaunchYear('1 44713U XXXXXX')).toBe(0);
  });
});

describe('parseLaunchInfoFromLine1', () => {
  it('parses year and launch number', () => {
    expect(parseLaunchInfoFromLine1(LINE1)).toEqual({ year: 2019, launch: '074' });
  });

  it('returns null when the designator field is blank (TBA objects)', () => {
    expect(parseLaunchInfoFromLine1('1 44713U          26010.91667824')).toBeNull();
  });
});
