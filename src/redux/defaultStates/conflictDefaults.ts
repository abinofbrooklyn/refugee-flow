export interface ConflictState {
  selectedYear: number;
  currentCountry: string;
}

const conflict: ConflictState = {
  selectedYear: 0,
  currentCountry: 'GLOBAL',
};

export default conflict;
