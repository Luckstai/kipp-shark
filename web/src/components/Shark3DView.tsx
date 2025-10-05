import { useRef, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
  useAnimations,
  Html,
} from "@react-three/drei";
import { motion } from "framer-motion";
import {
  Thermometer,
  Ruler,
  Activity,
  Fish as FishIcon,
  Satellite,
} from "lucide-react";
import * as THREE from "three";

// 🦈 Modelo 3D do tubarão com animação
function SharkModel() {
  const sharkRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/shark.glb");
  const { actions, mixer } = useAnimations(animations, sharkRef);

  useEffect(() => {
    // Centraliza e escala
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scaleFactor = 5 / Math.max(size.x, size.y, size.z);
    scene.scale.setScalar(scaleFactor);
    scene.position.sub(center.multiplyScalar(scaleFactor));

    // Animação contínua e fluida
    if (animations && animations.length > 0) {
      const firstAction = actions[animations[0].name];
      if (firstAction) {
        firstAction.reset();
        firstAction.setLoop(THREE.LoopRepeat, Infinity);
        firstAction.clampWhenFinished = false;
        firstAction.fadeIn(0.8);
        firstAction.play();
        mixer.timeScale = 1;
      }
    }

    return () => mixer.stopAllAction();
  }, [scene, animations, actions, mixer]);

  useFrame((_, delta) => mixer?.update(delta));

  useFrame((state) => {
    if (sharkRef.current) {
      sharkRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      sharkRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={sharkRef}>
      <primitive object={scene} />
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
      icon: Activity,
      name: "Acceleration",
      desc: "Detects hunting activity",
      color: "from-purple-500 to-pink-500",
      position: "top-[240px] left-10", // ⬇️ leve ajuste
    },
    {
      icon: Ruler,
      name: "Depth",
      desc: "Tracks dive depth and movement",
      color: "from-blue-500 to-cyan-500",
      position: "top-20 right-10",
    },
    {
      icon: Satellite,
      name: "GPS",
      desc: "Tracks migration and patterns",
      color: "from-yellow-500 to-amber-500",
      position: "top-[240px] right-10", // ⬇️ ajustado
    },
    {
      icon: FishIcon,
      name: "Prey Analysis",
      desc: "Detects what the shark is eating",
      color: "from-green-500 to-emerald-500",
      position: "top-[460px] right-10", // ⬇️ mais afastado
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
            behave, we can protect marine life and preserve ocean balance.
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
            <Canvas
              shadows
              gl={{ antialias: true }}
              onCreated={({ scene }) => {
                scene.background = new THREE.Color("#0b1225");
                scene.fog = new THREE.Fog("#0b1225", 10, 40);
              }}
            >
              <PerspectiveCamera makeDefault position={[0, 1.5, 5.2]} />
              <OrbitControls
                enablePan={false}
                minDistance={3}
                maxDistance={15}
                autoRotate
                autoRotateSpeed={0.6}
              />

              <ambientLight intensity={1.1} />
              <directionalLight
                position={[5, 10, 5]}
                intensity={2}
                castShadow
              />
              <hemisphereLight intensity={0.8} groundColor="#0f172a" />
              <pointLight
                position={[-10, 10, -10]}
                intensity={1.2}
                color="#00ffff"
              />

              <Suspense
                fallback={
                  <Html center>
                    <p className="text-cyan-400 font-medium animate-pulse">
                      🦈 Loading shark model...
                    </p>
                  </Html>
                }
              >
                <SharkModel />
              </Suspense>

              <mesh
                receiveShadow
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -3, 0]}
              >
                <planeGeometry args={[30, 30]} />
                <shadowMaterial opacity={0.2} />
              </mesh>
            </Canvas>

            <div className="absolute top-6 left-6 backdrop-blur-md bg-cyan-500/20 rounded-lg px-4 py-2 border border-cyan-500/50">
              <p className="text-cyan-300 text-sm font-medium">
                Drag to rotate • Scroll to zoom
              </p>
            </div>
          </motion.div>

          {/* Sensores ajustados */}
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
            behavior, migration patterns, and ecosystem health.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Precarrega o modelo
useGLTF.preload("/models/shark.glb");
