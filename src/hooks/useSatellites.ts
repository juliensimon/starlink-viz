'use client';

import { useState, useEffect } from 'react';
import type { TLEData } from '@/lib/satellites/tle-fetcher';

interface UseSatellitesReturn {
  tleData: TLEData[] | null;
  loading: boolean;
  error: string | null;
  satelliteCount: number;
}

/**
 * React hook that fetches TLE satellite data from the API route.
 */
export function useSatellites(): UseSatellitesReturn {
  const [tleData, setTleData] = useState<TLEData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const response = await fetch('/api/tle');
        if (!response.ok) {
          throw new Error(`TLE fetch failed: ${response.status}`);
        }
        const data: TLEData[] = await response.json();
        if (!cancelled) {
          setTleData(data);
          setLoading(false);
          console.log(`Loaded ${data.length} satellites`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    tleData,
    loading,
    error,
    satelliteCount: tleData?.length ?? 0,
  };
}
