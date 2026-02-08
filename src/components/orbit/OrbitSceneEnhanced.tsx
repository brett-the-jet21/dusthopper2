"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";
import { CraftMarker } from "./CraftMarker";
import { OrbitRibbon } from "./OrbitRibbon";
import { latLonAltToXYZ } from "@/lib/orbitMath";

function AnimatedSpacecraft({ mission, index, isSelected, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime * 0.1; // SLOWER
      const speed = 0.15 + (index * 0.05); // SLOWER
      const lat = Math.sin(time * speed) * 60;
      const lon = (time * speed * 30) % 360;
      const pos = latLonAltToXYZ(lat, lon, mission.alt);
      groupRef.current.position.set(...pos);
      onPositionUpdate(pos);
    }
  });
  
  return (
    <group ref={groupRef}>
      <CraftMarker position={[0, 0, 0]} />
    </group>
  );
}

function TrackingCamera({ target, enabled }: any) {
  const { camera } = useThree();
  
  useFrame(() => {
    if (enabled && target) {
      const targetPos = new THREE.Vector3(...target);
      const offset = new THREE.Vector3(0, 5, 15);
      const desiredPos = targetPos.clone().add(offset);
      camera.position.lerp(desiredPos, 0.05);
      camera.lookAt(targetPos);
    }
  });
  
  return null;
}

export function OrbitSceneEnhanced({ missionId }: { missionId: string }) {
  const [freeCam, setFreeCam] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [selectedMission, setSelectedMission] = useState(2);
  const [spacecraftPositions, setSpacecraftPositions] = useState<any[]>([]);
  
  const missions = useMemo(() => [
    { name: "LUNAR GATEWAY", color: "#00ffcc", alt: 450 },
    { name: "VOYAGER EXPRESS", color: "#ffaa00", alt: 550 },
    { name: "STARLINK-X42", color: "#00ff88", alt: 340 },
  ], []);
  
  const groundStations = useMemo(() => [
    latLonAltToXYZ(28.5, -80.6, 0),
    latLonAltToXYZ(-23, -43, 0),
    latLonAltToXYZ(35.7, 139.7, 0),
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
      <Canvas camera={{ position: [0, 0, 25], fov: 50 }}>
        <color attach="background" args={["#000510"]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[15, 10, 10]} intensity={3.5} />
        <pointLight position={[0, 0, 0]} intensity={1.5} distance={50} />
        
        <StarsField />
        <EarthPro />
        
        {playing && missions.map((m, i) => (
          <AnimatedSpacecraft key={i} mission={m} index={i} isSelected={i === selectedMission} onPositionUpdate={updatePosition(i)} />
        ))}
        
        {spacecraftPositions.map((pos, i) => pos && groundStations.map((ground, j) => (
          <OrbitRibbon key={`${i}-${j}`} from={ground} to={pos} colorA={missions[i].color} colorB={missions[i].color} opacity={i === selectedMission ? 0.9 : 0.3} />
        )))}
        
        <TrackingCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} />
        
        <EffectComposer>
          <Bloom intensity={2.5} luminanceThreshold={0.1} luminanceSmoothing={0.9} />
        </EffectComposer>
        
        <OrbitControls enabled={freeCam} />
      </Canvas>
      
      <div style={{position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:12,background:'rgba(0,10,20,0.95)',padding:'14px 28px',borderRadius:12,border:'1px solid rgba(0,255,200,0.3)',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}>
        <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'linear-gradient(135deg,#00ffcc,#00ccff)':'#333',color:freeCam?'#000':'#fff',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{freeCam?'🎥 FREE':'🎯 TRACK'}</button>
        <button onClick={()=>setPlaying(!playing)} style={{background:playing?'linear-gradient(135deg,#00ff88,#00cc66)':'linear-gradient(135deg,#ff6666,#ff3333)',color:'#000',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
      </div>
      
      <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',display:'flex',gap:16,zIndex:100}}>{missions.map((m,i)=><button key={i} onClick={()=>setSelectedMission(i)} style={{background:i===selectedMission?`linear-gradient(135deg,${m.color},${m.color}dd)`:'rgba(0,10,20,0.95)',color:i===selectedMission?'#000':'#fff',border:`2px solid ${m.color}`,padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:13,boxShadow:i===selectedMission?`0 8px 24px ${m.color}60`:'0 4px 12px rgba(0,0,0,0.5)',transition:'all 0.3s'}}>{m.name}</button>)}</div>
      
      <div style={{position:'fixed',top:24,right:24,width:220,background:'rgba(0,10,20,0.95)',border:'1px solid rgba(0,255,200,0.3)',borderRadius:12,padding:'16px 20px',color:'#00ffcc',fontSize:12,fontFamily:'monospace',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,paddingBottom:12,borderBottom:'1px solid rgba(0,255,200,0.2)'}}><div style={{width:8,height:8,borderRadius:'50%',background:'#00ff88',boxShadow:'0 0 10px rgba(0,255,136,0.8)'}}/><div style={{fontWeight:700,fontSize:13}}>{missions[selectedMission].name}</div></div><div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{opacity:0.7}}>ALTITUDE</span><span style={{fontWeight:700}}>{missions[selectedMission].alt} km</span></div><div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{opacity:0.7}}>VELOCITY</span><span style={{fontWeight:700}}>7.8 km/s</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{opacity:0.7}}>STATUS</span><span style={{color:'#00ff88',fontWeight:700}}>ACTIVE</span></div></div>
    </div>
  );
}
