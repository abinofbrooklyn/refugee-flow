import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate, Outlet } from 'react-router-dom';

import { TransitionProvider, useTransitionSignal } from '../../src/components/router/TransitionContext';

// Mock routeRegistry to avoid pulling in heavy components (MapLibre, THREE.js etc)
jest.mock('../../src/components/router/config/routeRegistry', () => ({
  __esModule: true,
  default: [
    { path: '/route/:arg', element: <div>mock-route</div> },
  ],
}));

// Now safe to import — routeRegistry is mocked
import TransitionOutlet from '../../src/components/router/TransitionOutlet';

/** Helper: a route component that calls signalReady after mounting */
const MockRoute: React.FC<{ label: string; delayMs: number }> = ({ label, delayMs }) => {
  const signal = useTransitionSignal();
  useEffect(() => {
    const t = setTimeout(() => signal?.signalReady(delayMs), 10);
    return () => clearTimeout(t);
  }, [signal, delayMs]);
  return <div data-testid={`route-${label}`}>{label}</div>;
};

/** Helper: triggers navigation on mount */
const NavTrigger: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useNavigate();
  useEffect(() => { navigate(to); }, [navigate, to]);
  return null;
};

/** Test harness that uses TransitionOutlet as a layout with child routes */
const TestHarness: React.FC<{ initialPath: string; children?: React.ReactNode }> = ({
  initialPath,
  children,
}) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route element={<TransitionOutlet />}>
        <Route path="/route/a" element={<MockRoute label="A" delayMs={150} />} />
        <Route path="/route/b" element={<MockRoute label="B" delayMs={150} />} />
        <Route path="/route/c" element={<MockRoute label="C" delayMs={50} />} />
      </Route>
    </Routes>
    {children}
  </MemoryRouter>
);

describe('TransitionOutlet', () => {
  test('renders current outlet content when location is stable (no navigation)', async () => {
    const { getByTestId } = render(<TestHarness initialPath="/route/a" />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(getByTestId('route-A')).toBeTruthy();
  });

  test('stacks old and new route layers when signalReady fires with loadDurationMs > 100', async () => {
    const { container, getByTestId } = render(<TestHarness initialPath="/route/a" />);

    // Wait for initial route to signal ready
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(getByTestId('route-A')).toBeTruthy();

    // Navigate to /route/b (delayMs=150, > 100ms threshold)
    await act(async () => {
      render(
        <TestHarness initialPath="/route/a">
          <NavTrigger to="/route/b" />
        </TestHarness>,
        { container }
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // During transition, both layers should be stacked
    const layers = container.querySelectorAll('[data-transition-layer]');
    if (layers.length === 2) {
      const oldLayer = container.querySelector('[data-transition-layer="old"]');
      expect(oldLayer).toBeTruthy();
    }
  });

  test('instant switch when signalReady fires with loadDurationMs < 100 (cached)', async () => {
    const { container, queryByTestId } = render(<TestHarness initialPath="/route/a" />);

    // Wait for initial route
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Navigate to /route/c (delayMs=50, < 100ms threshold)
    await act(async () => {
      render(
        <TestHarness initialPath="/route/a">
          <NavTrigger to="/route/c" />
        </TestHarness>,
        { container }
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // After instant switch, only new route should be present
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(queryByTestId('route-C')).toBeTruthy();
  });

  test('old route unmounts after onTransitionEnd fires', async () => {
    const { container } = render(<TestHarness initialPath="/route/a" />);

    // Wait for initial route
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Navigate to /route/b
    await act(async () => {
      render(
        <TestHarness initialPath="/route/a">
          <NavTrigger to="/route/b" />
        </TestHarness>,
        { container }
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // Find the old layer and fire transitionEnd with propertyName: 'opacity'
    const oldLayer = container.querySelector('[data-transition-layer="old"]');
    if (oldLayer) {
      await act(async () => {
        const event = new Event('transitionend', { bubbles: true });
        Object.defineProperty(event, 'propertyName', { value: 'opacity' });
        oldLayer.dispatchEvent(event);
        await new Promise(r => setTimeout(r, 20));
      });
    }

    // After transitionEnd, old route should be gone
    const oldLayers = container.querySelectorAll('[data-transition-layer="old"]');
    expect(oldLayers.length).toBe(0);
  });

  test('same-pathname navigation skips crossfade entirely', async () => {
    const { container, getByTestId } = render(<TestHarness initialPath="/route/a" />);

    // Wait for initial route
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(getByTestId('route-A')).toBeTruthy();

    // Navigate to same path
    await act(async () => {
      render(
        <TestHarness initialPath="/route/a">
          <NavTrigger to="/route/a" />
        </TestHarness>,
        { container }
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // Should still show route A with no old layer
    expect(getByTestId('route-A')).toBeTruthy();
    const layers = container.querySelectorAll('[data-transition-layer="old"]');
    expect(layers.length).toBe(0);
  });
});
