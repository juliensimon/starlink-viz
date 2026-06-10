import { fetchTLEData } from '@/lib/satellites/tle-fetcher';
import { createCachedTleHandler } from '@/lib/satellites/tle-route-cache';

export const GET = createCachedTleHandler(fetchTLEData);
