"use client";

import { useMissionStore } from '@/lib/store/missionStore';

export function TelemetryPanel() {
  const { missions, trackedMissionId, showTelemetry } = useMissionStore();
  if (!showTelemetry || !trackedMissionId) return null;
  
  const mission = missions.get(trackedMissionId);
  if (!mission) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      width: 220,
      background: 'rgba(0, 10, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 255, 200, 0.3)',
      borderRadius: 12,
      padding: '16px 20px',
      color: '#00ffcc',
      fontSize: 12,
      fontFamily: 'monospace',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      zIndex: 100,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(0, 255, 200, 0.2)',
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#00ff88',
          boxShadow: '0 0 10px rgba(0, 255, 136, 0.8)',
          animation: 'pulse 2s infinite',
        }} />
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
          {mission.name}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DataRow label="ALTITUDE" value={`${mission.telemetry.altitude.toFixed(1)} km`} />
        <DataRow label="VELOCITY" value={`${mission.telemetry.speed.toFixed(2)} km/s`} />
        <DataRow label="AGENCY" value={mission.agency} highlight />
        <DataRow 
          label="STATUS" 
          value={mission.status.toUpperCase()} 
          valueColor="#00ff88"
        />
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function DataRow({ label, value, highlight, valueColor }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: 'rgba(0, 255, 200, 0.6)', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ 
        color: valueColor || (highlight ? '#00ffcc' : 'rgba(255, 255, 255, 0.9)'), 
        fontWeight: highlight ? 700 : 600,
      }}>
        {value}
      </span>
    </div>
  );
}
