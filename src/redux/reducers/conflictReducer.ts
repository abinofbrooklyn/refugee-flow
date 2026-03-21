import constants from '../actionConstants';
import conflict, { ConflictState } from '../defaultStates/conflictDefaults';
import { ConflictAction } from '../actions/conflictActions';

const conflictReducer = (state: ConflictState = conflict, action: ConflictAction): ConflictState => {
  switch (action.type) {
    case constants.SET_SELECTED_YEAR:
      return {
        ...state,
        selectedYear: action.selectedYearIndex,
      };
    case constants.SET_CURRENT_COUNTRY:
      return {
        ...state,
        currentCountry: action.currentCountry,
      };
    default:
      return state;
  }
};

export default conflictReducer;
