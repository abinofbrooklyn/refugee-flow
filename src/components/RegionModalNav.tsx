import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { countryList } from '../data/warDictionary';
import _ from 'lodash';

const RegionContainer = styled.div`
  position: relative;
`;

const Regions = styled.ul`
  display: flex;
  justify-content: center;
  padding: 0;

  & > li{
    list-style-type: none;
    transition: all 300ms;
    margin: 0 35px;
    position: relative;
    cursor: pointer;
    color: #ffffff;
    z-index: 1;
    font-family: 'Roboto';
    font-weight: 100;
    font-size: 13px;
    width: 100px;
    text-align: center;
  }
`;

interface SelectRegionProps {
  selectedRegion: string;
  onSelect: (region: string) => void;
}

const SelectRegion: React.FC<SelectRegionProps> = ({ selectedRegion, onSelect }) => {
  const regions = (() => {
    const temp: string[] = [];
    countryList.forEach(d => temp.push(d[1] as string));
    return _.uniq(temp);
  })();

  return (
    <Regions>
      {regions.map((region) => (
        <li
          style={region === selectedRegion ? {
            borderStyle: 'solid',
            borderWidth: '0px 0px 2px',
            borderBottomColor: 'rgb(255, 0, 0)',
            width: '150px',
            height: '26px',
          } : undefined}
          onClick={() => onSelect(region)}
          key={region}
        >
          {region}
        </li>
      ))}
    </Regions>
  );
};

interface WarEventData {
  year: string;
  value: [unknown, Array<{ cot: string[]; fat: number }>][];
  scaler: { invert: (v: number) => number };
}

interface CountryEntry {
  country: string;
  total_fat: number;
  region: string;
  fat_year: Record<string, number>;
}

interface RegionModalNavProps {
  data: unknown;
  pass: (country: Record<string, CountryEntry[]>, region: string) => void;
}

const RegionModalNav: React.FC<RegionModalNavProps> = ({ data, pass }) => {
  const [selectedRegion, setSelectedRegion] = useState('Middle Africa');

  const countryRef = useRef<Record<string, CountryEntry[]> | null>(null);
  const availableYearsRef = useRef<string[]>([]);

  const aggregate = (d: unknown): Record<string, CountryEntry[]> => {
    const warData = d as WarEventData[];
    const availableYears = warData.map(item => item.year);
    availableYearsRef.current = availableYears;

    const country: CountryEntry[] = countryList.map(entry => {
      const fatYear: Record<string, number> = {};
      availableYears.forEach(y => { fatYear[y] = 0; });
      return {
        country: entry[0] as string,
        total_fat: 0,
        region: entry[1] as string,
        fat_year: fatYear,
      };
    });

    warData.forEach(item => {
      const t = item.value[0][1];
      for (let i = t.length - 1; i >= 0; i -= 4) {
        const countryRefIndex = _.findIndex(country, { country: t[i].cot[0].toUpperCase() });
        if (countryRefIndex >= 0) {
          country[countryRefIndex].fat_year[item.year] += item.scaler.invert(t[i].fat);
          country[countryRefIndex].total_fat += item.scaler.invert(t[i].fat);
        }
      }
    });

    return _.groupBy(country, d => d.region) as Record<string, CountryEntry[]>;
  };

  useEffect(() => {
    countryRef.current = aggregate(data);
    setSelectedRegion('Middle East');
    if (countryRef.current) {
      pass(countryRef.current, 'Middle East');
    }

    // Ugly fix for Region component jquery stuff (preserved from original)
    const timeout = setTimeout(() => {
      setSelectedRegion('Middle East');
      if (countryRef.current) {
        pass(countryRef.current, 'Middle East');
      }
    }, 10);

    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRegion = (region: string) => {
    if (selectedRegion !== region) {
      setSelectedRegion(region);
      if (countryRef.current) {
        pass(countryRef.current, region);
      }
    }
  };

  return (
    <RegionContainer>
      <SelectRegion
        selectedRegion={selectedRegion}
        onSelect={updateRegion}
      />
    </RegionContainer>
  );
};

export default RegionModalNav;
