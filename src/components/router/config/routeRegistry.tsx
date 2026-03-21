import React from 'react';

import LandingResolver from '../LandingResolver';
import Conflict from '../../Conflict';
import RefugeeRoute from '../../RefugeeRoute';
import About from '../../about/About';

export interface RouteConfig {
  path: string;
  element: React.ReactElement;
  isLanding?: boolean;
}

const routeRegistry: RouteConfig[] = [
  { path: '/landing', element: <LandingResolver />, isLanding: true },
  { path: '/conflict', element: <Conflict /> },
  { path: '/route/:arg', element: <RefugeeRoute /> },
  { path: '/about', element: <About /> },
];

export default routeRegistry;
