import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from './redux/store';

import './styles/fonts.css';
import './styles/reset.scss';

import Router from './components/router/Router';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <Provider store={store}>
    <Router />
  </Provider>,
);
