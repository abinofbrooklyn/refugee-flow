import { createStore } from 'redux';
import rootReducer from './reducers/reducer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;
const devTools = (process.env.NODE_ENV !== 'production' && win.__REDUX_DEVTOOLS_EXTENSION__)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  ? win.__REDUX_DEVTOOLS_EXTENSION__()
  : undefined;

const store = createStore(rootReducer, devTools);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
