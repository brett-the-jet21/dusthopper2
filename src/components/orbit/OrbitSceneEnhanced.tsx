"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";
import { CraftMarker } from "./CraftMarker";
import { latLonAltToXYZ } from "@/lib/orbitMath";

// Generate orbital path points
function generateOrbitPath(alt: number, inclination: number = 0) {
  const points = [];
  const segments = 128;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const lat = Math.sin(angle) * inclination;
    const lon = (angle * 180) / Math.PI;
    points.push(new THREE.Vector3(...latLonAltToXYZ(lat, lon, alt)));
  }
  return points;
}

function AnimatedSpacecraft({ mission, index, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      // REALISTIC ORBITAL SPEED: ISS orbits Earth every 90 minutes
      const orbitalPeriod = 90 * 60; // 90 minutes in seconds
      const time = state.clock.elapsedTime;
      const progress = (time / orbitalPeriod) % 1;
      const angle = progress * Math.PI * 2;
      
      const lat = Math.sin(angle) * mission.inclination;
      const lon = (angle * 180) / Math.PI;
      const pos = latLonAltToXYZ(lat, lon, mission.alt);
      
      groupRef.current.position.set(...pos);
      onPositionUpdate(pos);
    }
  });
  
  // Show orbital path
  const orbitPath = useMemo(() => generateOrbitPath(mission.alt, mission.inclination), [mission]);
  
  return (
    <group ref={groupRef}>
      {/* Orbital path line */}
      <Line points={orbitPath} color={mission.color} lineWidth={1} transparent opacity={0.4} />
      
      {/* Spacecraft */}
      <CraftMarker position={[0, 0, 0]} />
      
      {/* Velocity vector */}
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 2, mission.color]} />
    </group>
  );
}

function SpaceCamera({ target, enabled }: any) {
  const { camera } = useThree();
  
  useFrame(() => {
    if (enabled && target) {
      const targetPos = new THREE.Vector3(...target);
      // Position camera as if observing from nearby spacecraft
      const offset = new THREE.Vector3(3, 2, 8);
      const desiredPos = targetPos.clone().add(offset);
      camera.position.lerp(desiredPos, 0.03);
      camera.lookAt(targetPos);
    }
  });
  
  return null;
}

export function OrbitSceneEnhanced({ missionId }: { missionId: string }) {
  const [freeCam, setFreeCam] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [selectedMission, setSelectedMission] = useState(0);
  const [spacecraftPositions, setSpacecraftPositions] = useState<any[]>([]);
  
  const missions = useMemo(() => [
    { name: "ISS", color: "#00ffcc", alt: 408, inclination: 51.6, realData: true },
    { name: "STARSHIP HLS-1", color: "#ffaa00", alt: 350, inclination: 28.5, realData: false },
    { name: "STARLINK-6548", color: "#00ff88", alt: 550, inclination: 53, realData: false },
  ], []);
  
  const updatePosition = (index: number) => (pos: any) => {
    setSpacecraftPositions(prev => {
      const newPos = [...prev];
      newPos[index] = pos;
      return newPos;
    });
  };
  
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ position: [0, 8, 18], fov: 55 }}>
        <color attach="background" args={["#000008"]} />
        <ambientLight intensity={0.15} />
        <directionalLight position={[20, 15, 10]} intensity={4} castShadow />
        <pointLight position={[0, 0, 0]} intensity={2} distance={60} />
        
        <StarsField />
        
        {/* Earth - NO ROTATION for realism */}
        <EarthPro />
        
        {playing && missions.map((m, i) => (
          <AnimatedSpacecraft 
            key={i} 
            mission={m} 
            index={i} 
            onPositionUpdate={updatePosition(i)} 
          />
        ))}
        
        <SpaceCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} />
        
        <EffectComposer>
          <Bloom intensity={1.8} luminanceThreshold={0.05} luminanceSmoothing={0.95} />
        </EffectComposer>
        
        <OrbitControls enabled={freeCam} enablePan={true} />
      </Canvas>
      
      {/* CONTROLS */}
      <div style={{position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:12,background:'rgba(5,10,15,0.95)',padding:'12px 24px',borderRadius:10,border:'1px solid rgba(0,200,255,0.25)',zIndex:100}}>
        <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'#00ccff':'#1a1a1a',color:freeCam?'#000':'#0cf',border:'1px solid #0cf',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}>{freeCam?'🎥 FREE':'🎯 TRACK'}</button>
        <button onClick={()=>setPlaying(!playing)} style={{background:playing?'#00ff88':'#ff3333',color:'#000',border:'none',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
      </div>
      
      {/* MISSION SELECT */}
      <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:12,zIndex:100}}>{missions.map((m,i)=><button key={i} onClick={()=>setSelectedMission(i)} style={{background:i===selectedMission?m.color:'rgba(5,10,15,0.95)',color:i===selectedMission?'#000':'#fff',border:`2px solid ${m.color}`,padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11,boxShadow:i===selectedMission?`0 0 20px ${m.color}80`:'none'}}>{m.name}{m.realData&&' 🔴'}</button>)}</div>
      
      {/* TELEMETRY */}
      <div style={{position:'fixed',top:20,right:20,width:240,background:'rgba(5,10,15,0.95)',border:'1px solid rgba(0,200,255,0.25)',borderRadius:10,padding:16,color:'#0cf',fontSize:11,fontFamily:'monospace',zIndex:100}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,paddingBottom:10,borderBottom:'1px solid rgba(0,200,255,0.15)'}}><div style={{width:6,height:6,borderRadius:'50%',background:'#0f8',boxShadow:'0 0 8px #0f8'}}/><div style={{fontWeight:700,fontSize:12}}>{missions[selectedMission].name}</div></div><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{opacity:0.6}}>ALTITUDE</span><span style={{fontWeight:600}}>{missions[selectedMission].alt} km</span></div><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{opacity:0.6}}>VELOCITY</span><span style={{fontWeight:600}}>7.66 km/s</span></div><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{opacity:0.6}}>INCLINATION</span><span style={{fontWeight:600}}>{missions[selectedMission].inclination}°</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{opacity:0.6}}>PERIOD</span><span style={{fontWeight:600}}>~90 min</span></div></div>
    </div>
  );
}
