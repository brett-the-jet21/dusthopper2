"use client";

import { useMissionStore } from '@/lib/store/missionStore';

const TIME_SCALES = [1, 60, 360, 1440, 3600] as const;
const ZOOM_STEP   = 1.35; // each press moves 35% closer/further

const BORDER  = 'rgba(0, 200, 255, 0.25)';
const BG      = 'rgba(0, 8, 20, 0.88)';
const ACCENT  = '#00ccff';
const ACCENT2 = '#00aaee';
const SHADOW  = '0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(0,200,255,0.08)';

export function CommandCenterHUD() {
  const { playing, togglePlaying, simSpeed, setSimSpeed, freeCam, toggleFreeCam } = useMissionStore();

  const dispatch = (delta: number) =>
    window.dispatchEvent(new CustomEvent('dusthopper-zoom', { detail: { delta } }));

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
        padding: '10px 18px',
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
          padding: '7px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.5,
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
          padding: '7px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: 0.5,
        }}
      >
        {playing ? '⏸ PAUSE' : '▶ PLAY'}
      </button>

      <Divider />

      {/* TIME SCALE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Label text="TIME" />
        <div style={{ display: 'flex', gap: 3 }}>
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
                  padding: '5px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 10,
                  fontFamily: 'monospace',
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

      {/* ZOOM — simple +/− */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Label text="ZOOM" />
        <button
          title="Zoom out"
          onClick={() => dispatch(ZOOM_STEP)}
          style={zoomBtn}
        >
          −
        </button>
        <button
          title="Zoom in"
          onClick={() => dispatch(1 / ZOOM_STEP)}
          style={zoomBtn}
        >
          +
        </button>
      </div>
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  background: 'rgba(0,204,255,0.06)',
  color: '#00ccff',
  border: '1px solid rgba(0,200,255,0.25)',
  width: 30,
  height: 30,
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 17,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  fontFamily: 'monospace',
  flexShrink: 0,
};

function Divider() {
  return <div style={{ width: 1, height: 28, background: 'rgba(0,200,255,0.25)' }} />;
}

function Label({ text }: { text: string }) {
  return (
    <span
      style={{
        color: 'rgba(0,204,255,0.55)',
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
