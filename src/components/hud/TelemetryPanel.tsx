"use client";

import { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '@/lib/store/missionStore';

/* Artemis launch date (Nov 16 2022, 06:47 UTC) */
const ARTEMIS_LAUNCH_MS = new Date('2022-11-16T06:47:00Z').getTime();
/* Moon distance (km) — simplified live oscillation for visual effect */
const MOON_DIST_AVG = 384400;

function formatMET(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TelemetryPanel() {
  const { missions, trackedMissionId, showTelemetry, toggleTelemetry } = useMissionStore();
  const [collapsed, setCollapsed] = useState(false);
  const [met, setMet] = useState(0);
  const [missionDay, setMissionDay] = useState(0);
  const [moonDist, setMoonDist] = useState(MOON_DIST_AVG);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isArtemis = trackedMissionId === 'artemis';

  // Live MET counter for Artemis
  useEffect(() => {
    if (!isArtemis) return;
    const update = () => {
      const now = Date.now();
      const elapsed = now - ARTEMIS_LAUNCH_MS;
      setMet(elapsed);
      setMissionDay(Math.floor(elapsed / 86400000) + 1);
      // Oscillate Moon distance slightly for visual interest
      setMoonDist(MOON_DIST_AVG + Math.sin(now / 300000) * 2000);
    };
    update();
    tickRef.current = setInterval(update, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isArtemis]);

  if (!showTelemetry || !trackedMissionId) return null;

  const mission = missions.get(trackedMissionId);
  if (!mission) return null;

  const accentColor = isArtemis ? '#FF6B00' : '#00ffcc';
  const borderColor = isArtemis ? 'rgba(255,107,0,0.35)' : 'rgba(0,255,200,0.3)';
  const bgColor = isArtemis ? 'rgba(20, 8, 0, 0.9)' : 'rgba(0, 10, 20, 0.88)';
  const glowColor = isArtemis ? 'rgba(255,107,0,0.12)' : 'rgba(0,255,200,0.08)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        width: collapsed ? 48 : 240,
        background: bgColor,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        color: accentColor,
        fontSize: 11,
        fontFamily: 'monospace',
        boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${glowColor}`,
        zIndex: 100,
        transition: 'width 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header bar with collapse button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: collapsed ? '14px 12px' : '14px 16px 10px',
          borderBottom: collapsed ? 'none' : `1px solid ${borderColor}`,
          gap: 8,
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {/* Live dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#00ff88',
                boxShadow: '0 0 8px rgba(0,255,136,0.8)',
                flexShrink: 0,
              }}
            />
            {/* Header title */}
            {isArtemis ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Artemis A-mark (CSS SVG) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3L2 20h20L12 3z" stroke="#FF6B00" strokeWidth="2" fill="none" />
                  <path d="M7 14h10" stroke="#FF6B00" strokeWidth="1.5" />
                  {/* Moon arc */}
                  <path d="M15 7 A5 5 0 0 1 15 17" stroke="#FFB347" strokeWidth="1.2" fill="none" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.5, color: '#FF6B00' }}>
                  ARTEMIS CONTROL
                </span>
              </div>
            ) : (
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mission.name}
              </span>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand telemetry' : 'Collapse telemetry'}
          style={{
            background: 'none',
            border: 'none',
            color: accentColor,
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 2px',
            lineHeight: 1,
            opacity: 0.7,
            flexShrink: 0,
          }}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Body — only show when expanded */}
      {!collapsed && (
        <div style={{ padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {isArtemis ? (
            /* ── Artemis-specific telemetry ─────────────────────────── */
            <>
              <DataRow label="MISSION" value="Artemis I — SLS/Orion" color={accentColor} />
              <DataRow label="PHASE" value="Trans-Lunar Injection" color="rgba(255,179,71,0.9)" />
              <Sep color={borderColor} />
              <DataRow label="ALTITUDE" value="370 km (parking orbit)" color={accentColor} />
              <DataRow label="VELOCITY" value="10.4 km/s  |  23,265 mph" color={accentColor} />
              <DataRow label="INCLINATION" value="28.5°" color={accentColor} />
              <Sep color={borderColor} />
              <DataRow label="APOGEE" value={`${MOON_DIST_AVG.toLocaleString()} km`} color="#FFB347" />
              <DataRow label="MOON DIST" value={`${Math.round(moonDist).toLocaleString()} km`} color="#FFB347" />
              <Sep color={borderColor} />
              <DataRow label="MISSION DAY" value={`Day ${missionDay}`} color={accentColor} />
              <DataRow label="MET" value={formatMET(met)} color={accentColor} mono />
              <Sep color={borderColor} />
              <DataRow label="STATUS" value="✅  NOMINAL" color="#00ff88" />
            </>
          ) : (
            /* ── Generic telemetry for other missions ───────────────── */
            <>
              <DataRow label="ALTITUDE" value={`${mission.telemetry.altitude.toFixed(0)} km`} color={accentColor} />
              <DataRow label="VELOCITY" value={`${mission.telemetry.speed.toFixed(2)} km/s`} color={accentColor} />
              <DataRow label="AGENCY" value={mission.agency} color={accentColor} highlight />
              <DataRow
                label="STATUS"
                value={mission.status.toUpperCase()}
                color="#00ff88"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Sep({ color }: { color: string }) {
  return <div style={{ height: 1, background: color, opacity: 0.5 }} />;
}

function DataRow({
  label,
  value,
  color,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
      <span style={{ color: 'rgba(180,120,60,0.7)', letterSpacing: 0.6, fontSize: 10, flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          color: color ?? 'rgba(255,255,255,0.9)',
          fontWeight: highlight ? 700 : 600,
          fontSize: 11,
          textAlign: 'right',
          fontFamily: mono ? 'monospace' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
