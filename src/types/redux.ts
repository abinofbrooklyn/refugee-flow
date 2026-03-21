import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import store from '../redux/store';

/** Inferred root state type from JS store — will be replaced by explicit type after store.ts conversion in Plan 02 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
