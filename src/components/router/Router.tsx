import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';

import Navbar from '../Navbar';
import LandingResolver from './LandingResolver';

import routeRegistry from './config/routeRegistry';

const NavbarLayout: React.FC = () => (
  <>
    <Navbar />
    <Outlet />
  </>
);

const Router: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<NavbarLayout />}>
        {routeRegistry.filter(r => r.path !== '/landing').map(r => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Route>
      <Route path="/landing" element={routeRegistry.find(r => r.path === '/landing')!.element} />
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  </BrowserRouter>
);

export default Router;
