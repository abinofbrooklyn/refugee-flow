import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';
import { countryList } from '../data/warDictionary';
import _ from 'lodash';

interface ChartDataPoint {
  key: string;
  value: number;
}

interface BorderBreakdown {
  [year: string]: {
    [quarter: string]: {
      southwest?: number;
      northern?: number;
    };
  };
}

interface IbcCountryData {
  NationalityLong: string;
  BorderLocation?: string;
  chartData: ChartDataPoint[];
  totalCross: number;
  borderBreakdown?: BorderBreakdown;
  [key: string]: unknown;
}

interface Props {
  data: IbcCountryData;
}

const Wrapper = styled.div`
  height: 150px;
  width: 98%;
  background: #1e1e33;
  box-shadow: 4px 7px 58px -15px rgba(0,0,0,0.75);
  border-radius: 5px;
  margin-top: 10px;
  transition: opacity 200ms;
  position: relative;
`;

const CountryName = styled.p`
  font-family: 'Roboto';
  font-size: 20px;
  font-weight: 300;
  color: white;
  top: 20px;
  left: 30px;
  margin: 0;
  position: relative;
  width: 35%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 400ms;
`;
const Region = styled.p`
  font-size: 14px;
  font-family: 'Roboto';
  font-weight: 100;
  left: 30px;
  color: white;
  position: relative;
  width: 200px;
  top: 9px;
`;

const Stats = styled.div`
  cursor: pointer;
  left: 30px;
  height: 20px;
  background: #54547ab3;
  border-radius: 4px;
  position: absolute;
  transition: all 300ms;
  text-align: center;
  top: 120px;
  &>p{
    font-family: 'Roboto';
    color: white;
    font-weight: 600;
    font-size: 13px;
    position: relative;
    margin: auto;
    right: 0px;
    padding: 0 5px 0px 20px;
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
    background: #8383ab;
    top: 50%;
    transform: translateY(-50%);
  }

  &>p::after{
    content: 'total crossings';
    font-family: 'Roboto';
    font-size: 13px;
    color: #ffffff;
    font-weight: 100;
    position: absolute;
    top: 1px;
    margin-left: 11px;
    width: 220px;
    text-align: left;
  }

  &:hover{
    background: #54547a;
  }
`;
const BorderLocation = styled.div`
  cursor: pointer;
  left: 30px;
  height: 20px;
  background: #54547ab3;
  border-radius: 4px;
  position: absolute;
  transition: all 300ms;
  text-align: center;
  top: 95px;
  &>p{
    font-family: 'Roboto';
    color: white;
    font-weight: 400;
    font-size: 13px;
    position: relative;
    margin: auto;
    right: 0px;
    padding: 0 5px;
    transform: translateY(-50%);
    text-align: center;
    top: 50%;
    transition: all 300ms
  }
  &>p::after{
    content: 'Border';
    font-family: 'Roboto';
    font-size: 13px;
    color: #ffffff;
    font-weight: 100;
    position: absolute;
    top: 1px;
    margin-left: 8px;
    width: 220px;
    text-align: left;
  }

  &:hover{
    background: #54547a;
  }
`;
const BorderBreakdownRow = styled.div<{ top?: string }>`
  position: absolute;
  left: 30px;
  top: ${props => props.top || '95px'};
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Roboto';
  font-size: 11px;
  color: #ffffffc0;
  font-weight: 300;
`;
const BorderLabel = styled.span<{ bg?: string }>`
  background: ${props => props.bg || '#54547ab3'};
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 400;
  font-size: 11px;
  color: white;
`;
const BorderCount = styled.span`
  font-weight: 500;
  color: #ffffffd0;
`;
const ChartContainer = styled.div`
  width: 60%;
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  &>p{
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    color: #ffffff88;
    font-weight: 200;
    font-family: 'Roboto';
    font-size: 10px;
    margin: 0;
    white-space: nowrap;
  }

  &>svg{
    position: absolute;
    bottom: 5px;
  }

`;

const RefugeeRoute_textArea_content_ibcCountryItem: React.FC<Props> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const margin = { top: 20, right: 20, bottom: 30, left: 30 };

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const width = svgRef.current.getBoundingClientRect().width - margin.left - margin.right;
    const height = svgRef.current.getBoundingClientRect().height - margin.top - margin.bottom;

    // Derive years from chartData — ensure sensible domain
    const chartYears = data.chartData.map(d => d.key);
    let [minDate, maxDate] = d3.extent(chartYears, d => new Date(d)) as [Date, Date];
    // Pad if fewer than 3 data points to avoid cramped/degenerate scales
    if (chartYears.length < 3) {
      minDate = new Date(Math.min(minDate.getFullYear(), maxDate.getFullYear()) - 1, 0, 1);
      maxDate = new Date(Math.max(minDate.getFullYear(), maxDate.getFullYear()) + 2, 0, 1);
    }
    const xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);

    const [, maxVal] = d3.extent(data.chartData, d => d.value);
    const yScale = d3.scaleLinear()
      .domain([0, maxVal || 1])
      .range([height, 0]).nice();

    const g = d3.select(gRef.current);
    const x_Scale = xScale;
    const y_Scale = yScale;

    // line
    g.append("path")
      .datum(data.chartData)
      .attr("fill", "none")
      .style("stroke", "rgb(65, 237, 184)")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 2)
      .attr("d", d3.line<ChartDataPoint>()
        .x(d => xScale(new Date(d.key)))
        .y(d => yScale(+d.value))
        .curve(d3.curveMonotoneX)
      );

    // points
    g.selectAll('.cardChart__points')
      .data(data.chartData)
      .enter()
      .append('circle')
      .attr('class', d => 'cardChart__points ' + "points_year_" + d.key)
      .attr('r', 4)
      .attr('cx', d => xScale(new Date(d.key)))
      .attr('cy', d => yScale(+d.value))
      .style("fill", '#41edb8')
      .style('cursor', 'pointer')
      .style("stroke", 'rgb(27, 31, 58)')
      .style("stroke-width", '3')
      .on('mouseover', function(this: SVGCircleElement) {
        const datum = d3.select<SVGCircleElement, ChartDataPoint>(this).datum();

        // point transitions
        const yearKey = datum.key;
        d3.selectAll('.points_year_' + yearKey)
          .transition()
          .duration(500)
          .attr('r', 10)
          .on('interrupt', (_d, _i, nodes) => {
            if (nodes[0]) d3.select(nodes[0] as Element).attr('r', 4);
          });

        // draw text
        const currentYear = '.points_year_' + yearKey;
        d3.selectAll<SVGGElement, unknown>('.IBC_chart_dataLayer')
          .each(function(_d: unknown, i: number) {
            const pointDatum = d3.selectAll<SVGCircleElement, ChartDataPoint>(currentYear)
              .filter((_d2: ChartDataPoint, _i: number) => _i === i).datum();
            if (!pointDatum) return;

            d3.select<SVGGElement, unknown>(this)
              .append('text')
              .attr('class', 'IBC_tooltips')
              .attr('x', x_Scale(new Date(pointDatum['key'])))
              .attr('y', y_Scale(+pointDatum['value']) - 10)
              .attr('text-anchor', 'middle')
              .style('font-family', 'Roboto')
              .style('font-weight', 400)
              .style('font-size', '10px')
              .style("fill", '#41edb8')
              .text(d3.format(".2s")(+pointDatum['value']));
          });
      })
      .on('mouseout', function(this: SVGCircleElement) {
        const datum = d3.select<SVGCircleElement, ChartDataPoint>(this).datum();
        d3.selectAll('.IBC_tooltips').remove();
        d3.selectAll('.points_year_' + datum.key)
          .transition()
          .duration(200)
          .attr('r', 4)
          .on('interrupt', (_d, _i, nodes) => {
            if (nodes[0]) d3.select(nodes[0] as Element).attr('r', 4);
          });
      });

    // x axis
    const svgSel = d3.select(svgRef.current);
    svgSel.append("g").attr('class', 'cardChart__xAxis')
      .attr("transform", "translate(30," + (+height + +margin.top) + ")")
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%Y') as (domainValue: Date | d3.NumberValue, index: number) => string));

    d3.selectAll(".cardChart__xAxis .tick text")
      .attr("dy", 8)
      .attr('fill', '#ffffff')
      .style('font-family', 'Roboto')
      .style('font-weight', 200)
      .style('font-size', '10px');
    d3.selectAll(".cardChart__xAxis path").remove();
    d3.selectAll(".cardChart__xAxis line").attr('y2', 3);
    d3.selectAll(".cardChart__xAxis line")
      .attr('stroke', 'white')
      .style('opacity', .6);

    // y axis
    svgSel.append("g").attr('class', 'cardChart__yAxis')
      .attr("transform", "translate(" + margin.left + "," + +margin.top + ")")
      .call(g2 => {
        g2.call(d3.axisLeft(yScale).tickFormat(d3.format(".2s")));

        g2.selectAll("path").remove();
        g2.selectAll(".tick line:not(:last-of-type)").remove();
        g2.selectAll('.tick line')
          .attr('x2', 1000)
          .style('opacity', .4)
          .style('stroke', 'white')
          .style('stroke-dasharray', '2 13');

        g2.selectAll(".tick text")
          .attr("x", -8)
          .attr('fill', '#ffffff')
          .style('font-family', 'Roboto')
          .style('font-weight', 400)
          .style('font-size', '10px');

        g2.selectAll(".tick:not(:last-of-type)").remove();
      });

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute border breakdown if available
  let borderBreakdownEl: React.ReactNode = null;
  if (data.borderBreakdown) {
    let sw = 0, n = 0;
    Object.values(data.borderBreakdown).forEach(q => {
      Object.values(q).forEach(v => { sw += v.southwest || 0; n += v.northern || 0; });
    });
    borderBreakdownEl = (
      <>
        <BorderBreakdownRow top="75px">
          <BorderLabel bg="#3d6b5e">Southwest Border</BorderLabel>
          <BorderCount>{d3.format(",")(sw)}</BorderCount>
        </BorderBreakdownRow>
        <BorderBreakdownRow top="98px">
          <BorderLabel bg="#4a5a7a">Northern Border</BorderLabel>
          <BorderCount>{d3.format(",")(n)}</BorderCount>
        </BorderBreakdownRow>
      </>
    );
  }

  const country = _.find(countryList, d => d[0] === data['NationalityLong'].toUpperCase());

  return (
    <div>
      <Wrapper>
        <CountryName>{data['NationalityLong']}</CountryName>
        <Region>{country ? country[1] + ' Region' : ''}</Region>

        {data.borderBreakdown ? borderBreakdownEl : (
          <BorderLocation><p>{data['BorderLocation']}</p></BorderLocation>
        )}
        <Stats><p>{d3.format(",")(data['totalCross'])}</p></Stats>

        <ChartContainer>
          <p>Illegal Border Crossing by Year</p>
          <svg width='100%' height='90px' ref={svgRef}>
            <g
              width='100%'
              height='100%'
              className="IBC_chart_dataLayer"
              ref={gRef}
              transform={"translate(" + margin.left + "," + margin.top + ")"}
            ></g>
          </svg>
        </ChartContainer>
      </Wrapper>
    </div>
  );
};

export default RefugeeRoute_textArea_content_ibcCountryItem;
