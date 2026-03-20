import React from 'react';

import LandingResolver from '../LandingResolver';
import Conflict from '../../Conflict';
import RefugeeRoute from '../../RefugeeRoute';
import About from '../../about/About';

const routeRegistry = [
  { path: '/landing', element: <LandingResolver /> },
  { path: '/conflict', element: <Conflict /> },
  { path: '/route/:arg', element: <RefugeeRoute /> },
  { path: '/about', element: <About /> },
];

export default routeRegistry;
