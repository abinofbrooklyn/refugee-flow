import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';

// Mock routeRegistry to avoid pulling in heavy components
jest.mock('../../src/components/router/config/routeRegistry', () => ({
  __esModule: true,
  default: [
    { path: '/route/:arg', element: <div>mock-route</div> },
  ],
}));

import TransitionOutlet from '../../src/components/router/TransitionOutlet';
import { useTransitionSignal } from '../../src/components/router/TransitionContext';

const MockRoute: React.FC<{ label: string }> = ({ label }) => {
  const signal = useTransitionSignal();
  useEffect(() => {
    signal?.signalReady(50);
  }, [signal]);
  return <div data-testid={`route-${label}`}>{label}</div>;
};

const TestHarness: React.FC<{ initialPath: string }> = ({ initialPath }) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route element={<TransitionOutlet />}>
        <Route path="/route/a" element={<MockRoute label="A" />} />
        <Route path="/route/b" element={<MockRoute label="B" />} />
      </Route>
    </Routes>
  </MemoryRouter>
);

describe('TransitionOutlet', () => {
  test('renders outlet content via TransitionProvider', async () => {
    const { getByTestId } = render(<TestHarness initialPath="/route/a" />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(getByTestId('route-A')).toBeTruthy();
  });

  test('provides useTransitionSignal to child routes', async () => {
    let signalValue: ReturnType<typeof useTransitionSignal> = null;
    const Probe: React.FC = () => {
      signalValue = useTransitionSignal();
      return <div>probe</div>;
    };

    render(
      <MemoryRouter initialEntries={['/route/a']}>
        <Routes>
          <Route element={<TransitionOutlet />}>
            <Route path="/route/a" element={<Probe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 20));
    });

    expect(signalValue).not.toBeNull();
    expect(signalValue!.signalReady).toBeInstanceOf(Function);
  });
});
