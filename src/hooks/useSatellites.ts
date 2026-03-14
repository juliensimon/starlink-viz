'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { TLEData } from '@/lib/satellites/tle-fetcher';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface UseSatellitesReturn {
  tleData: TLEData[] | null;
  loading: boolean;
  error: string | null;
  satelliteCount: number;
}

/**
 * React hook that fetches TLE satellite data from the API route.
 * Retries with exponential backoff (1s, 2s, 4s) on failure.
 */
export function useSatellites(): UseSatellitesReturn {
  const [tleData, setTleData] = useState<TLEData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWithRetry() {
      let lastError: string | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (cancelled) return;

        // Exponential backoff delay (skip on first attempt)
        if (attempt > 0) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[TLE] Retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (cancelled) return;
        }

        try {
          const response = await fetch('/api/tle');
          if (!response.ok) {
            throw new Error(`TLE fetch failed: ${response.status}`);
          }
          const data: TLEData[] = await response.json();
          if (!cancelled) {
            setTleData(data);
            setLoading(false);
            setError(null);
            useAppStore.getState().setTleLastFetched(Date.now());
          }
          return; // success — exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[TLE] Attempt ${attempt + 1} failed:`, lastError);
        }
      }

      // All retries exhausted
      if (!cancelled) {
        setError(lastError);
        setLoading(false);
      }
    }

    fetchWithRetry();

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
