import React, { useState, useRef, useCallback } from 'react';
import { useOutlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { TransitionProvider } from './TransitionContext';

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

const TransitionOutlet: React.FC = () => {
  const outlet = useOutlet();
  const location = useLocation();

  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const [currOutlet, setCurrOutlet] = useState<React.ReactElement | null>(outlet);
  const [prevOutlet, setPrevOutlet] = useState<React.ReactElement | null>(null);

  // Refs for stale-closure-safe access inside callbacks and effects
  const prevPathnameRef = useRef<string>(location.pathname);
  const transitionStateRef = useRef<TransitionState>('idle');

  // lastIdleOutletRef holds the outlet element from the most recent idle state.
  // Updated ONLY via effect after an idle render — never during render — so that
  // a navigation render doesn't overwrite it with the new outlet before the
  // location-change effect can stash it as prevOutlet.
  const lastIdleOutletRef = useRef<React.ReactElement | null>(outlet);

  transitionStateRef.current = transitionState;

  // Capture the idle outlet AFTER render commits — this ensures the ref holds
  // the OLD outlet when the next navigation render fires.
  React.useEffect(() => {
    if (transitionState === 'idle') {
      lastIdleOutletRef.current = outlet;
    }
  });

  React.useEffect(() => {
    const newPathname = location.pathname;
    const prevPathname = prevPathnameRef.current;

    if (newPathname === prevPathname) {
      // Same pathname — skip crossfade entirely
      return;
    }

    // New route — stash the last idle outlet as prev, use new outlet as curr
    prevPathnameRef.current = newPathname;
    setPrevOutlet(lastIdleOutletRef.current);
    setCurrOutlet(outlet);
    setTransitionState('loading');
    transitionStateRef.current = 'loading';
  }, [location.pathname, outlet]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignalReady = useCallback((loadDurationMs: number) => {
    // Only act when actively waiting for a signal (loading state)
    if (transitionStateRef.current !== 'loading') return;

    if (loadDurationMs < 100) {
      // Instant switch — no crossfade
      setPrevOutlet(null);
      setTransitionState('idle');
      transitionStateRef.current = 'idle';
    } else {
      // Start CSS opacity crossfade
      setTransitionState('transitioning');
      transitionStateRef.current = 'transitioning';
    }
  }, []);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    // Only respond to opacity transitions on the old layer itself, not bubbled events
    if (e.propertyName !== 'opacity') return;
    setPrevOutlet(null);
    setTransitionState('idle');
    transitionStateRef.current = 'idle';
  }, []);

  // Derive opacity values from state — single consistent JSX tree prevents remounts
  const hasPrev = prevOutlet !== null;
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
          {prevOutlet}
        </RouteLayer>
      )}
      <RouteLayer
        data-transition-layer={hasPrev ? 'new' : undefined}
        $opacity={newOpacity}
        $isOld={false}
        $animate={isTransitioning}
      >
        <TransitionProvider onSignalReady={handleSignalReady}>
          {currOutlet}
        </TransitionProvider>
      </RouteLayer>
    </TransitionWrapper>
  );
};

export default TransitionOutlet;
