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
});
