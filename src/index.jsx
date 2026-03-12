import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from './redux/store';

// import './styles/main.scss';
import './styles/fonts.css';
import './styles/reset.scss';

import Router from './components/router/Router';

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <Router />
  </Provider>,
);
