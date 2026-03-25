import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { year as fallbackYears } from '../../data/warDictionary';

// d3 selection type — _groups is a private API used in legacy draw checks
type D3Selection = d3.Selection<SVGGElement, unknown, null, undefined>;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface AsyApplicationChartProps {
  margin: Margin;
  width: number;
  height: number;
  chartData: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
}

const AsyApplicationChart = React.forwardRef<
  {
    drawDataontoChart: (chartD: number[]) => void;
    x: d3.ScalePoint<string>;
    y: d3.ScaleLinear<number, number>;
    xAxisGroup: D3Selection | null;
    yAxisGroup: D3Selection | null;
    customXaxis: (g: D3Selection) => void;
    customYaxis: (g: D3Selection) => void;
    allYears: string[];
    quaterList: string[];
  },
  AsyApplicationChartProps
>((props, ref) => {
  const { margin, width, height, chartData, data } = props;

  const mountRef = useRef<SVGGElement>(null);

  // Internal chart state refs (mutable, not React state)
  const quaterListRef = useRef<string[]>([]);
  const xRef = useRef<d3.ScalePoint<string>>(d3.scalePoint().domain([]).range([0, 0]));
  const yRef = useRef<d3.ScaleLinear<number, number>>(d3.scaleLinear().domain([0, 0]).range([0, 0]));
  const xAxisGroupRef = useRef<D3Selection | null>(null);
  const yAxisGroupRef = useRef<D3Selection | null>(null);
  const allYearsRef = useRef<string[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customXaxisRef = useRef<(g: any) => void>(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customYaxisRef = useRef<(g: any) => void>(() => undefined);

  const drawDataontoChart = useCallback((chartD: number[]) => {
    const mount = mountRef.current;
    if (!mount) return;

    const svg_width = width;
    const svg_height = height;
    const currentDomain = quaterListRef.current;
    const dataYears: string[] = data && data.length > 0
      ? Object.keys(data[0])
      : fallbackYears;
    allYearsRef.current = dataYears;

    if (chartD.length > 4) {
      xRef.current = d3.scalePoint().domain(dataYears).range([0, width]);
    } else {
      xRef.current = d3.scalePoint().domain(quaterListRef.current).range([0, width]);
    }

    const yMax = d3.max(chartD) ?? 0;
    yRef.current = d3.scaleLinear()
      .domain([0, yMax * 1.1])
      .range([height, 0])
      .nice();

    // Draw line — only draw once, update "d" if changes happened
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingLines: any = d3.selectAll('.dataLine');
    if (existingLines._groups[0].length > 0) {
      existingLines
        .attr('d', d3.line<number>()
          .x((_d, i) => chartD.length > 4
            ? (xRef.current(allYearsRef.current[i]) ?? 0)
            : (xRef.current(quaterListRef.current[i]) ?? 0))
          .y(d => yRef.current(d))
          .curve(d3.curveMonotoneX)(chartD))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('stroke-dasharray', function(this: any) { return this.getTotalLength(); })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('stroke-dashoffset', function(this: any) { return this.getTotalLength(); })
        .transition()
        .duration(1500)
        .attr('stroke-dashoffset', 0);
    } else {
      d3.select(mount).append('path')
        .datum(chartD)
        .attr('class', 'dataLine')
        .attr('fill', 'none')
        .attr('stroke', '#41edb8')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 2)
        .attr('d',
          d3.line<number>()
            .x((_d, i) => xRef.current(quaterListRef.current[i]) ?? 0)
            .y(d => yRef.current(d))
            .curve(d3.curveMonotoneX))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('stroke-dasharray', function(this: any) { return this.getTotalLength(); })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('stroke-dashoffset', function(this: any) { return this.getTotalLength(); })
        .transition()
        .duration(1500)
        .attr('stroke-dashoffset', 0);
    }

    // Wipe all dataPoints if any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingPoints: any = d3.selectAll('.dataPoint');
    if (existingPoints._groups[0].length > 0) {
      d3.selectAll('.dataPoint').remove();
    }

    // Draw data points — last point in all-years view uses different color for partial year
    const currentYear = new Date().getFullYear().toString();
    const isAllYears = chartD.length > 4;

    d3.select(mount)
      .selectAll('.dataPoint')
      .data(chartD)
      .enter()
      .append('circle')
      .attr('class', 'dataPoint')
      .attr('fill', (_d, i) =>
        isAllYears && i === chartD.length - 1 && allYearsRef.current[i] === currentYear
          ? '#ff6b6b' : '#41edb8')
      .attr('stroke', '#1b1f3a')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', 3)
      .attr('r', 5)
      .attr('cx', (_d, i) => chartD.length > 4
        ? (xRef.current(allYearsRef.current[i]) ?? 0)
        : (xRef.current(quaterListRef.current[i]) ?? 0))
      .attr('cy', d => yRef.current(d))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('mouseover', function(this: any) {
        const w = 170;
        const h = 53;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = d3.select(this) as any;
        self.transition().duration(400).attr('fill', '#FF5764').attr('r', 8);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d3.select(this.parentNode as any)
          .append('g')
          .attr('class', 'dataPoint_tooltips')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .call((g: any) => {
            g.append('rect')
              .attr('x', () => {
                const cx = +self.attr('cx');
                if (svg_width - cx < w / 2) return cx - w;
                else if (cx > w / 2) return cx - w / 2;
                else return cx;
              })
              .attr('y', () => {
                const cy = +self.attr('cy');
                if (svg_height - cy < h) return cy - h - 15;
                else return cy + 15;
              })
              .style('fill', '#26242bb8')
              .attr('height', 0)
              .transition()
              .duration(600)
              .attr('width', w)
              .attr('height', h);

            g.append('text')
              .attr('x', () => {
                const cx = +self.attr('cx');
                if (svg_width - cx < w / 2) return cx - w + 20;
                else if (cx > w / 2) return cx - w / 2 + 20;
                else return cx + 20;
              })
              .attr('y', () => {
                const cy = +self.attr('cy');
                if (svg_height - cy < h) return cy - h - 15 + 40;
                else return cy + 15 + 40;
              })
              .text('Total application: ' + d3.format(',')(self.datum()))
              .attr('fill', '#b9b7b7')
              .style('font-family', 'Roboto')
              .style('font-weight', 400)
              .style('font-size', '12px')
              .style('opacity', 0)
              .transition()
              .duration(600)
              .style('opacity', 1);

            g.append('text')
              .attr('x', () => {
                const cx = +self.attr('cx');
                if (svg_width - cx < w / 2) return cx - w + 20;
                else if (cx > w / 2) return cx - w / 2 + 20;
                else return cx + 20;
              })
              .attr('y', () => {
                const cy = +self.attr('cy');
                if (svg_height - cy < h) return cy - h - 15 + 20;
                else return cy + 15 + 20;
              })
              .text(() => {
                const datum = self.datum() as number;
                const idx = chartD.indexOf(datum);
                const domain = chartD.length > 4 ? dataYears : currentDomain;
                return (chartD.length > 4 ? 'Year: ' : 'Quarter: ') + (domain[idx] || '').toUpperCase();
              })
              .attr('fill', '#b9b7b7')
              .style('font-family', 'Roboto')
              .style('font-weight', 400)
              .style('font-size', '12px')
              .style('opacity', 0)
              .transition()
              .duration(600)
              .style('opacity', 1);
          });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('mouseout', function(this: any) {
        d3.select(this).transition().duration(100).attr('fill', '#41edb8').attr('r', 5);

        d3.selectAll('.dataPoint_tooltips rect')
          .transition()
          .duration(200)
          .attr('height', 0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on('end', function(this: any) {
            d3.select('.dataPoint_tooltips').remove();
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on('interrupt', function(this: any) {
            d3.select('.dataPoint_tooltips').remove();
          });
      });

    // Draw avg line
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingStats: any = d3.selectAll('.asy-stats');
    const avg = chartD.reduce((a, c) => a + c, 0) / chartD.length;
    if (existingStats._groups[0].length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d3.selectAll('.asy-stats').call((g: any) => {
        g.select('line').transition().duration(1000)
          .attr('y1', yRef.current(avg))
          .attr('y2', yRef.current(avg));
        g.selectAll('text:last-of-type').text(d3.format('.2s')(avg));
        g.selectAll('text').transition().duration(1000).attr('y', yRef.current(avg));
      });
    } else {
      d3.select(mount)
        .append('g')
        .attr('class', 'asy-stats')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => {
          g.append('line')
            .attr('stroke', '#41edb8')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1)
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', yRef.current(avg))
            .attr('y2', yRef.current(avg));

          g.append('text')
            .attr('x', -10)
            .attr('y', yRef.current(avg))
            .attr('dy', -12)
            .text('Avg')
            .attr('fill', '#41edb8')
            .style('font-family', 'Roboto')
            .style('font-weight', 400)
            .style('font-size', '10px')
            .attr('text-anchor', 'end');

          g.append('text')
            .attr('x', -10)
            .attr('y', yRef.current(avg))
            .attr('dy', -1)
            .text(d3.format('.2s')(avg))
            .attr('fill', '#41edb8')
            .style('font-family', 'Roboto')
            .style('font-weight', 400)
            .style('font-size', '10px')
            .attr('text-anchor', 'end');
        });
    }
  }, [width, height, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawChart = useCallback(() => {
    const mount = mountRef.current;
    if (!mount) return;

    quaterListRef.current = ['q1', 'q2', 'q3', 'q4'];

    xRef.current = d3.scalePoint()
      .domain(quaterListRef.current)
      .range([0, width]);

    const yMaxQ = d3.max(chartData) ?? 0;
    yRef.current = d3.scaleLinear()
      .domain([0, yMaxQ * 1.1])
      .range([height, 0])
      .nice();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customXaxisRef.current = (g: any) => {
      const domain = xRef.current.domain();
      const isAllYears = domain.length > 4;
      g.call(d3.axisBottom(xRef.current)
        .tickFormat((d: string) => d.toUpperCase()));
      g.select('.domain').remove();
      g.selectAll('.tick text')
        .attr('dy', 10)
        .attr('fill', '#7f7f7f')
        .style('font-family', 'Roboto')
        .style('font-weight', 700)
        .style('font-size', isAllYears ? '9px' : null)
        .attr('transform', isAllYears ? 'rotate(-45)' : null)
        .style('text-anchor', isAllYears ? 'end' : null);
      g.selectAll('.tick line')
        .attr('stroke', '#7f7f7f')
        .attr('y2', 4)
        .attr('stroke-width', 2);
      g.selectAll('.tick:first-of-type line').remove();
      g.selectAll('.tick:last-of-type line').remove();
    };

    xAxisGroupRef.current = d3.select(mount)
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(customXaxisRef.current) as D3Selection;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customYaxisRef.current = (g: any) => {
      const s = g.selection ? g.selection() : g;
      g.call(
        d3.axisLeft(yRef.current)
          .tickSize(-width)
          .tickFormat(d3.format('.2s') as (domainValue: d3.NumberValue, index: number) => string));

      s.select('.domain').remove();
      s.selectAll('.tick line').attr('stroke', '#3b3a3e');
      s.selectAll('.tick text')
        .attr('x', -8)
        .attr('dy', 4)
        .attr('fill', '#7f7f7f')
        .style('font-family', 'Roboto')
        .style('font-weight', 700)
        .attr('text-anchor', 'end');

      if (s === g) {
        s.selectAll('.tick:first-of-type text').remove();
        s.selectAll('.tick:first-of-type line')
          .attr('stroke', '#7f7f7f')
          .attr('stroke-width', 2)
          .attr('id', 'asy_app_chart_baseLine');
        s.selectAll('.tick:last-of-type')
          .append('text')
          .attr('id', 'asy_app_y_axis_title')
          .attr('fill', '#7f7f7f')
          .style('font-family', 'Roboto')
          .style('font-weight', 700)
          .attr('x', 0)
          .attr('dy', 4)
          .attr('text-anchor', 'start')
          .text('Application Count (case)');
        s.selectAll('.tick:last-of-type line')
          .attr('id', 'asy_app_y_axis_title_indent')
          .attr('x1', 120);
      } else {
        s.selectAll('.tick:last-of-type')
          .append('text')
          .attr('id', 'asy_app_y_axis_title')
          .attr('fill', '#7f7f7f')
          .style('font-family', 'Roboto')
          .style('font-weight', 700)
          .attr('x', 0)
          .attr('dy', 4)
          .attr('text-anchor', 'start')
          .text('Application Count (case)');
        s.selectAll('.tick:last-of-type line')
          .attr('id', 'asy_app_y_axis_title_indent')
          .attr('x1', 120);
        g.selectAll('.tick:first-of-type text').remove();
        g.selectAll('.tick text').attrTween('x', null).attrTween('dy', null);
      }
    };

    yAxisGroupRef.current = d3.select(mount)
      .append('g')
      .call(customYaxisRef.current) as D3Selection;
  }, [width, height, chartData]);

  useEffect(() => {
    drawChart();
    // Default 2010 data
    drawDataontoChart([40764, 39031, 45253, 45328]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose imperative API via ref for parent (AsyApplicationChartContainer)
  React.useImperativeHandle(ref, () => ({
    drawDataontoChart,
    get x() { return xRef.current; },
    get y() { return yRef.current; },
    get xAxisGroup() { return xAxisGroupRef.current; },
    get yAxisGroup() { return yAxisGroupRef.current; },
    get customXaxis() { return customXaxisRef.current; },
    get customYaxis() { return customYaxisRef.current; },
    get allYears() { return allYearsRef.current; },
    get quaterList() { return quaterListRef.current; },
  }));

  return (
    <g
      transform={`translate(${margin.left},${margin.top})`}
      ref={mountRef}
    />
  );
});

AsyApplicationChart.displayName = 'AsyApplicationChart';

export default AsyApplicationChart;
