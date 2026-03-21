import fs from 'fs';
import path from 'path';
import { uniqBy, round } from 'lodash';

// Load JSON data file from datasets directory
export const dataLoader = (filePath: string, cb: ((key: string, value: unknown) => unknown) | null = null): unknown =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '../datasets', filePath), 'utf8'), cb as Parameters<typeof JSON.parse>[1]);

export const reduceGeoPercision = (num: number, percision: number): number => round(num, percision);

interface QuarterEvent {
  fat: number;
  lat: number | string;
  lng: number | string;
  [key: string]: unknown;
}

interface YearRecord {
  Year: string;
  value: Record<string, QuarterEvent[]>;
}

interface YearRecordOut {
  Year: string;
  value: {
    q1: QuarterEvent[];
    q2: QuarterEvent[];
    q3: QuarterEvent[];
    q4: QuarterEvent[];
  };
}

export const warReducer = (warDataAll: YearRecord[]): YearRecordOut[] => warDataAll.map((year) => {
  const yearlyQuarters = Object.values(year.value).map((quarter) => {
    const sortedQuarter = quarter.sort((a, b) => b.fat - a.fat);
    return uniqBy(sortedQuarter, (i: QuarterEvent) => `${i.lat},${i.lng}`);
  });
  return {
    Year: year.Year,
    value: {
      q1: yearlyQuarters[0],
      q2: yearlyQuarters[1],
      q3: yearlyQuarters[2],
      q4: yearlyQuarters[3],
    },
  };
});
