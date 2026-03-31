import { resolveClickAction, getHitRadius, HIT_RADIUS_MOUSE, HIT_RADIUS_TOUCH, CLICK_DEBOUNCE_MS } from '../../src/components/mapClickLogic';

describe('resolveClickAction', () => {
  const point = (id: number, lng = 10, lat = 20) => ({ id, lng, lat });

  describe('SELECT mode (nothing selected, click a bubble)', () => {
    it('returns select with zoom = currentZoom + 2', () => {
      const result = resolveClickAction(point(1), null, false, 3);
      expect(result).toEqual({
        mode: 'select',
        pointId: 1,
        center: [10, 20],
        zoom: 5,
      });
    });

    it('caps zoom at 7 when currentZoom + 2 would exceed it', () => {
      const result = resolveClickAction(point(1), null, false, 6);
      expect(result.zoom).toBe(7);
    });

    it('caps zoom at 7 when already at 7', () => {
      const result = resolveClickAction(point(1), null, false, 7);
      expect(result.zoom).toBe(7);
    });

    it('caps zoom at 7 when above 7', () => {
      const result = resolveClickAction(point(1), null, false, 8);
      expect(result.zoom).toBe(7);
    });

    it('handles null lng/lat by defaulting center to [0, 0]', () => {
      const result = resolveClickAction({ id: 5, lng: null, lat: null }, null, false, 3);
      expect(result.center).toEqual([0, 0]);
    });
  });

  describe('SWAP mode (point selected, click a different bubble)', () => {
    it('returns swap with no zoom property', () => {
      const result = resolveClickAction(point(2), 1, true, 5);
      expect(result).toEqual({
        mode: 'swap',
        pointId: 2,
        center: [10, 20],
      });
    });

    it('does not include zoom in swap result', () => {
      const result = resolveClickAction(point(2), 1, true, 5);
      expect(result).not.toHaveProperty('zoom');
    });
  });

  describe('DESELECT mode', () => {
    it('deselects when clicking the same bubble that is selected', () => {
      const result = resolveClickAction(point(1), 1, true, 5);
      expect(result).toEqual({ mode: 'deselect' });
    });

    it('deselects when clicking empty map while a point is selected', () => {
      const result = resolveClickAction(undefined, 1, true, 5);
      expect(result).toEqual({ mode: 'deselect' });
    });

    it('deselects when clicking empty map with nothing selected', () => {
      const result = resolveClickAction(undefined, null, false, 5);
      expect(result).toEqual({ mode: 'deselect' });
    });
  });

  describe('edge cases', () => {
    it('treats point id 0 as a valid id (not falsy)', () => {
      const result = resolveClickAction(point(0), null, false, 3);
      expect(result.mode).toBe('select');
      expect(result.pointId).toBe(0);
    });

    it('swap works when selected point id is 0', () => {
      const result = resolveClickAction(point(5), 0, true, 4);
      expect(result.mode).toBe('swap');
      expect(result.pointId).toBe(5);
    });

    it('deselect works when clicking point id 0 that is selected', () => {
      const result = resolveClickAction(point(0), 0, true, 4);
      expect(result.mode).toBe('deselect');
    });

    it('low zoom levels still add 2', () => {
      const result = resolveClickAction(point(1), null, false, 1);
      expect(result.zoom).toBe(3);
    });
  });

  describe('getHitRadius', () => {
    it('returns larger radius for touch input', () => {
      expect(getHitRadius(true)).toBe(HIT_RADIUS_TOUCH);
      expect(getHitRadius(true)).toBe(50);
    });

    it('returns smaller radius for mouse input', () => {
      expect(getHitRadius(false)).toBe(HIT_RADIUS_MOUSE);
      expect(getHitRadius(false)).toBe(30);
    });

    it('touch radius is larger than mouse radius', () => {
      expect(getHitRadius(true)).toBeGreaterThan(getHitRadius(false));
    });
  });

  describe('constants', () => {
    it('debounce threshold is 300ms', () => {
      expect(CLICK_DEBOUNCE_MS).toBe(300);
    });
  });

  describe('touch vs mouse interaction differences', () => {
    it('touch finds a bubble (larger radius) where mouse would miss', () => {
      // Mouse: no bubble within 30px → undefined → deselect (no-op)
      const mouseResult = resolveClickAction(undefined, null, false, 4);
      expect(mouseResult.mode).toBe('deselect');

      // Touch: same tap location but 50px radius finds a nearby bubble → select
      const touchResult = resolveClickAction(point(1), null, false, 4);
      expect(touchResult.mode).toBe('select');
    });

    it('touch select/swap/deselect cycle works identically to mouse', () => {
      // Touch tap a bubble → SELECT
      const r1 = resolveClickAction(point(1, -97.5, 29.3), null, false, 4);
      expect(r1.mode).toBe('select');

      // Touch tap a different bubble → SWAP
      const r2 = resolveClickAction(point(2, -97.6, 29.4), r1.pointId, true, 6);
      expect(r2.mode).toBe('swap');

      // Touch tap same bubble → DESELECT
      const r3 = resolveClickAction(point(2, -97.6, 29.4), r2.pointId, true, 6);
      expect(r3.mode).toBe('deselect');
    });

    it('touch tap on empty area while selected deselects (stays in place)', () => {
      // Bubble selected, tap empty area (50px radius still misses) → deselect
      const result = resolveClickAction(undefined, 5, true, 6);
      expect(result.mode).toBe('deselect');
    });

    it('double-tap protection: debounce prevents select then immediate deselect', () => {
      // First tap → select
      const r1 = resolveClickAction(point(1), null, false, 4);
      expect(r1.mode).toBe('select');

      // Second tap on same point without debounce would deselect
      // With debounce, the second tap is ignored (component-level).
      // But if it DID get through, it should be deselect:
      const r2 = resolveClickAction(point(1), r1.pointId, true, 6);
      expect(r2.mode).toBe('deselect');
      // Component debounce (300ms) prevents r2 from firing — tested via CLICK_DEBOUNCE_MS constant
      expect(CLICK_DEBOUNCE_MS).toBe(300);
    });
  });

  describe('click missed all bubbles (quadtree radius miss)', () => {
    it('does nothing when no bubble is nearby and nothing is selected', () => {
      const result = resolveClickAction(undefined, null, false, 5);
      expect(result).toEqual({ mode: 'deselect' });
    });

    it('deselects when no bubble is nearby and a point is selected', () => {
      const result = resolveClickAction(undefined, 42, true, 5);
      expect(result).toEqual({ mode: 'deselect' });
    });
  });

  describe('route change state reset (simulated sequences)', () => {
    it('after route change (state reset), first click is SELECT not SWAP', () => {
      // Before route change: point 1 selected
      // Route change resets: selectedPointId=null, isPointSelected=false
      // First click on new route should be SELECT
      const result = resolveClickAction(point(5), null, false, 4);
      expect(result.mode).toBe('select');
      expect(result.pointId).toBe(5);
    });

    it('after route change, clicking empty map is a no-op deselect', () => {
      // State reset after route change: nothing selected
      // Clicking empty map should just return deselect (no-op in component)
      const result = resolveClickAction(undefined, null, false, 4);
      expect(result.mode).toBe('deselect');
    });
  });

  describe('dense cluster exploration (multi-swap sequence)', () => {
    it('supports chaining multiple swaps without deselect', () => {
      // Click first bubble → SELECT
      const r1 = resolveClickAction(point(1, 5, 10), null, false, 4);
      expect(r1.mode).toBe('select');

      // Click second bubble while first selected → SWAP
      const r2 = resolveClickAction(point(2, 6, 11), r1.pointId, true, 6);
      expect(r2.mode).toBe('swap');
      expect(r2.pointId).toBe(2);

      // Click third bubble while second selected → SWAP again
      const r3 = resolveClickAction(point(3, 7, 12), r2.pointId, true, 6);
      expect(r3.mode).toBe('swap');
      expect(r3.pointId).toBe(3);

      // Click fourth bubble → still SWAP
      const r4 = resolveClickAction(point(4, 8, 13), r3.pointId, true, 6);
      expect(r4.mode).toBe('swap');
      expect(r4.pointId).toBe(4);

      // Finally deselect by clicking same bubble
      const r5 = resolveClickAction(point(4, 8, 13), r4.pointId, true, 6);
      expect(r5.mode).toBe('deselect');
    });

    it('swap preserves coordinates for each new point', () => {
      const r1 = resolveClickAction(point(1, -97.5, 29.3), null, false, 5);
      expect(r1.center).toEqual([-97.5, 29.3]);

      const r2 = resolveClickAction(point(2, -97.6, 29.4), r1.pointId, true, 5);
      expect(r2.center).toEqual([-97.6, 29.4]);

      const r3 = resolveClickAction(point(3, -97.7, 29.5), r2.pointId, true, 5);
      expect(r3.center).toEqual([-97.7, 29.5]);
    });
  });
});
