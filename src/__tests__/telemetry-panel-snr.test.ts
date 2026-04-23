import { describe, it, expect } from 'vitest';

function snrLabel(snrEstimate: number): string {
  return snrEstimate >= 10 ? 'OK' : 'Low';
}

describe('SNR label', () => {
  it('shows OK when snr is 10.5 (above noise floor)', () => {
    expect(snrLabel(10.5)).toBe('OK');
  });

  it('shows Low when snr is 5.0 (below noise floor)', () => {
    expect(snrLabel(5.0)).toBe('Low');
  });
});
