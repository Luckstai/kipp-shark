import { useRef, Suspense, useEffect, useLayoutEffect } from "react";
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

/* ==================== CONFIG ==================== */
const SWIM_START = 0;
const SWIM_END = 120;
const SWIM_FPS = 24;

/* ===== câmera inicial determinística e configurável ===== */
function applyInitialCamera(
  cam: THREE.PerspectiveCamera,
  ctrls: any,
  {
    axis = "x", // 'x' ou 'z' → eixo pelo qual a câmera olha
    sign = 1, //  1 ou -1   → lado do eixo
    dist = 5.2,
    height = 1.5,
    target = new THREE.Vector3(0, 0.2, 0),
  }: {
    axis?: "x" | "z";
    sign?: 1 | -1;
    dist?: number;
    height?: number;
    target?: THREE.Vector3;
  } = {}
) {
  const pos = new THREE.Vector3();
  if (axis === "x") pos.set(sign * dist, height, 0);
  else pos.set(0, height, sign * dist);

  cam.position.copy(pos);
  cam.lookAt(target);

  ctrls.target.copy(target);
  ctrls.update();
  ctrls.saveState();
}

/* ========== filtro mínimo: remove só trilhas da cabeça ========== */
function clipWithoutHead(clip: THREE.AnimationClip) {
  const HEAD_TRACK_PREFIXES = [
    "Head_Shark_Armature_3.",
    "Head001_Shark_Armature_2.",
    "CTRL_Head_Shark_Armature_38.",
  ];
  const filtered = clip.tracks.filter(
    (t) => !HEAD_TRACK_PREFIXES.some((p) => t.name.startsWith(p))
  );
  (window as any).__filteredTracks = filtered.map((t) => t.name);
  return new THREE.AnimationClip(
    clip.name + "_noHead",
    clip.duration,
    filtered
  );
}

/* ==================== LED blink robusto ==================== */
function useBlink(scene: THREE.Object3D | null) {
  const lightRef = useRef<THREE.PointLight | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (!scene) return;
    let blink: THREE.Mesh | null =
      (scene.getObjectByName("Blink") as THREE.Mesh) ?? null;
    if (!blink) {
      scene.traverse((o) => {
        if (!blink && /blink/i.test(o.name) && (o as any).isMesh) {
          blink = o as THREE.Mesh;
        }
      });
    }
    meshRef.current = blink ?? null;
    if (!blink) {
      console.warn("[Blink] nenhum objeto encontrado contendo 'blink'");
      return;
    }

    const ensureStd = (m: THREE.Material) => {
      if ((m as any).isMeshStandardMaterial)
        return m as THREE.MeshStandardMaterial;
      return new THREE.MeshStandardMaterial({
        color: (m as any)?.color ?? 0x222222,
      });
    };
    const orig = blink.material as THREE.Material | THREE.Material[];
    let mat: THREE.MeshStandardMaterial;
    if (Array.isArray(orig)) {
      mat = ensureStd(orig[0]);
      blink.material = mat;
    } else {
      mat = ensureStd(orig);
      blink.material = mat;
    }
    mat.emissive = new THREE.Color(0xff0000);
    mat.emissiveIntensity = 0.2;

    if (!lightRef.current)
      lightRef.current = new THREE.PointLight(0xff0000, 0, 1);
    if (lightRef.current.parent !== blink) blink.add(lightRef.current);
    if (blink.geometry) {
      const center = new THREE.Vector3();
      (blink.geometry as THREE.BufferGeometry).computeBoundingBox();
      blink.geometry.boundingBox?.getCenter(center);
      lightRef.current.position.copy(center);
    }
  }, [scene]);

  useFrame(({ clock }) => {
    const blink = meshRef.current;
    const light = lightRef.current;
    if (!blink || !light) return;
    const t = clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI); // 1 Hz
    const mat = blink.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissive.set(0xff0000);
      (mat as any).emissiveIntensity = 0.25 + pulse * 2.75;
      mat.needsUpdate = true;
    }
    light.intensity = pulse * 2.0;
    light.color.set(0xff0000);
    light.distance = 0.9;
  });
}

/* ==================== Sensor card ==================== */
function SensorCard({
  icon: Icon,
  name,
  desc,
  color,
}: {
  icon: any;
  name: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="backdrop-blur-md bg-slate-900/90 rounded-xl p-4 border border-cyan-500/30 shadow-xl max-w-[220px]">
      <div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center mb-3`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h4 className="text-white font-semibold mb-1">{name}</h4>
      <p className="text-slate-300 text-sm">{desc}</p>
    </div>
  );
}

/* ==================== Shark model ==================== */
function SharkModel() {
  const sharkRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/shark_v5.glb");
  const { mixer } = useAnimations(animations, sharkRef);

  const HEAD_NAMES = [
    "Head_Shark_Armature_3",
    "Head001_Shark_Armature_2",
    "CTRL_Head_Shark_Armature_38",
  ];
  const headBonesRef = useRef<(THREE.Bone | null)[]>([]);
  const headPoseRef = useRef<
    { q: THREE.Quaternion; p: THREE.Vector3 }[] | null
  >(null);

  useEffect(() => {
    if (!animations?.length) return;
    (window as any).__tracks = animations[0].tracks.map((t) => t.name);
  }, [animations]);

  useEffect(() => {
    if (!scene) return;
    const bones: string[] = [];
    scene.traverse((o) => {
      if ((o as any).isBone) bones.push(o.name);
    });
    (window as any).__bones = bones;
  }, [scene]);

  useEffect(() => {
    // centraliza/escala no group externo
    const root = sharkRef.current;
    if (root) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const k = 5 / Math.max(size.x, size.y, size.z);
      root.scale.setScalar(k);
      root.position.sub(center.multiplyScalar(k));
    }

    if (animations && animations.length > 0) {
      const base = animations[0];
      const noHead = clipWithoutHead(base);
      (window as any).__noHead = noHead;

      let clipToPlay: THREE.AnimationClip = noHead;
      if (SWIM_END > SWIM_START) {
        const maybe = THREE.AnimationUtils.subclip(
          noHead,
          "SwimOnly",
          SWIM_START,
          SWIM_END,
          SWIM_FPS
        );
        if (maybe.tracks.length > 0 && maybe.duration > 0) clipToPlay = maybe;
        else console.warn("[Shark] subclip vazio — usando clipe inteiro.");
      }

      mixer.stopAllAction();
      const act = mixer.clipAction(clipToPlay, sharkRef.current ?? undefined);
      act.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.5).play();
      mixer.timeScale = 1;

      headBonesRef.current = HEAD_NAMES.map(
        (n) => (scene.getObjectByName(n) as THREE.Bone) || null
      );

      let raf = 0;
      raf = requestAnimationFrame(() => {
        headPoseRef.current = headBonesRef.current.map((b) => {
          const q = new THREE.Quaternion();
          const p = new THREE.Vector3();
          if (b) {
            q.copy(b.quaternion);
            p.copy(b.position);
          }
          return { q, p };
        });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [scene, animations, mixer]);

  useFrame((_, d) => mixer?.update(d));

  // trava localmente a cabeça (pós-mixer)
  useFrame(() => {
    const bones = headBonesRef.current;
    const pose = headPoseRef.current;
    if (!bones.length || !pose) return;
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      if (!b) continue;
      b.quaternion.copy(pose[i].q);
      b.position.copy(pose[i].p);
      b.updateMatrixWorld(true);
    }
  });

  // leve “vida” no group externo
  useFrame((state) => {
    if (!sharkRef.current) return;
    sharkRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    sharkRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
  });

  useBlink(scene);

  return (
    <group ref={sharkRef}>
      <primitive object={scene} />
    </group>
  );
}

export default function Shark3DView() {
  /* ===== câmera determinística na frente (eixo X) ===== */
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const controlsRef = useRef<any>(null);

  useLayoutEffect(() => {
    if (!camRef.current || !controlsRef.current) return;
    applyInitialCamera(camRef.current, controlsRef.current, {
      axis: "z", // usa o eixo Z como frente
      sign: 1, // 1 => +Z ; se ficar de costas, troque para -1
      dist: 5.2, // distância
      height: 0.8, // altura menor para não “olhar de cima”
      target: new THREE.Vector3(0, 0.2, 0),
    });
  }, []);

  const leftSensors = [
    {
      icon: Thermometer,
      name: "Temperature",
      desc: "Monitors water and body temperature",
      color: "from-red-500 to-orange-500",
    },
    {
      icon: Activity,
      name: "Acceleration",
      desc: "Detects hunting activity",
      color: "from-purple-500 to-pink-500",
    },
  ];
  const rightSensors = [
    {
      icon: Ruler,
      name: "Depth",
      desc: "Tracks dive depth and movement",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Satellite,
      name: "GPS",
      desc: "Tracks migration and patterns",
      color: "from-yellow-500 to-amber-500",
    },
    {
      icon: FishIcon,
      name: "Prey Analysis",
      desc: "Detects what the shark is eating",
      color: "from-green-500 to-emerald-500",
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
          {/* hint centralizado */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 backdrop-blur-md bg-cyan-500/20 rounded-lg px-4 py-2 border border-cyan-500/50 shadow">
            <p className="text-cyan-300 text-sm font-medium">
              Drag to rotate • Scroll to zoom
            </p>
          </div>

          {/* ====== CONTAINER SEM FLICKER + CANVAS 100% ====== */}
          <div className="relative h-[600px] rounded-3xl border border-cyan-500/30 shadow-2xl overflow-hidden">
            {/* fundo sólido já no 1º frame */}
            <div className="absolute inset-0 bg-[#0b1225]" />

            <Canvas
              className="absolute inset-0 block"
              shadows
              gl={{ antialias: true }}
            >
              {/* background e fog via nodes (síncrono) */}
              <color attach="background" args={["#0b1225"]} />
              <fog attach="fog" args={["#0b1225", 10, 40]} />

              {/* keys se quiser forçar remontagem em dev: */}
              <PerspectiveCamera ref={camRef} makeDefault key="cam-v3" />
              <OrbitControls
                ref={controlsRef}
                enablePan={false}
                minDistance={4}
                maxDistance={10}
                autoRotate
                autoRotateSpeed={0.8}
                minPolarAngle={Math.PI * 0.5} // ~45° acima do horizonte
                maxPolarAngle={Math.PI * 0.75} // ~45° abaixo (evita vista de topo)
                // opcional: trave a rotação para não ir completamente para trás:
                // minAzimuthAngle={-Math.PI * 0.6}
                // maxAzimuthAngle={ Math.PI * 0.6}
              />

              {/* luzes base */}
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

              {/* chão */}
              <mesh
                receiveShadow
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -3, 0]}
              >
                <planeGeometry args={[30, 30]} />
                <shadowMaterial opacity={0.2} />
              </mesh>
            </Canvas>

            {/* Overlay lateral (desktop) */}
            <div className="pointer-events-none absolute inset-0 hidden lg:flex items-center justify-between px-6">
              <div className="pointer-events-auto flex flex-col gap-6">
                {leftSensors.map((s) => (
                  <SensorCard key={s.name} {...s} />
                ))}
              </div>
              <div className="pointer-events-auto flex flex-col gap-6 items-end">
                {rightSensors.map((s) => (
                  <SensorCard key={s.name} {...s} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="mt-12 space-y-12"
        >
          <div className="backdrop-blur-md bg-slate-800/40 rounded-2xl p-8 border border-cyan-500/20 shadow-2xl">
            <h3 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-4 text-center drop-shadow">
              Why Smart Tags Matter
            </h3>
            <p className="text-slate-300 text-center max-w-3xl mx-auto leading-relaxed text-lg">
              Understanding what sharks eat, where they travel, and how they behave allows us to
              safeguard marine life and maintain ocean balance. These insights help us to:
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Map Migration Routes",
                  description: "Track seasonal movements and breeding corridors.",
                  icon: "🌊",
                },
                {
                  title: "Identify Critical Habitats",
                  description: "Protect essential nursery and feeding grounds.",
                  icon: "🎯",
                },
                {
                  title: "Monitor Ecosystem Health",
                  description: "Understand how sharks interact with their environment.",
                  icon: "📊",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 px-6 py-8 text-center shadow-lg"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15 text-2xl">
                    {item.icon}
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">
                    {item.title}
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="backdrop-blur-md bg-slate-800/40 rounded-2xl p-8 border border-cyan-500/20 shadow-2xl">
            <h3 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-8 text-center drop-shadow">
              Technical Specifications
            </h3>

            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h4 className="text-lg font-semibold text-cyan-200 mb-4">Hardware</h4>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li>• Titanium shell rated to 3000m depth (waterproof and pressure-proof).</li>
                  <li>• Energy-harvesting battery with 5-year lifespan.</li>
                  <li>• Multi-sensor suite with real-time onboard processing.</li>
                  <li>• Dual communication: satellite uplink and acoustic telemetry.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-cyan-200 mb-4">Data Capture</h4>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li>• GPS fixes every 15 minutes for migration tracking.</li>
                  <li>• Temperature &amp; depth readings every 5 seconds.</li>
                  <li>• Continuous acceleration and posture monitoring.</li>
                  <li>• Encrypted storage and cloud analytics pipeline.</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* Preload do modelo */
useGLTF.preload("/models/shark_v5.glb");
