import React, { createContext, useContext } from 'react';

export interface TransitionContextValue {
  signalReady: (loadDurationMs: number) => void;
}

export const TransitionContext = createContext<TransitionContextValue | null>(null);

export interface TransitionProviderProps {
  onSignalReady: (loadDurationMs: number) => void;
  children: React.ReactNode;
}

export const TransitionProvider: React.FC<TransitionProviderProps> = ({ onSignalReady, children }) => {
  const value: TransitionContextValue = {
    signalReady: onSignalReady,
  };

  return (
    <TransitionContext.Provider value={value}>
      {children}
    </TransitionContext.Provider>
  );
};

export const useTransitionSignal = (): TransitionContextValue | null => {
  return useContext(TransitionContext);
};
