import { describe, it, expect } from 'vitest';
import { parsePopHostname, POP_CODES } from '../lib/utils/pop';

describe('parsePopHostname', () => {
  it('parses Frankfurt PoP', () => {
    expect(parsePopHostname('customer.frntdeu1.isp.starlink.com.')).toBe('Frankfurt, DE');
  });

  it('parses London PoP', () => {
    expect(parsePopHostname('customer.lndngbr1.pop.starlinkisp.net')).toBe('London, GB');
  });

  it('parses LAX PoP', () => {
    expect(parsePopHostname('customer.lax3.mc.starlinkisp.net')).toBe('Los Angeles, US');
  });

  it('parses Madrid PoP', () => {
    expect(parsePopHostname('customer.madresp1.isp.starlink.com')).toBe('Madrid, ES');
  });

  it('returns null for non-Starlink hostname', () => {
    expect(parsePopHostname('ec2-1-2-3-4.compute.amazonaws.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePopHostname('')).toBeNull();
  });

  it('returns uppercase code for unknown PoP', () => {
    expect(parsePopHostname('customer.xyz123.isp.starlink.com')).toBe('XYZ');
  });

  it('handles case-insensitive matching', () => {
    expect(parsePopHostname('customer.FRNTDEU1.isp.starlink.com')).toBe('Frankfurt, DE');
  });
});

describe('POP_CODES', () => {
  it('has entries for major regions', () => {
    expect(Object.keys(POP_CODES).length).toBeGreaterThanOrEqual(10);
    expect(POP_CODES['lax']).toBe('Los Angeles, US');
    expect(POP_CODES['frntdeu']).toBe('Frankfurt, DE');
  });
});
