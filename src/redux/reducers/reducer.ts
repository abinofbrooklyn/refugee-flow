import { combineReducers } from 'redux';
import conflictReducer from './conflictReducer';

const rootReducer = combineReducers({
  conflictReducer,
});

export default rootReducer;
