"use client";

// La scène 3D (Three.js via React Three Fiber) : un dé de casino de précision
// en acétate rubis translucide, posé sur un tapis de feutre outremer.
//
// Le dé a une petite physique maison (gravité, rebonds, frottements) :
// - au repos : il flotte et montre le chiffre choisi, en s'inclinant vers la souris
// - on peut l'attraper à la souris (ou au doigt) et le lancer, pour le plaisir
// - pendant une vraie partie : il tournoie en l'air en attendant la blockchain,
//   puis il est lancé et retombe, en se corrigeant discrètement à chaque rebond
//   pour finir sur le chiffre tiré par le contrat
// Chaque choc fait onduler le tapis et prévient la page (`onImpact`) ; une
// victoire fait jaillir des jetons et une vague rubis sur le feutre.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { faceBasis, FACE_NORMALS, faceUpQuaternion, restHeight, topFace } from "@/lib/dicePhysics";
import { PIPS } from "./Die";

export type Impact = { strength: number; x: number; y: number };
export type SceneFx = { kind: "win" | "lose"; id: number } | null;

export type DieSceneProps = {
  /** Chiffre montré au repos (le chiffre choisi). */
  face: number;
  /** true pendant la transaction : le dé tournoie en l'air. */
  rolling: boolean;
  /** Résultat à jouer : à chaque nouvel `id`, le dé est lancé et finit sur `roll`. */
  outcome: { id: number; roll: number } | null;
  /** Effet de victoire / défaite sur le tapis. */
  fx: SceneFx;
  /** On peut lancer le dé à la main (pas pendant une vraie partie). */
  allowToy: boolean;
  /** false quand la scène n'est pas visible : on arrête de dessiner. */
  active: boolean;
  reduceMotion: boolean;
  onImpact?: (impact: Impact) => void;
  onLanded?: () => void;
  onToyLanded?: (face: number) => void;
};

// --- Réglages physiques (unités : 1 = un côté de dé) ---
const GRAVITY = 26;
const BOUNCE = 0.36;
// Zone de jeu du dé : bords et plafond invisibles, choisis pour qu'il reste
// toujours entièrement visible à l'écran, même lancé fort.
const BOUNDS = { x: 1.35, z: 0.95 };
const CEILING = 2.3;
// Caméra : proche au repos (le dé paraît grand), plus loin pendant un lancer
// (il a de la place pour voler et rebondir sans sortir du cadre).
const CAMERA = new THREE.Vector3(0, 2.5, 4.4);
const CAMERA_WIDE = new THREE.Vector3(0, 3.5, 6.6);
const LOOK_AT = new THREE.Vector3(0, 0.55, 0);
const LOOK_AT_WIDE = new THREE.Vector3(0, 0.95, 0);

type Mode = "idle" | "held" | "hover" | "free" | "settle" | "rest";

export default function DieScene(props: DieSceneProps) {
  return (
    <Canvas
      frameloop={props.active ? "always" : "never"}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: CAMERA.toArray(), fov: 34, near: 0.1, far: 50 }}
      onCreated={({ camera }) => camera.lookAt(LOOK_AT)}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={0.35} />
      <spotLight position={[2.5, 7, 3]} angle={0.45} penumbra={1} intensity={90} color="#fff4e6" />
      <pointLight position={[-3, 2, -2]} intensity={8} color="#9DB0FF" />

      {/* Reflets du dé : des « studios » de lumière, sans fichier HDR à charger */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={5} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2.5} />
          <Lightformer form="circle" intensity={2.5} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="ring" color="#9DB0FF" intensity={4} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={3} />
          <Lightformer form="rect" intensity={3} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[12, 2, 1]} />
        </group>
      </Environment>

      <World {...props} />
    </Canvas>
  );
}

function World({ face, rolling, outcome, fx, allowToy, reduceMotion, onImpact, onLanded, onToyLanded }: DieSceneProps) {
  const { camera, pointer, raycaster } = useThree();
  const dieRef = useRef<THREE.Group>(null);
  const feltRef = useRef<THREE.ShaderMaterial>(null);
  const chipsRef = useRef<ChipsHandle>(null);

  // Toujours les dernières versions des callbacks (sans relancer d'effets)
  const cb = useRef({ onImpact, onLanded, onToyLanded, allowToy, face });
  useEffect(() => {
    cb.current = { onImpact, onLanded, onToyLanded, allowToy, face };
  });

  // État physique du dé, modifié à chaque image (hors de React pour la fluidité)
  const s = useRef({
    mode: "idle" as Mode,
    pos: new THREE.Vector3(0, 0.62, 0),
    vel: new THREE.Vector3(),
    quat: faceUpQuaternion(face),
    ang: new THREE.Vector3(),
    target: null as number | null, // face imposée (vraie partie) ; null = lancer libre
    real: false,
    impacts: 0,
    airTime: 0,
    settleFrom: new THREE.Quaternion(),
    settleTo: new THREE.Quaternion(),
    settleT: 0,
    restAt: 0,
    lastPos: new THREE.Vector3(),
    heldVel: new THREE.Vector3(),
    shake: 0,
    zoom: 0, // 0 = caméra proche, 1 = caméra éloignée (dé en vol)
    ripples: [] as THREE.Vector4[],
    flashAt: -10,
    lossAt: -10,
  });

  // Une nouvelle transaction : le dé s'envole et tournoie.
  useEffect(() => {
    if (!rolling) return;
    const st = s.current;
    st.mode = "hover";
    st.real = true;
    st.target = null;
    st.ang.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(11);
  }, [rolling]);

  // Le résultat arrive : on lance le dé vers le tapis.
  const thrown = useRef<number | null>(null);
  useEffect(() => {
    if (!outcome || rolling || thrown.current === outcome.id) return;
    thrown.current = outcome.id;
    const st = s.current;
    st.real = true;
    st.target = outcome.roll;
    if (reduceMotion) {
      st.quat.copy(faceUpQuaternion(outcome.roll));
      st.pos.set(0, restHeight(st.quat), 0);
      st.mode = "rest";
      cb.current.onLanded?.();
      return;
    }
    if (st.mode !== "hover") st.pos.set(0, 1.6, 0);
    st.vel.set(rand(-2.6, 2.6), 2.2, rand(-1.2, 0.4));
    st.ang.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(13, 17));
    st.impacts = 0;
    st.airTime = 0;
    st.mode = "free";
  }, [outcome, rolling, reduceMotion]);

  // Changement de chiffre : le dé revient au centre et le montre.
  useEffect(() => {
    const st = s.current;
    if (st.mode === "rest" || st.mode === "idle") st.mode = "idle";
  }, [face]);

  // Effets de victoire / défaite
  useEffect(() => {
    if (!fx) return;
    const st = s.current;
    const now = performance.now() / 1000;
    if (fx.kind === "win") {
      st.flashAt = now;
      st.shake = 0.12;
      chipsRef.current?.burst(st.pos);
    } else {
      st.lossAt = now;
    }
  }, [fx]);

  // Lâcher le dé : il part dans la direction du geste.
  useEffect(() => {
    const release = () => {
      const st = s.current;
      if (st.mode !== "held") return;
      const v = st.heldVel.clone().clampLength(0, 9);
      st.vel.set(v.x, Math.max(2.4, v.y + 2.4), v.z);
      st.ang.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(6 + v.length() * 1.4);
      st.ang.add(new THREE.Vector3(v.z, 0, -v.x).multiplyScalar(2));
      st.target = null;
      st.real = false;
      st.impacts = 0;
      st.airTime = 0;
      st.mode = "free";
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  const grab = (e: ThreeEvent<PointerEvent>) => {
    const st = s.current;
    if (!cb.current.allowToy || reduceMotion || !(st.mode === "idle" || st.mode === "rest")) return;
    e.stopPropagation();
    st.mode = "held";
    st.lastPos.copy(st.pos);
    st.heldVel.set(0, 0, 0);
  };

  const emitImpact = (strength: number) => {
    const st = s.current;
    st.shake = Math.max(st.shake, 0.05 * strength);
    st.ripples = [...st.ripples.slice(-3), new THREE.Vector4(st.pos.x, st.pos.z, performance.now() / 1000, strength)];
    const p = tmp.v.copy(st.pos).project(camera);
    cb.current.onImpact?.({ strength, x: (p.x + 1) / 2, y: (1 - p.y) / 2 });
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = state.clock.elapsedTime;
    const now = performance.now() / 1000;
    const st = s.current;

    switch (st.mode) {
      case "idle": {
        // Le chiffre choisi vers le haut, légèrement tourné vers la caméra et vers la souris
        tmp.q.setFromEuler(tmp.euler.set(-pointer.y * 0.22 + 0.18, -0.62 + pointer.x * 0.45, pointer.x * 0.08));
        tmp.q.multiply(faceUpQuaternion(cb.current.face));
        st.quat.slerp(tmp.q, 1 - Math.exp(-5 * dt));
        st.pos.lerp(tmp.v.set(0, 0.68 + Math.sin(t * 1.4) * 0.07, 0), 1 - Math.exp(-4 * dt));
        break;
      }
      case "held": {
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(tmp.plane, tmp.hit)) {
          tmp.hit.x = THREE.MathUtils.clamp(tmp.hit.x, -BOUNDS.x, BOUNDS.x);
          tmp.hit.z = THREE.MathUtils.clamp(tmp.hit.z, -BOUNDS.z, BOUNDS.z);
          st.pos.lerp(tmp.hit, 1 - Math.exp(-16 * dt));
        }
        // Vitesse du geste, lissée
        tmp.v.copy(st.pos).sub(st.lastPos).divideScalar(dt);
        st.heldVel.lerp(tmp.v, 0.35);
        st.lastPos.copy(st.pos);
        // Le dé bascule dans le sens du mouvement
        st.ang.set(st.heldVel.z, 0, -st.heldVel.x).multiplyScalar(0.5);
        integrate(st.quat, st.ang, dt, tmp.q);
        break;
      }
      case "hover": {
        // En attente de la blockchain : il tournoie au-dessus du tapis
        st.pos.lerp(tmp.v.set(Math.sin(t * 1.7) * 0.35, 1.55 + Math.sin(t * 3.1) * 0.12, Math.cos(t * 1.3) * 0.2), 1 - Math.exp(-3 * dt));
        st.ang.applyAxisAngle(tmp.v.set(0, 1, 0).normalize(), dt * 0.8);
        integrate(st.quat, st.ang, dt, tmp.q);
        break;
      }
      case "free": {
        st.airTime += dt;
        st.vel.y -= GRAVITY * dt;
        st.pos.addScaledVector(st.vel, dt);
        integrate(st.quat, st.ang, dt, tmp.q);

        // Bords de la table : rebond sur des bandes invisibles
        if (Math.abs(st.pos.x) > BOUNDS.x) {
          st.pos.x = Math.sign(st.pos.x) * BOUNDS.x;
          st.vel.x *= -0.55;
        }
        if (Math.abs(st.pos.z) > BOUNDS.z) {
          st.pos.z = Math.sign(st.pos.z) * BOUNDS.z;
          st.vel.z *= -0.55;
        }
        // Plafond : un lancer trop fort redescend au lieu de sortir de l'écran
        if (st.pos.y > CEILING) {
          st.pos.y = CEILING;
          st.vel.y = -Math.abs(st.vel.y) * 0.3;
        }

        // Le tapis
        const h = restHeight(st.quat);
        const grounded = st.pos.y - h <= 0.001;
        if (st.pos.y < h) {
          st.pos.y = h;
          if (st.vel.y < -1.2) {
            const strength = Math.min(1, -st.vel.y / 9);
            st.vel.y = -st.vel.y * BOUNCE;
            st.vel.x *= 0.72;
            st.vel.z *= 0.72;
            st.ang.multiplyScalar(0.6);
            st.impacts++;
            emitImpact(strength);
          } else {
            st.vel.y = 0;
          }
        }
        if (grounded) {
          st.vel.x *= Math.exp(-5 * dt);
          st.vel.z *= Math.exp(-5 * dt);
          st.ang.multiplyScalar(Math.exp(-6 * dt));
        }

        // Vraie partie : après le 1er rebond, le dé se rapproche peu à peu du bon chiffre
        if (st.target !== null && st.impacts > 0) {
          const k = 2.5 + st.impacts * 2.5;
          st.quat.slerp(faceUpQuaternion(st.target, st.quat), 1 - Math.exp(-k * dt));
        }

        const calm = grounded && Math.abs(st.vel.y) < 0.4 && st.vel.length() < 0.5 && st.ang.length() < 2.5;
        if (calm || st.airTime > 3.2) {
          st.mode = "settle";
          st.settleFrom.copy(st.quat);
          st.settleTo.copy(faceUpQuaternion(st.target ?? topFace(st.quat), st.quat));
          st.settleT = 0;
        }
        break;
      }
      case "settle": {
        // Le dé bascule sur sa face et s'immobilise
        st.settleT = Math.min(1, st.settleT + dt / 0.32);
        const e = 1 - Math.pow(1 - st.settleT, 3);
        st.quat.slerpQuaternions(st.settleFrom, st.settleTo, e);
        st.pos.y = restHeight(st.quat);
        st.vel.multiplyScalar(Math.exp(-8 * dt));
        st.pos.addScaledVector(st.vel, dt);
        if (st.settleT >= 1) {
          st.mode = "rest";
          st.restAt = t;
          emitImpact(0.12);
          if (st.real) cb.current.onLanded?.();
          else cb.current.onToyLanded?.(topFace(st.quat));
        }
        break;
      }
      case "rest": {
        // Après un lancer libre, le dé revient montrer le chiffre choisi
        if (!st.real && t - st.restAt > 2.8) st.mode = "idle";
        break;
      }
    }

    const die = dieRef.current;
    if (die) {
      die.position.copy(st.pos);
      die.quaternion.copy(st.quat);
    }

    // Caméra : recule en douceur quand le dé vole, se rapproche quand il est posé.
    const moving = st.mode === "held" || st.mode === "free" || st.mode === "settle" || st.mode === "hover";
    st.zoom += ((moving ? 1 : 0) - st.zoom) * (1 - Math.exp(-(moving ? 4 : 1.5) * dt));
    // Écran étroit (téléphone en portrait) : on recule davantage pour garder les bords visibles
    const narrow = Math.max(1, 1.15 / Math.max(0.5, state.size.width / Math.max(1, state.size.height)));
    tmp.v.lerpVectors(CAMERA, CAMERA_WIDE, st.zoom);
    tmp.v.sub(LOOK_AT).multiplyScalar(narrow).add(LOOK_AT);
    st.shake *= Math.exp(-9 * dt);
    camera.position.set(
      tmp.v.x + pointer.x * 0.25 + (Math.random() - 0.5) * st.shake,
      tmp.v.y + pointer.y * 0.12 + (Math.random() - 0.5) * st.shake,
      tmp.v.z,
    );
    camera.lookAt(tmp.hit.lerpVectors(LOOK_AT, LOOK_AT_WIDE, st.zoom));

    // Tapis : temps, ondes de choc, vague de victoire, voile de défaite
    const felt = feltRef.current;
    if (felt) {
      felt.uniforms.uTime.value = now;
      const rip = felt.uniforms.uRipples.value as THREE.Vector4[];
      for (let i = 0; i < 4; i++) rip[i].copy(st.ripples[i] ?? NO_RIPPLE);
      felt.uniforms.uFlash.value = Math.max(0, 1 - (now - st.flashAt) / 1.8);
      felt.uniforms.uLoss.value = Math.max(0, 1 - (now - st.lossAt) / 2.2);
      (felt.uniforms.uFlashPos.value as THREE.Vector2).set(st.pos.x, st.pos.z);
    }
  });

  return (
    <>
      <group ref={dieRef} onPointerDown={grab}>
        <PrecisionDie />
      </group>
      <Felt materialRef={feltRef} />
      <ContactShadows position={[0, 0.002, 0]} scale={7} blur={2.6} far={2.5} opacity={0.85} resolution={512} color="#01020c" />
      <Chips ref={chipsRef} />
    </>
  );
}

/** Fait tourner `q` selon la vitesse angulaire `ang` (axe × vitesse en rad/s). */
function integrate(q: THREE.Quaternion, ang: THREE.Vector3, dt: number, tmp: THREE.Quaternion) {
  const speed = ang.length();
  if (speed < 1e-4) return;
  tmp.setFromAxisAngle(ang.clone().divideScalar(speed), speed * dt);
  q.premultiply(tmp).normalize();
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

const NO_RIPPLE = new THREE.Vector4(0, 0, -100, 0);

// Objets réutilisés à chaque image (pas d'allocation dans la boucle de rendu)
const tmp = {
  q: new THREE.Quaternion(),
  v: new THREE.Vector3(),
  euler: new THREE.Euler(),
  plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.25),
  hit: new THREE.Vector3(),
};

// ---------------------------------------------------------------------------
// Le dé : acétate rubis translucide, arêtes vives, points percés et peints en blanc
// ---------------------------------------------------------------------------

const ACETATE_GLOW = new THREE.Color("#ffd9df");

function PrecisionDie() {
  const pips = useMemo(() => {
    const items: { position: THREE.Vector3; quaternion: THREE.Quaternion; radius: number }[] = [];
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let face = 1; face <= 6; face++) {
      const n = FACE_NORMALS[face];
      const [u, v] = faceBasis(face);
      for (const [px, py] of PIPS[face]) {
        const a = ((px - 50) / 100) * 0.86;
        const b = ((py - 50) / 100) * 0.86;
        items.push({
          position: n.clone().multiplyScalar(0.493).addScaledVector(u, a).addScaledVector(v, b),
          quaternion: new THREE.Quaternion().setFromUnitVectors(yAxis, n),
          radius: face === 1 ? 0.13 : 0.085,
        });
      }
    }
    return items;
  }, []);

  return (
    <group>
      <RoundedBox args={[1, 1, 1]} radius={0.06} smoothness={5} creaseAngle={0.5}>
        <MeshTransmissionMaterial
          // Fond lumineux derrière l'acétate : la lumière traverse le dé et le fait rougeoyer
          background={ACETATE_GLOW}
          color="#ff4a6a"
          attenuationColor="#e3173e"
          attenuationDistance={0.9}
          thickness={0.85}
          roughness={0.035}
          ior={1.49}
          chromaticAberration={0.06}
          anisotropicBlur={0.12}
          clearcoat={1}
          clearcoatRoughness={0.04}
          samples={6}
          resolution={512}
          transmission={1}
        />
      </RoundedBox>
      {/* Points : petits disques peints, visibles aussi par transparence */}
      {pips.map((pip, i) => (
        <mesh key={i} position={pip.position} quaternion={pip.quaternion}>
          <cylinderGeometry args={[pip.radius, pip.radius, 0.018, 32]} />
          <meshStandardMaterial color="#fbf9f4" roughness={0.35} emissive="#fbf9f4" emissiveIntensity={0.08} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Le tapis : feutre outremer dessiné par un shader (fibres, projecteur, ondes)
// ---------------------------------------------------------------------------

const feltVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const feltFragment = /* glsl */ `
  uniform float uTime;
  uniform vec4 uRipples[4];
  uniform float uFlash;
  uniform float uLoss;
  uniform vec2 uFlashPos;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    float r = length(p - vec2(0.15, -0.1));
    float spot = smoothstep(2.9, 0.0, r);

    vec3 lapis = vec3(0.027, 0.047, 0.169);
    vec3 felt = vec3(0.086, 0.188, 0.722);
    vec3 col = mix(lapis, felt, pow(spot, 1.5));
    col += vec3(0.25, 0.3, 0.45) * pow(spot, 6.0) * 0.35;

    // Fibres du feutre : deux bruits étirés dans des sens opposés
    float fibres = noise(p * vec2(140.0, 18.0)) * 0.5 + noise(p * vec2(20.0, 150.0)) * 0.5;
    col *= 0.88 + 0.22 * fibres;

    // Ondes de choc des rebonds
    for (int i = 0; i < 4; i++) {
      vec4 rp = uRipples[i];
      float age = uTime - rp.z;
      if (age > 0.0 && age < 1.3) {
        float d = length(p - rp.xy);
        float ring = exp(-pow((d - age * 2.4) * 10.0, 2.0)) * (1.0 - age / 1.3) * rp.w;
        col += vec3(0.62, 0.69, 1.0) * ring * 0.6;
      }
    }

    // Victoire : une vague rubis part du dé
    float fd = length(p - uFlashPos);
    float wave = exp(-pow((fd - (1.0 - uFlash) * 5.5) * 2.6, 2.0)) * uFlash;
    col = mix(col, vec3(0.89, 0.09, 0.24), clamp(wave, 0.0, 1.0) * 0.85);
    col += vec3(0.9, 0.12, 0.3) * uFlash * 0.12 * spot;

    // Défaite : le tapis se ternit un instant
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(g) * 0.7, uLoss * 0.75);

    // Le tapis se fond dans la page avant d'atteindre les bords de l'image
    float alpha = smoothstep(2.5, 0.7, r);
    gl_FragColor = vec4(col, alpha);
  }
`;

function Felt({ materialRef }: { materialRef: React.RefObject<THREE.ShaderMaterial | null> }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRipples: { value: [0, 1, 2, 3].map(() => NO_RIPPLE.clone()) },
      uFlash: { value: 0 },
      uLoss: { value: 0 },
      uFlashPos: { value: new THREE.Vector2() },
    }),
    [],
  );
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
      <planeGeometry args={[14, 14]} />
      <shaderMaterial ref={materialRef} vertexShader={feltVertex} fragmentShader={feltFragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Jetons de victoire : 40 jetons projetés depuis le dé (un seul objet instancié)
// ---------------------------------------------------------------------------

type ChipsHandle = { burst: (from: THREE.Vector3) => void };
const CHIP_COUNT = 40;
const CHIP_COLORS = ["#E3173E", "#EFEADF", "#3A54E6", "#E3173E", "#EFEADF"];

function Chips({ ref }: { ref: React.Ref<ChipsHandle> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const state = useRef(
    Array.from({ length: CHIP_COUNT }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      spin: new THREE.Vector3(),
      life: 0,
    })),
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Couleur de chaque jeton (une fois)
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    for (let i = 0; i < CHIP_COUNT; i++) m.setColorAt(i, c.set(CHIP_COLORS[i % CHIP_COLORS.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  // API exposée au parent : lancer une gerbe de jetons
  const handle = useMemo<ChipsHandle>(
    () => ({
      burst(from) {
        for (const chip of state.current) {
          chip.pos.copy(from);
          const a = Math.random() * Math.PI * 2;
          const sp = rand(1.5, 4.2);
          chip.vel.set(Math.cos(a) * sp, rand(5, 9), Math.sin(a) * sp * 0.6);
          chip.rot.set(rand(0, 6), rand(0, 6), rand(0, 6));
          chip.spin.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
          chip.life = rand(2.2, 2.9);
        }
      },
    }),
    [],
  );
  useEffect(() => {
    if (typeof ref === "function") ref(handle);
    else if (ref) (ref as React.RefObject<ChipsHandle>).current = handle;
  }, [ref, handle]);

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 1 / 30);
    state.current.forEach((chip, i) => {
      if (chip.life > 0) {
        chip.life -= dt;
        chip.vel.y -= GRAVITY * 0.7 * dt;
        chip.pos.addScaledVector(chip.vel, dt);
        if (chip.pos.y < 0.03) {
          chip.pos.y = 0.03;
          chip.vel.y *= -0.3;
          chip.vel.x *= 0.6;
          chip.vel.z *= 0.6;
          chip.spin.multiplyScalar(0.5);
        }
        chip.rot.x += chip.spin.x * dt;
        chip.rot.y += chip.spin.y * dt;
        chip.rot.z += chip.spin.z * dt;
      }
      const scale = chip.life > 0 ? Math.min(1, chip.life / 0.4) : 0;
      dummy.position.copy(chip.pos);
      dummy.rotation.copy(chip.rot);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CHIP_COUNT]} frustumCulled={false}>
      <cylinderGeometry args={[0.16, 0.16, 0.04, 28]} />
      <meshStandardMaterial roughness={0.3} metalness={0.1} />
    </instancedMesh>
  );
}
