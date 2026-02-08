"use client";

import { useMissionStore } from '@/lib/store/missionStore';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

export function TimeController() {
  const { simTime, setSimTime, hudOpacity } = useMissionStore();
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    setNow(Date.now());
  }, []);
  
  const minT = now - 6 * 60 * 60 * 1000;
  const maxT = now + 6 * 60 * 60 * 1000;
  
  return (
    <div
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 pointer-events-auto"
      style={{
        width: '90%',
        maxWidth: 1100,
      }}
    >
      <div
        style={{
          background: `rgba(0, 0, 0, ${hudOpacity * 0.7})`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 10px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 200, 255, 0.1)',
          border: '1px solid rgba(0, 200, 255, 0.15)',
          borderRadius: 18,
          padding: '16px 24px',
          color: 'white',
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 12,
        }}>
          <div>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 700, 
              letterSpacing: 1.5,
              color: 'rgba(0, 255, 240, 0.7)',
              textTransform: 'uppercase',
            }}>
              Mission Time
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 800,
              fontFamily: 'monospace',
              color: 'rgb(0, 255, 240)',
              marginTop: 2,
              textShadow: '0 0 10px rgba(0, 255, 240, 0.5)',
            }}>
              {format(simTime, 'HH:mm:ss')}
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.5)',
            }}>
              {format(simTime, 'MMM dd, yyyy')}
            </div>
            <div style={{ 
              fontSize: 10,
              color: 'rgba(255, 255, 255, 0.4)',
              marginTop: 2,
            }}>
              {simTime > now ? `+${Math.floor((simTime - now) / 60000)} min` : `${Math.floor((now - simTime) / 60000)} min ago`}
            </div>
          </div>
        </div>
        
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: `${((now - minT) / (maxT - minT)) * 100}%`,
              top: -6,
              width: 2,
              height: 20,
              background: 'rgb(255, 200, 0)',
              boxShadow: '0 0 10px rgba(255, 200, 0, 0.8)',
              zIndex: 1,
            }}
          />
          
          <input
            type="range"
            min={minT}
            max={maxT}
            value={simTime}
            onChange={(e) => setSimTime(Number(e.target.value))}
            style={{
              width: '100%',
              height: 8,
              borderRadius: 4,
              appearance: 'none',
              background: `linear-gradient(
                90deg,
                rgba(0, 200, 255, 0.2) 0%,
                rgba(0, 255, 200, 0.4) ${((simTime - minT) / (maxT - minT)) * 100}%,
                rgba(255, 255, 255, 0.1) ${((simTime - minT) / (maxT - minT)) * 100}%
              )`,
              cursor: 'pointer',
              outline: 'none',
            }}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 10,
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: 'monospace',
        }}>
          <div>-6h</div>
          <div>NOW</div>
          <div>+6h</div>
        </div>
      </div>
    </div>
  );
}
