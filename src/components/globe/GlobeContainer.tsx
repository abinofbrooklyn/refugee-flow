import React, { useRef, useState, useEffect, useCallback } from 'react';

import styled, { css } from 'styled-components';
import * as THREE from 'three';
import * as d3 from 'd3';
import _ from 'lodash';

import { ScaleLoader } from 'react-spinners';
import { rgbToHsl } from '../../utils/color-conversion-algorithms';
import GlobeVisual, { GlobeVisualHandle } from './GlobeVisual';
import type { GlobeOpts } from './GlobeVisual';
import Timeline from './GlobeTimeline';
import GlobeStatsBoard from './GlobeStatsBoard';
import { LoadingDivWrapper, LoaderGraphWrapper, LoadingIndicator } from '../LoadingBar';
import RegionModalButton from '../RegionModalButton';
import GlobeRouteButton from './GlobeRouteButton';

import { setSelectedYear, setCurrentCountry } from '../../redux/actions/conflictActions';
import { useAppSelector, useAppDispatch } from '../../types/redux';
import { useNavigate } from 'react-router-dom';

import Scroll from 'scroll-js';
import cot_latLng from '../../data/cot_latLng.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarDataEntry {
  lat: number;
  lng: number;
  fat: number;
  evt: number;
  cot: string[];
  int: number;
  id: number;
}

interface QuarterData {
  [quarter: string]: WarDataEntry[];
}

interface RawWarYear {
  Year: string | number;
  value: QuarterData;
}

interface ProcessedDataPoint {
  year: string | number;
  value: [string, unknown[]][];
  scaler: d3.ScaleLinear<number, number>;
  totalFatality: number;
  civilianFatality: number;
  totalConflictCount: number;
}

interface CountryFatalityEntry {
  year: string | number;
  totalFatality: number;
}

interface CountryCivilianEntry {
  year: string | number;
  civilianFatality: number;
}

interface CountryConflictEntry {
  year: string | number;
  totalConflictCount: number;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Wrapper = styled.div`
  & ::selection {
    background: none;
    color: none;
  }
`;

const TitleContainer = styled.div`
  position: absolute;
  width: ${window.innerWidth - 30 - (0.25 * window.innerWidth) + 'px'};
  left: 30px;
  top: 40px;
`;

const TitleText = styled.p`
  font-family: 'Roboto';
  font-size: 25px;
  font-weight: 300;
  color: white;
  margin-top: 25px;
  cursor: pointer;
  position: absolute;
  transition: all 400ms;
  &:after{
    background-image: url(./assets/title_icon.png);
    background-size: 14px 14px;
    display: inline-block;
    width: 14px;
    height: 14px;
    content: "";
    bottom: 10px;
    right: 0px;
    position: relative;
    cursor: pointer;
  }

  &:before{
    content: 'Select, filter and view regional conflict data';
    font-weight: 100;
    color: white;
    font-size: 11px;
    position: absolute;
    width: 300px;
    top: 32px;
    letter-spacing: 0.7px;
  }

  &:hover{
    color: #d7d7ead4;
  }
`;

const DataSource = styled.div`
  fill: white;
  position: absolute;
  right: 2%;
  cursor: pointer;
  opacity: 0.8;
  transition: all 200ms;
  top: 90vh;
  &:hover{
    opacity: 1;
  }

  &::before{
    content: 'Data Sources';
    position: relative;
    color: #fff;
    right: 10px;
    bottom: 0;
    font-family: 'Roboto';
    font-size: 12px;
    font-weight: 300;
  }
`;

const GlobeControllerButton = styled.button`
  cursor: pointer;
  color: white;
  font-family: 'Ubuntu';
  font-size: 15px;
  font-weight: 700;
  position: absolute;
  background: #3f415845;
  border: none;
  top: 160px;
  margin: 0px;
  z-index: 10;
  transition: background 400ms, border-color 1000ms;
  cursor: pointer;
  padding: 8px 44px 9px 50px;
  border-radius: 3px;
  border: 1px solid;
  border-color: #3f41581c;
  &:hover{
    background: #3f415894;
    border-color: #555875cf;
  }
  &:before{
    background-image: url(./assets/globe_icon.png);
    background-size: 50%;
    width: 50px;
    height: 40px;
    background-repeat: no-repeat;
    content: "";
    bottom: -12px;
    right: 99px;
    position: absolute;
    margin-right: 10px;
  }
`;

const GlobeControllerItems = styled.div<{ $show?: boolean }>`
  position: absolute;
  top: 160px;
  left: 98px;
  transition: all 300ms ease-in-out;
  ${props => !props.$show
  ? css`
    transform: translateX(-300px);
    opacity: 0;
  `
  : css`
    transform: translateX(90px);
    opacity: 1;
  `}
`;

const AllConflict = styled.button<{ $selectornot?: number }>`
  cursor: pointer;
  background: #3f415891;
  border-radius: 4px;
  border: 1px solid #060610b5;
  font-family: 'Roboto';
  font-size: 10px;
  font-weight: 400;
  color: white;
  padding: 5px 15px 5px 15px;
  ${props => props.$selectornot == 1 && css`
    background: #3f4158;
    border-color: #8387b185;
  `}
  margin-right: 17px;
  transition: all 400ms;
  &:hover{
    background: #2b2c3c;
    border-color: #2e9493cc;
  }
`;

const Conflict_Civilians = styled.button<{ $selectornot?: number }>`
  cursor: pointer;
  background: #3f415891;
  border-radius: 4px;
  border: 1px solid #060610b5;
  font-family: 'Roboto';
  font-size: 10px;
  font-weight: 400;
  color: white;
  padding: 5px 15px 5px 15px;
  ${props => props.$selectornot == 2 && css`
    background: #3f4158;
    border-color: #8387b185;
  `}
  transition: all 400ms;
  &:hover{
    background: #2b2c3c;
    border-color: #2e9493cc;
  }
`;

const LegendWrapper = styled.div<{ $minMax?: number[] }>`
  position: absolute;
  bottom: 60px;
  left: 165px;
  height: 15px;

  &:before{
    content: ${props => props.$minMax && "'" + props.$minMax[1] + "'"};
    font-weight: 300;
    color: white;
    font-size: 12px;
    position: absolute;
    top: 18px;
    font-family: 'Roboto';
    font-weight: 700;
    font-size: 10px;
  }

  &:after{
    content: ${props => props.$minMax && "'" + props.$minMax[0] + "'"};
    right: 0;
    font-weight: 300;
    color: white;
    font-size: 12px;
    position: absolute;
    top: 18px;
    font-family: 'Roboto';
    font-weight: 700;
    font-size: 10px;
  }
`;

const LegendTitle = styled.p<{ $mode?: number }>`
  font-family: 'Roboto';
  font-weight: 700;
  font-size: 14.2px;
  position: absolute;
  color: white;
  top: -50px;
  &:before{
    content: ${props => props.$mode === 1 ? "'Max'" : "'Others'"};
    font-weight: 300;
    color: white;
    font-size: 12px;
    position: absolute;
    top: 21px;
    font-family: 'Roboto';
    font-weight: 700;
    font-size: 10px;
  }

  &:after{
    content: ${props => props.$mode === 1 ? "'Min'" : "'Civilians'"};
    font-weight: 300;
    color: white;
    font-size: 12px;
    right: 0px;
    position: absolute;
    top: 21px;
    font-family: 'Roboto';
    font-weight: 700;
    font-size: 10px;
  }
`;

const Legend = styled.img`
  width: 90px;
  opacity: 0.5;
  transition: all 400ms;
  &:hover{
    opacity: 1;
  }
`;

const GlobeNavPanel = styled.div`
  position: absolute;
  top: 105px;
  right: 28.6%;
`;

const Compass = styled.img`
  position: absolute;
  width: 32px;
  left: -3px;
  cursor: pointer;
  opacity: .6;
  transition: all 300ms;
  &:hover{
    opacity: 1;
  }
`;

const ZoomIn = styled.img`
  position: absolute;
  width: 25px;
  top: 41px;
  cursor: pointer;
  opacity: .6;
  transition: all 300ms;
  &:hover{
    opacity: 1;
  }
`;

const ZoomOut = styled.img`
  position: absolute;
  width: 25px;
  top: 73px;
  cursor: pointer;
  opacity: .6;
  transition: all 300ms;
  &:hover{
    opacity: 1;
  }
`;

// ---------------------------------------------------------------------------
// GlobeContainer
// ---------------------------------------------------------------------------

interface GlobeContainerProps {
  loadingManager: (loading: boolean) => void;
}

const GlobeContainer: React.FC<GlobeContainerProps> = ({ loadingManager }) => {
  // Redux hooks (replaces connect())
  const currentCountry = useAppSelector(state => (state as { conflictReducer: { currentCountry: string } }).conflictReducer.currentCountry);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Ref to GlobeVisual imperative handle (replaces this.gv)
  const globeRef = useRef<GlobeVisualHandle>(null);

  // Scroll helper ref — scroll-js has no types, use any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeLineScrollRef = useRef<any>(null);

  // Colour function (stable)
  const color = rgbToHsl(22, 247, 123);
  const colorFn = useCallback((x: number): THREE.Color => {
    const c = new THREE.Color();
    c.setHSL(
      color[0] + 0.4 * x,
      0.87 + 0.13 * x,
      0.56,
    );
    return c;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // State
  const [imgDir] = useState<string>('../assets/globe/');
  const [currentColorFn, setCurrentColorFn] = useState<(x: number, criteria?: Record<string, unknown>) => THREE.Color>(() => colorFn);
  const [currentYear, setCurrentYear] = useState<string | number | null>(null);
  const [availableYears, setAvailableYears] = useState<(string | number)[]>([]);
  const [rotatePause, setRotatePause] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>('Loading...');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [warData, setWarData] = useState<ProcessedDataPoint[] | null>(null);
  const [controllerShow, setControllerShow] = useState<boolean>(true);
  const [currentControllerSelection, setCurrentControllerSelection] = useState<number>(1);
  const [countryData, setCountryData] = useState<ProcessedDataPoint[]>([]);
  const [country_totalFatality, setCountryTotalFatality] = useState<CountryFatalityEntry[]>([]);
  const [country_civilianFatality, setCountryCivilianFatality] = useState<CountryCivilianEntry[]>([]);
  const [country_totalConflictCount, setCountryTotalConflictCount] = useState<CountryConflictEntry[]>([]);

  // State refs for use in callbacks (avoid stale closures)
  const warDataRef = useRef<ProcessedDataPoint[] | null>(null);
  const currentYearRef = useRef<string | number | null>(null);
  const availableYearsRef = useRef<(string | number)[]>([]);
  const currentCountryRef = useRef<string>(currentCountry);
  const countryDataRef = useRef<ProcessedDataPoint[]>([]);
  const currentColorFnRef = useRef<(x: number, criteria?: Record<string, unknown>) => THREE.Color>(colorFn);

  useEffect(() => { warDataRef.current = warData; }, [warData]);
  useEffect(() => { currentYearRef.current = currentYear; }, [currentYear]);
  useEffect(() => { availableYearsRef.current = availableYears; }, [availableYears]);
  useEffect(() => { currentCountryRef.current = currentCountry; }, [currentCountry]);
  useEffect(() => { countryDataRef.current = countryData; }, [countryData]);
  useEffect(() => { currentColorFnRef.current = currentColorFn; }, [currentColorFn]);

  // ---------------------------------------------------------------------------
  // Data processing
  // ---------------------------------------------------------------------------

  function fetchData(url: string): Promise<ProcessedDataPoint[]> {
    const request = new Request(url, { method: 'GET', cache: 'default' });
    return fetch(request)
      .then(res => res.json())
      .then((rawData: RawWarYear[]) => {
        return rawData.map(data => {
          const totalFatalityArr: number[] = [];
          const civilianFatalityArr: number[] = [];
          let totalConflictCount = 0;

          const data_year = data.Year;
          const data_value = data.value;
          const allEntries = Object.values(data_value).flat();
          const max = d3.max(allEntries, d => d.fat) ?? 0;
          const min = d3.min(allEntries, d => d.fat) ?? 0;
          const scaler = d3.scaleLinear().domain([min, max]).range([0, 1]);

          const out: [string, unknown[]][] = [];
          const all: unknown[] = [];
          const noHeight: unknown[] = [];

          for (const quater in data_value) {
            const output: unknown[] = [];

            data_value[quater].forEach(d => {
              totalFatalityArr.push(d.fat);
              d.evt === 0 && civilianFatalityArr.push(d.fat);
              totalConflictCount++;
              all.push(d.lat, d.lng, scaler(d.fat), { fat: scaler(d.fat), id: d.id, int: d.int, cot: d.cot, evt: d.evt });
              noHeight.push(d.lat, d.lng, 0, { evt: d.evt, cot: d.cot });
            });

            for (const _q in data_value) {
              if (_q === quater) {
                data_value[_q].forEach(d => {
                  output.push(d.lat, d.lng, scaler(d.fat), { fat: scaler(d.fat), id: d.id, int: d.int, cot: d.cot, evt: d.evt });
                });
              } else {
                data_value[_q].forEach(d => {
                  output.push(d.lat, d.lng, -1, { fat: scaler(d.fat), id: d.id, int: d.int, cot: d.cot, evt: d.evt });
                });
              }
            }
            out.push([quater, output]);
          }

          return {
            year: data_year,
            value: ([['all', all]] as [string, unknown[]][]).concat(out, [['noHeight', noHeight]]),
            scaler,
            totalFatality: _.reduce(totalFatalityArr, (a, c) => a + c, 0),
            civilianFatality: _.reduce(civilianFatalityArr, (a, c) => a + c, 0),
            totalConflictCount,
          };
        });
      });
  }

  function drawData(data: [string, unknown[]][]): void {
    const gv = globeRef.current;
    if (!gv) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (gv as any)._baseGeometry;
    // Wipe base geometry via opts proxy
    if ('_baseGeometry' in (gv as object)) {
      // @ts-expect-error -- direct property delete not possible via interface; use cast
      delete (gv as Record<string, unknown>)._baseGeometry;
    }

    data.forEach(d => gv.addData(d[1] as unknown[], { format: 'legend', name: d[0], animated: true }));
    gv.createPoints(data as unknown[]);
    gv.renderer.render(gv.scene, gv.camera);
  }

  // ---------------------------------------------------------------------------
  // componentDidMount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    timeLineScrollRef.current = new Scroll(document.querySelector('.TimelineWrapper'));

    const url = `${window.location.protocol}//${window.location.host}/data/reduced_war_data`;
    fetchData(url)
      .then(processedData => {
        const availYears = processedData.map(d => d.year);
        return new Promise<void>((resolve) => {
          setLoadingStatus(true);
          setLoadingText('Loading Globe...');
          setWarData(processedData);
          warDataRef.current = processedData;
          setAvailableYears(availYears);
          availableYearsRef.current = availYears;
          setCurrentYear(availYears[0]);
          currentYearRef.current = availYears[0];
          resolve();
        });
      })
      .then(() => {
        const wd = warDataRef.current;
        const gv = globeRef.current;
        if (!wd || !wd[0] || !gv) {
          throw new Error('Globe data or renderer not ready after load.');
        }
        drawData(wd[0].value);
        gv.scaler = wd[0].scaler;
        gv.lastIndex = 0;
        gv.transition(gv.lastIndex);
        gv.octree.update(() => {
          setLoadingStatus(false);
          gv.animate();
          gv.setTarget([-11.874010, 44.605859], 945);
          loadingManager(false);
          setControllerShow(false);
        });
      })
      .catch(err => {
        setLoadingStatus(false);
        setLoadingError((err as Error).message || 'Failed to load data. Please refresh.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Timeline handlers
  // ---------------------------------------------------------------------------

  const timlineYearClicked = useCallback((year: string | number) => {
    const gv = globeRef.current;
    if (!gv) return;

    if (year == currentYearRef.current) {
      gv.transition(0);
    } else {
      const years = availableYearsRef.current;
      const yearIndex = years.indexOf(year);
      setLoadingStatus(true);
      setLoadingText('Switching data to ' + year);
      setCurrentControllerSelection(1);
      timeLineScrollRef.current?.toElement(document.querySelectorAll('.individualWrapper')[yearIndex]);

      gv.transition(5, () => {
        gv.octree.remove(gv.points);
        gv.scene.remove(gv.points!);

        if (currentCountryRef.current === 'GLOBAL') {
          warDataRef.current?.slice().forEach((d, i) => {
            if (d.year === year) {
              dispatch(setSelectedYear(i));
              drawData(d.value);
              gv.scaler = d.scaler;
              gv.octree.update(() => {
                gv.transition(0);
                loadingManager(false);
                setRotatePause(false);
                setCurrentYear(year);
                currentYearRef.current = year;
                setLoadingStatus(false);
                setLoadingText('');
              });
            }
          });
        } else {
          dispatch(setSelectedYear(yearIndex));
          const cd = countryDataRef.current;
          const wd = warDataRef.current;
          const found = _.find(cd, d => d.year === year);
          if (found) drawData(found.value);
          gv.scaler = _.find(wd, d => d.year === year)?.scaler;
          gv.octree.update(() => {
            gv.transition(0);
            loadingManager(false);
            setRotatePause(false);
            setCurrentYear(year);
            currentYearRef.current = year;
            setLoadingStatus(false);
            setLoadingText('');
          });
        }
      });
    }
  }, [dispatch, loadingManager]);

  const timlineQuaterClicked = useCallback((quarter: number) => {
    globeRef.current?.transition(quarter);
  }, []);

  // ---------------------------------------------------------------------------
  // Globe controller (filter mode)
  // ---------------------------------------------------------------------------

  const globeControllerClick = useCallback((id: number) => {
    const gv = globeRef.current;
    if (!gv) return;
    // Read current selection from ref to avoid stale closure
    setCurrentControllerSelection(prev => {
      if (prev === id) return prev;

      if (id === 1) {
        gv.opts.colorFn = currentColorFnRef.current;
        setLoadingStatus(true);
        setLoadingText('Filtering Data...');
        gv.transition(5, () => {
          gv.octree.remove(gv.points);
          gv.scene.remove(gv.points!);
          if (currentCountryRef.current === 'GLOBAL') {
            warDataRef.current?.slice().forEach(d => {
              if (d.year == currentYearRef.current) {
                drawData(d.value);
                gv.scaler = d.scaler;
                gv.octree.update(() => {
                  gv.transition(0);
                  loadingManager(false);
                  setRotatePause(false);
                  setLoadingStatus(false);
                  setLoadingText('');
                });
              }
            });
          } else {
            countryDataRef.current.forEach(d => {
              if (d.year == currentYearRef.current) {
                drawData(d.value);
                gv.scaler = _.find(warDataRef.current, _d => _d.year === d.year)?.scaler;
                gv.octree.update(() => {
                  gv.transition(0);
                  loadingManager(false);
                  setRotatePause(false);
                  setLoadingStatus(false);
                  setLoadingText('');
                });
              }
            });
          }
        });
      } else if (id === 2) {
        setLoadingStatus(true);
        setLoadingText('Filtering Data...');
        gv.opts.colorFn = (_x: number, criteria?: Record<string, unknown>) =>
          criteria && criteria.evt != 0 ? new THREE.Color('#004542') : new THREE.Color('#F44745');

        gv.transition(5, () => {
          if (currentCountryRef.current === 'GLOBAL') {
            warDataRef.current?.forEach(d => {
              if (d.year === currentYearRef.current) {
                gv.octree.remove(gv.points);
                gv.scene.remove(gv.points!);
                drawData(d.value);
                gv.scaler = _.find(warDataRef.current, wd => wd.year === currentYearRef.current)?.scaler;
                gv.octree.update(() => {
                  gv.transition(0);
                  loadingManager(false);
                  setRotatePause(false);
                  setLoadingStatus(false);
                  setLoadingText('');
                });
              }
            });
          } else {
            countryDataRef.current.forEach(d => {
              if (d.year == currentYearRef.current) {
                drawData(d.value);
                gv.scaler = _.find(warDataRef.current, _d => _d.year === d.year)?.scaler;
                gv.octree.update(() => {
                  gv.transition(0);
                  loadingManager(false);
                  setRotatePause(false);
                  setLoadingStatus(false);
                  setLoadingText('');
                });
              }
            });
          }
        });
      }

      return id;
    });
  }, [loadingManager]);

  // ---------------------------------------------------------------------------
  // Country change handlers
  // ---------------------------------------------------------------------------

  const changeCountryData = useCallback((country: string, yearArg: number | null) => {
    const gv = globeRef.current;
    if (!gv) return;

    dispatch(setCurrentCountry(country));
    const years = availableYearsRef.current;
    const year = yearArg === null ? years[0] : years[yearArg];
    const yearIndex = years.indexOf(year);

    timeLineScrollRef.current?.toElement(document.querySelectorAll('.individualWrapper')[yearIndex]);

    const wd = warDataRef.current;
    if (!wd) return;
    const data = JSON.parse(JSON.stringify(wd)) as ProcessedDataPoint[];
    const country_totalFatality: CountryFatalityEntry[] = [];
    const country_civilianFatality: CountryCivilianEntry[] = [];
    const country_totalConflictCount: CountryConflictEntry[] = [];

    data.forEach((d, _i) => {
      const totalFatalityArr: number[] = [];
      const civilianFatalityArr: number[] = [];
      let totalConflictCount = 0;

      d.value.forEach(dv => {
        const t = dv[1] as unknown[];
        for (let i = t.length - 1; i >= 0; i -= 4) {
          const item = t[i] as { cot?: string[]; fat?: number; evt?: number };
          if (item.cot != undefined && item.cot[0].toUpperCase() == country) {
            if (dv[0] === 'all') {
              const rawFat = wd[_i].scaler.invert(item.fat ?? 0);
              totalFatalityArr.push(rawFat);
              item.evt === 0 && civilianFatalityArr.push(rawFat);
              totalConflictCount++;
            }
          } else {
            t.splice(i - 3, 4);
          }
        }
      });

      country_totalFatality.push({ year: d.year, totalFatality: _.reduce(totalFatalityArr, (a, c) => a + c, 0) });
      country_civilianFatality.push({ year: d.year, civilianFatality: _.reduce(civilianFatalityArr, (a, c) => a + c, 0) });
      country_totalConflictCount.push({ year: d.year, totalConflictCount });
    });

    setLoadingStatus(true);
    setLoadingText('Switching to ' + country + '...');
    setCountryData(data);
    countryDataRef.current = data;
    setCurrentYear(year);
    currentYearRef.current = year;
    setCountryTotalFatality(country_totalFatality);
    setCountryCivilianFatality(country_civilianFatality);
    setCountryTotalConflictCount(country_totalConflictCount);

    gv.transition(5, () => {
      gv.octree.remove(gv.points);
      gv.scene.remove(gv.points!);
      dispatch(setSelectedYear(yearIndex));
      const found = _.find(data, d => d.year === year);
      if (found) drawData(found.value);
      gv.scaler = _.find(wd, d => d.year === year)?.scaler;

      gv.octree.update(() => {
        gv.transition(0);
        loadingManager(false);
        setRotatePause(false);
        setLoadingStatus(false);
        setLoadingText('');
        const latLng = _.find(cot_latLng as Array<{ cot: string; lat: number; lng: number }>, d => d.cot.toUpperCase() === country);
        if (latLng != undefined) {
          gv.setTarget([latLng.lat, latLng.lng], 700);
        }
      });
    });
  }, [dispatch, loadingManager]);

  const countryChangeHandler = useCallback((country: string, year: number | null) => {
    dispatch(setCurrentCountry(country));
    changeCountryData(country, year);
  }, [dispatch, changeCountryData]);

  const removeCountryHandler = useCallback(() => {
    const gv = globeRef.current;
    if (!gv || currentCountryRef.current === 'GLOBAL') return;

    setLoadingStatus(true);
    setLoadingText('Returning to Global View...');
    dispatch(setCurrentCountry('GLOBAL'));

    gv.transition(5, () => {
      gv.octree.remove(gv.points);
      gv.scene.remove(gv.points!);

      const yr = currentYearRef.current;
      warDataRef.current?.slice().forEach((d, i) => {
        if (d.year === yr) {
          dispatch(setSelectedYear(i));
          drawData(d.value);
          gv.scaler = d.scaler;
          gv.octree.update(() => {
            const years = availableYearsRef.current;
            timeLineScrollRef.current?.toElement(
              document.querySelectorAll('.individualWrapper')[years.indexOf(yr!)]
            );
            gv.transition(0);
            gv.setTarget([-11.874010, 44.605859], 945);
            loadingManager(false);
            setRotatePause(false);
            setLoadingStatus(false);
            setLoadingText('');
          });
        }
      });
    });
  }, [dispatch, loadingManager]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderGlobeVisual() {
    if (loadingError) {
      return (
        <div style={{ width: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p style={{ color: '#ff6b6b', fontFamily: 'Roboto', fontWeight: 300, fontSize: '16px', textAlign: 'center' }}>
            {loadingError}
          </p>
        </div>
      );
    }

    const opts: GlobeOpts = { imgDir, colorFn: currentColorFn };

    return (
      <div style={{ width: '75%' }}>
        <LoadingDivWrapper $loading={loadingStatus} $leftPercentage='37.5%'>
          <LoaderGraphWrapper>
            <ScaleLoader color={'#ffffff'} loading={loadingStatus} />
          </LoaderGraphWrapper>
          <LoadingIndicator>{loadingText}</LoadingIndicator>
        </LoadingDivWrapper>

        <GlobeVisual
          opts={opts}
          rotatePause={rotatePause}
          ref={globeRef}
        />
      </div>
    );
  }

  // Compute legend min/max
  const legendMinMax = warData && currentYear
    ? _.find(warData, d => d.year === currentYear)?.scaler.domain()
    : undefined;

  // Compute stats data
  const statsData = warData && currentYear
    ? {
        'Total Fatality': currentCountry === 'GLOBAL'
          ? (_.find(warData, d => d.year === currentYear)?.totalFatality ?? 0)
          : (country_totalFatality.length > 0
            ? (_.find(country_totalFatality, d => d.year === currentYear)?.totalFatality ?? false)
            : false),
        'Civilian Fatality': currentCountry === 'GLOBAL'
          ? (_.find(warData, d => d.year === currentYear)?.civilianFatality ?? 0)
          : (country_civilianFatality.length > 0
            ? (_.find(country_civilianFatality, d => d.year === currentYear)?.civilianFatality ?? false)
            : false),
        'Armed Conflict Count': currentCountry === 'GLOBAL'
          ? (_.find(warData, d => d.year === currentYear)?.totalConflictCount ?? 0)
          : (country_totalConflictCount.length > 0
            ? (_.find(country_totalConflictCount, d => d.year === currentYear)?.totalConflictCount ?? false)
            : false),
      }
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Wrapper className="globe">
      <TitleContainer>
        <TitleText
          onClick={() => {
            (d3 as unknown as { select: (s: string) => { style: (k: string, v: string) => { transition: () => { delay: (n: number) => { style: (k: string, v: string) => unknown } } } } })
              .select('.annotation-wrapper')
              .style('display', 'block')
              .transition()
              .delay(10)
              .style('opacity', '1');
          }}
        >
          {'Armed Conflict | Region : ' + currentCountry.charAt(0).toUpperCase() + currentCountry.toLowerCase().slice(1) + ' | Year : ' + (currentYear || '...') + '  '}
        </TitleText>
        <DataSource
          data-annotation="Data Sources|View data attribution and methodology"
          onClick={() => window.open('https://www.acleddata.com/data/', '_blank')}
        >
          <svg x="0px" y="0px" width="18.014px" height="19.304px" viewBox="0 0 18.014 19.304">
            <defs></defs>
            <g id="zpGC0g_1_">
              <g>
                <path d="M8.858,8.442c1.995-0.015,3.835-0.176,5.607-0.76c0.726-0.239,1.44-0.553,2.109-0.925
                  c0.97-0.539,1.453-1.335,1.44-2.533C18,3.059,17.575,2.23,16.599,1.723c-0.857-0.446-1.759-0.854-2.688-1.106
                  c-2.708-0.734-5.468-0.765-8.23-0.349C4.268,0.481,2.893,0.853,1.632,1.562c-1.067,0.6-1.79,1.398-1.603,2.734
                  C0.044,4.396,0.038,4.5,0.03,4.602C-0.024,5.321,0.288,5.886,0.826,6.31c0.408,0.322,0.852,0.619,1.321,0.839
                  C4.316,8.164,6.638,8.406,8.858,8.442z M0.031,14.08c0,0.473,0.026,0.846-0.005,1.216c-0.077,0.914,0.342,1.562,1.044,2.079
                  c1.018,0.75,2.187,1.144,3.397,1.425c2.587,0.599,5.199,0.643,7.815,0.249c1.458-0.219,2.891-0.574,4.166-1.353
                  c1.67-1.021,1.639-1.678,1.466-3.518c-0.481,0.854-1.191,1.377-2.463,1.815c-1.442,0.496-2.933,0.737-4.448,0.83
                  c-2.689,0.165-5.364,0.097-7.969-0.676C1.861,15.797,0.718,15.352,0.031,14.08z M0.031,6.806c0,0.505,0.028,0.885-0.006,1.26
                  c-0.082,0.919,0.357,1.559,1.052,2.077c0.879,0.655,1.886,1.031,2.932,1.305c2.6,0.681,5.238,0.774,7.892,0.417
                  c1.564-0.21,3.104-0.551,4.478-1.368c1.75-1.041,1.706-1.712,1.537-3.566c-0.5,1.01-1.432,1.455-2.417,1.798
                  c-2.475,0.86-5.042,0.994-7.633,0.901c-1.826-0.065-3.63-0.275-5.36-0.899C1.527,8.377,0.591,7.942,0.031,6.806z M0.031,10.543
                  c0,0.408,0.024,0.818-0.005,1.224c-0.056,0.772,0.246,1.395,0.851,1.813c0.616,0.426,1.27,0.847,1.97,1.095
                  c3.531,1.253,7.137,1.278,10.765,0.482c1.286-0.282,2.522-0.717,3.552-1.588c0.41-0.346,0.756-0.758,0.799-1.309
                  c0.045-0.574,0.01-1.155,0.01-1.858c-0.338,0.807-0.883,1.284-1.548,1.535c-1.042,0.392-2.108,0.762-3.196,0.982
                  c-2.199,0.445-4.434,0.455-6.664,0.257c-1.569-0.139-3.121-0.393-4.578-1.032C1.193,11.795,0.458,11.365,0.031,10.543z"/>
              </g>
            </g>
          </svg>
        </DataSource>
        <RegionModalButton
          data={warData ?? undefined}
          countryChangeHandler={countryChangeHandler}
          removeCountryHandler={removeCountryHandler}
          currentCountry={currentCountry}
        />
        <GlobeControllerButton
          data-annotation="Map Filter|Filter to show only violence against civilians"
          onClick={() => setControllerShow(prev => !prev)}
        >Map Filter</GlobeControllerButton>

        <GlobeControllerItems $show={controllerShow}>
          <AllConflict
            $selectornot={currentControllerSelection}
            onClick={() => globeControllerClick(1)}
          >All Armed Conflict</AllConflict>
          <Conflict_Civilians
            $selectornot={currentControllerSelection}
            onClick={() => globeControllerClick(2)}
          >Conflict Against Civilians</Conflict_Civilians>
        </GlobeControllerItems>
      </TitleContainer>

      <Timeline
        onClickYear={timlineYearClicked}
        onClickQuater={timlineQuaterClicked}
        currentYear={currentYear}
        years={availableYears}
      />

      <GlobeRouteButton navigate={navigate} country={currentCountry} />

      {renderGlobeVisual()}

      <GlobeNavPanel data-annotation="Map Navigation|Zoom and rotate the globe">
        <Compass
          src='./assets/compass_icon.png'
          onClick={() => globeRef.current?.setTarget([-11.874010, 44.605859], 945)}
        />
        <ZoomIn
          src='./assets/zoomin_icon.png'
          onClick={() => globeRef.current?.zoom(100)}
        />
        <ZoomOut
          src='./assets/zoomout_icon.png'
          onClick={() => globeRef.current?.zoom(-100)}
        />
        <button
          onClick={() => setRotatePause(prev => !prev)}
          aria-label={rotatePause ? 'Resume globe rotation' : 'Pause globe rotation'}
          title={rotatePause ? 'Resume rotation' : 'Pause rotation'}
          style={{
            position: 'absolute', top: '115px', width: '25px', height: '25px', padding: 0,
            left: '0px', fontSize: '12px', background: '#3f415870', border: '1px solid #555875cf',
            borderRadius: '3px', color: 'white', cursor: 'pointer', opacity: 0.6, transition: 'all 300ms',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.6'; }}
        >
          {rotatePause ? '\u25B6' : '\u23F8'}
        </button>
      </GlobeNavPanel>

      <LegendWrapper
        data-annotation="Fatality Scale|Color shows fatality count per event"
        $minMax={legendMinMax}
      >
        <LegendTitle $mode={currentControllerSelection}>Fatality Count</LegendTitle>
        <Legend
          src={currentControllerSelection === 1
            ? './assets/globe_lagend-all.png'
            : './assets/globe_lagend-civilian.png'}
        />
      </LegendWrapper>

      <GlobeStatsBoard data={statsData as Parameters<typeof GlobeStatsBoard>[0]['data']} />
    </Wrapper>
  );
};

export default GlobeContainer;
