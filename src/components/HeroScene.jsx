import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";

const METRICS = [
  { key: "test", label: "Test" },
  { key: "evaluation", label: "Evaluation" },
  { key: "verification", label: "Verification" },
  { key: "reliability", label: "Reliability" },
  { key: "leniency", label: "Leniency" },
];

function ModelNode({ position, color, accent, scale, active }) {
  const ref = useRef(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    ref.current.rotation.y = elapsed * 0.45;
    ref.current.position.y = position[1] + Math.sin(elapsed * 1.6 + position[0]) * 0.05;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={1.4} wireframe />
      </mesh>
      <mesh scale={1.18}>
        <sphereGeometry args={[0.68, 32, 32]} />
        <meshStandardMaterial color={accent} transparent opacity={active ? 0.16 : 0.07} />
      </mesh>
    </group>
  );
}

function ComparisonScene({ primaryModel, secondaryModel, primaryScore, secondaryScore }) {
  const primaryScale = 0.8 + primaryScore.validation * 0.03;
  const secondaryScale = 0.8 + secondaryScore.validation * 0.03;
  const connectionPoints = useMemo(
    () => [
      [-1.45, 0.2, 0],
      [0, 0.55, 0.28],
      [1.45, -0.2, 0],
    ],
    []
  );

  return (
    <>
      <ambientLight intensity={1.15} />
      <pointLight position={[2.4, 2.6, 3.4]} intensity={18} color={secondaryModel.color} />
      <pointLight position={[-2.4, -1.2, 3.2]} intensity={18} color={primaryModel.color} />
      <pointLight position={[0, 2, -3]} intensity={10} color="#fb7185" />
      <Stars radius={26} depth={18} count={650} factor={3} fade speed={0.6} />
      <Sparkles count={24} scale={4.6} size={2.3} speed={0.4} color="#f5efff" />

      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.35}>
        <ModelNode
          position={[-1.45, 0.2, 0]}
          color={primaryModel.color}
          accent="#8b5cf6"
          scale={primaryScale}
          active={primaryModel.winner}
        />
      </Float>

      <Float speed={1.9} rotationIntensity={0.25} floatIntensity={0.35}>
        <ModelNode
          position={[1.45, -0.2, 0]}
          color={secondaryModel.color}
          accent="#fb7185"
          scale={secondaryScale}
          active={secondaryModel.winner}
        />
      </Float>

      <Line points={connectionPoints} color="#f5efff" transparent opacity={0.35} lineWidth={1.2} />
      <mesh position={[0, 0.55, 0.28]} rotation={[1.15, 0.2, 0.25]}>
        <torusGeometry args={[0.5, 0.03, 16, 100]} />
        <meshStandardMaterial color="#d946ef" emissive="#ef4444" emissiveIntensity={0.75} />
      </mesh>

      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.65} />
    </>
  );
}

function MetricRow({ label, primaryValue, secondaryValue, primaryWinner, secondaryWinner }) {
  return (
    <div className="hero-metric-row">
      <span>{label}</span>
      <div className="hero-metric-bars">
        <div className={`hero-metric-bar ${primaryWinner ? "winner" : ""}`}>
          <i style={{ width: `${primaryValue * 10}%` }} />
          <strong>{primaryValue}</strong>
        </div>
        <div className={`hero-metric-bar secondary ${secondaryWinner ? "winner" : ""}`}>
          <i style={{ width: `${secondaryValue * 10}%` }} />
          <strong>{secondaryValue}</strong>
        </div>
      </div>
    </div>
  );
}

export default function HeroScene({ primaryModel, secondaryModel, primaryScore, secondaryScore, winnerName, gap }) {
  return (
    <div className="hero-scene-shell">
      <Canvas camera={{ position: [0, 0, 5.1], fov: 42 }}>
        <color attach="background" args={["#12091f"]} />
        <fog attach="fog" args={["#12091f", 4.5, 8.5]} />
        <ComparisonScene
          primaryModel={primaryModel}
          secondaryModel={secondaryModel}
          primaryScore={primaryScore}
          secondaryScore={secondaryScore}
        />
      </Canvas>

      <div className="hero-scene-copy hero-scene-copy-top">
        <span>What you are looking at</span>
        <strong>{winnerName} is currently ahead</strong>
        <p>The two floating nodes are the selected models. Their size tracks the live composite score, and the bars below compare each TEVVRL metric directly.</p>
      </div>

      <div className="hero-scene-copy hero-scene-copy-bottom">
        <div className="hero-scene-legend">
          <div>
            <b style={{ color: primaryModel.color }}>{primaryModel.name}</b>
            <span>{primaryScore.validation}/10 overall</span>
          </div>
          <div>
            <b style={{ color: secondaryModel.color }}>{secondaryModel.name}</b>
            <span>{secondaryScore.validation}/10 overall</span>
          </div>
          <div>
            <b>Gap</b>
            <span>{gap}</span>
          </div>
        </div>

        <div className="hero-metric-grid">
          {METRICS.map((metric) => (
            <MetricRow
              key={metric.key}
              label={metric.label}
              primaryValue={primaryScore.current[metric.key]}
              secondaryValue={secondaryScore.current[metric.key]}
              primaryWinner={primaryScore.current[metric.key] >= secondaryScore.current[metric.key]}
              secondaryWinner={secondaryScore.current[metric.key] > primaryScore.current[metric.key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
