'use client';

import SkyDomeCamera from './sky/SkyDomeCamera';
import SkyEnvironment from './sky/SkyEnvironment';
import SkyGrid from './sky/SkyGrid';
import SkyConstellations from './sky/SkyConstellations';
import SkySatellites from './sky/SkySatellites';
import SkyStars from './sky/SkyStars';
import SkyTooltip from './sky/SkyTooltip';
import SkyTrajectory from './sky/SkyTrajectory';

export default function SkyView() {
  return (
    <group>
      <SkyDomeCamera />
      <SkyEnvironment />
      <SkyGrid />
      <SkyConstellations />
      <SkySatellites />
      <SkyStars />
      <SkyTooltip />
      <SkyTrajectory />
    </group>
  );
}
