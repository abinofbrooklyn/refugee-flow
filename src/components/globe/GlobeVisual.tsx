import React, { useRef, useState, useEffect, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import * as THREE from 'three';
import mousetrap from 'mousetrap';

import GlobeTooltips from './GlobeTooltips';
import country_borderLine from '../../data/countries_states.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GlobeVisualHandle {
  animate: () => void;
  addData: (data: unknown[], opts: AddDataOpts) => void;
  transition: (currentIndex: number, cb?: () => void) => void;
  createPoints: (userData: unknown[]) => void;
  setTarget: (rot: [number, number], distance: number | null) => void;
  zoom: (delta: number) => void;
  // Properties accessed by GlobeContainer directly
  scaler: d3.ScaleLinear<number, number> | undefined;
  lastIndex: number;
  octree: OctreeStub;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  points: THREE.Mesh | undefined;
  opts: GlobeOpts;
}

export interface GlobeOpts {
  imgDir: string;
  colorFn: (x: number, criteria?: Record<string, unknown>) => THREE.Color;
  animated?: boolean;
  format?: string;
  name?: string;
}

interface AddDataOpts {
  animated: boolean;
  format: string;
  name: string;
}

interface OctreeStub {
  update: (cb?: () => void) => void;
  remove: (obj?: unknown) => void;
}

interface GlobeVisualProps {
  opts: GlobeOpts;
  rotatePause: boolean;
}

interface TooltipState {
  mv_show: boolean;
  mv_tooltips: unknown[];
  mv_position?: [number, number];
  tooltips_clicked_id: number;
  tooltips_clicked: boolean;
  tooltips_expendInfo: Array<{ id: unknown; notes: string; source: string }>;
}

// ---------------------------------------------------------------------------
// Shader definitions (moved outside component to avoid recreation)
// ---------------------------------------------------------------------------

const Shaders = {
  earth: {
    uniforms: {
      mapTexture: { type: 't', value: null as THREE.Texture | null },
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'varying vec2 vUv;',
      'void main() {',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        'vNormal = normalize( normalMatrix * normal );',
        'vUv = uv;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D mapTexture;',
      'varying vec3 vNormal;',
      'varying vec2 vUv;',
      'void main() {',
        'vec3 diffuse = texture2D( mapTexture, vUv ).xyz;',
        'float intensity = 1.02 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
        'vec3 atmosphere = vec3( 0.423, 0.423, 0.654 ) * pow( intensity, 3.0 );',
        'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
      '}',
    ].join('\n'),
  },
  atmosphere: {
    uniforms: {},
    vertexShader: [
      'varying vec3 vNormal;',
      'void main() {',
        'vNormal = normalize( normalMatrix * normal );',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vNormal;',
      'void main() {',
        'float intensity = pow( 0.75 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 14.0 );',
        'gl_FragColor = vec4( 0.254, 0.929, 0.721, 1.0 ) * intensity;',
      '}',
    ].join('\n'),
  },
};

// ---------------------------------------------------------------------------
// GlobeVisual
// ---------------------------------------------------------------------------

const GlobeVisual = React.forwardRef<GlobeVisualHandle, GlobeVisualProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // THREE.js object refs (mutable, not state — mutations don't need re-render)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null); // earth/atmosphere mesh (latest)
  const earthMeshRef = useRef<THREE.Mesh | null>(null); // earth mesh specifically (for lookAt)
  const pointRef = useRef<THREE.Mesh | null>(null); // prototype box geometry for addPoint
  const pointsRef = useRef<THREE.Mesh | undefined>(undefined); // rendered data points
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const raycasterMouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const tooltipsFeedbackRef = useRef<THREE.Mesh | null>(null);
  const globeRadiusRef = useRef<number>(200);

  // Base geometry for morph targets
  const baseGeometryRef = useRef<THREE.BufferGeometry | undefined>(undefined);
  const morphTargetNamesRef = useRef<string[]>([]);

  // Animation state refs
  const frameIdRef = useRef<number | null>(null);
  const rotatePauseRef = useRef<boolean>(props.rotatePause);
  const tooltipPauseRef = useRef<boolean>(false);
  const distanceRef = useRef<number>(100000);
  const distanceTargetRef = useRef<number>(100000);
  const curZoomSpeedRef = useRef<number>(0);
  const rotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetRef = useRef<{ x: number; y: number }>({ x: Math.PI * 3 / 2, y: Math.PI / 6.0 });
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseOnDownRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetOnDownRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overRendererRef = useRef<boolean>(false);
  const warIDRef = useRef<number | string>(0);
  const intersectedRef = useRef<THREE.Intersection | undefined>(undefined);
  const currentSelectedTimeFrameRef = useRef<number>(0);
  const lastIndexRef = useRef<number>(0);

  const PI_HALF = Math.PI / 2;
  const zoomSpeed = 50;

  // Scaler is set externally by GlobeContainer
  const scalerRef = useRef<d3.ScaleLinear<number, number> | undefined>(undefined);

  // opts ref (GlobeContainer mutates opts.colorFn directly)
  const optsRef = useRef<GlobeOpts>(props.opts);

  // Debounced raycast — stored as ref so cleanup can remove it
  const debouncedRaycastRef = useRef<ReturnType<typeof _.debounce> | null>(null);
  // Mouse over/out handlers stored for cleanup
  const onMouseOverHandlerRef = useRef<(() => void) | null>(null);
  const onMouseOutHandlerRef = useRef<(() => void) | null>(null);

  // Tooltip state
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    mv_show: false,
    mv_tooltips: Array(7).fill(0),
    tooltips_clicked_id: 0,
    tooltips_clicked: false,
    tooltips_expendInfo: [],
  });
  // Keep a ref to tooltipState for use inside event callbacks without stale closure
  const tooltipStateRef = useRef<TooltipState>(tooltipState);
  useEffect(() => {
    tooltipStateRef.current = tooltipState;
  }, [tooltipState]);

  // Keep rotatePause in sync with props
  useEffect(() => {
    rotatePauseRef.current = props.rotatePause;
  }, [props.rotatePause]);

  // ---------------------------------------------------------------------------
  // Internal methods (defined as stable refs so they can be used in useEffect)
  // ---------------------------------------------------------------------------

  const zoom = (delta: number): void => {
    distanceTargetRef.current -= delta;
    distanceTargetRef.current = distanceTargetRef.current > 945 ? 945 : distanceTargetRef.current;
    distanceTargetRef.current = distanceTargetRef.current < 380 ? 380 : distanceTargetRef.current;
  };

  const setTarget = (rot: [number, number], distance: number | null): void => {
    const convert = (n: number, start1: number, stop1: number, start2: number, stop2: number): number => {
      return (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
    };
    targetRef.current.x = rot[1] > 0
      ? convert(rot[1], 0, 180, -Math.PI * 1 / 2, Math.PI * 1 / 2)
      : convert(rot[1], -180, 0, Math.PI * 1 / 2, Math.PI * 3 / 2);
    targetRef.current.y = convert(rot[0], -85, 85, -1.5707963267948966, 1.5707963267948966);
    if (distance !== null) {
      distanceTargetRef.current = distance;
    }
  };

  const rotateGlobe = (deltaSeconds: number, cancel: boolean): void => {
    if (cancel) return;
    if (deltaSeconds > 0 && deltaSeconds < 1) {
      targetRef.current.x += 1 * deltaSeconds / -20;
      targetRef.current.y += 1 * deltaSeconds / -100;
    }
  };

  const animate = (): void => {
    rotateGlobe(2 / 1000, rotatePauseRef.current || tooltipPauseRef.current);
    frameIdRef.current = window.requestAnimationFrame(animate);

    zoom(curZoomSpeedRef.current);

    rotationRef.current.x += (targetRef.current.x - rotationRef.current.x) * 0.1;
    rotationRef.current.y += (targetRef.current.y - rotationRef.current.y) * 0.1;
    distanceRef.current += (distanceTargetRef.current - distanceRef.current) * 0.1;

    const cam = cameraRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const earthMesh = earthMeshRef.current;
    if (!cam || !renderer || !earthMesh) return;

    cam.position.x = distanceRef.current * Math.sin(rotationRef.current.x) * Math.cos(rotationRef.current.y);
    cam.position.y = distanceRef.current * Math.sin(rotationRef.current.y);
    cam.position.z = distanceRef.current * Math.cos(rotationRef.current.x) * Math.cos(rotationRef.current.y);
    cam.lookAt(earthMesh.position);
    cam.updateProjectionMatrix();

    renderer.render(scene, cam);
  };

  const tooltips_onexit = (): void => {
    tooltipStateRef.current.mv_show && setTooltipState(prev => ({ ...prev, mv_show: false }));
    tooltipPauseRef.current = false;
    setTooltipState(prev => ({
      ...prev,
      tooltips_clicked: false,
      tooltips_clicked_id: Math.random(),
    }));
    warIDRef.current = Math.random();
    if (tooltipsFeedbackRef.current) {
      tooltipsFeedbackRef.current.position.x = 0;
      tooltipsFeedbackRef.current.position.y = 0;
      tooltipsFeedbackRef.current.position.z = 0;
    }
    setTarget([-11.874010, 44.605859], 945);
  };

  const tooltips_expand = (): void => {
    const state = tooltipStateRef.current;
    if (state.mv_show && state.tooltips_clicked_id != warIDRef.current) {
      const url = `${window.location.protocol}//${window.location.host}/data/note/${warIDRef.current}`;
      fetch(new Request(url, { method: 'GET', cache: 'default' }))
        .then(res => res.json())
        .then((d: unknown) => {
          const noteData = Array.isArray(d) && d.length > 0
            ? d as Array<{ id: unknown; notes: string; source: string }>
            : [{ id: warIDRef.current, notes: 'No additional details available.', source: '' }];
          const mv_tooltips = tooltipStateRef.current.mv_tooltips;
          setTarget([mv_tooltips[5] as number, mv_tooltips[6] as number], 700);
          setTooltipState(prev => ({
            ...prev,
            mv_position: [(window.innerWidth * 0.75) * 0.75 - 400 / 1.5, window.innerHeight * 0.75 - 300 + 25 - 80],
            tooltips_clicked: true,
            tooltips_expendInfo: noteData,
            tooltips_clicked_id: noteData[0].id as number,
          }));
        })
        .catch(() => {
          const mv_tooltips = tooltipStateRef.current.mv_tooltips;
          setTarget([mv_tooltips[5] as number, mv_tooltips[6] as number], 700);
          setTooltipState(prev => ({
            ...prev,
            mv_position: [(window.innerWidth * 0.75) * 0.75 - 400 / 1.5, window.innerHeight * 0.75 - 300 + 25 - 80],
            tooltips_clicked: true,
            tooltips_expendInfo: [{ id: warIDRef.current, notes: 'Unable to load details.', source: '' }],
            tooltips_clicked_id: warIDRef.current as number,
          }));
        });
    }
  };

  // ---------------------------------------------------------------------------
  // Imperative handle — the contract used by GlobeContainer
  // ---------------------------------------------------------------------------

  useImperativeHandle(ref, () => ({
    animate,
    zoom,
    setTarget,
    transition(currentIndex: number, cb?: () => void): void {
      currentSelectedTimeFrameRef.current = currentIndex;
      const timer = d3.timer((e: number) => {
        const t = Math.min(1, (d3.easeCubicInOut as (t: number) => number)(e / 400));
        const pts = pointsRef.current;
        if (pts) {
          // @ts-expect-error -- morphTargetInfluences exists at runtime on THREE.Mesh with morph targets
          pts.morphTargetInfluences[lastIndexRef.current] = 1 - t;
          // @ts-expect-error -- morphTargetInfluences exists at runtime on THREE.Mesh with morph targets
          pts.morphTargetInfluences[currentIndex] = t;
        }
        if (t === 1) {
          timer.stop();
          lastIndexRef.current = currentIndex;
          cb && cb();
        }
      });
    },
    addData(data: unknown[], _opts: AddDataOpts): void {
      optsRef.current.animated = _opts.animated;
      optsRef.current.format = _opts.format || 'magnitude';
      optsRef.current.name = _opts.name;

      let step: number;
      let colorFnWrapper: (data: unknown[], i: number) => THREE.Color;

      if (optsRef.current.format === 'magnitude') {
        step = 3;
        colorFnWrapper = (d, i) => optsRef.current.colorFn(d[i + 2] as number);
      } else if (optsRef.current.format === 'legend') {
        step = 4;
        colorFnWrapper = (d, i) => optsRef.current.colorFn(
          (d[i + 3] as Record<string, number>).fat,
          d[i + 3] as Record<string, unknown>
        );
      } else {
        throw new Error('error: format not supported: ' + optsRef.current.format);
      }

      const pointCount = data.length / step;
      const vertsPerPoint = 24;
      const pt = pointRef.current;
      if (!pt) return;

      if (optsRef.current.animated) {
        if (baseGeometryRef.current === undefined) {
          const basePositions = new Float32Array(pointCount * vertsPerPoint * 3);
          const baseColors = new Float32Array(pointCount * vertsPerPoint * 3);
          let pointIdx = 0;
          for (let i = 0; i < data.length; i += step) {
            const lat = data[i] as number;
            const lng = data[i + 1] as number;
            const color = colorFnWrapper(data, i);
            addPointInternal(lat, lng, null, color, basePositions, baseColors, pointIdx, pt);
            pointIdx++;
          }
          const bg = new THREE.BufferGeometry();
          bg.setAttribute('position', new THREE.BufferAttribute(basePositions, 3));
          bg.setAttribute('color', new THREE.BufferAttribute(baseColors, 3));
          baseGeometryRef.current = bg;
          morphTargetNamesRef.current = [];
        }
      }

      const subPositions = new Float32Array(pointCount * vertsPerPoint * 3);
      const subColors = new Float32Array(pointCount * vertsPerPoint * 3);
      let pointIdx = 0;

      for (let i = 0; i < data.length; i += step) {
        const lat = data[i] as number;
        const lng = data[i + 1] as number;
        const color = colorFnWrapper(data, i);
        const size = (data[i + 2] as number) * 200;
        addPointInternal(lat, lng, size, color, subPositions, subColors, pointIdx, pt);
        pointIdx++;
      }

      const bg = baseGeometryRef.current!;
      if (optsRef.current.animated) {
        if (!bg.morphAttributes.position) {
          bg.morphAttributes.position = [];
        }
        bg.morphAttributes.position.push(new THREE.BufferAttribute(subPositions, 3));
        morphTargetNamesRef.current.push(optsRef.current.name!);
      } else {
        const newBg = new THREE.BufferGeometry();
        newBg.setAttribute('position', new THREE.BufferAttribute(subPositions, 3));
        newBg.setAttribute('color', new THREE.BufferAttribute(subColors, 3));
        baseGeometryRef.current = newBg;
      }
    },
    createPoints(userData: unknown[]): void {
      const bg = baseGeometryRef.current;
      if (bg !== undefined) {
        const morphCount = morphTargetNamesRef.current.length;
        if (morphCount >= 8) console.warn('maybe too many data?');

        const pts = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({
          color: 0xffffff,
          vertexColors: true,
        }));
        pts.userData = { userData };
        pointsRef.current = pts;
      }
      sceneRef.current.add(pointsRef.current!);
    },
    get scaler() { return scalerRef.current; },
    set scaler(v) { scalerRef.current = v; },
    get lastIndex() { return lastIndexRef.current; },
    set lastIndex(v) { lastIndexRef.current = v; },
    get octree(): OctreeStub {
      return {
        update: (cb?: () => void) => { if (cb) cb(); },
        remove: () => {},
      };
    },
    get scene() { return sceneRef.current; },
    get camera() { return cameraRef.current!; },
    get renderer() { return rendererRef.current!; },
    get points() { return pointsRef.current; },
    set points(v) { pointsRef.current = v; },
    get opts() { return optsRef.current; },
    set opts(v) { optsRef.current = v; },
  }), []);

  // ---------------------------------------------------------------------------
  // Helper: addPoint (internal — mirrors original addPoint method)
  // ---------------------------------------------------------------------------

  function addPointInternal(
    lat: number,
    lng: number,
    size: number | null,
    color: THREE.Color,
    positionsArray: Float32Array,
    colorsArray: Float32Array,
    pointIdx: number,
    pt: THREE.Mesh,
  ): void {
    const vertsPerPoint = 24;
    const posOffset = pointIdx * vertsPerPoint * 3;
    const colOffset = pointIdx * vertsPerPoint * 3;
    const globeRadius = globeRadiusRef.current;

    const phi = (90 - lat) * Math.PI / 180;
    const theta = (180 - lng) * Math.PI / 180;
    pt.position.x = globeRadius * Math.sin(phi) * Math.cos(theta);
    pt.position.y = globeRadius * Math.cos(phi);
    pt.position.z = globeRadius * Math.sin(phi) * Math.sin(theta);

    if (earthMeshRef.current) pt.lookAt(earthMeshRef.current.position);

    pt.scale.z = Math.max(size ?? 0, 0.1);
    pt.updateMatrix();

    for (let v = 0; v < vertsPerPoint; v++) {
      if (v >= 20 && v < 24) {
        colorsArray[colOffset + v * 3]     = 90 / 255;
        colorsArray[colOffset + v * 3 + 1] = 90 / 255;
        colorsArray[colOffset + v * 3 + 2] = 90 / 255;
      } else {
        colorsArray[colOffset + v * 3]     = color.r;
        colorsArray[colOffset + v * 3 + 1] = color.g;
        colorsArray[colOffset + v * 3 + 2] = color.b;
      }
    }

    const srcPositions = (pt.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < vertsPerPoint; v++) {
      const vx = srcPositions.getX(v);
      const vy = srcPositions.getY(v);
      const vz = srcPositions.getZ(v);
      const vec = new THREE.Vector3(vx, vy, vz).applyMatrix4(pt.matrix);
      positionsArray[posOffset + v * 3]     = vec.x;
      positionsArray[posOffset + v * 3 + 1] = vec.y;
      positionsArray[posOffset + v * 3 + 2] = vec.z;
    }
  }

  // ---------------------------------------------------------------------------
  // drawThreeGeo (closure-heavy helper — ported verbatim, typed)
  // ---------------------------------------------------------------------------

  function drawThreeGeo(
    json: Record<string, unknown>,
    radius: number,
    shape: string,
    materialOptions: THREE.LineBasicMaterialParameters,
    container: THREE.Mesh,
  ): void {
    const x_values: number[] = [];
    const y_values: number[] = [];
    const z_values: number[] = [];
    const euler = new THREE.Euler(0, -1.5708, 0, 'XYZ');
    const json_geom = createGeometryArray(json);
    const convertCoordinates = getConversionFunctionName(shape);
    let coordinate_array: number[][] = [];

    for (let geom_num = 0; geom_num < json_geom.length; geom_num++) {
      const geom = json_geom[geom_num] as Record<string, unknown>;
      if (geom.type === 'LineString') {
        coordinate_array = createCoordinateArray(geom.coordinates as number[][]);
        for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
          convertCoordinates(coordinate_array[point_num], radius);
        }
        drawLine(y_values, z_values, x_values, materialOptions);
      } else if (geom.type === 'Polygon') {
        const coords = geom.coordinates as number[][][];
        for (let segment_num = 0; segment_num < coords.length; segment_num++) {
          coordinate_array = createCoordinateArray(coords[segment_num]);
          for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
            convertCoordinates(coordinate_array[point_num], radius);
          }
          drawLine(y_values, z_values, x_values, materialOptions);
        }
      } else if (geom.type === 'MultiLineString' || geom.type === 'MultiPolygon') {
        const outer = geom.coordinates as number[][][][];
        for (let polygon_num = 0; polygon_num < outer.length; polygon_num++) {
          const inner = geom.type === 'MultiPolygon' ? outer[polygon_num] : [outer[polygon_num] as unknown as number[][]];
          for (let segment_num = 0; segment_num < inner.length; segment_num++) {
            coordinate_array = createCoordinateArray(inner[segment_num]);
            for (let point_num = 0; point_num < coordinate_array.length; point_num++) {
              convertCoordinates(coordinate_array[point_num], radius);
            }
            drawLine(y_values, z_values, x_values, materialOptions);
          }
        }
      } else {
        throw new Error('The geoJSON is not valid.');
      }
    }

    function createGeometryArray(json: Record<string, unknown>): unknown[] {
      const geometry_array: unknown[] = [];
      if (json.type === 'Feature') {
        geometry_array.push(json.geometry);
      } else if (json.type === 'FeatureCollection') {
        const features = json.features as Array<{ geometry: unknown }>;
        for (let feature_num = 0; feature_num < features.length; feature_num++) {
          geometry_array.push(features[feature_num].geometry);
        }
      } else if (json.type === 'GeometryCollection') {
        const geometries = json.geometries as unknown[];
        for (let geom_num = 0; geom_num < geometries.length; geom_num++) {
          geometry_array.push(geometries[geom_num]);
        }
      } else {
        throw new Error('The geoJSON is not valid.');
      }
      return geometry_array;
    }

    function getConversionFunctionName(shape: string): (coords: number[], radius: number) => void {
      if (shape === 'sphere') return convertToSphereCoords;
      throw new Error('The shape that you specified is not valid.');
    }

    function createCoordinateArray(feature: number[][]): number[][] {
      const temp_array: number[][] = [];
      for (let point_num = 0; point_num < feature.length; point_num++) {
        const point1 = feature[point_num];
        const point2 = feature[point_num - 1];
        if (point_num > 0) {
          if (needsInterpolation(point2, point1)) {
            let interp_array: number[][] = [point2, point1];
            interp_array = interpolatePoints(interp_array);
            for (let inter_point_num = 0; inter_point_num < interp_array.length; inter_point_num++) {
              temp_array.push(interp_array[inter_point_num]);
            }
          } else {
            temp_array.push(point1);
          }
        } else {
          temp_array.push(point1);
        }
      }
      return temp_array;
    }

    function needsInterpolation(point2: number[], point1: number[]): boolean {
      return Math.abs(point1[0] - point2[0]) > 5 || Math.abs(point1[1] - point2[1]) > 5;
    }

    function interpolatePoints(interpolation_array: number[][]): number[][] {
      const temp_array: number[][] = [];
      for (let point_num = 0; point_num < interpolation_array.length - 1; point_num++) {
        const point1 = interpolation_array[point_num];
        const point2 = interpolation_array[point_num + 1];
        if (needsInterpolation(point2, point1)) {
          temp_array.push(point1);
          temp_array.push(getMidpoint(point1, point2));
        } else {
          temp_array.push(point1);
        }
      }
      temp_array.push(interpolation_array[interpolation_array.length - 1]);
      if (temp_array.length > interpolation_array.length) {
        return interpolatePoints(temp_array);
      }
      return temp_array;
    }

    function getMidpoint(point1: number[], point2: number[]): number[] {
      return [(point1[0] + point2[0]) / 2, (point1[1] + point2[1]) / 2];
    }

    function convertToSphereCoords(coordinates_array: number[], sphere_radius: number): void {
      const lon = coordinates_array[0];
      const lat = coordinates_array[1];
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (180 - lon) * Math.PI / 180;
      x_values.push(Math.sin(phi) * Math.cos(theta) * sphere_radius);
      y_values.push(Math.sin(phi) * Math.sin(theta) * sphere_radius * -1);
      z_values.push(Math.cos(phi) * sphere_radius);
    }

    function drawLine(x_values: number[], y_values: number[], z_values: number[], options: THREE.LineBasicMaterialParameters): void {
      const positions = new Float32Array(x_values.length * 3);
      for (let i = 0; i < x_values.length; i++) {
        const v = new THREE.Vector3(x_values[i], y_values[i], z_values[i]).applyEuler(euler);
        positions[i * 3]     = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
      }
      const line_geom = new THREE.BufferGeometry();
      line_geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line_material = new THREE.LineBasicMaterial(options);
      const line = new THREE.Line(line_geom, line_material);
      container.add(line);
      x_values.length = 0;
      y_values.length = 0;
      z_values.length = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Raycast listener
  // ---------------------------------------------------------------------------

  function raycast_listener(event: MouseEvent): void {
    event.preventDefault();
    const renderer = rendererRef.current;
    if (!renderer || !cameraRef.current) return;

    const rect = renderer.domElement.getBoundingClientRect();
    raycasterMouseRef.current.x = ((event.clientX - rect.left) / (rect.width - rect.left)) * 2 - 1;
    raycasterMouseRef.current.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    raycasterRef.current.setFromCamera(raycasterMouseRef.current, cameraRef.current);

    const pts = pointsRef.current;
    const intersections = pts ? raycasterRef.current.intersectObject(pts) : [];
    const state = tooltipStateRef.current;

    if (intersections.length > 0) {
      intersectedRef.current = intersections[0];
      const dataIndex = Math.floor(intersectedRef.current.face!.a / 24);
      const currentFrame = currentSelectedTimeFrameRef.current;
      const displayData = (pts!.userData.userData as unknown[][])[currentFrame][1] as unknown[];
      const d = displayData[dataIndex * 4 + 3] as { id: number; cot: string[]; fat: number; evt: number; int: number };

      if (warIDRef.current !== d.id && !state.tooltips_clicked) {
        setTooltipState(prev => ({
          ...prev,
          tooltips_clicked: false,
          mv_position: [event.clientX, event.clientY],
          mv_show: true,
          mv_tooltips: [
            d.id,
            d.cot,
            Math.round(scalerRef.current ? scalerRef.current.invert(d.fat) : d.fat),
            d.evt,
            d.int,
            displayData[dataIndex * 4 + 0],
            displayData[dataIndex * 4 + 1],
          ],
        }));
        warIDRef.current = d.id;
        tooltipPauseRef.current = true;
      }

      const heightVal = (displayData[dataIndex * 4 + 2] as number);
      const feedback = tooltipsFeedbackRef.current;
      const earthMesh = earthMeshRef.current;
      if (heightVal >= 0 && !state.tooltips_clicked && feedback && earthMesh) {
        const phi = (90 - (displayData[dataIndex * 4 + 0] as number)) * Math.PI / 180;
        const theta = (180 - (displayData[dataIndex * 4 + 1] as number)) * Math.PI / 180;
        feedback.position.x = 200 * Math.sin(phi) * Math.cos(theta);
        feedback.position.y = 200 * Math.cos(phi);
        feedback.position.z = 200 * Math.sin(phi) * Math.sin(theta);
        feedback.lookAt(earthMesh.position);
        feedback.scale.z = Math.max(heightVal * 200, 0.1);
      }
    } else if (intersectedRef.current && !state.tooltips_clicked) {
      state.mv_show && setTooltipState(prev => ({ ...prev, mv_show: false }));
      tooltipPauseRef.current = false;
      setTooltipState(prev => ({
        ...prev,
        tooltips_clicked: false,
        tooltips_clicked_id: Math.random(),
      }));
      warIDRef.current = Math.random();

      const feedback = tooltipsFeedbackRef.current;
      if (feedback) {
        feedback.position.x = 0;
        feedback.position.y = 0;
        feedback.position.z = 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Mouse event handlers
  // ---------------------------------------------------------------------------

  function onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const mount = mountRef.current;
    if (!mount) return;
    mount.addEventListener('mousemove', onMouseMove as EventListener, false);
    mount.addEventListener('mouseup', onMouseUp as EventListener, false);
    mount.addEventListener('mouseout', onMouseOut as EventListener, false);
    mouseOnDownRef.current.x = -event.clientX;
    mouseOnDownRef.current.y = event.clientY;
    targetOnDownRef.current.x = targetRef.current.x;
    targetOnDownRef.current.y = targetRef.current.y;
    mount.style.cursor = 'move';
    tooltips_expand();
  }

  function onMouseMove(event: MouseEvent): void {
    mouseRef.current.x = -event.clientX;
    mouseRef.current.y = event.clientY;
    const zoomDamp = distanceRef.current / 1000;
    targetRef.current.x = targetOnDownRef.current.x + (mouseRef.current.x - mouseOnDownRef.current.x) * 0.005 * zoomDamp;
    targetRef.current.y = targetOnDownRef.current.y + (mouseRef.current.y - mouseOnDownRef.current.y) * 0.005 * zoomDamp;
    targetRef.current.y = targetRef.current.y > PI_HALF ? PI_HALF : targetRef.current.y;
    targetRef.current.y = targetRef.current.y < -PI_HALF ? -PI_HALF : targetRef.current.y;
  }

  function onMouseUp(event: MouseEvent): void {
    const mount = mountRef.current;
    if (!mount) return;
    mount.removeEventListener('mousemove', onMouseMove as EventListener, false);
    mount.removeEventListener('mouseup', onMouseUp as EventListener, false);
    mount.removeEventListener('mouseout', onMouseOut as EventListener, false);
    mount.style.cursor = 'auto';
  }

  function onMouseOut(event: MouseEvent): void {
    const mount = mountRef.current;
    if (!mount) return;
    mount.removeEventListener('mousemove', onMouseMove as EventListener, false);
    mount.removeEventListener('mouseup', onMouseUp as EventListener, false);
    mount.removeEventListener('mouseout', onMouseOut as EventListener, false);
  }

  function onMouseWheel(event: Event): boolean {
    event.preventDefault();
    const we = event as WheelEvent & { wheelDeltaY?: number };
    if (overRendererRef.current) zoom((we.wheelDeltaY ?? 0) * 0.3);
    return false;
  }

  function onDocumentKeyDown(event: KeyboardEvent): void {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }
  }

  function onWindowResize(): void {
    const mount = mountRef.current;
    const cam = cameraRef.current;
    const renderer = rendererRef.current;
    if (!mount || !cam || !renderer) return;
    cam.aspect = mount.offsetWidth / mount.offsetHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(mount.offsetWidth, mount.offsetHeight);
  }

  // ---------------------------------------------------------------------------
  // THREE.js initialization (componentDidMount equivalent)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.offsetWidth || window.innerWidth;
    const h = mount.offsetHeight || window.innerHeight;
    const globeRadius = globeRadiusRef.current;
    const opts = optsRef.current;

    const camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distanceRef.current;
    cameraRef.current = camera;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111116);
    sceneRef.current = scene;

    // Earth geometry
    const earthGeometry = new THREE.SphereGeometry(globeRadius, 100, 100);
    const earthShader = Shaders['earth'];
    const earthUniforms = THREE.UniformsUtils.clone(earthShader.uniforms);
    const earthTexture = new THREE.TextureLoader().load(opts.imgDir + 'world.jpg');
    earthTexture.colorSpace = THREE.LinearSRGBColorSpace;
    earthUniforms['mapTexture'].value = earthTexture;
    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: earthShader.vertexShader,
      fragmentShader: earthShader.fragmentShader,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.y = Math.PI;
    earthMesh.name = 'earth';
    earthMeshRef.current = earthMesh;

    drawThreeGeo(country_borderLine as unknown as Record<string, unknown>, globeRadius + 0.5, 'sphere', {
      color: 0x245454,
      transparent: true,
      linewidth: 1,
      opacity: 0.6,
    }, earthMesh);
    scene.add(earthMesh);

    // Atmosphere
    const atmShader = Shaders['atmosphere'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const atmUniforms = THREE.UniformsUtils.clone(atmShader.uniforms as any);
    const atmMaterial = new THREE.ShaderMaterial({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      uniforms: atmUniforms as any,
      vertexShader: atmShader.vertexShader,
      fragmentShader: atmShader.fragmentShader,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const atmMesh = new THREE.Mesh(earthGeometry, atmMaterial);
    atmMesh.scale.set(1.1, 1.1, 1.1);
    atmMesh.name = 'atmosphere';
    meshRef.current = atmMesh;
    scene.add(atmMesh);

    // Data point prototype geometry
    const boxGeometry = new THREE.BoxGeometry(0.75, 0.75, 1);
    boxGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5));
    const pointColors = new Float32Array(24 * 3);
    boxGeometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
    const pt = new THREE.Mesh(boxGeometry);
    pointRef.current = pt;

    // Raycaster
    raycasterRef.current = new THREE.Raycaster();
    raycasterMouseRef.current = new THREE.Vector2();

    // Tooltip mouseover feedback mesh
    const feedbackGeo = new THREE.BoxGeometry(2.5, 2.5, 1);
    feedbackGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5));
    const feedbackMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'float intensity = pow( 2.75 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 54.0 );',
          'gl_FragColor = vec4( 0.254, 0.929, 1., 1.0 ) * intensity;',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
    });
    const feedbackMesh = new THREE.Mesh(feedbackGeo, feedbackMat);
    feedbackMesh.name = 'raycast-mouseover';
    tooltipsFeedbackRef.current = feedbackMesh;
    scene.add(feedbackMesh);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setSize(w * 1.5, h * 1.5);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Debounced raycast
    const debouncedRaycast = _.debounce(raycast_listener as unknown as (...args: unknown[]) => unknown, 1000 / 65);
    debouncedRaycastRef.current = debouncedRaycast;
    mount.addEventListener('mousemove', debouncedRaycast as EventListener, false);

    // Mouse handlers
    const onMouseOverHandler = () => { overRendererRef.current = true; };
    const onMouseOutHandler = () => { overRendererRef.current = false; };
    onMouseOverHandlerRef.current = onMouseOverHandler;
    onMouseOutHandlerRef.current = onMouseOutHandler;

    mount.addEventListener('mousedown', onMouseDown as EventListener, false);
    mount.addEventListener('mousewheel', onMouseWheel as EventListener, false);
    mount.addEventListener('keydown', onDocumentKeyDown as EventListener, false);
    mount.addEventListener('mouseover', onMouseOverHandler, false);
    mount.addEventListener('mouseout', onMouseOutHandler, false);
    window.addEventListener('resize', onWindowResize, false);

    mousetrap.bind('esc', () => tooltipStateRef.current.tooltips_clicked && tooltips_onexit(), 'keyup');

    // Cleanup (componentWillUnmount equivalent)
    return () => {
      if (frameIdRef.current) {
        window.cancelAnimationFrame(frameIdRef.current);
      }
      if (debouncedRaycastRef.current) {
        mount.removeEventListener('mousemove', debouncedRaycastRef.current as EventListener, false);
      }
      mount.removeEventListener('mousedown', onMouseDown as EventListener, false);
      mount.removeEventListener('mousewheel', onMouseWheel as EventListener, false);
      mount.removeEventListener('keydown', onDocumentKeyDown as EventListener, false);
      if (onMouseOverHandlerRef.current) {
        mount.removeEventListener('mouseover', onMouseOverHandlerRef.current, false);
      }
      if (onMouseOutHandlerRef.current) {
        mount.removeEventListener('mouseout', onMouseOutHandlerRef.current, false);
      }
      window.removeEventListener('resize', onWindowResize, false);

      // Dispose THREE.js scene objects
      sceneRef.current.traverse((object) => {
        const obj = object as THREE.Mesh;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mat = m as any;
            Object.keys(mat).forEach((key: string) => {
              const val = mat[key];
              if (val && typeof val === 'object' && 'minFilter' in (val as object)) {
                (val as THREE.Texture).dispose();
              }
            });
            (m as THREE.Material).dispose();
          });
        }
      });

      // Dispose renderer
      const renderer = rendererRef.current;
      if (renderer) {
        if (renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }

      if (typeof mousetrap !== 'undefined') {
        mousetrap.unbind('esc');
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <GlobeTooltips
        mv_tooltips={tooltipState.mv_tooltips}
        mv_show={tooltipState.mv_show}
        mv_position={tooltipState.mv_position}
        tooltips_clicked={tooltipState.tooltips_clicked}
        tooltips_expendInfo={tooltipState.tooltips_expendInfo}
        tooltips_onexit={tooltips_onexit}
        tooltips_onclick={tooltips_expand}
      />
      <div
        id="globev"
        style={{ width: '100%', height: window.innerHeight - 60, backgroundColor: '#111117' }}
        ref={mountRef}
      />
    </div>
  );
});

GlobeVisual.displayName = 'GlobeVisual';

export default GlobeVisual;
