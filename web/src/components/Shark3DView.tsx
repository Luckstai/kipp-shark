import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { motion } from "framer-motion";
import {
  Thermometer,
  Ruler,
  Activity,
  Fish as FishIcon,
  Satellite,
} from "lucide-react";
import * as THREE from "three";

function SharkModel() {
  const sharkRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (sharkRef.current) {
      sharkRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  return (
    <group ref={sharkRef}>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.5, 3, 32]} />
        <meshStandardMaterial color="#4a5568" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0, 1.8]} castShadow>
        <coneGeometry args={[0.3, 0.8, 32]} />
        <meshStandardMaterial color="#4a5568" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <coneGeometry args={[0.3, 1, 16]} />
        <meshStandardMaterial color="#2d3748" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh
        position={[0.6, -0.1, 0.5]}
        rotation={[0, 0, -Math.PI / 3]}
        castShadow
      >
        <boxGeometry args={[0.1, 0.8, 0.3]} />
        <meshStandardMaterial color="#2d3748" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh
        position={[-0.6, -0.1, 0.5]}
        rotation={[0, 0, Math.PI / 3]}
        castShadow
      >
        <boxGeometry args={[0.1, 0.8, 0.3]} />
        <meshStandardMaterial color="#2d3748" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh position={[0, 0, -1.5]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.4, 0.8, 3]} />
        <meshStandardMaterial color="#2d3748" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh position={[0, 0.3, 0.3]} castShadow>
        <boxGeometry args={[0.4, 0.15, 0.4]} />
        <meshStandardMaterial
          color="#06b6d4"
          metalness={0.8}
          roughness={0.2}
          emissive="#06b6d4"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0.15, 0.35, 0.5]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.8}
        />
      </mesh>

      <mesh position={[-0.15, 0.35, 0.5]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

export default function Shark3DView() {
  const sensors = [
    {
      icon: Thermometer,
      name: "Temperature",
      desc: "Monitors water and body temperature",
      color: "from-red-500 to-orange-500",
      position: "top-20 left-10",
    },
    {
      icon: Ruler,
      name: "Depth",
      desc: "Tracks dive depth and movement",
      color: "from-blue-500 to-cyan-500",
      position: "top-40 right-10",
    },
    {
      icon: Activity,
      name: "Acceleration",
      desc: "Detects hunting activity",
      color: "from-purple-500 to-pink-500",
      position: "bottom-40 left-10",
    },
    {
      icon: FishIcon,
      name: "Prey Analysis",
      desc: "Detects what the shark is eating",
      color: "from-green-500 to-emerald-500",
      position: "bottom-20 right-10",
    },
    {
      icon: Satellite,
      name: "GPS",
      desc: "Tracks migration and patterns",
      color: "from-yellow-500 to-amber-500",
      position: "top-1/2 right-20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950 to-cyan-950 pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent">
            Smart Tag Prototype
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            By understanding what sharks eat, where they go, and how they
            behave, we can protect marine life and preserve ocean balance
          </p>
        </motion.div>

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="backdrop-blur-md bg-slate-900/40 rounded-3xl border border-cyan-500/30 shadow-2xl overflow-hidden"
            style={{ height: "600px" }}
          >
            <Canvas shadows>
              <PerspectiveCamera makeDefault position={[0, 2, 6]} />
              <OrbitControls
                enablePan={false}
                minDistance={4}
                maxDistance={10}
                autoRotate
                autoRotateSpeed={1}
              />

              <ambientLight intensity={0.5} />
              <directionalLight
                position={[5, 5, 5]}
                intensity={1}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
              />
              <pointLight
                position={[-5, 5, -5]}
                intensity={0.5}
                color="#06b6d4"
              />
              <pointLight
                position={[0, -2, 0]}
                intensity={0.3}
                color="#0ea5e9"
              />

              <SharkModel />

              <mesh
                receiveShadow
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -2, 0]}
              >
                <planeGeometry args={[20, 20]} />
                <shadowMaterial opacity={0.3} />
              </mesh>

              <mesh position={[0, 0, -8]}>
                <planeGeometry args={[20, 15]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
            </Canvas>

            <div className="absolute top-6 left-6 backdrop-blur-md bg-cyan-500/20 rounded-lg px-4 py-2 border border-cyan-500/50">
              <p className="text-cyan-300 text-sm font-medium">
                Drag to rotate • Scroll to zoom
              </p>
            </div>
          </motion.div>

          {sensors.map((sensor, index) => {
            const Icon = sensor.icon;
            return (
              <motion.div
                key={sensor.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.8 + index * 0.1,
                  type: "spring",
                  stiffness: 200,
                }}
                className={`absolute ${sensor.position} hidden lg:block`}
              >
                <div className="backdrop-blur-md bg-slate-900/90 rounded-xl p-4 border border-cyan-500/30 shadow-xl max-w-[200px]">
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${sensor.color} flex items-center justify-center mb-3`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="text-white font-semibold mb-1">
                    {sensor.name}
                  </h4>
                  <p className="text-slate-300 text-sm">{sensor.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="mt-12 grid md:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {sensors.map((sensor, index) => {
            const Icon = sensor.icon;
            return (
              <div
                key={sensor.name}
                className="backdrop-blur-md bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 lg:hidden"
              >
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${sensor.color} flex items-center justify-center mb-2`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-white font-semibold text-sm mb-1">
                  {sensor.name}
                </h4>
                <p className="text-slate-300 text-xs">{sensor.desc}</p>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="mt-12 backdrop-blur-md bg-slate-800/40 rounded-2xl p-8 border border-cyan-500/20"
        >
          <h3 className="text-2xl font-bold text-cyan-400 mb-4 text-center">
            The Future of Marine Conservation
          </h3>
          <p className="text-slate-300 text-center max-w-3xl mx-auto leading-relaxed">
            Our Smart Tag technology combines cutting-edge sensors with
            satellite communication to provide real-time insights into shark
            behavior, migration patterns, and ecosystem health. This data helps
            scientists make informed decisions to protect these essential apex
            predators and maintain the delicate balance of our oceans.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
