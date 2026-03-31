"use client";

import { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '@/lib/store/missionStore';

/* Artemis II launch: April 1 2026 22:24 UTC */
const ARTEMIS_II_LAUNCH_MS = new Date('2026-04-01T22:24:00Z').getTime();
const MOON_DIST_AVG = 384400; // km

function formatMET(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// ── Constant cyan palette for all missions ──────────────────────────
const BORDER  = 'rgba(0, 200, 255, 0.25)';
const BG      = 'rgba(0, 8, 20, 0.90)';
const SHADOW  = '0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(0,200,255,0.07)';
const CYAN    = '#00ccff';
const CYAN_DIM = 'rgba(0,204,255,0.55)';

export function TelemetryPanel() {
  const { missions, trackedMissionId, showTelemetry } = useMissionStore();
  const [collapsed, setCollapsed] = useState(false);
  const [met, setMet] = useState(0);
  const [missionDay, setMissionDay] = useState(1);
  const [moonDist, setMoonDist] = useState(MOON_DIST_AVG);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isArtemis = trackedMissionId === 'artemis';

  useEffect(() => {
    if (!isArtemis) return;
    const tick = () => {
      const now = Date.now();
      const diff = ARTEMIS_II_LAUNCH_MS - now;
      setMet(diff > 0 ? diff : 0);          // repurpose met as T-minus ms when pre-launch
      setMissionDay(Math.floor(-diff / 86400000) + 1);
      setMoonDist(MOON_DIST_AVG + Math.sin(now / 300000) * 1800);
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isArtemis]);

  if (!showTelemetry || !trackedMissionId) return null;
  const mission = missions.get(trackedMissionId);
  if (!mission) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        width: collapsed ? 46 : 236,
        background: BG,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        color: CYAN,
        fontSize: 11,
        fontFamily: 'monospace',
        boxShadow: SHADOW,
        zIndex: 100,
        transition: 'width 0.22s ease',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: collapsed ? '13px 10px' : '13px 14px 9px',
          borderBottom: collapsed ? 'none' : `1px solid ${BORDER}`,
          gap: 8,
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
            {/* Live pulse dot */}
            <div
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#00ff88',
                boxShadow: '0 0 7px rgba(0,255,136,0.9)',
                flexShrink: 0,
              }}
            />
            {isArtemis ? (
              /* Artemis header — mission name in orange, rest cyan */
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArtemisMark />
                <span style={{ fontWeight: 700, fontSize: 12, color: '#FF6B00', letterSpacing: 0.4 }}>
                  ARTEMIS II
                </span>
              </div>
            ) : (
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mission.name.toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none', border: 'none',
            color: CYAN_DIM, cursor: 'pointer',
            fontSize: 14, padding: '0 2px', lineHeight: 1,
            flexShrink: 0,
          }}
          title={collapsed ? 'Expand telemetry' : 'Collapse telemetry'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: '11px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isArtemis ? (
            <>
              <Row label="MISSION"    value="Artemis II — SLS/Orion" />
              <Row label="PHASE"      value="PRE-LAUNCH" bright />
              <Sep />
              <Row label="VEHICLE"    value="SLS Block 1 + Orion" />
              <Row label="LAUNCH SITE" value="LC-39B, KSC" />
              <Row label="INCLINATION" value="28.5°" />
              <Sep />
              <Row label="CREW"       value="4  (Reid Wiseman, CDR)" bright />
              <Row label="ORBIT"      value="185 km parking orbit" />
              <Row label="TARGET"     value="Free-return lunar flyby" />
              <Sep />
              <Row label="T-MINUS"    value={`−${formatMET(met)}`} mono />
              <Row label="LIFTOFF"    value="01 Apr 2026  22:24 UTC" />
              <Sep />
              <Row label="STATUS"     value="GO FOR LAUNCH" green />
            </>
          ) : (
            <>
              <Row label="ALTITUDE" value={`${mission.telemetry.altitude.toFixed(0)} km`} />
              <Row label="VELOCITY" value={`${mission.telemetry.speed.toFixed(2)} km/s`} />
              <Row label="AGENCY"   value={mission.agency} bright />
              <Row label="STATUS"   value={mission.status.toUpperCase()} green />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function ArtemisMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L2 20h20L12 3z" stroke="#FF6B00" strokeWidth="2" />
      <path d="M7.5 14h9" stroke="#FF6B00" strokeWidth="1.5" />
      <path d="M16 7 A5.5 5.5 0 0 1 16 17" stroke="#FFB347" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function Sep() {
  return <div style={{ height: 1, background: BORDER }} />;
}

function Row({
  label, value, bright, green, mono,
}: {
  label: string;
  value: string;
  bright?: boolean;
  green?: boolean;
  mono?: boolean;
}) {
  const valueColor = green ? '#00ff88' : bright ? CYAN : 'rgba(255,255,255,0.82)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ color: CYAN_DIM, fontSize: 10, letterSpacing: 0.6, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: valueColor, fontWeight: 600, fontSize: 11, textAlign: 'right', fontFamily: mono ? 'monospace' : undefined }}>
        {value}
      </span>
    </div>
  );
}
