import React, { useState, useRef, useCallback } from 'react';
import { useLocation, useOutlet, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import { TransitionProvider } from './TransitionContext';
import routeRegistry from './config/routeRegistry';

type TransitionState = 'idle' | 'loading' | 'transitioning';

const TransitionWrapper = styled.div`
  position: relative;
  width: 100%;
  height: calc(100vh - 40px);
  overflow: hidden;
`;

interface RouteLayerProps {
  $opacity: number;
  $isOld: boolean;
  $animate: boolean;
}

const RouteLayer = styled.div<RouteLayerProps>`
  position: ${props => (props.$isOld ? 'absolute' : 'relative')};
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${props => props.$opacity};
  transition: ${props => (props.$animate ? 'opacity 400ms ease-in-out' : 'none')};
  will-change: ${props => (props.$animate ? 'opacity' : 'auto')};
  pointer-events: ${props => (props.$isOld ? 'none' : 'auto')};
`;

/** Renders routes matched against a frozen location — keeps old route alive */
const FrozenRoutes: React.FC<{ location: ReturnType<typeof useLocation> }> = ({ location }) => (
  <Routes location={location}>
    {routeRegistry.filter(r => r.path !== '/landing').map(r => (
      <Route key={r.path} path={r.path} element={r.element} />
    ))}
  </Routes>
);

const TransitionOutlet: React.FC = () => {
  const outlet = useOutlet();
  const location = useLocation();

  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const [frozenLocation, setFrozenLocation] = useState<ReturnType<typeof useLocation> | null>(null);

  const prevPathnameRef = useRef<string>(location.pathname);
  const transitionStateRef = useRef<TransitionState>('idle');

  transitionStateRef.current = transitionState;

  // Detect location change synchronously during render.
  const isNewPath = location.pathname !== prevPathnameRef.current;
  if (isNewPath && transitionStateRef.current === 'idle') {
    // Freeze the OLD location so we can render the old route via <Routes location={...}>
    setFrozenLocation({ ...location, pathname: prevPathnameRef.current, key: prevPathnameRef.current });
    prevPathnameRef.current = location.pathname;
    transitionStateRef.current = 'loading';
    setTransitionState('loading');
  }

  const handleSignalReady = useCallback((loadDurationMs: number) => {
    if (transitionStateRef.current !== 'loading') return;

    if (loadDurationMs < 100) {
      // Instant switch — no crossfade
      setFrozenLocation(null);
      setTransitionState('idle');
      transitionStateRef.current = 'idle';
    } else {
      // Start CSS opacity crossfade
      setTransitionState('transitioning');
      transitionStateRef.current = 'transitioning';
    }
  }, []);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.propertyName !== 'opacity') return;
    setFrozenLocation(null);
    setTransitionState('idle');
    transitionStateRef.current = 'idle';
  }, []);

  const hasPrev = frozenLocation !== null;
  const isTransitioning = transitionState === 'transitioning';
  const oldOpacity = isTransitioning ? 0 : 1;
  const newOpacity = transitionState === 'loading' ? 0 : 1;

  return (
    <TransitionWrapper>
      {hasPrev && (
        <RouteLayer
          data-transition-layer="old"
          $opacity={oldOpacity}
          $isOld={true}
          $animate={isTransitioning}
          onTransitionEnd={handleTransitionEnd}
        >
          <FrozenRoutes location={frozenLocation} />
        </RouteLayer>
      )}
      <RouteLayer
        data-transition-layer={hasPrev ? 'new' : undefined}
        $opacity={newOpacity}
        $isOld={false}
        $animate={isTransitioning}
      >
        <TransitionProvider onSignalReady={handleSignalReady}>
          {outlet}
        </TransitionProvider>
      </RouteLayer>
    </TransitionWrapper>
  );
};

export default TransitionOutlet;
