import { describe, it, expect } from 'vitest';
import { DISH_LAT_DEG, DISH_LON_DEG, MAX_STEERING_DEG, MIN_ELEVATION_DEG, EARTH_RADIUS_KM } from '../lib/config';

describe('config', () => {
  it('dish latitude is in valid range', () => {
    expect(DISH_LAT_DEG).toBeGreaterThan(-90);
    expect(DISH_LAT_DEG).toBeLessThan(90);
  });

  it('dish longitude is in valid range', () => {
    expect(DISH_LON_DEG).toBeGreaterThan(-180);
    expect(DISH_LON_DEG).toBeLessThan(180);
  });

  it('max steering angle is reasonable for phased array', () => {
    expect(MAX_STEERING_DEG).toBeGreaterThanOrEqual(20);
    expect(MAX_STEERING_DEG).toBeLessThanOrEqual(35);
  });

  it('min elevation is reasonable for Starlink', () => {
    expect(MIN_ELEVATION_DEG).toBeGreaterThanOrEqual(20);
    expect(MIN_ELEVATION_DEG).toBeLessThanOrEqual(30);
  });

  it('Earth radius is correct', () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
  });
});
