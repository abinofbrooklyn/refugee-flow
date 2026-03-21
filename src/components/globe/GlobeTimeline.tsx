import React, { useState } from 'react';
import * as d3 from 'd3';
import styled, { css } from 'styled-components';

import { year as fallbackYears } from '../../data/warDictionary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobeTimelineProps {
  onClickYear: (year: string | number) => void;
  onClickQuater: (quarter: number) => void;
  currentYear: string | number | null;
  years?: (string | number)[];
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const TimelineWrapper = styled.div`
  position:absolute;
  z-index: 1;
  height: 300px;
  width: 100px;
  bottom:0;
  overflow-y: scroll;
  left: 30px;
  box-shadow: 25px 69px 126px -11px rgba(0,0,0,0.75);
  height: ${() => (window.innerHeight - 300) + 'px'};

  &::-webkit-scrollbar{
    width: 1px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #5a5a61;
    -webkit-border-radius: 4px;
  }
  &::before{
    content: "Timeline";
    position: fixed;
    font-family: 'Ubuntu';
    font-size: 12px;
    font-weight: 700;
    color: white;
    margin-top: -2px;
    width: 98px;
    background: #111116;
    height: 20px;
    z-index: 1;
  }
`;

const IndividualWrapper = styled.div`
  width: 40px;
  padding: 0px;
  height: 1px;
  background: white;
  cursor: pointer;
  margin-bottom: 150px;
  &:first-child{
    margin-top: 20px;
  }
`;

const YearButton = styled.button<{ isSelected?: boolean }>`
  font-family: 'Roboto';
  font-size: 11px;
  font-weight: 400;
  color: white;
  border: 0;
  background: transparent;
  width: 50px;
  left: 45px;
  bottom: 6px;
  padding: 0;
  position: relative;
  cursor: pointer;

  &:hover{
    font-size: 13px;
    opacity: 0.7;
    transition: all 0.3s ease;
  }

  ${props => props.isSelected && css`
    color: #41edb8 !important;
    font-size: 14px !important;
    bottom: 4px !important;
  `}
`;

const QuarterButton = styled.button<{ $param?: string }>`
  font-family: 'Roboto';
  font-size: 10px;
  font-weight: 200;
  color: white;
  border: 0;
  background: transparent;
  width: 50px;
  left: 20px;
  padding: 0;
  position: relative;
  cursor: pointer;
  text-align: left;
  margin-bottom: 9px;

  &::after{
    content: '';
    width: 10px;
    position: absolute;
    height: 1px;
    border-radius: 20px;
    background-color: #fff;
    top: 6px;
    left: -20px;
  }

  ${props => props.$param === 'disabled' && css`
    opacity: .2;
  `}

  ${props => props.$param === 'currentYear' && css`
    &:hover{
      opacity: 0.7;
      color: #41edb8;
      transition: all 0.3s ease;
    }
  `}

  ${props => props.$param === 'currentYearSelected' && css`
    color: #41edb8;
    font-weight: 500;
    &:hover{
      opacity: 0.7;
      color: #41edb8;
      transition: all 0.3s ease;
    }
  `}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GlobeTimeline: React.FC<GlobeTimelineProps> = (props) => {
  const { onClickYear, onClickQuater, currentYear, years } = props;

  const [currentSelectedQuarter, setCurrentSelectedQuarter] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | number>(2010);

  function quater_selected_check(num: number, year: string | number): string {
    if (year == currentYear) {
      return num === currentSelectedQuarter ? 'currentYearSelected' : 'currentYear';
    }
    return 'disabled';
  }

  function checkYearClassName(year: string | number): boolean {
    return year == currentYear;
  }

  function checkQuaterDisabled(year: string | number): boolean {
    return year != currentYear;
  }

  function renderYearItem(year: string | number) {
    return (
      <IndividualWrapper key={year} className="individualWrapper">
        <YearButton
          isSelected={checkYearClassName(year)}
          onClick={() => {
            setCurrentSelectedQuarter(null);
            setSelectedYear(year);
            onClickYear(year);
          }}
          onMouseOver={(e) => {
            if (currentSelectedQuarter != null) {
              if (selectedYear == (d3 as unknown as { select: (el: EventTarget | null) => { text: () => string } }).select(e.target).text()) {
                setCurrentSelectedQuarter(null);
                onClickYear(year);
              }
            }
          }}
        >{year}</YearButton>

        <QuarterButton
          $param={quater_selected_check(1, year)}
          disabled={checkQuaterDisabled(year)}
          onMouseOver={() => {
            setCurrentSelectedQuarter(1);
            onClickQuater(1);
          }}
        >Quarter 1</QuarterButton>
        <QuarterButton
          $param={quater_selected_check(2, year)}
          disabled={checkQuaterDisabled(year)}
          onMouseOver={() => {
            setCurrentSelectedQuarter(2);
            onClickQuater(2);
          }}
        >Quarter 2</QuarterButton>
        <QuarterButton
          $param={quater_selected_check(3, year)}
          disabled={checkQuaterDisabled(year)}
          onMouseOver={() => {
            setCurrentSelectedQuarter(3);
            onClickQuater(3);
          }}
        >Quarter 3</QuarterButton>
        <QuarterButton
          $param={quater_selected_check(4, year)}
          disabled={checkQuaterDisabled(year)}
          onMouseOver={() => {
            setCurrentSelectedQuarter(4);
            onClickQuater(4);
          }}
        >Quarter 4</QuarterButton>
      </IndividualWrapper>
    );
  }

  const activeYears = years && years.length > 0 ? years : fallbackYears;

  return (
    <TimelineWrapper className="TimelineWrapper" data-annotation="Timeline|Select a year to view conflict data">
      {activeYears.map(year => renderYearItem(year))}
    </TimelineWrapper>
  );
};

export default GlobeTimeline;
