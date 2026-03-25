import React, { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { TransitionProvider } from './TransitionContext';

const TransitionWrapper = styled.div`
  position: relative;
  width: 100%;
  height: calc(100vh - 40px);
  overflow: hidden;
`;

const TransitionOutlet: React.FC = () => {
  const handleSignalReady = useCallback((_loadDurationMs: number) => {
    // Signal received — RefugeeRoute manages its own smooth transitions now.
    // This callback exists so TransitionProvider/useTransitionSignal contract is satisfied.
  }, []);

  return (
    <TransitionWrapper>
      <TransitionProvider onSignalReady={handleSignalReady}>
        <Outlet />
      </TransitionProvider>
    </TransitionWrapper>
  );
};

export default TransitionOutlet;
