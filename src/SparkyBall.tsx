import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

function FuturisticCore({ analyser, isSpeaking, isConnected }: { analyser: AnalyserNode | null, isSpeaking: boolean, isConnected: boolean }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  // Create a reusable Uint8Array for frequency data
  const dataArray = useMemo(() => {
    return analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  }, [analyser]);

  useFrame((state) => {
    if (!outerRef.current || !innerRef.current || !materialRef.current) return;

    let targetScale = 1.2;
    let targetDistort = 0.1;
    let targetSpeed = 2;

    if (analyser && isSpeaking && dataArray) {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Scale and distort based on volume (0 to 255)
      const normalizedVolume = average / 255;
      targetScale = 1.2 + normalizedVolume * 1.5; // Scale up to 2.7x
      targetDistort = 0.1 + normalizedVolume * 0.8; // Distort up to 0.9
      targetSpeed = 2 + normalizedVolume * 10; // Speed up to 12
    } else if (!isConnected) {
      // Sleep state
      targetScale = 0.9;
      targetDistort = 0.0;
      targetSpeed = 0.5;
    }

    // Smoothly interpolate scale and distortion
    outerRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
    innerRef.current.scale.lerp(new THREE.Vector3(targetScale * 0.8, targetScale * 0.8, targetScale * 0.8), 0.15);
    
    materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetDistort, 0.15);
    materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, targetSpeed, 0.1);
    
    // Futuristic complex rotation
    outerRef.current.rotation.x += 0.002;
    outerRef.current.rotation.y += 0.005;
    outerRef.current.rotation.z -= 0.001;

    innerRef.current.rotation.x -= 0.01;
    innerRef.current.rotation.y += 0.015;
  });

  return (
    <group>
      {/* Outer Geometric Wireframe Shell */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial
          color={isConnected ? "#1e40af" : "#52525b"} // blue-800
          emissive={isConnected ? "#1e3a8a" : "#27272a"} // blue-900
          emissiveIntensity={2}
          wireframe={true}
          transparent={true}
          opacity={0.4}
        />
      </mesh>

      {/* Inner Distorting Energy Core */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.2, 8]} />
        <MeshDistortMaterial
          ref={materialRef}
          color={isConnected ? "#1d4ed8" : "#3f3f46"} // blue-700
          emissive={isConnected ? "#1e40af" : "#27272a"} // blue-800
          emissiveIntensity={2.5}
          distort={0.2}
          speed={2}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

export default function SparkyBall({ analyser, isSpeaking, isConnected }: { analyser: AnalyserNode | null, isSpeaking: boolean, isConnected: boolean }) {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas camera={{ position: [0, 0, 6] }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[10, 10, 10]} intensity={2.5} color="#1d4ed8" />
        <pointLight position={[-10, -10, -10]} intensity={1.5} color="#172554" />
        <FuturisticCore analyser={analyser} isSpeaking={isSpeaking} isConnected={isConnected} />
      </Canvas>
    </div>
  );
}
