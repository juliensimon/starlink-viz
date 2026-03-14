/**
 * Starlink Point of Presence (PoP) detection.
 * Parses reverse DNS hostnames to identify the exit PoP.
 */

export const POP_CODES: Record<string, string> = {
  frntdeu: 'Frankfurt, DE',
  frntfra: 'Frankfurt, DE',
  lndngbr: 'London, GB',
  madresp: 'Madrid, ES',
  lax: 'Los Angeles, US',
  sea: 'Seattle, US',
  chi: 'Chicago, US',
  iad: 'Washington DC, US',
  mia: 'Miami, US',
  ams: 'Amsterdam, NL',
  par: 'Paris, FR',
  sin: 'Singapore, SG',
  syd: 'Sydney, AU',
  nrt: 'Tokyo, JP',
};

/**
 * Parse a Starlink reverse DNS hostname to extract the PoP city.
 * Hostnames follow the pattern: customer.<pop-code><number>.isp.starlink.com
 */
export function parsePopHostname(hostname: string): string | null {
  const match = hostname.match(/customer\.([a-z]+)\d*\./i);
  if (!match) return null;

  const code = match[1].toLowerCase();
  for (const [prefix, city] of Object.entries(POP_CODES)) {
    if (code.startsWith(prefix)) return city;
  }
  return code.toUpperCase();
}
