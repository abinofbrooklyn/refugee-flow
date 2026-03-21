import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';

import AsyApplicationChart from './AsyApplicationChart';

const Chart = styled.div`
    width: 95%;
    margin-left: 5%;
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: visible;

    &:after{
      background-image: url(./assets/chartLegend_icon.png);
      background-size: 90px 10px;
      display: inline-block;
      width: 90px;
      height: 10px;
      content: "";
      bottom: 10px;
      left: 7%;
      position: absolute;
    }
`;

/** Raw application entry as received from server */
interface AppEntry {
  Origin: string;
  Value: number;
}

/** Year data: quarter keys -> either raw AppEntry[] (before processing) or number[] (after) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataItem = Record<string, any>;

interface AsyApplicationChartContainerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  selectedYear: number;
  currentCountry: string;
  loadingManager: boolean;
  chartMode: number;
}

// Ref handle type that the parent (AsyApplicationChartContainer) calls imperatively
interface ChartHandle {
  drawDataontoChart: (chartD: number[]) => void;
  x: d3.ScalePoint<string>;
  y: d3.ScaleLinear<number, number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xAxisGroup: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yAxisGroup: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customXaxis: (g: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customYaxis: (g: any) => void;
  allYears: string[];
  quaterList: string[];
}

const AsyApplicationChartContainer: React.FC<AsyApplicationChartContainerProps> = (props) => {
  const { data, selectedYear, currentCountry, chartMode } = props;

  const margin = { top: 20, right: 30, bottom: 50, left: 30 };

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [chartData, setChartData] = useState<number[]>([]);

  const mountRef = useRef<SVGSVGElement>(null);
  const gMountRef = useRef<ChartHandle>(null);

  const processData = useCallback((
    rawData: DataItem[],
    selYear: number,
    country: string,
    mode: number,
  ) => {
    if (rawData.length > 0) {
      const _data: DataItem[] = JSON.parse(JSON.stringify(rawData));

      _data.forEach(d => {
        for (const year in d) {
          const eachYear = d[year];
          for (const quarter in eachYear) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eachYear[quarter] = (eachYear[quarter] as any[]).reduce(
              (a: AppEntry, c: AppEntry) => {
                if (country === 'GLOBAL') {
                  return { Value: a.Value + c.Value };
                } else {
                  return c.Origin.toUpperCase() === country
                    ? { Value: a.Value + c.Value }
                    : { Value: a.Value + 0 };
                }
              },
              { Value: 0 },
            ) as unknown as AppEntry[];
          }
          // Object format to array format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d as any)[year] = (() => {
            const obj_to_array: number[] = [];
            for (const quarter in eachYear) {
              obj_to_array.push((eachYear[quarter] as unknown as AppEntry).Value);
            }
            return obj_to_array;
          })();
        }
      });

      if (mode === 1) {
        const yearList = Object.keys(_data[0]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentData = (_data[0] as any)[yearList[selYear]] as number[];
        setChartData(currentData || []);
      } else if (mode === 2) {
        const allData: number[] = [];
        for (const year in _data[0]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const yearTotal = ((_data[0] as any)[year] as number[]).reduce((sum, q) => sum + q, 0);
          allData.push(yearTotal);
        }
        setChartData(allData);
      }
    }
  }, []);

  useEffect(() => {
    if (mountRef.current) {
      const rect = mountRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width - margin.left - margin.right,
        height: rect.height - margin.top - margin.bottom,
      });
    }
    processData(data, selectedYear, currentCountry, chartMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-process when props change (replaces UNSAFE_componentWillReceiveProps)
  const prevPropsRef = useRef({ data, selectedYear, currentCountry, chartMode });
  useEffect(() => {
    const prev = prevPropsRef.current;
    if (
      prev.data !== data ||
      prev.selectedYear !== selectedYear ||
      prev.currentCountry !== currentCountry ||
      prev.chartMode !== chartMode
    ) {
      prevPropsRef.current = { data, selectedYear, currentCountry, chartMode };
      processData(data, selectedYear, currentCountry, chartMode);
    }
  });

  // Transition the chart when chartData changes (replaces render-time callGMountTransition)
  const prevChartDataRef = useRef<number[]>([]);
  useEffect(() => {
    if (prevChartDataRef.current === chartData) return;
    prevChartDataRef.current = chartData;

    const gMount = gMountRef.current;
    if (!gMount) return;

    gMount.drawDataontoChart(chartData);

    // x axis transition
    if (chartMode === 2) {
      gMount.x.domain(gMount.allYears);
    } else {
      gMount.x.domain(gMount.quaterList);
    }

    if (gMount.xAxisGroup) {
      gMount.xAxisGroup
        .transition()
        .duration(1700)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => { gMount.customXaxis(g); });
    }

    // y axis transition
    if (gMount.yAxisGroup) {
      gMount.y.domain([0, d3.max(chartData) ?? 0]).nice();
      gMount.yAxisGroup
        .transition()
        .duration(1700)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => { gMount.customYaxis(g); })
        .on('start', () => {
          d3.select('#asy_app_chart_baseLine')
            .transition()
            .duration(400)
            .attr('stroke', '#3b3a3e')
            .attr('stroke-width', 1);

          d3.select('#asy_app_y_axis_title').remove();

          d3.select('#asy_app_y_axis_title_indent')
            .transition()
            .duration(400)
            .attr('x1', 0)
            .attr('id', '');
        })
        .on('end', () => {
          d3.select('#asy_app_chart_baseLine')
            .transition()
            .duration(1000)
            .attr('stroke', '#7f7f7f')
            .attr('stroke-width', 2);
        });
    }
  });

  const renderChart = () => {
    if (data.length !== 0 && chartData.length !== 0) {
      return (
        <AsyApplicationChart
          ref={gMountRef}
          margin={margin}
          width={dimensions.width}
          height={dimensions.height}
          chartData={chartData}
          data={data}
        />
      );
    }
    return null;
  };

  return (
    <Chart>
      <svg width="100%" height="100%" ref={mountRef}>
        {renderChart()}
      </svg>
    </Chart>
  );
};

export default AsyApplicationChartContainer;
