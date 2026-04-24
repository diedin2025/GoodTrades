import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line, Sparkles, Stars, Text } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";

function AgentNode({ position, color, label, active, highlighted }) {
  const ref = useRef(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    ref.current.rotation.y = elapsed * 0.5;
    ref.current.position.y = position[1] + Math.sin(elapsed * 1.4 + position[0]) * 0.08;
    const emphasis = highlighted ? 1.22 + Math.sin(elapsed * 6) * 0.06 : active ? 1.08 : 1;
    ref.current.scale.setScalar(emphasis);
  });

  return (
    <group ref={ref} position={position}>
      <mesh>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={highlighted ? 3.4 : active ? 2.4 : 1.3} wireframe />
      </mesh>
      <mesh scale={1.3}>
        <sphereGeometry args={[0.34, 24, 24]} />
        <meshStandardMaterial color={color} transparent opacity={highlighted ? 0.26 : active ? 0.18 : 0.08} />
      </mesh>
      <Text position={[0, -0.52, 0]} fontSize={0.12} color="#f5efe2" anchorX="center">
        {label}
      </Text>
    </group>
  );
}

function UploadPulse({ targetPosition, active, token }) {
  const ref = useRef(null);
  const progress = useRef(0);
  const source = useMemo(() => [0, -3.1, 0.4], []);
  const path = useMemo(() => [source, targetPosition], [source, targetPosition]);

  useEffect(() => {
    progress.current = 0;
  }, [token]);

  useFrame((state, delta) => {
    if (!ref.current) {
      return;
    }

    if (!active) {
      ref.current.visible = false;
      return;
    }

    ref.current.visible = true;
    progress.current = Math.min(progress.current + delta * 0.9, 1);
    const eased = 1 - (1 - progress.current) ** 3;
    ref.current.position.set(
      source[0] + (targetPosition[0] - source[0]) * eased,
      source[1] + (targetPosition[1] - source[1]) * eased,
      source[2] + (targetPosition[2] - source[2]) * eased
    );
    const pulse = 1 + Math.sin(state.clock.getElapsedTime() * 16) * 0.2;
    ref.current.scale.setScalar(pulse);
  });

  if (!active) {
    return null;
  }

  return (
    <>
      <Line points={path} color="#fff1d6" transparent opacity={0.52} lineWidth={1.8} />
      <mesh ref={ref} position={source}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#fff1d6" emissive="#ff8a8a" emissiveIntensity={2.8} />
      </mesh>
    </>
  );
}

function Scene({ agents, selectedSymbol, background = false, transparent = false, targetIndex = -1, uploadToken = 0 }) {
  const colors = ["#ff8b5e", "#f6bd60", "#86efac", "#7dd3fc", "#c4b5fd", "#f9a8d4"];

  const nodes = useMemo(
    () =>
      agents.map((agent, index) => {
        const angle = (Math.PI * 2 * index) / agents.length;
        const radius = index % 2 === 0 ? 2.2 : 1.55;
        return {
          ...agent,
          color: colors[index % colors.length],
          position: [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.75, (index % 3) * 0.18 - 0.18],
        };
      }),
    [agents]
  );

  const links = useMemo(() => nodes.map((node) => [node.position, [0, 0, 0]]), [nodes]);
  const targetPosition = nodes[targetIndex]?.position || [0, 0, 0];

  return (
    <>
      {!background && !transparent ? <color attach="background" args={["#140f0e"]} /> : null}
      <fog attach="fog" args={["#140f0e", 5, 10]} />
      <ambientLight intensity={background ? 1.15 : 1.4} />
      <pointLight position={[4, 4, 4]} intensity={background ? 18 : 20} color="#ff8b5e" />
      <pointLight position={[-4, -2, 3]} intensity={background ? 14 : 16} color="#7dd3fc" />
      <pointLight position={[0, 3, -3]} intensity={background ? 11 : 12} color="#f6bd60" />
      <Stars radius={26} depth={18} count={background ? 780 : 700} factor={3.5} fade speed={0.8} />
      <Sparkles count={background ? 42 : 36} scale={10} size={2.4} speed={0.45} color="#f8f6ef" />

      <mesh scale={background ? 1.2 : 1}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color="#f97316" emissive="#fb923c" emissiveIntensity={background ? 2.8 : 2} wireframe />
      </mesh>
      {!background ? (
        <Text position={[0, -0.88, 0]} fontSize={0.18} color="#fff4dd" anchorX="center">
          {selectedSymbol}
        </Text>
      ) : null}

      {links.map((points, index) => (
        <Line
          key={index}
          points={points}
          color="#f8f6ef"
          transparent
          opacity={index === targetIndex ? 0.64 : background ? 0.34 : 0.22}
          lineWidth={index === targetIndex ? 2 : 1}
        />
      ))}

      <UploadPulse targetPosition={targetPosition} active={targetIndex >= 0} token={uploadToken} />

      {nodes.map((node, index) => (
        <Float key={node.name} speed={1.4 + index * 0.05} rotationIntensity={0.3} floatIntensity={0.45}>
          <AgentNode
            position={node.position}
            color={node.color}
            label={node.name.split(" ")[0]}
            active={index < 3}
            highlighted={index === targetIndex}
          />
        </Float>
      ))}
    </>
  );
}

export default function AgentConstellation({ agents, selectedSymbol }) {
  return (
    <div className="constellation-shell">
      <Canvas camera={{ position: [0, 0, 7.3], fov: 46 }}>
        <Scene agents={agents} selectedSymbol={selectedSymbol} />
      </Canvas>
      <div className="constellation-copy top">
        <span>Screen one</span>
        <strong>Agent collaboration view</strong>
        <p>The center node is the active symbol. Ten specialist agents orbit it and feed each other risk, pattern, memory, and coaching signals.</p>
      </div>
      <div className="constellation-copy bottom">
        <span>Swipe right</span>
        <strong>Market Studio</strong>
        <p>Move to the stock screen to inspect the setup, draw directly on the chart space, and review what the AI questions.</p>
      </div>
    </div>
  );
}

export function AgentConstellationForeground({ agents, selectedSymbol, targetIndex = -1, uploadToken = 0 }) {
  return (
    <div className="constellation-foreground" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 6.1], fov: 42 }} gl={{ alpha: true }}>
        <Scene agents={agents} selectedSymbol={selectedSymbol} transparent targetIndex={targetIndex} uploadToken={uploadToken} />
      </Canvas>
    </div>
  );
}
