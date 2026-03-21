import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';
import _ from 'lodash';
import { color_map } from '../data/routeDictionary';
import type { RouteDeath } from '../types/api';

import routeDescDict from '../data/route_desc.json';

interface Props {
  route_death_data: RouteDeath[];
  currentRouteName: string | undefined;
}

const Wrapper = styled.div`
  width: 83%;
  position: relative;
  height: ${() => window.innerHeight-60-50 + 'px'};
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
`;
const CurrentSituation = styled.div<{ currentRouteName?: string }>`

  height: 120px;
  overflow-y: scroll;
  top: 40px;
  position: relative;

  &::-webkit-scrollbar{
    width: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #5a5a61;
    -webkit-border-radius: 4px;
  }

  &>p{
    font-family: 'Roboto';
    font-size: 13px;
    font-weight: 300;
    color: #ffffff;
    position: relative;
    width: 98%;
  }
  &>p::selection {
    text-shadow: 0 0 0.8rem #de2279;
    background: rgba(54,56,126,0.1);
    color: white;
  }

  &::before{

    content:${ props => "'" +'Current Situation - '+ (props.currentRouteName || '') + "'" };
    font-family: 'Roboto';
    font-size: 25px;
    color: #ffffff;
    font-weight: 100;
    position: absolute;
    top: -40px;
  }
`;
const DataSource = styled.div<{ top?: string }>`
  fill: white;
  position: absolute;
  right: 0;
  cursor: pointer;
  opacity: 0.8;
  transition: all 200ms;
  top: ${props => props.top};
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
const DeathSummary = styled.div`

  top: 40px;
  position: relative;

  &>p{
    font-family: 'Roboto';
    font-size: 25px;
    color: #ffffff;
    font-weight: 100;
    margin-bottom: 10px;
  }
`;
const Stats = styled.div`
  height: 25px;
  background: #351f1fb3;
  border-radius: 4px;
  position: relative;
  float: left;
  transition: all 300ms;
  text-align: center;
  &>p{
    font-family: 'Roboto';
    color: #ef6464;
    font-weight: 600;
    font-size: 18px;
    position: relative;
    margin: auto;
    right: 0px;
    padding: 0px 15px 3px 25px;
    transform: translateY(-50%);
    text-align: center;
    top: 50%;
    transition: all 300ms
  }

  &>p::before{
    content: "";
    width: 5px;
    height: 5px;
    left: 7px;
    position: absolute;
    border-radius: 50%;
    background: #ef6464;
    top: 50%;
    transform: translateY(-50%);
  }

  &>p::after{
    content: 'Accumulative Death/Missing Count';
    font-family: 'Roboto';
    font-size: 13px;
    color: #ffffff;
    font-weight: 100;
    position: absolute;
    top: 10px;
    margin-left: 28px;
    width: 220px;
    text-align: left;
  }
`;
const ChartContainer = styled.div`
  width: 100%;
  position: fixed;
  bottom: 0;
`;
const ChartController = styled.div`
  height: 25px;
  border-radius: 4px;
  position: relative;
  top: 80px;

  &::before{
    content: 'Breakdown By:';
    font-family: 'Roboto';
    font-size: 13px;
    color: #ffffff;
    font-weight: 300;
    font-style: italic;
    position: absolute;
    top: -30px;
    left: 0;
    text-align: left;
  }
`;
const ChartControllerButton = styled.p<{ mode: number; index: string; button2W: number }>`
  &::selection {
    text-shadow: none;
    background: none;
    color: none;
  }
  cursor: pointer;
  position: absolute;
  color: white;
  font-family: 'Roboto';
  margin-top: 0px;
  padding: 3px 10px 5px 10px;
  border-radius: 3.5px;
  transition: all 400ms;

  background:${props => {
    if(props.mode - 1 == +props.index) return '#606096'
    else return '#28283c'
  }};
  border-bottom: ${props => {
    if(props.mode - 1 == +props.index) return '3px #ef6363 solid'
    else return '1px #4e5d9a solid'
  }};
  left: ${props => props.button2W*(+props.index) + 'px' };
  &:hover{
    border-width: 4px;
    background: #3b425a;
    color: #e8eaff;
  }

`;

type ChartMode = 1 | 2 | 3;

const RefugeeRoute_textArea_content_basicInfo: React.FC<Props> = ({ route_death_data, currentRouteName }) => {
  const [chartControllerWidth, setChartControllerWidth] = useState<number>(0);
  const [mode, setMode] = useState<ChartMode>(1);

  const currentRouteNameRef = useRef<string | undefined>(currentRouteName);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const chartControllerRef = useRef<HTMLDivElement>(null);
  const button2Ref = useRef<HTMLParagraphElement>(null);
  const chartDrawnRef = useRef<boolean>(false);
  const modeRef = useRef<ChartMode>(1);

  // Keep mode ref in sync
  modeRef.current = mode;

  const description = (textArr: string[]) => {
    return textArr.map((d, i) => <p key={i}>{d}</p>);
  };

  const calculateDeathTotal = useCallback((): string => {
    let total = 0;
    const grouped = _.groupBy(route_death_data, d => d.route)[currentRouteNameRef.current || ''];
    if (grouped) grouped.forEach(d => total += +(d.dead_and_missing ?? 0));
    return d3.format(',')(total);
  }, [route_death_data]);

  const drawChart = useCallback(() => {
    if (!chartContainerRef.current || !statsRef.current) return;
    chartDrawnRef.current = true;
    const routeName = currentRouteNameRef.current;

    d3.select(chartContainerRef.current).selectAll('svg').remove();

    const margin = { top: 20, right: 15, bottom: 20, left: 40 };
    const width = chartContainerRef.current.offsetWidth - margin.left - margin.right;
    const height = (chartContainerRef.current.getBoundingClientRect().top - statsRef.current.getBoundingClientRect().top) - 100
      - margin.top - margin.bottom;

    const g = d3.select(chartContainerRef.current).append('svg')
      .attr('overflow', "visible")
      .attr('width', width + margin.left + margin.right + 'px')
      .attr('height', height + margin.top + margin.bottom + 'px')
      .append('g')
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Map new IOM cause_of_death categories to the original display categories
    const causeMap: Record<string, string> = {
      "drowning or exhaustion related death": "drowning or exhaustion related death",
      "Drowning": "drowning or exhaustion related death",
      "violent accidental death (transport; blown in minefield...)": "violent accidental death (transport; blown in minefield...)",
      "Vehicle accident / death linked to hazardous transport": "violent accidental death (transport; blown in minefield...)",
      "Accidental death": "violent accidental death (transport; blown in minefield...)",
      "authorities related death": "authorities related death",
      "Violence": "authorities related death",
      "unknown - supposedly exhaustion related death": "unknown - supposedly exhaustion related death",
      "Harsh environmental conditions / lack of adequate shelter, food, water": "unknown - supposedly exhaustion related death",
      "Sickness / lack of access to adequate healthcare": "unknown - supposedly exhaustion related death",
      "suicide": "suicide",
      "malicious intent related death / manslaughter": "malicious intent related death / manslaughter",
      "other": "other",
      "Mixed or unknown": "other",
    };
    const mapCause = (cause: string): string => {
      if (causeMap[cause]) return causeMap[cause];
      const parts = cause.split(',');
      for (const p of parts) {
        if (causeMap[p]) return causeMap[p];
      }
      return "other";
    };

    type YearDataItem = {
      total: number;
      missing: number;
      dead: number;
      year: string;
      [key: string]: number | string;
    };

    const data: YearDataItem[] = Object.values(_.groupBy(route_death_data, d => d.year)).map((d) => {
      const value: YearDataItem = {
        'total': 0,
        'missing': 0,
        'dead': 0,
        'year': d[0].year,
        "drowning or exhaustion related death": 0,
        "violent accidental death (transport; blown in minefield...)": 0,
        "authorities related death": 0,
        "unknown - supposedly exhaustion related death": 0,
        "suicide": 0,
        "malicious intent related death / manslaughter": 0,
        "other": 0,
      };

      for (const i of d) {
        if (i.route === routeName) {
          value.total += +(i.dead_and_missing ?? 0);
          value.dead += +(i.dead ?? 0);
          value.missing += +(i.missing ?? 0);
          const mappedCause = mapCause(i.cause_of_death);
          (value[mappedCause] as number) += +(i.dead_and_missing ?? 0);
        }
      }
      return value;
    });

    const routeData = route_death_data.filter(d => d.route === routeName);
    const year = [...new Set(routeData.map(d => d.year))].sort();
    const filteredData = data.filter(d => year.includes(d.year));
    const xScale = d3.scaleLinear().domain([0, d3.max(filteredData, d => d.total) || 0]).range([0, width]).nice();
    const yScale = d3.scaleBand().domain(year).rangeRound([height, 0]).padding(0.4);
    const xAxis = g.append("g").attr("transform", `translate(0,${height - 10})`).call(d3.axisBottom(xScale));
    const yAxis = g.append("g").call(d3.axisLeft(yScale));
    xAxis.selectAll('text').style('fill', 'white');
    xAxis.selectAll('line').remove();
    xAxis.selectAll('path').remove();
    yAxis.selectAll('text').style('fill', 'white').style('font-size', '10px');
    yAxis.selectAll('line').remove();
    yAxis.selectAll('path').remove();

    const stack = d3.stack<YearDataItem>().keys(color_map.map(d => d.key));
    const stackedSeries = stack(filteredData);
    const ratio = d3.stack<YearDataItem>().keys(['dead', 'missing'])(filteredData);

    const currentMode = modeRef.current;

    if (currentMode === 1) {
      // total fatality
      const totalFat = g
        .append('g')
        .selectAll("rect")
        .data(filteredData)
        .enter().append("rect")
        .attr('rx', 3)
        .attr("x", () => 0)
        .attr("y", d => yScale(d.year) ?? 0)
        .attr("height", yScale.bandwidth())
        .style('fill', '#47478aad');

      totalFat.attr('width', 0)
        .transition()
        .duration(600)
        .attr("width", d => xScale(d.total))
        .style('transition', 'fill 400ms');

      totalFat
        .on('mouseenter', function(this: SVGRectElement, d: YearDataItem) {
          d3.select(this).style('fill', '#9292efad');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [x, y] = (d3 as any).mouse(this) as [number, number];
          const tooltipW = 170;
          const tooltipH = 20;
          const parent = (this as SVGElement).parentNode;
          if (!parent) return;
          d3.select(parent as SVGElement).append('rect')
            .attr('id', 'chartTooltip')
            .attr('rx', 3)
            .attr("x", x + 15)
            .attr("y", y)
            .attr('width', tooltipW)
            .attr('height', 0)
            .style('fill', 'rgb(255,255,255)')
            .style('opacity', 0)
            .transition()
            .duration(400)
            .style('opacity', .7)
            .attr('height', tooltipH)
            .on('interrupt', function(this: SVGElement) {
              d3.select(this).style('opacity', .7);
            });

          d3.select(parent as SVGElement).append('text')
            .attr('id', 'chartTooltip__text')
            .attr("x", x + 10 + 15)
            .attr("y", y + (tooltipH / 2) + 5)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', 1)
            .style('fill', '#191938')
            .style('font-size', '12px')
            .style('font-family', 'Roboto')
            .text('Total Death & Missing: ' + d3.format(',')(d.total));
        })
        .on('mouseout', function(this: SVGRectElement) {
          d3.select(this).style('fill', '#47478aad');
          d3.select('#chartTooltip').remove();
          d3.select('#chartTooltip__text').remove();
        });

    } else if (currentMode === 2) {
      // incident type
      const incidentType = g.selectAll<SVGGElement, (typeof stackedSeries)[0]>("g.series").data(stackedSeries)
        .enter().append("g")
        .attr("class", "series")
        .attr('transform', d => String(yScale(d[1] as unknown as string)))
        .style("fill", (d) => { const c = _.find(color_map, _d => _d.key === d.key); return c ? c.value : '#5CFFE2CC'; })
        .selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr('rx', '.2%')
        .attr("y", d => yScale(d.data.year) ?? 0)
        .attr("x", d => xScale(d[0]))
        .attr("height", yScale.bandwidth());

      incidentType
        .attr("width", 0)
        .transition()
        .duration(400)
        .attr("width", d => xScale(d[1]) - xScale(d[0]));

      incidentType
        .on('mouseenter', function(this: SVGRectElement, d: d3.SeriesPoint<YearDataItem>) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [x, y] = (d3 as any).mouse(this) as [number, number]; // D3 v5 API
          const tooltipW = 370;
          const activeCategories = color_map.map(d2 => d2.key).filter(key => (d.data[key] as number) > 0);
          const tooltipH = 30 + activeCategories.length * 25;
          const grandParent = (this as SVGElement).parentNode?.parentNode;
          if (!grandParent) return;

          const text_g = d3.select(grandParent as SVGElement)
            .append('g').attr('id', 'chartTooltip__text');

          text_g.append('rect')
            .attr('id', 'chartTooltip__text__rect')
            .attr('rx', 3)
            .attr("x", width - tooltipW)
            .attr("y", height - tooltipH - 20)
            .attr('width', tooltipW)
            .attr('height', 0)
            .style('fill', 'rgb(255,255,255)')
            .style('opacity', 0)
            .transition()
            .duration(400)
            .style('opacity', 1)
            .attr('height', tooltipH)
            .on('interrupt', function(this: SVGElement) {
              d3.select(this).style('opacity', 1);
            });

          text_g
            .append('text')
            .attr("x", width - tooltipW + 10)
            .attr("y", height - tooltipH)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', 1)
            .style('fill', '#191938')
            .style('font-size', '16px')
            .style('font-family', 'Roboto')
            .style('font-weight', '700')
            .text(d.data.year + ' Incident Type Summary:');

          activeCategories.forEach((ele, index) => {
            text_g
              .append('text')
              .attr("x", width - tooltipW + 10)
              .attr("y", height - tooltipH + 25 * (index + 1) + 2)
              .style('opacity', 0)
              .transition()
              .ease(d3.easePolyIn)
              .duration(300)
              .style('opacity', 1)
              .style('fill', '#191938')
              .style('font-size', '12px')
              .style('font-family', 'Roboto')
              .style('font-weight', '400')
              .style('text-transform', 'capitalize')
              .text(ele + ':');

            text_g
              .append('text')
              .attr("x", width - 10)
              .attr("y", height - tooltipH + 25 * (index + 1))
              .style('opacity', 0)
              .transition()
              .ease(d3.easePolyIn)
              .duration(300)
              .style('opacity', .7)
              .style('text-shadow', () => { const c = _.find(color_map, _d => _d.key === ele); return "3px 3px 0.6rem " + (c ? c.value : '#5CFFE2CC'); })
              .style('fill', '#1d1d29f7')
              .style('font-size', '15px')
              .style('font-family', 'Roboto')
              .style('font-weight', '600')
              .attr('text-anchor', 'end')
              .text(d3.format(',')(d.data[ele] as number));
          });
        })
        .on('mouseout', function(this: SVGRectElement) {
          const xStart = +d3.select('#chartTooltip__text__rect').attr('x');
          const yStart = +d3.select('#chartTooltip__text__rect').attr('y');
          const xEnd = xStart + +d3.select('#chartTooltip__text__rect').attr('width');
          const yEnd = yStart + +d3.select('#chartTooltip__text__rect').attr('height');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [mx, my] = (d3 as any).mouse(this) as [number, number]; // D3 v5 API

          if ((mx > xStart && mx < xEnd) && (my > yStart && my < yEnd)) {
            d3.select('#chartTooltip__text').on('mouseout', () => {
              d3.select('#chartTooltip__text').remove();
            });
          } else {
            d3.select('#chartTooltip__text').remove();
          }
        });

    } else if (currentMode === 3) {
      // death/missing ratio
      const colorCode: Record<number, string> = {
        0: `rgb(${Math.random()*255},${Math.random()*255},${Math.random()*255})`,
        1: `rgb(${Math.random()*255},${Math.random()*255},${Math.random()*255})`,
      };

      const d_m_ratio = g.selectAll<SVGGElement, (typeof ratio)[0]>('g.ratio_series').data(ratio)
        .enter().append("g")
        .attr("class", "series")
        .attr('transform', d => String(yScale(d[1] as unknown as string)))
        .style("fill", (_d, i) => colorCode[i])
        .selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => xScale(d[0]))
        .attr("y", d => yScale(d.data.year) ?? 0)
        .attr('rx', '.2%')
        .attr("height", yScale.bandwidth());

      d_m_ratio
        .attr('width', 0)
        .transition()
        .duration(400)
        .attr("width", d => xScale(d[1]) - xScale(d[0]));

      d_m_ratio
        .on('mouseenter', function(this: SVGRectElement, d: d3.SeriesPoint<YearDataItem>) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [x, y] = (d3 as any).mouse(this) as [number, number]; // D3 v5 API
          const tooltipW = 230;
          const tooltipH = 55;
          const grandParent = (this as SVGElement).parentNode?.parentNode;
          if (!grandParent) return;

          const text_g = d3.select(grandParent as SVGElement).append('g').attr('id', 'chartTooltip__text');

          text_g.append('rect')
            .attr('rx', 3)
            .attr("x", x + 10)
            .attr("y", y)
            .attr('width', tooltipW)
            .attr('height', 0)
            .style('fill', 'rgb(255,255,255)')
            .style('opacity', 0)
            .transition()
            .duration(400)
            .style('opacity', 1)
            .attr('height', tooltipH)
            .on('interrupt', function(this: SVGElement) {
              d3.select(this).style('opacity', 1);
            });

          text_g
            .append('text')
            .attr("x", x + 22)
            .attr("y", y + 12)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', 1)
            .style('fill', '#191938')
            .style('font-size', '13px')
            .style('font-family', 'Roboto')
            .style('font-weight', '600')
            .text(d.data.year + ' Death / Missing Ratio');

          text_g
            .append('text')
            .attr("x", x + 22)
            .attr("y", y + 25)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', 1)
            .style('fill', '#191938')
            .style('font-size', '12px')
            .style('font-family', 'Roboto')
            .style('font-weight', '400')
            .text('Death');

          text_g
            .append('text')
            .attr("x", x + 22)
            .attr("y", y + 45)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', .7)
            .style('fill', '#1d1d29f7')
            .style('font-size', '15px')
            .style('font-family', 'Roboto')
            .style('font-weight', '600')
            .style('fill', colorCode[0])
            .text(d3.format(',')(d.data['dead'] as number) + ' (' + d3.format('.1%')(d.data['dead'] as number / d.data['total']) + ')');

          text_g
            .append('text')
            .attr("x", x + tooltipW / 2 + 30)
            .attr("y", y + 25)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', 1)
            .style('fill', '#191938')
            .style('font-size', '12px')
            .style('font-family', 'Roboto')
            .style('font-weight', '400')
            .text('Missing');

          text_g
            .append('text')
            .attr("x", x + tooltipW / 2 + 30)
            .attr("y", y + 45)
            .style('opacity', 0)
            .transition()
            .ease(d3.easePolyIn)
            .duration(300)
            .style('opacity', .7)
            .style('fill', '#1d1d29f7')
            .style('font-size', '15px')
            .style('font-family', 'Roboto')
            .style('font-weight', '600')
            .style('fill', colorCode[1])
            .text(d3.format(',')(d.data['missing'] as number) + ' (' + d3.format('.1%')(d.data['missing'] as number / d.data['total']) + ')');
        })
        .on('mouseout', function(this: SVGRectElement) {
          d3.select('#chartTooltip__text').remove();
        });
    }
  }, [route_death_data]);

  const handleChartMode = useCallback((m: ChartMode) => {
    if (modeRef.current !== m) {
      setMode(m);
      modeRef.current = m;
      // Draw will happen via useEffect
    }
  }, []);

  // Initial mount
  useEffect(() => {
    setChartControllerWidth(chartControllerRef.current ? chartControllerRef.current.offsetWidth : 0);
    drawChart();
    const el = document.getElementById('CurrentSituation__text');
    if (el) el.scrollTop = 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw when mode changes
  useEffect(() => {
    if (!chartDrawnRef.current) return;
    drawChart();
  }, [mode, drawChart]);

  // React when currentRouteName changes (equivalent of UNSAFE_componentWillReceiveProps)
  useEffect(() => {
    const csText = document.getElementById('CurrentSituation__text');
    if (csText) {
      csText.scrollTop = 0;
      csText.scrollTo({ top: csText.scrollHeight, behavior: 'smooth' });
    }

    if (currentRouteName !== currentRouteNameRef.current) {
      currentRouteNameRef.current = currentRouteName;
      d3.select('.route-map-titleGroup__basic')
        .style('opacity', 0)
        .transition()
        .duration(400)
        .style('opacity', 1);
      drawChart();
    }
  }, [currentRouteName, drawChart]);

  // Fallback: draw if refs are now available but chart not yet drawn
  useEffect(() => {
    if (!chartDrawnRef.current && chartContainerRef.current && statsRef.current) {
      drawChart();
    }
    const el = document.getElementById('CurrentSituation__text');
    if (el) el.scrollTop = 0;
  });

  const button2W = button2Ref.current ? button2Ref.current.offsetWidth : 0;

  return (
    <Wrapper className='route-map-titleGroup__basic'>
      <CurrentSituation currentRouteName={currentRouteName} id="CurrentSituation__text"
        onClick={() => { const el = document.getElementById('CurrentSituation__text'); if (el) el.scrollTop = 0; }}>
        {(() => {
          const rd = _.find(routeDescDict as Array<{ route: string; desc: string[] }>, d => d.route === currentRouteName);
          return rd ? description(rd.desc) : null;
        })()}
      </CurrentSituation>
      <DataSource top='-5px' onClick={() => window.open(
        currentRouteName === 'Americas'
          ? 'https://www.cbp.gov/newsroom/stats/nationwide-encounters'
          : currentRouteName === 'English Channel'
            ? 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables'
            : 'https://frontex.europa.eu/along-eu-borders/migratory-routes/central-mediterranean-route/',
        '_blank'
      )}>
        <svg x="0px" y="0px" width="18.014px" height="19.304px" viewBox="0 0 18.014 19.304">
        <defs>
        </defs>
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
      <DeathSummary>
        <p>Incident Summary - {currentRouteName}</p>
        <Stats ref={statsRef}><p>{calculateDeathTotal()}</p></Stats>
        <DataSource top='48px' onClick={(e) => {
          e.preventDefault();
          window.open('https://missingmigrants.iom.int/downloads', '_blank');
          if (currentRouteName !== 'Americas') {
            window.open('http://www.themigrantsfiles.com/', '_blank');
          }
        }}>
          <svg x="0px" y="0px" width="18.014px" height="19.304px" viewBox="0 0 18.014 19.304">
          <defs>
          </defs>
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
        <ChartController ref={chartControllerRef}>
          <ChartControllerButton
            index="0"
            ref={button2Ref}
            button2W={button2W}
            mode={mode}
            onClick={() => handleChartMode(1)}>Total Fatality </ChartControllerButton>
          <ChartControllerButton
            index="1"
            ref={button2Ref}
            button2W={button2W}
            mode={mode}
            onClick={() => handleChartMode(2)}>Incident Type</ChartControllerButton>
          <ChartControllerButton
            index="2"
            ref={button2Ref}
            button2W={button2W}
            mode={mode}
            onClick={() => handleChartMode(3)}>Death/Missing Ratio</ChartControllerButton>
        </ChartController>
        <ChartContainer ref={chartContainerRef}></ChartContainer>
      </DeathSummary>
    </Wrapper>
  );
};

export default RefugeeRoute_textArea_content_basicInfo;
