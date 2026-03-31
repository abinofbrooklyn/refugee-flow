import React, { useRef, useEffect, useCallback } from 'react';
import _ from 'lodash';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as d3 from 'd3';
// d3-canvas-transition imported for side effects (canvas rendering extensions)
import 'd3-canvas-transition';
import { color_map } from '../data/routeDictionary';
import '../stylesheets/RefugeeRoute_map.css';
import type { RouteDeath, RouteCrossingCount } from '../types/api';
import { resolveClickAction, getHitRadius, HIT_RADIUS_MOUSE, CLICK_DEBOUNCE_MS } from './mapClickLogic';

import dataDictRaw from '../data/IBC_crossingCountByCountry.json';
const dataDict = dataDictRaw as RouteCrossingCount[];

/**
 * Compute bounds from actual data points for a route, clamped by per-route
 * max bounds from JSON. This is self-maintaining: as new data arrives via
 * ingestion, the view auto-expands to include it — but never wider than the
 * max bounds (e.g., English Channel never shows Germany even if data exists there).
 */
const computeDataBounds = (
  data: RouteDeath[],
  routeName: string | undefined,
  maxBounds?: [number, number, number, number]
): [number, number, number, number] | null => {
  const routeData = routeName
    ? data.filter(d => d.route === routeName)
    : data;

  const valid = routeData.filter(
    d => d.lng != null && d.lat != null
      && d.lat >= -90 && d.lat <= 90 && d.lng >= -180 && d.lng <= 180
  );

  if (valid.length === 0) return maxBounds ?? null;

  let sw_lng = Infinity, sw_lat = Infinity;
  let ne_lng = -Infinity, ne_lat = -Infinity;
  for (const d of valid) {
    if (d.lng! < sw_lng) sw_lng = d.lng!;
    if (d.lat! < sw_lat) sw_lat = d.lat!;
    if (d.lng! > ne_lng) ne_lng = d.lng!;
    if (d.lat! > ne_lat) ne_lat = d.lat!;
  }

  if (maxBounds) {
    // Clamp: data bounds can shrink within max bounds but never exceed them
    sw_lng = Math.max(sw_lng, maxBounds[0]);
    sw_lat = Math.max(sw_lat, maxBounds[1]);
    ne_lng = Math.min(ne_lng, maxBounds[2]);
    ne_lat = Math.min(ne_lat, maxBounds[3]);
  }

  return [sw_lng, sw_lat, ne_lng, ne_lat];
};

const navigateToRouteBounds = (
  map: maplibregl.Map,
  params: RouteCrossingCount,
  animate: boolean,
  data: RouteDeath[],
  routeName: string | undefined
): void => {
  if (params.bounds) {
    const bounds = computeDataBounds(data, routeName, params.bounds);
    if (bounds) {
      map.fitBounds(bounds, {
        animate,
        duration: animate ? 1500 : 0,
        maxZoom: 7,
      });
    }
  } else {
    // Fallback for routes without bounds (Iran-Afghanistan Corridor, South & East Asia)
    map.flyTo({
      center: [params.center_lng, params.center_lat],
      zoom: params.zoom,
      animate,
    });
  }
};

// Map new IOM cause_of_death categories to original display categories
const CAUSE_MAP: Record<string, string> = {
  "Drowning": "drowning or exhaustion related death",
  "Vehicle accident / death linked to hazardous transport": "violent accidental death (transport; blown in minefield...)",
  "Accidental death": "violent accidental death (transport; blown in minefield...)",
  "Violence": "authorities related death",
  "Harsh environmental conditions / lack of adequate shelter, food, water": "unknown - supposedly exhaustion related death",
  "Sickness / lack of access to adequate healthcare": "unknown - supposedly exhaustion related death",
  "Mixed or unknown": "other",
};

const mapCause = (cause: string | undefined): string => {
  if (!cause) return "other";
  if (CAUSE_MAP[cause]) return CAUSE_MAP[cause];
  const parts = cause.split(',');
  for (const p of parts) { if (CAUSE_MAP[p]) return CAUSE_MAP[p]; }
  return cause; // return as-is if it's already an old category
};

interface RouteDeathWithCoords extends RouteDeath {
  map_coord_x?: number;
  map_coord_y?: number;
  description?: string;
  source_url?: string;
  source?: string;
  route_displayText?: string;
  cause_of_death_displayText?: string;
  location?: string;
}

interface Props {
  data: RouteDeath[];
  currentRouteName: string | undefined;
  banned_category: string[] | null;
  slideoutCollapsed: boolean;
  passClickedPointManager: (point: object) => void;
  passRemoveClickedPointManager: () => void;
}

const RefugeeRoute_map: React.FC<Props> = ({
  data,
  currentRouteName,
  banned_category,
  slideoutCollapsed,
  passClickedPointManager,
  passRemoveClickedPointManager,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Mutable state tracked in refs (matching class component's instance variables)
  const dataGroupedRef = useRef<Record<string, RouteDeathWithCoords[]>>(
    _.groupBy(data, d => d.route) as Record<string, RouteDeathWithCoords[]>
  );
  const currentRouteNameRef = useRef<string | undefined>(currentRouteName);
  const currentMapParamsRef = useRef(_.find(dataDict, d => d.route === currentRouteName) || dataDict[0]);
  const bannedCategoryRef = useRef<string[] | null>(banned_category);
  const slideoutCollapsedRef = useRef<boolean>(slideoutCollapsed);
  const intersectedIdRef = useRef<number | null>(null);
  const mouseover_toggleRef = useRef<boolean>(true);
  const selectedPointIdRef = useRef<number | null>(null);
  const sizeScalerRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const dataFilteredRef = useRef<RouteDeathWithCoords[]>([]);
  const treeRef = useRef<d3.Quadtree<RouteDeathWithCoords> | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeChangeRef = useRef<number>(1);
  const mapContainerWidthRef = useRef<number>(0);
  const mapContainerHeightRef = useRef<number>(0);
  const myZoomRef = useRef({ start: 0, end: 0 });
  const lastClickTimeRef = useRef<number>(0);

  // Keep refs in sync with props
  useEffect(() => {
    dataGroupedRef.current = _.groupBy(data, d => d.route) as Record<string, RouteDeathWithCoords[]>;
  }, [data]);

  // Sync banned_category ref and re-render when it changes
  useEffect(() => {
    bannedCategoryRef.current = banned_category;
    if (mapRef.current) {
      canvas_overlay_render();
    }
  }, [banned_category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync slideout collapsed ref and ease map padding
  useEffect(() => {
    if (!mapRef.current || !containerRef.current) return;
    if (slideoutCollapsed !== slideoutCollapsedRef.current) {
      slideoutCollapsedRef.current = slideoutCollapsed;
      const rightPad = slideoutCollapsed ? 0 : Math.round(containerRef.current.offsetWidth * 0.55);
      mapRef.current.easeTo({
        padding: { top: 0, bottom: 0, left: 0, right: rightPad },
        duration: 400,
      });
    }
  }, [slideoutCollapsed]);

  // Sync currentRouteName ref and fly to new route
  useEffect(() => {
    if (!mapRef.current) return;
    const prevRouteName = currentRouteNameRef.current;
    currentRouteNameRef.current = currentRouteName;
    currentMapParamsRef.current = _.find(dataDict, d => d.route === currentRouteName) || dataDict[0];
    selectedPointIdRef.current = null;
    mouseover_toggleRef.current = true;
    intersectedIdRef.current = null;

    if (prevRouteName !== currentRouteName) {
      passRemoveClickedPointManager();
      mapRef.current.on('mousemove', handleMousemove);
      canvas_overlay_render(() =>
        navigateToRouteBounds(mapRef.current!, currentMapParamsRef.current, true, data, currentRouteName)
      );
    } else {
      canvas_overlay_render();
    }
  }, [currentRouteName]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvas_overlay_drawCall = useCallback((d: RouteDeathWithCoords, mappedCause: string) => {
    if (!mapRef.current || !ctxRef.current || !sizeScalerRef.current) return;
    const ctx = ctxRef.current;

    if (-90 > (d.lat ?? 0) || (d.lat ?? 0) > 90) {
      const ready = mapRef.current.project(new maplibregl.LngLat(d.lng ?? 0, 90));
      d.map_coord_x = ready.x;
      d.map_coord_y = ready.y;
    } else {
      const ready = mapRef.current.project(new maplibregl.LngLat(d.lng ?? 0, d.lat ?? 0));
      d.map_coord_x = ready.x;
      d.map_coord_y = ready.y;
    }

    const size = sizeScalerRef.current(+(d.dead_and_missing ?? 0)) * sizeChangeRef.current;
    const causeLookup = mappedCause || mapCause(d.cause_of_death);
    const colorEntry = _.find(color_map, _d => _d.key === causeLookup);
    let color = colorEntry ? colorEntry.value : '#5CFFE2CC';

    if (intersectedIdRef.current && d.id === intersectedIdRef.current) color = '#FFFFFFDE';

    ctx.beginPath();
    ctx.moveTo((d.map_coord_x ?? 0) + size, d.map_coord_y ?? 0);
    ctx.arc(d.map_coord_x ?? 0, d.map_coord_y ?? 0, size, 0, Math.PI * 2);

    if (intersectedIdRef.current && d.id === intersectedIdRef.current && !mouseover_toggleRef.current) {
      ctx.strokeStyle = "#666C82CC";
      ctx.lineWidth = 10;
      ctx.stroke();
    }
    // Bright outline + glow for incidents with media coverage
    if (d.description) {
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#FFFFFFDD";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const canvas_overlay_render = useCallback((cb?: () => void) => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const routeName = currentRouteNameRef.current;
    const dataGrouped = dataGroupedRef.current;
    const banned = bannedCategoryRef.current;

    dataFilteredRef.current = [];
    ctx.clearRect(0, 0, mapContainerWidthRef.current, mapContainerHeightRef.current);

    if (routeName && dataGrouped[routeName]) {
      sizeScalerRef.current = d3.scaleLinear()
        .domain(d3.extent(dataGrouped[routeName], d => +(d.dead_and_missing ?? 0)) as [number, number])
        .range([2, 50]);

      if (routeName === 'Others') {
        sizeScalerRef.current = d3.scaleLinear()
          .domain(d3.extent(dataGrouped[routeName], d => +(d.dead_and_missing ?? 0)) as [number, number])
          .range([2, 200]);
      }
      if (routeName === 'Central Mediterranean') {
        sizeScalerRef.current = d3.scaleLinear()
          .domain(d3.extent(dataGrouped[routeName], d => +(d.dead_and_missing ?? 0)) as [number, number])
          .range([2, 120]);
      }
    }

    if (routeName && dataGrouped[routeName]) {
      dataGrouped[routeName].forEach(d => {
        const mappedCause = mapCause(d.cause_of_death);
        if (banned != null && banned.length > 0) {
          const check = _.find(banned, banned => banned === mappedCause);
          if (!check) {
            dataFilteredRef.current.push(d);
            canvas_overlay_drawCall(d, mappedCause);
          }
        } else {
          dataFilteredRef.current.push(d);
          canvas_overlay_drawCall(d, mappedCause);
        }
      });
    }

    // quadtree optimized mouseover
    treeRef.current = d3.quadtree<RouteDeathWithCoords>()
      .extent([[0, 0], [mapContainerWidthRef.current, mapContainerHeightRef.current]])
      .x(d => d.map_coord_x ?? 0)
      .y(d => d.map_coord_y ?? 0)
      .addAll(dataFilteredRef.current);

    cb && cb();
  }, [canvas_overlay_drawCall]);

  const handleMousemove = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!treeRef.current) return;
    const p = treeRef.current.find(e.point.x, e.point.y, HIT_RADIUS_MOUSE) as RouteDeathWithCoords | undefined;
    if (p) intersectedIdRef.current = p.id;
    else intersectedIdRef.current = null;
    canvas_overlay_render();
  }, [canvas_overlay_render]);

  const handleClick = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!treeRef.current || !mapRef.current) return;

    // Debounce: ignore rapid double-clicks/taps
    const now = performance.now();
    if (now - lastClickTimeRef.current < CLICK_DEBOUNCE_MS) return;
    lastClickTimeRef.current = now;

    // Touch taps get a larger hit radius than mouse clicks
    const isTouch = e.originalEvent instanceof PointerEvent && e.originalEvent.pointerType === 'touch';
    const hitRadius = getHitRadius(isTouch);
    const p = treeRef.current.find(e.point.x, e.point.y, hitRadius) as RouteDeathWithCoords | undefined;

    const action = resolveClickAction(
      p,
      selectedPointIdRef.current,
      !mouseover_toggleRef.current,
      mapRef.current.getZoom(),
    );

    if (action.mode === 'deselect') {
      mouseover_toggleRef.current = true;
      selectedPointIdRef.current = null;
      intersectedIdRef.current = null;
      mapRef.current.on('mousemove', handleMousemove);
      passRemoveClickedPointManager();
      canvas_overlay_render();
    } else if (action.mode === 'swap') {
      selectedPointIdRef.current = action.pointId;
      intersectedIdRef.current = action.pointId;
      passClickedPointManager(p!);
      canvas_overlay_render(() =>
        mapRef.current!.flyTo({ center: action.center }),
      );
    } else {
      // select
      mouseover_toggleRef.current = false;
      selectedPointIdRef.current = action.pointId;
      intersectedIdRef.current = action.pointId;
      mapRef.current.off('mousemove', handleMousemove);
      passClickedPointManager(p!);
      canvas_overlay_render(() =>
        mapRef.current!.flyTo({ center: action.center, zoom: action.zoom }),
      );
    }
  }, [canvas_overlay_render, handleMousemove, passClickedPointManager, passRemoveClickedPointManager]);

  useEffect(() => {
    if (!containerRef.current) return;

    const params = currentMapParamsRef.current;
    const slideoutWidth = Math.round(containerRef.current.offsetWidth * 0.55);

    // Compute initial bounds so the map never flashes at the wrong position
    const initBounds = params.bounds
      ? computeDataBounds(data, currentRouteName, params.bounds)
      : null;

    const mapOptions: maplibregl.MapOptions = {
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      attributionControl: false,
    };

    if (initBounds) {
      mapOptions.bounds = initBounds;
      mapOptions.fitBoundsOptions = { maxZoom: 7, padding: { top: 0, bottom: 0, left: 0, right: slideoutWidth } };
    } else {
      mapOptions.center = [params.center_lng, params.center_lat];
      mapOptions.zoom = params.zoom;
    }

    mapRef.current = new maplibregl.Map(mapOptions)
      .addControl(new maplibregl.NavigationControl({}), 'top-right');

    // Set padding for slideout (also needed for non-bounds routes and subsequent navigations)
    mapRef.current.setPadding({ top: 0, bottom: 0, left: 0, right: slideoutWidth });

    mapContainerWidthRef.current = containerRef.current.offsetWidth;
    mapContainerHeightRef.current = containerRef.current.offsetHeight;

    d3.select(mapRef.current.getCanvasContainer())
      .append('canvas')
      .attr('height', mapContainerHeightRef.current)
      .attr('width', mapContainerWidthRef.current)
      .style('opacity', 0.999)
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('pointer-events', 'none')
      .attr('class', 'canvas_overlay');

    sizeChangeRef.current = 1;
    const canvasEl = containerRef.current!.querySelector('.canvas_overlay') as HTMLCanvasElement | null;
    if (canvasEl) ctxRef.current = canvasEl.getContext('2d');

    myZoomRef.current = { start: mapRef.current.getZoom(), end: mapRef.current.getZoom() };

    mapRef.current.on('zoomstart', () => { myZoomRef.current.start = mapRef.current!.getZoom(); });
    mapRef.current.on('zoomend', () => { myZoomRef.current.end = mapRef.current!.getZoom(); });
    mapRef.current.on('viewreset', () => canvas_overlay_render());
    mapRef.current.on('move', () => canvas_overlay_render());
    mapRef.current.on('mousemove', handleMousemove);
    mapRef.current.on('click', handleClick);

    canvas_overlay_render();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const style: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: window.innerHeight - 40 + 'px',
    zIndex: 0,
  };

  return <div style={style} ref={containerRef} />;
};

export default RefugeeRoute_map;
