'use client';

import SkyDomeCamera from './sky/SkyDomeCamera';
import SkyEnvironment from './sky/SkyEnvironment';
import SkyGrid from './sky/SkyGrid';
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
      <SkySatellites />
      <SkyStars />
      <SkyTooltip />
      <SkyTrajectory />
    </group>
  );
}
