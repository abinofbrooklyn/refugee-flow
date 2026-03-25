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

  const prevPathnameRef = useRef<string>(location.pathname);
  const transitionStateRef = useRef<TransitionState>('idle');
  // Stores the outlet from the PREVIOUS render — always one render behind.
  // Updated at the END of each render cycle (synchronously), so when a new
  // location triggers a re-render, this still holds the old route's element.
  const prevRenderOutletRef = useRef<React.ReactElement | null>(outlet);

  transitionStateRef.current = transitionState;

  // Detect location change synchronously during render — before effects.
  // This runs on every render; when pathname differs, we know outlet just switched.
  const isNewPath = location.pathname !== prevPathnameRef.current;
  if (isNewPath && transitionStateRef.current === 'idle') {
    // Synchronous state update during render (React supports this pattern).
    // prevRenderOutletRef still holds the OLD outlet from the previous render.
    prevPathnameRef.current = location.pathname;
    transitionStateRef.current = 'loading';
    // Use functional updates to avoid stale closure issues
    setPrevOutlet(prevRenderOutletRef.current);
    setCurrOutlet(outlet);
    setTransitionState('loading');
  }

  // Update the ref AFTER all synchronous render logic has read it.
  // On the next render, this will be the "previous" outlet.
  prevRenderOutletRef.current = outlet;

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
