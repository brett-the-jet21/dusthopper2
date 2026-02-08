"use client";

import { useEffect, useRef, useState } from "react";
import type { Telemetry } from "@/lib/telemetry";
import { mockTelemetry } from "@/lib/telemetry";

export function useTelemetry(missionId: string) {
  const [telemetry, setTelemetry] = useState<Telemetry>(() => mockTelemetry(Date.now(), missionId));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      // TODO: replace with real telemetry fetch:
      // fetch(`/api/missions/${missionId}/telemetry`).then(r=>r.json()).then(setTelemetry)
      setTelemetry(mockTelemetry(Date.now(), missionId));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [missionId]);

  return telemetry;
}
