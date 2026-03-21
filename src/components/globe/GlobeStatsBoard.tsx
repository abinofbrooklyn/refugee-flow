import React, { useRef, useEffect } from 'react';
import styled, { css } from 'styled-components';
import _ from 'lodash';
import CountUp from 'countup.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsData {
  'Total Fatality': number | false;
  'Civilian Fatality': number | false;
  'Armed Conflict Count': number | false;
}

interface GlobeStatsBoardProps {
  data: StatsData | false | null;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const container_width = (window.innerWidth * 0.75) - 165 - 90;

const BoardWrapper = styled.div<{ $container_width: number }>`
  width: ${props => props.$container_width + 'px'};
  height: 40px;
  position: absolute;
  bottom: 50px;
  right: 25%;
`;

const BoardItem = styled.div<{
  $_width: number;
  $_margin_end: number;
  $container_width: number;
  $order: number;
}>`
  width: ${props => props.$_width + 'px'};
  height: 40px;
  background: #2f2f4ab3;
  border-radius: 4px;
  position: relative;
  float: left;
  transition: all 300ms;

  ${props => props.$order === 0 && css`
    margin-left: ${props.$_margin_end + 'px'};
  `}

  ${props => props.$order === 1 && css`
    margin: ${'0 ' + ((props.$container_width - (props.$_width * 3 + props.$_margin_end * 2)) / 2 + 'px')};
  `}

  ${props => props.$order === 2 && css`
    margin-right: ${props.$_margin_end + 'px'};
  `}

  &:hover{
    background: #2f2f4a;
    cursor: pointer;
  }

  &>p{
    font-family: 'Roboto';
    color: white;
    font-weight: 100;
    font-size: 25px;
    position: relative;
    margin: auto;
    right: 15px;
    text-align: end;
    transform: translateY(-50%);
    top: 50%;
    transition: all 300ms;
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GlobeStatsBoard: React.FC<GlobeStatsBoardProps> = ({ data }) => {
  // Keep previous data for countup animation delta
  const prevDataRef = useRef<StatsData | null>(null);

  useEffect(() => {
    if (!data) return;
    const keys = Object.keys(data) as Array<keyof StatsData>;
    const prev = prevDataRef.current || { 'Total Fatality': 0, 'Civilian Fatality': 0, 'Armed Conflict Count': 0 };

    if (!_.isMatch(prev as object, data as object)) {
      for (let i = 0; i < keys.length; i++) {
        const from = (prev[keys[i]] || 0) as number;
        const to = (data[keys[i]] || 0) as number;
        new CountUp('stats_' + i, from, to, 0, 2.5, {
          useEasing: true,
          useGrouping: true,
          separator: ',',
          decimal: '.',
        }).start();
      }
      prevDataRef.current = { ...data } as StatsData;
    }
  }, [data]);

  const annotations = [
    'Total Fatality|All fatalities for selected year',
    'Civilian Fatality|Civilian deaths during selected year',
    'Conflict Count|Armed conflicts during selected year',
  ];

  function drawBoard(data: StatsData) {
    const keys = Object.keys(data) as Array<keyof StatsData>;
    return keys.map((key, i) => (
      <BoardItem
        key={key}
        $order={i}
        $_width={container_width / 4}
        $_margin_end={container_width / 20}
        $container_width={container_width}
        // name and fontSize as data attributes to avoid styled-components warning;
        // kept as extra props to preserve original pattern
        // @ts-expect-error -- styled-components transient prop pattern; extra props ignored by DOM
        name={(() => {
          if (window.innerWidth < 1450) {
            return i === 2 ? 'Conflict Count' : key;
          }
          return key;
        })()}
        fontSize={window.innerWidth < 1450 ? '9px' : '12px'}
      >
        <span
          data-annotation={annotations[i]}
          style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
        />
        <p id={'stats_' + i}>{Math.floor((data[key] as number) || 0)}</p>
      </BoardItem>
    ));
  }

  return (
    <BoardWrapper $container_width={container_width}>
      {data ? drawBoard(data as StatsData) : null}
    </BoardWrapper>
  );
};

export default GlobeStatsBoard;
