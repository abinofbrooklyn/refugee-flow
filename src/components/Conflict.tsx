import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';

import GlobeContainer from './globe/GlobeContainer';
import AsyApplicationContainer from './asylumApplication/AsyApplicationContainer';
import Annotation from './Annotation';

const Conflict: React.FC = () => {
  const [stillLoading, setStillLoading] = useState(true);
  const promptShownRef = useRef(false);

  const loadingManager = useCallback((boolean: boolean) => {
    setStillLoading(boolean);
  }, []);

  // Show annotation overlay once after loading completes (replaces render-time side effect)
  useEffect(() => {
    if (stillLoading || promptShownRef.current) return;
    promptShownRef.current = true;

    const fromLanding = sessionStorage.getItem('lastPage') === '/landing' ||
      !sessionStorage.getItem('lastPage');
    if (!fromLanding) return;

    const timer = window.setTimeout(() => {
      d3.select('.annotation-wrapper').style('display', 'block').style('opacity', '1');
    }, 2000);

    return () => clearTimeout(timer);
  }, [stillLoading]);

  return (
    <div>
      <Annotation />
      <GlobeContainer
        loadingManager={loadingManager}
      />
      <AsyApplicationContainer
        loadingManager={stillLoading}
      />
    </div>
  );
};

export default Conflict;
