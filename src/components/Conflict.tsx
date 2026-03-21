import React, { useState, useCallback } from 'react';
import _ from 'lodash';
import * as d3 from 'd3';

import GlobeContainer from './globe/GlobeContainer';
import AsyApplicationContainer from './asylumApplication/AsyApplicationContainer';
import Annotation from './Annotation';

const Conflict: React.FC = () => {
  const [stillLoading, setStillLoading] = useState(true);

  // evokePrompt is called at most once (_.once) after loading completes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const evokePrompt = useCallback(_.once(() => {
    const fromLanding = sessionStorage.getItem('lastPage') === '/landing' ||
      !sessionStorage.getItem('lastPage');
    if (!fromLanding) return;
    if (!stillLoading) {
      _.delay(() => {
        d3.select('.annotation-wrapper').style('display', 'block').style('opacity', '1');
      }, 2000);
    }
  }), []);

  const loadingManager = useCallback((boolean: boolean) => {
    setStillLoading(boolean);
  }, []);

  // Trigger annotation overlay once loading completes (side-effect in render)
  if (!stillLoading) evokePrompt();

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
