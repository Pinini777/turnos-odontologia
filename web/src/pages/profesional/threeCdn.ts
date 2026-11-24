// shortcut: Three.js 0.170.0 se carga dinámicamente desde esm.sh CDN en runtime (sin modificar package.json ni web/index.html, con fallback automático a OdontogramaFdiSvg cuando falta WebGL 2 o conexión); migrar a dependencia local si se requiere vista 3D 100% offline.

export interface ThreeVector2 {
  x: number;
  y: number;
}

export interface ThreeVector3 {
  x: number;
  y: number;
  z: number;
  clone(): ThreeVector3;
  copy(v: ThreeVector3): ThreeVector3;
  normalize(): ThreeVector3;
  negate(): ThreeVector3;
  addScaledVector(v: ThreeVector3, s: number): ThreeVector3;
  lerpVectors(a: ThreeVector3, b: ThreeVector3, alpha: number): ThreeVector3;
  set(x: number, y: number, z: number): ThreeVector3;
  setScalar(s: number): ThreeVector3;
}

export interface ThreeEuler {
  x: number;
  y: number;
  z: number;
}

export interface ThreeQuaternion {
  setFromAxisAngle(axis: ThreeVector3, angle: number): ThreeQuaternion;
  multiply(q: ThreeQuaternion): ThreeQuaternion;
}

export interface ThreeBufferAttribute {
  readonly count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
  setX(index: number, value: number): ThreeBufferAttribute;
  setZ(index: number, value: number): ThreeBufferAttribute;
}

export interface ThreeGeometryGroup {
  readonly start: number;
  readonly count: number;
  readonly materialIndex?: number;
}

export interface ThreeBufferGeometry {
  readonly attributes: { readonly position?: ThreeBufferAttribute };
  readonly groups: readonly ThreeGeometryGroup[];
  setAttribute(name: string, attribute: ThreeBufferAttribute): ThreeBufferGeometry;
  setIndex(index: number[]): ThreeBufferGeometry;
  addGroup(start: number, count: number, materialIndex?: number): void;
  computeVertexNormals(): void;
  computeBoundingSphere(): void;
  setFromPoints(points: readonly ThreeVector3[]): ThreeBufferGeometry;
  dispose(): void;
}

export interface ThreeShader {
  fragmentShader: string;
}

export interface ThreeMaterial {
  opacity: number;
  transparent: boolean;
  dispose(): void;
}

export interface ThreeMeshPhysicalMaterial extends ThreeMaterial {
  onBeforeCompile?: (shader: ThreeShader) => void;
}

export interface ThreeTexture {
  colorSpace: string;
  dispose(): void;
}

export interface ThreeObject3D {
  visible: boolean;
  renderOrder: number;
  readonly position: ThreeVector3;
  readonly rotation: ThreeEuler;
  readonly quaternion: ThreeQuaternion;
  readonly scale: ThreeVector3;
  readonly userData: Record<string, unknown>;
  add(object: ThreeObject3D): ThreeObject3D;
  remove(object: ThreeObject3D): ThreeObject3D;
  updateMatrixWorld(force?: boolean): void;
}

export interface ThreeGroup extends ThreeObject3D {
  readonly isGroup?: boolean;
}

export interface ThreeMesh extends ThreeObject3D {
  readonly geometry: ThreeBufferGeometry;
  material: ThreeMaterial;
}

export interface ThreeLine extends ThreeObject3D {
  readonly geometry: ThreeBufferGeometry;
  material: ThreeMaterial;
}

export interface ThreeCamera extends ThreeObject3D {
  aspect: number;
  lookAt(x: number, y: number, z: number): void;
  updateProjectionMatrix(): void;
}

export interface ThreeScene extends ThreeObject3D {
  environment: ThreeTexture | null;
  environmentIntensity: number;
}

export interface ThreeWebGLRenderTarget {
  readonly texture: ThreeTexture;
  dispose(): void;
}

export interface ThreePMREMGenerator {
  fromScene(scene: ThreeScene, sigma?: number): ThreeWebGLRenderTarget;
  dispose(): void;
}

export interface ThreeWebGLRenderer {
  toneMapping: number;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: ThreeScene, camera: ThreeCamera): void;
  dispose(): void;
}

export interface ThreeIntersection {
  readonly point: ThreeVector3;
  readonly object: ThreeMesh;
  readonly faceIndex?: number | null;
}

export interface ThreeRaycaster {
  set(origin: ThreeVector3, direction: ThreeVector3): void;
  setFromCamera(coords: ThreeVector2, camera: ThreeCamera): void;
  intersectObject(object: ThreeObject3D, recursive?: boolean): ThreeIntersection[];
  intersectObjects(objects: readonly ThreeObject3D[], recursive?: boolean): ThreeIntersection[];
}

export interface ThreeOrbitControls {
  readonly target: ThreeVector3;
  enablePan: boolean;
  enableDamping: boolean;
  dampingFactor: number;
  rotateSpeed: number;
  zoomSpeed: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  minDistance: number;
  maxDistance: number;
  readonly touches: { ONE: number; TWO: number };
  update(): boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  dispose(): void;
}

export interface ThreeRoomEnvironment extends ThreeScene {
  dispose(): void;
}

export interface ThreeMaterialParams {
  readonly color?: number;
  readonly roughness?: number;
  readonly metalness?: number;
  readonly clearcoat?: number;
  readonly clearcoatRoughness?: number;
  readonly ior?: number;
  readonly envMapIntensity?: number;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly depthWrite?: boolean;
  readonly depthTest?: boolean;
  readonly toneMapped?: boolean;
  readonly side?: number;
  readonly polygonOffset?: boolean;
  readonly polygonOffsetFactor?: number;
  readonly map?: ThreeTexture;
}

export interface ThreeNamespace {
  readonly NeutralToneMapping: number;
  readonly DoubleSide: number;
  readonly BackSide: number;
  readonly SRGBColorSpace: string;
  readonly TOUCH: { readonly ROTATE: number; readonly DOLLY_PAN: number };
  readonly MathUtils: { clamp(value: number, min: number, max: number): number };
  readonly Vector2: new (x?: number, y?: number) => ThreeVector2;
  readonly Vector3: new (x?: number, y?: number, z?: number) => ThreeVector3;
  readonly Quaternion: new () => ThreeQuaternion;
  readonly BufferGeometry: new () => ThreeBufferGeometry;
  readonly Float32BufferAttribute: new (array: readonly number[], itemSize: number) => ThreeBufferAttribute;
  readonly LatheGeometry: new (points: readonly ThreeVector2[], segments?: number) => ThreeBufferGeometry;
  readonly CatmullRomCurve3: new (points: readonly ThreeVector3[]) => object;
  readonly TubeGeometry: new (
    path: object,
    tubularSegments?: number,
    radius?: number,
    radialSegments?: number,
  ) => ThreeBufferGeometry;
  readonly EdgesGeometry: new (geometry: ThreeBufferGeometry, thresholdAngle?: number) => ThreeBufferGeometry;
  readonly WireframeGeometry: new (geometry: ThreeBufferGeometry) => ThreeBufferGeometry;
  readonly PlaneGeometry: new (width: number, height: number) => ThreeBufferGeometry;
  readonly MeshPhysicalMaterial: new (params?: ThreeMaterialParams) => ThreeMeshPhysicalMaterial;
  readonly MeshBasicMaterial: new (params?: ThreeMaterialParams) => ThreeMaterial;
  readonly LineBasicMaterial: new (params?: ThreeMaterialParams) => ThreeMaterial;
  readonly Group: new () => ThreeGroup;
  readonly Mesh: new (geometry: ThreeBufferGeometry, material: ThreeMaterial) => ThreeMesh;
  readonly LineSegments: new (geometry: ThreeBufferGeometry, material: ThreeMaterial) => ThreeLine;
  readonly LineLoop: new (geometry: ThreeBufferGeometry, material: ThreeMaterial) => ThreeLine;
  readonly Scene: new () => ThreeScene;
  readonly PerspectiveCamera: new (
    fov?: number,
    aspect?: number,
    near?: number,
    far?: number,
  ) => ThreeCamera;
  readonly WebGLRenderer: new (params: {
    readonly canvas: HTMLCanvasElement;
    readonly context: WebGL2RenderingContext;
    readonly alpha?: boolean;
    readonly antialias?: boolean;
  }) => ThreeWebGLRenderer;
  readonly PMREMGenerator: new (renderer: ThreeWebGLRenderer) => ThreePMREMGenerator;
  readonly HemisphereLight: new (
    skyColor?: number,
    groundColor?: number,
    intensity?: number,
  ) => ThreeObject3D;
  readonly DirectionalLight: new (color?: number, intensity?: number) => ThreeObject3D;
  readonly CanvasTexture: new (canvas: HTMLCanvasElement) => ThreeTexture;
  readonly Raycaster: new () => ThreeRaycaster;
}

export type ThreeOrbitControlsCtor = new (
  camera: ThreeCamera,
  domElement: HTMLElement,
) => ThreeOrbitControls;

export type ThreeRoomEnvironmentCtor = new () => ThreeRoomEnvironment;

export interface ThreeModulos {
  readonly THREE: ThreeNamespace;
  readonly OrbitControls: ThreeOrbitControlsCtor;
  readonly RoomEnvironment: ThreeRoomEnvironmentCtor;
}

const URL_THREE = 'https://esm.sh/three@0.170.0';
const URL_ORBIT_CONTROLS =
  'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js?deps=three@0.170.0';
const URL_ROOM_ENVIRONMENT =
  'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js?deps=three@0.170.0';

let cacheModulos: Promise<ThreeModulos> | null = null;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

/**
 * Verifica de forma defensiva si el entorno soporta WebGL 2 sin arrojar excepciones ni ruido en jsdom.
 */
export function soportaWebGl2(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof window.WebGL2RenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!ctx) return false;
    const ext = ctx.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function cargarThreeCdn(): Promise<ThreeModulos> {
  if (cacheModulos) return cacheModulos;

  cacheModulos = Promise.all([
    import(/* @vite-ignore */ URL_THREE) as Promise<unknown>,
    import(/* @vite-ignore */ URL_ORBIT_CONTROLS) as Promise<unknown>,
    import(/* @vite-ignore */ URL_ROOM_ENVIRONMENT) as Promise<unknown>,
  ])
    .then(([threeMod, orbitMod, roomMod]) => {
      if (!esObjeto(threeMod) || !esObjeto(orbitMod) || !esObjeto(roomMod)) {
        throw new Error('Módulos Three.js inválidos');
      }
      if (typeof orbitMod.OrbitControls !== 'function' || typeof roomMod.RoomEnvironment !== 'function') {
        throw new Error('Complementos de Three.js no disponibles');
      }
      return {
        THREE: threeMod as unknown as ThreeNamespace,
        OrbitControls: orbitMod.OrbitControls as ThreeOrbitControlsCtor,
        RoomEnvironment: roomMod.RoomEnvironment as ThreeRoomEnvironmentCtor,
      };
    })
    .catch((err: unknown) => {
      cacheModulos = null;
      throw err;
    });

  return cacheModulos;
}
