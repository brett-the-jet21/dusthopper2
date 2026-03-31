"use client";

import { useMissionStore } from '@/lib/store/missionStore';

const TIME_SCALES = [1, 60, 360, 1440, 3600] as const;
const ZOOM_LEVELS = [0.4, 0.7, 1, 1.5, 2, 4] as const;

// ── Constant cyan/navy palette — no per-mission theme switching ──────────
const BORDER  = 'rgba(0, 200, 255, 0.25)';
const BG      = 'rgba(0, 8, 20, 0.88)';
const ACCENT  = '#00ccff';
const ACCENT2 = '#00aaee';
const SHADOW  = '0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(0,200,255,0.08)';

export function CommandCenterHUD() {
  const { playing, togglePlaying, simSpeed, setSimSpeed, freeCam, toggleFreeCam } = useMissionStore();

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
        background: BG,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: '10px 20px',
        boxShadow: SHADOW,
      }}
    >
      {/* FREE CAM / TRACKING toggle */}
      <button
        onClick={toggleFreeCam}
        style={{
          background: freeCam
            ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`
            : 'rgba(0,204,255,0.07)',
          color: freeCam ? '#000' : ACCENT,
          border: freeCam ? 'none' : `1px solid ${BORDER}`,
          padding: '8px 16px',
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

      <Divider />

      {/* PLAY / PAUSE */}
      <button
        onClick={togglePlaying}
        style={{
          background: playing
            ? 'linear-gradient(135deg, #00ff88, #00cc66)'
            : 'linear-gradient(135deg, #ff5555, #cc2222)',
          color: '#000',
          border: 'none',
          padding: '8px 16px',
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

      <Divider />

      {/* TIME SCALE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Label text="TIME" />
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_SCALES.map((s) => {
            const active = simSpeed === s;
            return (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`
                    : 'rgba(0,204,255,0.06)',
                  color: active ? '#000' : ACCENT,
                  border: `1px solid ${active ? 'transparent' : BORDER}`,
                  padding: '6px 9px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s === 1 ? '1×' : s >= 3600 ? `${s / 3600}k×` : `${s / 60}m×`}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ZOOM presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Label text="ZOOM" />
        <div style={{ display: 'flex', gap: 4 }}>
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              title={`Zoom ${z}×`}
              style={{
                background: 'rgba(0,204,255,0.06)',
                color: ACCENT,
                border: `1px solid ${BORDER}`,
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 10,
                fontFamily: 'monospace',
                transition: 'all 0.15s',
              }}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('dusthopper-zoom', { detail: { level: z } }),
                );
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

function Divider() {
  return <div style={{ width: 1, height: 30, background: BORDER }} />;
}

function Label({ text }: { text: string }) {
  return (
    <span
      style={{
        color: `${ACCENT}88`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}
