import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';

import GlobeContainer from './globe/GlobeContainer';
import AsyApplicationContainer from './asylumApplication/AsyApplicationContainer';
import Annotation from './Annotation';

const Conflict: React.FC = () => {
  const [stillLoading, setStillLoading] = useState(true);
  const promptShownRef = useRef(false);
  // Capture lastPage at mount time before Navbar overwrites it with '/conflict'
  const fromLandingRef = useRef(
    sessionStorage.getItem('lastPage') === '/landing' ||
    !sessionStorage.getItem('lastPage')
  );

  const loadingManager = useCallback((boolean: boolean) => {
    setStillLoading(boolean);
  }, []);

  // Show annotation overlay once after loading completes
  useEffect(() => {
    if (stillLoading || promptShownRef.current) return;
    promptShownRef.current = true;

    if (!fromLandingRef.current) return;

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
