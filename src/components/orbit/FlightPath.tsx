'use client';

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { Vec3 } from '@/lib/orbitMath';
import { arcPoints } from '@/lib/orbitMath';

export function FlightPath({ from, to }: { from: Vec3; to: Vec3 }) {
  const points = useMemo(() => arcPoints(from, to, 200, 0.7), [from, to]);

  return (
    <Line
      points={points}
      lineWidth={2.2}
      transparent
      opacity={0.9}
    />
  );
}
