import type { CaraPiezaApi } from './apiProfesional';
import type { EstadoVisualPieza } from './odontogramaFdi';
import {
  esPiezaIzquierda,
  esPiezaSuperior,
  esPiezaTemporaria,
  esPiezaVisibleEnDenticion,
  TODAS_LAS_PIEZAS_FDI,
  type TipoDenticion,
} from './odontogramaHistorial';
import type {
  ThreeBufferGeometry,
  ThreeGroup,
  ThreeLine,
  ThreeMaterial,
  ThreeMaterialParams,
  ThreeMesh,
  ThreeMeshPhysicalMaterial,
  ThreeModulos,
  ThreeVector3,
  ThreeWebGLRenderTarget,
} from './threeCdn';

export interface HoverPieza3d {
  readonly pieza: number;
  readonly x: number;
  readonly y: number;
}

export interface ClickArcada3d {
  readonly pieza: number;
  readonly cara: CaraPiezaApi;
}

export interface EstadoMotor3d {
  readonly mapaEstados: ReadonlyMap<number, EstadoVisualPieza>;
  readonly denticion: TipoDenticion;
  readonly piezaSeleccionada: number;
  readonly caraSeleccionada: CaraPiezaApi | '';
  readonly soloPiezaCompleta: boolean;
  readonly rayosX: boolean;
  readonly enfocada: boolean;
  readonly vista3dActiva: boolean;
  readonly flashPiezas?: ReadonlySet<number>;
}

export interface OpcionesMotor3d {
  readonly modulos: ThreeModulos;
  readonly canvasArcadas: HTMLCanvasElement;
  readonly canvasAislada: HTMLCanvasElement;
  readonly contenedorViewport: HTMLElement;
  readonly contenedorMini: HTMLElement;
  readonly contextoArcadas: WebGL2RenderingContext;
  readonly contextoAislada: WebGL2RenderingContext;
  readonly estadoInicial: EstadoMotor3d;
  readonly onHover: (hover: HoverPieza3d | null) => void;
  readonly onClickArcada: (click: ClickArcada3d) => void;
  readonly onClickAislada: (cara: CaraPiezaApi) => void;
  readonly onCambioMovimientoReducido?: (reducido: boolean) => void;
}

export interface InstanciaMotor3d {
  actualizarEstado(estado: EstadoMotor3d): void;
  enfocarPieza(pieza?: number, inmediato?: boolean): void;
  centrarArcadas(inmediato?: boolean): void;
  setGiroMini(activo: boolean): void;
  redimensionar(): void;
  dispose(): void;
}

type TipoPerfilDental =
  | 'central'
  | 'lateral'
  | 'canine'
  | 'premolar'
  | 'molarUpper'
  | 'molarLower'
  | 'wisdom'
  | 'milkMolar';

interface PerfilDental {
  readonly half: readonly [number, number];
  readonly height: number;
  readonly shape: number;
  readonly peak: number;
  readonly cusp: readonly (readonly [number, number, number, number])[];
  readonly roots: readonly (readonly [number, number, number])[];
}

interface MarcaGeometria {
  readonly caries: ThreeBufferGeometry;
  readonly filling: ThreeBufferGeometry;
  readonly rim: ThreeBufferGeometry;
}

interface ActivosPerfil {
  readonly crown: ThreeBufferGeometry;
  readonly marks: readonly MarcaGeometria[];
  readonly roots: readonly ThreeBufferGeometry[];
  readonly canals: readonly ThreeBufferGeometry[];
  readonly contour: ThreeBufferGeometry;
  readonly wire: ThreeBufferGeometry;
  readonly rootWires: readonly ThreeBufferGeometry[];
  readonly edge: ThreeBufferGeometry;
}

interface MarcaMeshes {
  readonly decay: ThreeMesh;
  readonly fill: ThreeMesh;
  readonly border: ThreeMesh;
}

interface ModeloPieza3d {
  readonly id: number;
  readonly group: ThreeGroup;
  readonly anatomy: ThreeGroup;
  readonly crown: ThreeMesh;
  readonly roots: readonly ThreeMesh[];
  readonly canals: readonly ThreeMesh[];
  readonly wire: ThreeLine;
  readonly rootWires: readonly ThreeLine[];
  readonly cover: ThreeGroup;
  readonly shell: ThreeMesh;
  readonly edge: ThreeLine;
  readonly pulse: ThreeLine;
  readonly silhouette: ThreeMesh;
  readonly outline: ThreeLine;
  readonly signal: ThreeLine;
  readonly marks: readonly MarcaMeshes[];
  readonly focusPatches: readonly ThreeMesh[];
  readonly isolated: boolean;
  readonly faceMap: readonly CaraPiezaApi[];
  base: ThreeVector3;
  contact?: ThreeMesh;
  flashAt: number;
  crownAt: number;
  prev: string;
  lift: number;
  eruptAt: number;
  present: boolean;
}

interface EstadoPuntero {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  moved: boolean;
  multiple: boolean;
  readonly mini: boolean;
}

interface VueloCamara {
  readonly a: ThreeVector3;
  readonly p: ThreeVector3;
  readonly b: ThreeVector3;
  readonly t: ThreeVector3;
  readonly start: number;
}

const RING_PROFILE: readonly (readonly [number, number])[] = [
  [0.62, -0.11],
  [0.77, -0.035],
  [0.88, 0.1],
  [0.98, 0.28],
  [1, 0.49],
  [0.98, 0.65],
  [0.94, 0.79],
  [0.79, 0.93],
  [0.6, 1],
  [0.38, 1.015],
  [0.19, 1.012],
  [0.001, 1.01],
];

const X_ADULT: readonly number[] = [0.465, 1.31, 2.14, 2.91, 3.58, 4.25, 4.82, 5.32];
const X_CHILD: readonly number[] = [0.355, 1.029, 1.72, 2.39, 2.99];

function ridge(peak: number): Pick<PerfilDental, 'peak' | 'cusp'> {
  return {
    peak,
    cusp: [
      [0, 0, 0.08, 0.52],
      [0.55, 0, 0.035, 0.34],
      [-0.55, 0, 0.04, 0.32],
    ],
  };
}

const PROFILES: Readonly<Record<TipoPerfilDental, PerfilDental>> = {
  central: { half: [0.444, 0.297], height: 0.91, shape: 3.2, ...ridge(0.89), roots: [[0.01, -0.09, 1.02]] },
  lateral: { half: [0.38, 0.302], height: 0.83, shape: 2.9, ...ridge(0.88), roots: [[0.03, -0.09, 0.94]] },
  canine: {
    half: [0.452, 0.368],
    height: 0.91,
    shape: 2.55,
    peak: 0.76,
    cusp: [[0, 0.17, 0.29, 0.41]],
    roots: [[0.04, -0.08, 1.24]],
  },
  premolar: {
    half: [0.465, 0.465],
    height: 0.7,
    shape: 2.62,
    peak: 0.86,
    cusp: [
      [-0.06, 0.48, 0.23, 0.35],
      [0.05, -0.43, 0.18, 0.36],
    ],
    roots: [
      [-0.13, 0.04, 1],
      [0.16, -0.08, 0.82],
    ],
  },
  molarUpper: {
    half: [0.561, 0.566],
    height: 0.686,
    shape: 2.72,
    peak: 0.84,
    cusp: [
      [-0.43, 0.44, 0.26, 0.34],
      [0.43, 0.44, 0.235, 0.36],
      [-0.44, -0.41, 0.225, 0.34],
      [0.42, -0.39, 0.185, 0.34],
    ],
    roots: [
      [-0.2, 0.22, 1.05],
      [0.24, 0.19, 0.95],
      [0.02, -0.28, 1.13],
    ],
  },
  molarLower: {
    half: [0.573, 0.517],
    height: 0.675,
    shape: 2.76,
    peak: 0.845,
    cusp: [
      [-0.49, 0.44, 0.22, 0.34],
      [0.42, 0.46, 0.21, 0.34],
      [-0.48, -0.43, 0.245, 0.34],
      [0.39, -0.43, 0.21, 0.34],
      [0.61, 0.04, 0.14, 0.28],
    ],
    roots: [
      [-0.25, 0.035, 1.1],
      [0.25, -0.06, 0.97],
    ],
  },
  wisdom: {
    half: [0.548, 0.51],
    height: 0.62,
    shape: 2.63,
    peak: 0.855,
    cusp: [
      [-0.44, 0.44, 0.22, 0.37],
      [0.45, 0.42, 0.16, 0.37],
      [-0.4, -0.35, 0.19, 0.37],
      [0.32, -0.4, 0.16, 0.34],
    ],
    roots: [
      [-0.18, 0.17, 0.86],
      [0.2, -0.16, 0.8],
    ],
  },
  milkMolar: {
    half: [0.525, 0.493],
    height: 0.66,
    shape: 2.82,
    peak: 0.84,
    cusp: [
      [-0.42, 0.39, 0.24, 0.35],
      [0.42, 0.42, 0.23, 0.35],
      [-0.44, -0.42, 0.22, 0.34],
      [0.42, -0.41, 0.2, 0.34],
    ],
    roots: [
      [-0.28, 0.12, 0.9],
      [0.27, -0.13, 0.91],
    ],
  },
};

function profileFor(id: number): TipoPerfilDental {
  const position = id % 10;
  if (position === 1) return 'central';
  if (position === 2) return 'lateral';
  if (position === 3) return 'canine';
  if (esPiezaTemporaria(id)) return 'milkMolar';
  if (position <= 5) return 'premolar';
  if (position === 8) return 'wisdom';
  return esPiezaSuperior(id) ? 'molarUpper' : 'molarLower';
}

function localFaces(id: number): readonly CaraPiezaApi[] {
  const plusIsMesial = esPiezaSuperior(id) === esPiezaIzquierda(id);
  return [
    'oclusal',
    plusIsMesial ? 'mesial' : 'distal',
    plusIsMesial ? 'distal' : 'mesial',
    'vestibular',
    'lingual',
  ];
}

function arc(x: number, child: boolean, mixed: boolean): number {
  return (child ? (mixed ? 3.14 : 3.73) : 4.42) - (child ? 0.234 : 0.181) * x * x;
}

function ease(n: number): number {
  return 1 - (1 - n) ** 3;
}

function uncap(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function crearMotorOdontograma3d(opciones: OpcionesMotor3d): InstanciaMotor3d {
  const {
    modulos: { THREE: T, OrbitControls, RoomEnvironment },
    canvasArcadas,
    canvasAislada,
    contenedorViewport,
    contenedorMini,
    contextoArcadas,
    contextoAislada,
    onHover,
    onClickArcada,
    onClickAislada,
    onCambioMovimientoReducido,
  } = opciones;

  let estado: EstadoMotor3d = opciones.estadoInicial;
  let destruido = false;

  const motionQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const reducedMotion = (): boolean => Boolean(motionQuery?.matches);

  const geometriasCreadas: ThreeBufferGeometry[] = [];
  const materialesCreados: ThreeMaterial[] = [];
  const renderTargetsCreados: ThreeWebGLRenderTarget[] = [];

  const trackGeo = <G extends ThreeBufferGeometry>(g: G): G => {
    geometriasCreadas.push(g);
    return g;
  };
  const trackMat = <M extends ThreeMaterial>(m: M): M => {
    materialesCreados.push(m);
    return m;
  };

  const v = (x = 0, y = 0, z = 0): ThreeVector3 => new T.Vector3(x, y, z);

  const makeRenderer = (target: HTMLCanvasElement, context: WebGL2RenderingContext) => {
    const renderer = new T.WebGLRenderer({ canvas: target, context, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = T.NeutralToneMapping;
    return renderer;
  };

  const main = makeRenderer(canvasArcadas, contextoArcadas);
  const mini = makeRenderer(canvasAislada, contextoAislada);
  const stage = new T.Scene();
  const preview = new T.Scene();

  const room = new RoomEnvironment();
  for (const [renderer, scene] of [
    [main, stage],
    [mini, preview],
  ] as const) {
    const generator = new T.PMREMGenerator(renderer);
    const rt = generator.fromScene(room, 0.024);
    renderTargetsCreados.push(rt);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.66;
    generator.dispose();
    scene.add(new T.HemisphereLight(0xf6fcff, 0xa78176, 1.1));
    const key = new T.DirectionalLight(0xfff8ee, 1.78);
    key.position.set(-5, 9, 6);
    scene.add(key);
    const fill = new T.DirectionalLight(0xd9f3ff, 0.82);
    fill.position.set(6, 3, -6);
    scene.add(fill);
  }
  room.dispose();

  const camera = new T.PerspectiveCamera(31, 1, 0.08, 80);
  const miniCamera = new T.PerspectiveCamera(29, 1, 0.05, 30);
  const homeTarget = v(1.26, 0.06, 1.57);
  const homeDirection = v(0.47, 0.28, 1).normalize();
  camera.position.copy(homeTarget).addScaledVector(homeDirection, 17.2);

  const controls = new OrbitControls(camera, canvasArcadas);
  controls.target.copy(homeTarget);
  controls.enablePan = false;
  controls.enableDamping = !reducedMotion();
  controls.dampingFactor = 0.14;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.69;
  controls.minPolarAngle = 0.67;
  controls.maxPolarAngle = 1.78;
  controls.minAzimuthAngle = -0.91;
  controls.maxAzimuthAngle = 0.91;
  controls.minDistance = 3.9;
  controls.maxDistance = 29;
  controls.touches.ONE = T.TOUCH.ROTATE;
  controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  controls.update();

  miniCamera.position.set(1.8, 1.94, 3.95);
  miniCamera.lookAt(0, -0.06, 0);

  const phys = (params: ThreeMaterialParams): ThreeMeshPhysicalMaterial =>
    trackMat(new T.MeshPhysicalMaterial(params));
  const basic = (params: ThreeMaterialParams): ThreeMaterial =>
    trackMat(new T.MeshBasicMaterial(params));

  const materialCache = new Map<string, ThreeMeshPhysicalMaterial>();
  function enamel(isChild: boolean, kind: 'solid' | 'xray' | 'endo' | 'faint' | 'faint-x'): ThreeMeshPhysicalMaterial {
    const key = `${String(isChild)}:${kind}`;
    const cached = materialCache.get(key);
    if (cached) return cached;

    const isX = kind === 'xray';
    const endo = kind === 'endo';
    const faint = kind === 'faint' || kind === 'faint-x';
    const material = phys({
      color: isX
        ? 0x89c2d2
        : endo
          ? 0xb2d7db
          : kind === 'faint-x'
            ? 0xa3cbd3
            : isChild
              ? 0xe5f0fa
              : 0xf6efdf,
      roughness: 0.36,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
      ior: 1.49,
      envMapIntensity: 0.72,
      transparent: isX || endo || faint,
      depthWrite: !isX && !endo && !faint,
      opacity: kind === 'faint-x' ? 0.13 : faint ? 0.27 : isX ? 0.71 : endo ? 0.62 : 1,
    });
    if (isX || endo) {
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          'diffuseColor.a *= 0.18 + 0.82 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.15);\n#include <opaque_fragment>',
        );
      };
    }
    materialCache.set(key, material);
    return material;
  }

  const rootMat = phys({ color: 0xe5caab, roughness: 0.58, envMapIntensity: 0.38 });
  const xRoot = phys({ color: 0x82adba, roughness: 0.32, transparent: true, opacity: 0.3, depthWrite: false });
  const faintRoot = phys({ color: 0xb3c4c6, roughness: 0.55, transparent: true, opacity: 0.18, depthWrite: false });
  const canalMat = basic({ color: 0x00a7b6, toneMapped: false });
  const treatedCanal = basic({ color: 0x00c9ca, toneMapped: false });
  const faintCanal = basic({ color: 0x00899b, transparent: true, opacity: 0.3, depthWrite: false });
  const ceramicMat = phys({ color: 0xf5e8cf, roughness: 0.17, clearcoat: 1, envMapIntensity: 1.14 });
  const ceramicEdge = trackMat(new T.LineBasicMaterial({ color: 0xb49c77, transparent: true, opacity: 0.85 }));
  const ghostMat = trackMat(new T.LineBasicMaterial({ color: 0x627f89, transparent: true, opacity: 0.5, depthWrite: false }));
  const faintGhost = trackMat(new T.LineBasicMaterial({ color: 0x627f89, transparent: true, opacity: 0.2, depthWrite: false }));
  const highlightMat = trackMat(new T.LineBasicMaterial({ color: 0x167f91, transparent: true, opacity: 0.82, depthWrite: false }));
  const restorationMat = phys({
    color: 0x7799a9,
    roughness: 0.18,
    clearcoat: 0.85,
    metalness: 0.16,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const restorationRim = phys({
    color: 0x456878,
    roughness: 0.45,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const decayMat = phys({
    color: 0x573225,
    roughness: 0.89,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const faintMark = basic({
    color: 0x657e83,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: T.DoubleSide,
  });

  const directions: readonly ThreeVector3[] = [v(0, 1, 0), v(1), v(-1), v(0, 0, 1), v(0, 0, -1)];

  function makeCrown(profile: PerfilDental, steps = 60, shouldTrack = true): ThreeBufferGeometry {
    const arrays: number[][] = Array.from({ length: 5 }, () => []);
    const points: number[] = [];
    const [width, depth] = profile.half;

    for (let j = 0; j < RING_PROFILE.length; j++) {
      const ring = RING_PROFILE[j];
      if (!ring) continue;
      const [radius, elevation] = ring;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const cx = Math.cos(angle);
        const cz = Math.sin(angle);
        const x = Math.sign(cx) * Math.abs(cx) ** (2 / profile.shape) * radius;
        const z = Math.sign(cz) * Math.abs(cz) ** (2 / profile.shape) * radius;
        const cusps = profile.cusp.reduce(
          (sum, [u, w, height, spread]) => sum + height * Math.exp(-((x - u) ** 2 + (z - w) ** 2) / spread ** 2),
          0,
        );
        const arch = 1 + 0.021 * Math.sin(3 * angle) + 0.015 * Math.cos(5 * angle + 0.4);
        const y = elevation * profile.height * (j < 5 ? 1 : profile.peak + cusps * Math.min(1, (j - 4) / 3));
        points.push(x * width * arch, y, z * depth * arch);
        if (j === RING_PROFILE.length - 1) continue;
        const theta = angle + Math.PI / steps;
        const u = Math.cos(theta);
        const w = Math.sin(theta);
        const surface = j >= 7 ? 0 : Math.abs(u) > Math.abs(w) ? (u > 0 ? 1 : 2) : w > 0 ? 3 : 4;
        const a = j * steps + i;
        const b = j * steps + ((i + 1) % steps);
        const c = a + steps;
        const d = b + steps;
        arrays[surface]?.push(a, c, d, a, d, b);
      }
    }

    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setIndex(arrays.flat());
    let offset = 0;
    for (let index = 0; index < arrays.length; index++) {
      const list = arrays[index] ?? [];
      geometry.addGroup(offset, list.length, index);
      offset += list.length;
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return shouldTrack ? trackGeo(geometry) : geometry;
  }

  function makeAssets(profile: PerfilDental): ActivosPerfil {
    const crown = makeCrown(profile);
    const ray = new T.Raycaster();
    const probeMat = new T.MeshBasicMaterial({ side: T.DoubleSide });
    const probe = new T.Mesh(crown, probeMat);

    const marks: MarcaGeometria[] = directions.map((normal, index) => {
      const u = normal.x ? v(0, 0, 1) : v(1);
      const w = normal.y ? v(0, 0, 1) : v(0, 1);
      const center = index ? v(0, profile.height * 0.49, 0) : v(0.025, 0, 0.028);

      const stamp = (damage: boolean, size: number): ThreeBufferGeometry => {
        const vertices: number[] = [];
        const indices: number[] = [];
        const segments = 32;
        const rings = 4;
        for (let ring = 0; ring <= rings; ring++) {
          for (let i = 0; i < segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            const radius = Math.max(0.001, ring / rings) * size;
            const edge = damage
              ? 1 + 0.19 * Math.sin(3 * a + 0.9) + 0.16 * Math.cos(5 * a) + 0.08 * Math.sin(9 * a)
              : 1 + 0.044 * Math.sin(4 * a);
            const p = center
              .clone()
              .addScaledVector(u, Math.cos(a) * radius * edge * (index ? 0.9 : 1.15))
              .addScaledVector(w, Math.sin(a) * radius * edge * (index ? 1.04 : 0.85));
            ray.set(p.clone().addScaledVector(normal, 2), normal.clone().negate());
            const hit = ray.intersectObject(probe, false)[0];
            if (hit) p.copy(hit.point).addScaledVector(normal, damage ? 0.012 : 0.017);
            vertices.push(p.x, p.y, p.z);
            if (ring === rings) continue;
            const j = ring * segments + i;
            const k = ring * segments + ((i + 1) % segments);
            indices.push(j, k, k + segments, j, k + segments, j + segments);
          }
        }
        const geometry = trackGeo(new T.BufferGeometry());
        geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
      };

      const size = index ? Math.min(0.145, profile.height * 0.19) : Math.min(0.205, profile.half[1] * 0.46);
      return { caries: stamp(true, size), filling: stamp(false, size), rim: stamp(false, size * 1.13) };
    });

    probeMat.dispose();

    const roots: ThreeBufferGeometry[] = [];
    const canals: ThreeBufferGeometry[] = [];
    for (const [dx, dz, len] of profile.roots) {
      const cross = profile.roots.length === 1 ? 0.225 : 0.164;
      const profile2d = [
        [0.009, -len],
        [0.069, -len * 0.93],
        [0.13, -len * 0.71],
        [0.19, -len * 0.38],
        [cross, -0.1],
        [cross * 0.94, 0.018],
      ].map(([radius, y]) => new T.Vector2(radius, y));
      const root = trackGeo(new T.LatheGeometry(profile2d, 18));
      const position = root.attributes.position;
      if (position) {
        for (let i = 0; i < position.count; i++) {
          const y = position.getY(i);
          const shift = Math.max(0, Math.min(1, -y / len));
          position.setX(i, position.getX(i) + dx * (0.52 + shift * 0.87) + shift ** 2 * 0.055);
          position.setZ(i, position.getZ(i) + dz * (0.52 + shift * 0.85) + shift ** 2 * 0.025);
        }
      }
      root.computeVertexNormals();
      roots.push(root);
      const line = new T.CatmullRomCurve3([
        v(dx * 0.27, 0.32, dz * 0.27),
        v(dx * 0.56, -0.05, dz * 0.55),
        v(dx * 0.93, -len * 0.54, dz * 0.97),
        v(dx * 1.35 + 0.05, -len * 0.94, dz * 1.34 + 0.02),
      ]);
      canals.push(trackGeo(new T.TubeGeometry(line, 13, 0.021, 7)));
    }

    const contour = trackGeo(new T.EdgesGeometry(crown, 29));
    const sparse = makeCrown(profile, 16, false);
    const wire = trackGeo(new T.WireframeGeometry(sparse));
    sparse.dispose();
    const rootWires = roots.map((geometry) => trackGeo(new T.WireframeGeometry(geometry)));
    const edgePoints = Array.from({ length: 44 }, (_, i) => {
      const angle = (i / 44) * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const power = 2 / profile.shape;
      return v(
        Math.sign(x) * Math.abs(x) ** power * profile.half[0] * 0.91,
        0.118,
        Math.sign(z) * Math.abs(z) ** power * profile.half[1] * 0.91,
      );
    });
    const edge = trackGeo(new T.BufferGeometry().setFromPoints(edgePoints));
    return { crown, marks, roots, canals, contour, wire, rootWires, edge };
  }

  const assets: Record<TipoPerfilDental, ActivosPerfil> = {
    central: makeAssets(PROFILES.central),
    lateral: makeAssets(PROFILES.lateral),
    canine: makeAssets(PROFILES.canine),
    premolar: makeAssets(PROFILES.premolar),
    molarUpper: makeAssets(PROFILES.molarUpper),
    molarLower: makeAssets(PROFILES.molarLower),
    wisdom: makeAssets(PROFILES.wisdom),
    milkMolar: makeAssets(PROFILES.milkMolar),
  };

  function model(id: number, isolated = false): ModeloPieza3d {
    const asset = assets[profileFor(id)];
    const group = new T.Group();
    const anatomy = new T.Group();
    group.add(anatomy);
    const add = <O extends ThreeMesh | ThreeLine>(mesh: O): O => {
      anatomy.add(mesh);
      return mesh;
    };

    const crown = add(new T.Mesh(asset.crown, enamel(esPiezaTemporaria(id), 'solid')));
    crown.renderOrder = 3;
    const roots = asset.roots.map((geometry) => add(new T.Mesh(geometry, rootMat)));
    const canals = asset.canals.map((geometry) => add(new T.Mesh(geometry, canalMat)));
    const wire = add(new T.LineSegments(asset.wire, ghostMat));
    wire.renderOrder = 4;
    const rootWires = asset.rootWires.map((geometry) => add(new T.LineSegments(geometry, ghostMat)));

    const cover = new T.Group();
    anatomy.add(cover);
    const shell = new T.Mesh(asset.crown, ceramicMat);
    shell.scale.set(1.028, 1.022, 1.028);
    cover.add(shell);
    const edge = new T.LineLoop(asset.edge, ceramicEdge);
    edge.scale.set(1.019, 1, 1.019);
    cover.add(edge);

    const red = trackMat(
      new T.LineBasicMaterial({ color: 0xb91c1c, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false }),
    );
    const pulse = add(new T.LineSegments(asset.contour, red));
    pulse.renderOrder = 6;
    const silhouette = add(
      new T.Mesh(
        asset.crown,
        basic({ color: 0xb91c1c, side: T.BackSide, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
      ),
    );
    silhouette.renderOrder = 6;

    const outline = add(new T.LineLoop(asset.edge, highlightMat));
    outline.scale.set(1.07, 1, 1.07);
    outline.renderOrder = 5;

    const flash = trackMat(
      new T.LineBasicMaterial({ color: 0x15998d, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
    );
    const signal = add(new T.LineSegments(asset.contour, flash));
    signal.scale.setScalar(1.045);
    signal.renderOrder = 7;

    const marks: MarcaMeshes[] = asset.marks.map(({ caries, filling, rim }) => {
      const decay = add(new T.Mesh(caries, decayMat));
      const fill = add(new T.Mesh(filling, restorationMat));
      const border = add(new T.Mesh(rim, restorationRim));
      decay.renderOrder = 5;
      border.renderOrder = 4;
      fill.renderOrder = 5;
      return { decay, fill, border };
    });

    const focusPatches = asset.marks.map(({ rim }) =>
      add(
        new T.Mesh(
          rim,
          basic({
            color: 0x1791a5,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
            side: T.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -3,
          }),
        ),
      ),
    );
    for (const patch of focusPatches) patch.renderOrder = 6;

    const result: ModeloPieza3d = {
      id,
      group,
      anatomy,
      crown,
      roots,
      canals,
      wire,
      rootWires,
      cover,
      shell,
      edge,
      pulse,
      silhouette,
      outline,
      signal,
      marks,
      focusPatches,
      isolated,
      faceMap: localFaces(id),
      base: v(),
      flashAt: 0,
      crownAt: 0,
      prev: '',
      lift: 0,
      eruptAt: 0,
      present: true,
    };
    crown.userData.tooth = result;
    return result;
  }

  function positionTooth(t: ModeloPieza3d, mixed = false): void {
    const child = esPiezaTemporaria(t.id);
    const isUpper = esPiezaSuperior(t.id);
    const sign = esPiezaIzquierda(t.id) ? 1 : -1;
    const index = (t.id % 10) - 1;
    const archScale = isUpper ? 1 : 0.935;
    const xBase = (child ? X_CHILD[index] : X_ADULT[index]) ?? 0.5;
    const x = sign * xBase * archScale * (mixed && child ? 0.92 : 1);
    const z = arc(x, child, mixed) + (isUpper ? 0 : -0.24);
    const y =
      (isUpper ? 1 : -1) * (1.25 - 0.09 * (1 - (x / 5.4) ** 2)) +
      (mixed && child ? (isUpper ? -0.44 : 0.17) : 0);
    t.base = v(x, y, z);
    t.group.position.copy(t.base);
    const yaw = Math.atan((child ? 0.468 : 0.362) * x);
    t.group.quaternion
      .setFromAxisAngle(v(0, 1), yaw)
      .multiply(new T.Quaternion().setFromAxisAngle(v(0, 0, 1), isUpper ? Math.PI : 0));
    const scale = (child ? 0.74 : 1) * archScale;
    t.group.scale.set(scale, scale, scale);
  }

  const teeth = new Map<number, ModeloPieza3d>(
    TODAS_LAS_PIEZAS_FDI.map((id) => {
      const tooth = model(id);
      positionTooth(tooth);
      stage.add(tooth.group);
      return [id, tooth] as const;
    }),
  );

  function gingiva(isUpper: boolean, child: boolean, mixed: boolean): ThreeMesh {
    const extent = child ? 3.28 * (mixed ? 0.92 : 1) : 5.61;
    const rows = 88;
    const sides = 24;
    const positions: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= rows; j++) {
      const x = ((j / rows) * 2 - 1) * extent * (isUpper ? 1 : 0.935);
      const z = arc(x, child, mixed) + (isUpper ? 0 : -0.24);
      const normal = v((child ? 0.468 : 0.362) * x, 0, 1).normalize();
      const sign = isUpper ? 1 : -1;
      const cap = Math.max(0.025, Math.min(1, Math.sin((Math.PI * j) / rows) * 11));
      const width = (mixed ? 0.36 : child ? 0.48 : 0.58) + 0.08 * (Math.abs(x) / extent);
      const middle = sign * (1.61 + (child ? -0.08 : 0) - (mixed ? (isUpper ? 0.44 : 0.17) : 0));
      for (let i = 0; i < sides; i++) {
        const t = (i / sides) * Math.PI * 2;
        const r = Math.cos(t) * width * cap;
        const scallop = 0.021 * Math.cos(6.8 * x) * (1 - Math.abs(Math.cos(t)));
        positions.push(
          x + r * normal.x,
          middle + (Math.sin(t) * (mixed ? 0.29 : child ? 0.38 : 0.44) + scallop) * cap,
          z + r * normal.z,
        );
        if (j === rows) continue;
        const a = j * sides + i;
        const b = j * sides + ((i + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = trackGeo(new T.BufferGeometry());
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = phys({
      color: isUpper ? 0xdfa1a2 : 0xd38e95,
      roughness: 0.56,
      clearcoat: 0.28,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: T.DoubleSide,
      envMapIntensity: 0.47,
    });
    const mesh = new T.Mesh(geometry, material);
    mesh.renderOrder = 2;
    stage.add(mesh);
    return mesh;
  }

  const gumAdult: readonly ThreeMesh[] = [gingiva(true, false, false), gingiva(false, false, false)];
  const gumChild: readonly ThreeMesh[] = [gingiva(true, true, false), gingiva(false, true, false)];
  const gumMixed: readonly ThreeMesh[] = [gingiva(true, true, true), gingiva(false, true, true)];

  const shade = document.createElement('canvas');
  shade.width = 128;
  shade.height = 128;
  const ink = shade.getContext('2d');
  if (ink) {
    const gradient = ink.createRadialGradient(64, 64, 4, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(44,68,71,.24)');
    gradient.addColorStop(0.42, 'rgba(75,99,102,.14)');
    gradient.addColorStop(1, 'rgba(75,99,102,0)');
    ink.fillStyle = gradient;
    ink.fillRect(0, 0, 128, 128);
  }
  const contact = new T.CanvasTexture(shade);
  contact.colorSpace = T.SRGBColorSpace;

  const shadowGeo = trackGeo(new T.PlaneGeometry(15, 10));
  const shadow = new T.Mesh(
    shadowGeo,
    basic({ map: contact, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.75 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.2, -2.21, 1.9);
  stage.add(shadow);

  const toothShadowGeo = trackGeo(new T.PlaneGeometry(0.98, 0.91));
  const toothShadowMat = basic({
    map: contact,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.45,
  });
  for (const tooth of teeth.values()) {
    const patch = new T.Mesh(toothShadowGeo, toothShadowMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = -0.018;
    tooth.group.add(patch);
    tooth.contact = patch;
  }

  let previewTooth: ModeloPieza3d | null = null;
  let hovered: number | null = null;
  let pointer: EstadoPuntero | null = null;
  let flight: VueloCamara | null = null;
  let raf = 0;
  let mainDirty = true;
  let miniDirty = true;
  let miniInView = true;
  let mainInView = true;
  let lastTime = 0;
  let spin = true;
  let spinAngle = -0.37;
  let mode: TipoDenticion = estado.denticion;
  let mainWasMoving = false;
  let miniWasMoving = false;
  const miniCache = new Map<number, ModeloPieza3d>();

  function style(tooth: ModeloPieza3d, now: number, animate = false): void {
    const { id, isolated, roots, canals, rootWires, marks, focusPatches } = tooth;
    const data = estado.mapaEstados.get(id);
    const full = data?.completa ?? '';
    const hide = full === 'ausente';
    const faint = !isolated && estado.enfocada && id !== estado.piezaSeleccionada;
    const seeInside = estado.rayosX || full === 'endodoncia';
    const kind = faint
      ? estado.rayosX
        ? 'faint-x'
        : 'faint'
      : estado.rayosX
        ? 'xray'
        : full === 'endodoncia'
          ? 'endo'
          : 'solid';

    tooth.crown.material = enamel(esPiezaTemporaria(id), kind);
    tooth.crown.visible = !hide && !(full === 'corona' && !faint && !estado.rayosX);
    tooth.wire.visible = hide;
    tooth.wire.material = faint ? faintGhost : ghostMat;
    for (const mesh of rootWires) {
      mesh.visible = hide && (isolated || estado.rayosX);
      mesh.material = faint ? faintGhost : ghostMat;
    }
    for (const mesh of roots) {
      mesh.visible = !hide && (isolated || seeInside);
      mesh.material = faint ? faintRoot : estado.rayosX || full === 'endodoncia' ? xRoot : rootMat;
    }
    for (const mesh of canals) {
      mesh.visible = !hide && seeInside;
      mesh.material = faint ? faintCanal : full === 'endodoncia' ? treatedCanal : canalMat;
    }

    tooth.cover.visible = full === 'corona' && !faint && !estado.rayosX;
    if (animate && tooth.prev !== full && tooth.cover.visible && !reducedMotion()) tooth.crownAt = now;
    if (!tooth.cover.visible || reducedMotion()) {
      tooth.crownAt = 0;
      tooth.cover.position.y = 0;
    }
    tooth.prev = full;

    tooth.pulse.visible = full === 'a_extraer';
    tooth.pulse.material.opacity = faint ? 0.29 : 0.91;
    tooth.silhouette.visible = tooth.pulse.visible && !faint && !estado.rayosX;
    tooth.outline.visible = !isolated && (id === hovered || (estado.enfocada && id === estado.piezaSeleccionada)) && !hide;

    for (let index = 0; index < marks.length; index++) {
      const mark = marks[index];
      const caraLocal = tooth.faceMap[index];
      const focusPatch = focusPatches[index];
      if (!mark || !caraLocal || !focusPatch) continue;
      const faceState = data?.caras[caraLocal];
      mark.decay.visible = faceState === 'caries';
      mark.decay.material = faint ? faintMark : decayMat;
      mark.fill.visible = faceState === 'obturado';
      mark.fill.material = faint ? faintMark : restorationMat;
      mark.border.visible = faceState === 'obturado' && !faint;
      focusPatch.visible =
        !hide &&
        !estado.soloPiezaCompleta &&
        (isolated || (estado.enfocada && id === estado.piezaSeleccionada)) &&
        estado.caraSeleccionada === caraLocal;
    }

    if (tooth.contact) tooth.contact.visible = !estado.rayosX && !hide && !faint;
  }

  function request(): void {
    if (!destruido && !raf && !document.hidden) {
      raf = requestAnimationFrame(frame);
    }
  }

  function updateVisuals(flash?: ReadonlySet<number>): void {
    const now = performance.now();
    for (const tooth of teeth.values()) {
      style(tooth, now, tooth.group.visible && tooth.id === estado.piezaSeleccionada);
      if (flash?.has(tooth.id) && !reducedMotion()) tooth.flashAt = now;
    }
    for (const gum of [...gumAdult, ...gumChild, ...gumMixed]) {
      gum.material.opacity = estado.rayosX
        ? 0.24
        : estado.enfocada
          ? 0.4
          : gumMixed.includes(gum)
            ? 0.54
            : 0.82;
    }
    if (previewTooth?.id !== estado.piezaSeleccionada) {
      if (previewTooth) preview.remove(previewTooth.group);
      let nextPreview = miniCache.get(estado.piezaSeleccionada);
      if (!nextPreview) {
        nextPreview = model(estado.piezaSeleccionada, true);
        miniCache.set(estado.piezaSeleccionada, nextPreview);
      }
      previewTooth = nextPreview;
      preview.add(previewTooth.group);
      spinAngle = -0.37;
      previewTooth.group.rotation.y = spinAngle;
      previewTooth.prev = estado.mapaEstados.get(estado.piezaSeleccionada)?.completa ?? '';
    }
    style(previewTooth, now, true);
    mainDirty = true;
    miniDirty = true;
    request();
  }

  function applyDentition(next: TipoDenticion, animate = true): void {
    const previous = mode;
    const now = performance.now();
    mode = next;
    for (const tooth of teeth.values()) {
      const isChild = esPiezaTemporaria(tooth.id);
      const was = esPiezaVisibleEnDenticion(tooth.id, previous);
      tooth.present = esPiezaVisibleEnDenticion(tooth.id, next);
      tooth.group.visible = tooth.present;
      positionTooth(tooth, next === 'mixta');
      tooth.eruptAt =
        animate && isChild && tooth.present && (!was || previous !== next) && !reducedMotion()
          ? now + (tooth.id % 10) * 24
          : 0;
      if (tooth.eruptAt) tooth.anatomy.position.y = -0.63;
    }
    for (const g of gumAdult) g.visible = next !== 'temporaria';
    for (const g of gumChild) g.visible = next === 'temporaria';
    for (const g of gumMixed) g.visible = next === 'mixta';
    hovered = null;
    onHover(null);
    mainDirty = true;
    request();
  }

  function homeDistance(): number {
    return Math.max(14.45, 24.25 / Math.max(0.85, camera.aspect));
  }

  function aim(id?: number, immediate = false): void {
    const tooth = id !== undefined ? teeth.get(id) : undefined;
    const target = tooth ? tooth.base.clone() : homeTarget.clone();
    const direction = tooth ? v(Math.sign(target.x) * 0.24, 0.2, 1).normalize() : homeDirection;
    const position = target
      .clone()
      .addScaledVector(direction, tooth ? (camera.aspect < 1.15 ? 5.25 : 4.75) : homeDistance());
    if (tooth && id !== undefined) target.y += esPiezaSuperior(id) ? -0.3 : 0.3;
    onHover(null);
    if (reducedMotion() || immediate || !estado.vista3dActiva) {
      flight = null;
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
    } else {
      flight = {
        a: camera.position.clone(),
        p: position,
        b: controls.target.clone(),
        t: target,
        start: performance.now(),
      };
    }
    mainDirty = true;
    request();
  }

  function sizeCanvas(
    renderer: { setSize(w: number, h: number, s?: boolean): void },
    cam: { aspect: number; updateProjectionMatrix(): void },
    element: HTMLCanvasElement,
  ): boolean {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return false;
    renderer.setSize(width, height, false);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    return true;
  }

  function resize(): void {
    if (destruido) return;
    if (sizeCanvas(main, camera, canvasArcadas) && !estado.enfocada && !flight) {
      aim(undefined, true);
    }
    sizeCanvas(mini, miniCamera, canvasAislada);
    mainDirty = true;
    miniDirty = true;
    request();
  }

  function animateTooth(tooth: ModeloPieza3d, now: number, step: number, animateLift: boolean): boolean {
    let changing = false;
    if (tooth.eruptAt || animateLift) {
      const progress = tooth.eruptAt ? uncap((now - tooth.eruptAt) / 510) : 1;
      if (progress === 1 || reducedMotion()) tooth.eruptAt = 0;
      const to = tooth.id === hovered && !reducedMotion() ? 0.13 : 0;
      tooth.lift += (to - tooth.lift) * (reducedMotion() ? 1 : Math.min(1, step * 13));
      if (Math.abs(to - tooth.lift) < 0.003) tooth.lift = to;
      if (reducedMotion()) tooth.lift = 0;
      tooth.anatomy.position.y = tooth.lift - (tooth.eruptAt ? 0.63 * (1 - ease(progress)) : 0);
      changing ||= Boolean(tooth.eruptAt) || tooth.lift !== to;
    }
    if (tooth.crownAt) {
      const p = uncap((now - tooth.crownAt) / 430);
      tooth.cover.position.y = reducedMotion() ? 0 : 0.36 * (1 - ease(p));
      if (p === 1 || reducedMotion()) tooth.crownAt = 0;
      else changing = true;
    }
    if (tooth.flashAt) {
      const p = uncap((now - tooth.flashAt) / 760);
      tooth.signal.material.opacity = reducedMotion()
        ? 0
        : (1 - p) * (0.54 + 0.38 * Math.sin(p * Math.PI * 4) ** 2);
      if (p === 1 || reducedMotion()) tooth.flashAt = 0;
      else changing = true;
    }
    tooth.signal.visible = Boolean(tooth.flashAt);
    if (
      tooth.pulse.visible &&
      !reducedMotion() &&
      (tooth.isolated || !estado.enfocada || tooth.id === estado.piezaSeleccionada)
    ) {
      const amplitude = 0.5 + 0.5 * Math.sin(now * 0.0032);
      tooth.pulse.scale.setScalar(1.012 + amplitude * 0.023);
      tooth.silhouette.scale.setScalar(1.024 + amplitude * 0.033);
      tooth.silhouette.material.opacity = 0.49 + amplitude * 0.42;
      tooth.pulse.material.opacity = 0.48 + amplitude * 0.43;
      changing = true;
    } else {
      tooth.pulse.scale.setScalar(1.013);
      tooth.silhouette.scale.setScalar(1.035);
    }
    return changing;
  }

  function frame(now: number): void {
    raf = 0;
    if (destruido) return;
    const step = Math.min(0.05, Math.max(0.012, (now - lastTime) / 1000));
    lastTime = now;
    let animateMain = false;
    let animateMini = false;

    if (estado.vista3dActiva && mainInView) {
      if (flight) {
        const current = flight;
        const p = reducedMotion() ? 1 : Math.min(1, (now - current.start) / 490);
        camera.position.lerpVectors(current.a, current.p, ease(p));
        controls.target.lerpVectors(current.b, current.t, ease(p));
        if (p === 1) flight = null;
        mainDirty = true;
        animateMain = Boolean(flight);
      }
      controls.update();
      for (const tooth of teeth.values()) {
        if (tooth.group.visible) {
          const active = animateTooth(tooth, now, step, true);
          animateMain ||= active;
        }
      }
      if (mainDirty || animateMain || mainWasMoving) main.render(stage, camera);
      mainWasMoving = animateMain;
      mainDirty = false;
    }

    if (previewTooth && miniInView) {
      if (spin && !reducedMotion()) {
        if (!pointer?.mini) spinAngle += step * 0.56;
        previewTooth.group.rotation.y = spinAngle;
        animateMini = true;
      }
      animateMini = animateTooth(previewTooth, now, step, false) || animateMini;
      if (miniDirty || animateMini || miniWasMoving) mini.render(preview, miniCamera);
      miniWasMoving = animateMini;
      miniDirty = false;
    }

    if (animateMain || animateMini) request();
  }

  const ray = new T.Raycaster();
  function hit(event: PointerEvent, isMini: boolean): ClickArcada3d | null {
    const target = isMini ? canvasAislada : canvasArcadas;
    const box = target.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const scene = isMini ? preview : stage;
    scene.updateMatrixWorld(true);
    ray.setFromCamera(
      new T.Vector2(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        1 - ((event.clientY - box.top) / box.height) * 2,
      ),
      isMini ? miniCamera : camera,
    );
    const list = isMini
      ? previewTooth
        ? [previewTooth.crown]
        : []
      : [...teeth.values()].filter((tooth) => tooth.group.visible).map((tooth) => tooth.crown);
    const result = ray.intersectObjects(list, false)[0];
    if (!result) return null;
    const tooth = result.object.userData.tooth as ModeloPieza3d | undefined;
    if (!tooth) return null;
    const triangle = (result.faceIndex ?? 0) * 3;
    const surface = result.object.geometry.groups.find(
      ({ start, count }) => triangle >= start && triangle < start + count,
    );
    const cara = tooth.faceMap[surface?.materialIndex ?? 0] ?? 'oclusal';
    return { pieza: tooth.id, cara };
  }

  function handleHover(event: PointerEvent): void {
    if (event.pointerType === 'touch' || pointer || flight) return;
    const result = hit(event, false);
    const id = result?.pieza ?? null;
    if (hovered !== id) {
      hovered = id;
      updateVisuals();
    }
    if (id !== null) {
      const box = contenedorViewport.getBoundingClientRect();
      onHover({
        pieza: id,
        x: T.MathUtils.clamp(event.clientX - box.left, 70, Math.max(70, box.width - 70)),
        y: Math.max(46, event.clientY - box.top - 12),
      });
    } else {
      onHover(null);
    }
  }

  const cleanups: (() => void)[] = [];

  function installPointer(target: HTMLCanvasElement, isMini: boolean): void {
    const onDown = (event: PointerEvent) => {
      if (pointer) {
        pointer.multiple = true;
        return;
      }
      if (event.button !== 0) return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        multiple: false,
        mini: isMini,
      };
      onHover(null);
    };
    const onMove = (event: PointerEvent) => {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 7) {
        pointer.moved = true;
      }
      if (!isMini) handleHover(event);
    };
    const onUp = (event: PointerEvent) => {
      if (pointer?.id !== event.pointerId) return;
      const tap = !pointer.moved && !pointer.multiple;
      pointer = null;
      if (!tap) return;
      const result = hit(event, isMini);
      if (!result) return;
      if (isMini) onClickAislada(result.cara);
      else onClickArcada(result);
    };
    const onCancel = (event: PointerEvent) => {
      if (pointer?.id === event.pointerId) pointer = null;
    };
    const onLeave = () => {
      if (!isMini) {
        hovered = null;
        onHover(null);
        updateVisuals();
      }
    };

    target.addEventListener('pointerdown', onDown);
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onCancel);
    target.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onCancel);
      target.removeEventListener('pointerleave', onLeave);
    });
  }

  installPointer(canvasArcadas, false);
  installPointer(canvasAislada, true);

  const onControlsChange = () => {
    mainDirty = true;
    request();
  };
  const onControlsStart = () => {
    flight = null;
  };
  controls.addEventListener('change', onControlsChange);
  controls.addEventListener('start', onControlsStart);
  cleanups.push(() => {
    controls.removeEventListener('change', onControlsChange);
    controls.removeEventListener('start', onControlsStart);
  });

  const onWindowPointerUp = (event: PointerEvent) => {
    if (pointer?.id === event.pointerId) pointer = null;
  };
  window.addEventListener('pointerup', onWindowPointerUp);
  cleanups.push(() => window.removeEventListener('pointerup', onWindowPointerUp));

  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(contenedorViewport);
    resizeObserver.observe(contenedorMini);
    cleanups.push(() => resizeObserver.disconnect());
  }

  if (typeof IntersectionObserver !== 'undefined') {
    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === contenedorViewport) mainInView = entry.isIntersecting;
        else miniInView = entry.isIntersecting;
      }
      mainDirty = true;
      miniDirty = true;
      request();
    });
    intersectionObserver.observe(contenedorViewport);
    intersectionObserver.observe(contenedorMini);
    cleanups.push(() => intersectionObserver.disconnect());
  }

  const handleMotionChange = () => {
    controls.enableDamping = !reducedMotion();
    onCambioMovimientoReducido?.(reducedMotion());
    mainDirty = true;
    miniDirty = true;
    updateVisuals();
  };
  motionQuery?.addEventListener('change', handleMotionChange);
  cleanups.push(() => motionQuery?.removeEventListener('change', handleMotionChange));

  const handleVisibility = () => {
    if (!document.hidden) {
      mainDirty = true;
      miniDirty = true;
      request();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibility));

  applyDentition(estado.denticion, false);
  handleMotionChange();
  resize();

  return {
    actualizarEstado(siguiente: EstadoMotor3d) {
      const cambioDenticion = siguiente.denticion !== estado.denticion;
      const cambioVista = siguiente.vista3dActiva !== estado.vista3dActiva;
      estado = siguiente;
      if (cambioDenticion) {
        applyDentition(siguiente.denticion, true);
        aim(undefined, false);
      }
      if (cambioVista && siguiente.vista3dActiva) {
        resize();
      }
      updateVisuals(siguiente.flashPiezas);
    },
    enfocarPieza(pieza?: number, inmediato = false) {
      aim(pieza, inmediato);
    },
    centrarArcadas(inmediato = false) {
      aim(undefined, inmediato);
    },
    setGiroMini(activo: boolean) {
      spin = activo;
      miniDirty = true;
      request();
    },
    redimensionar() {
      resize();
    },
    dispose() {
      if (destruido) return;
      destruido = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      for (const fn of cleanups) fn();
      controls.dispose();
      contact.dispose();
      for (const rt of renderTargetsCreados) rt.dispose();
      for (const g of geometriasCreadas) g.dispose();
      for (const m of materialesCreados) m.dispose();
      main.dispose();
      mini.dispose();
    },
  };
}
