/** Hit radius in pixels for quadtree point lookup */
export const HIT_RADIUS_MOUSE = 30;
export const HIT_RADIUS_TOUCH = 50;

/** Minimum ms between clicks to prevent double-tap toggling */
export const CLICK_DEBOUNCE_MS = 300;

export function getHitRadius(isTouch: boolean): number {
  return isTouch ? HIT_RADIUS_TOUCH : HIT_RADIUS_MOUSE;
}

export type ClickMode = 'select' | 'swap' | 'deselect';

export type ClickResult =
  | { mode: 'select'; pointId: number; center: [number, number]; zoom: number }
  | { mode: 'swap'; pointId: number; center: [number, number] }
  | { mode: 'deselect' };

/**
 * Pure decision function for bubble click handling.
 * Given the clicked point, current selection state, and zoom level,
 * returns what action to take (select, swap, or deselect).
 */
export function resolveClickAction(
  point: { id: number; lng: number | null; lat: number | null } | undefined,
  selectedPointId: number | null,
  isPointSelected: boolean,
  currentZoom: number,
): ClickResult {
  const isSamePoint = isPointSelected && point != null && point.id === selectedPointId;
  const isDifferentPoint = isPointSelected && point != null && point.id !== selectedPointId;

  if (!point || isSamePoint) {
    return { mode: 'deselect' };
  }

  if (isDifferentPoint) {
    return {
      mode: 'swap',
      pointId: point.id,
      center: [point.lng ?? 0, point.lat ?? 0],
    };
  }

  return {
    mode: 'select',
    pointId: point.id,
    center: [point.lng ?? 0, point.lat ?? 0],
    zoom: Math.min(currentZoom + 2, 7),
  };
}
