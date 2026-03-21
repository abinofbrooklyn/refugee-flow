import constants from '../actionConstants';

export interface SetSelectedYearAction {
  type: typeof constants.SET_SELECTED_YEAR;
  selectedYearIndex: number;
}

export interface SetCurrentCountryAction {
  type: typeof constants.SET_CURRENT_COUNTRY;
  currentCountry: string;
}

export type ConflictAction = SetSelectedYearAction | SetCurrentCountryAction;

const setSelectedYear = (selectedYearIndex: number): SetSelectedYearAction => ({
  type: constants.SET_SELECTED_YEAR,
  selectedYearIndex,
});

const setCurrentCountry = (currentCountry: string): SetCurrentCountryAction => ({
  type: constants.SET_CURRENT_COUNTRY,
  currentCountry,
});

export { setSelectedYear, setCurrentCountry };
