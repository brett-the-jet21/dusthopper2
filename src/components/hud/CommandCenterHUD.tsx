"use client";

import { useMissionStore } from '@/lib/store/missionStore';

const TIME_SCALES = [1, 60, 360, 1440, 3600] as const;
const ZOOM_LEVELS = [0.4, 0.7, 1, 1.5, 2, 4] as const;

export function CommandCenterHUD() {
  const { playing, togglePlaying, simSpeed, setSimSpeed, freeCam, toggleFreeCam, trackedMissionId } = useMissionStore();

  const isArtemis = trackedMissionId === 'artemis';
  const borderColor = isArtemis ? 'rgba(255,107,0,0.35)' : 'rgba(0,255,200,0.3)';
  const accentColor = isArtemis ? '#FF6B00' : '#00ffcc';
  const bgColor = isArtemis ? 'rgba(20, 8, 0, 0.88)' : 'rgba(0, 10, 20, 0.85)';
  const glowShadow = isArtemis
    ? '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,107,0,0.12)'
    : '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,255,200,0.08)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: bgColor,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: '11px 22px',
        boxShadow: glowShadow,
        transition: 'border-color 0.4s, box-shadow 0.4s',
      }}
    >
      {/* FREE CAM / TRACK toggle */}
      <button
        onClick={toggleFreeCam}
        style={{
          background: freeCam
            ? `linear-gradient(135deg, ${accentColor}, ${isArtemis ? '#FFB347' : '#00ccff'})`
            : 'rgba(255,255,255,0.06)',
          color: freeCam ? '#000' : accentColor,
          border: freeCam ? 'none' : `1px solid ${borderColor}`,
          padding: '9px 18px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: 0.5,
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        {freeCam ? '🎥 FREE CAM' : '🎯 TRACKING'}
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: borderColor }} />

      {/* PLAY / PAUSE */}
      <button
        onClick={togglePlaying}
        style={{
          background: playing
            ? 'linear-gradient(135deg, #00ff88, #00cc66)'
            : 'linear-gradient(135deg, #ff6666, #ff3333)',
          color: '#000',
          border: 'none',
          padding: '9px 18px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: 0.5,
          transition: 'all 0.2s',
        }}
      >
        {playing ? '⏸ PAUSE' : '▶ PLAY'}
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: borderColor }} />

      {/* TIME SCALE buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            color: `${accentColor}99`,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          TIME
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_SCALES.map((s) => (
            <button
              key={s}
              onClick={() => setSimSpeed(s)}
              style={{
                background:
                  simSpeed === s
                    ? `linear-gradient(135deg, ${accentColor}, ${isArtemis ? '#FFB347' : '#00ccff'})`
                    : 'rgba(255,255,255,0.06)',
                color: simSpeed === s ? '#000' : accentColor,
                border: `1px solid ${simSpeed === s ? 'transparent' : borderColor}`,
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 11,
                fontFamily: 'monospace',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {s === 1 ? '1×' : s >= 3600 ? `${s / 3600}k×` : s >= 60 ? `${s / 60}m×` : `${s}×`}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: borderColor }} />

      {/* ZOOM buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            color: `${accentColor}99`,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
          }}
        >
          ZOOM
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              title={`Zoom ${z}×`}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: accentColor,
                border: `1px solid ${borderColor}`,
                padding: '6px 9px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 10,
                fontFamily: 'monospace',
                transition: 'all 0.15s',
              }}
              onClick={() => {
                // Dispatch a custom event that the scene can listen to
                window.dispatchEvent(new CustomEvent('artemis-zoom', { detail: { level: z } }));
              }}
            >
              {z}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
