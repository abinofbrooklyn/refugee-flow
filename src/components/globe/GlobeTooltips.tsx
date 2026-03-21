import React from 'react';
import styled, { css, keyframes } from 'styled-components';

import * as warDict from '../../data/warDictionary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpandInfo {
  id: unknown;
  notes: string;
  source: string;
}

interface GlobeTooltipsProps {
  mv_tooltips: unknown[];
  mv_show: boolean;
  mv_position?: [number, number];
  tooltips_clicked: boolean;
  tooltips_expendInfo: ExpandInfo[];
  tooltips_onexit: () => void;
  tooltips_onclick: () => void;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const ExpandTooltipsAnimation = keyframes`
  100% {
    height: 300px;
    width: 400px;
  }
`;

const TooltipWarpper = styled.div<{
  showornot?: boolean;
  mv_position?: [number, number];
  expendornot?: boolean;
}>`
  z-index: 10;
  position: absolute;
  opacity: 1;
  background: #15151ce6;
  box-shadow: 0px 0px 25px 2px rgba(0,0,0,0.75);
  width: 350px;
  height: 100px;
  color: white;
  overflow: hidden;
  cursor: ${props => props.expendornot ? 'default' : 'pointer'};
  transition: all 300ms ease-in-out;

  ${props => !props.showornot && css`
    animation: ${keyframes`
      100% {
        filter: blur(5px);
        opacity: 0;
        visibility: hidden;
      }
    `} .35s;
    animation-fill-mode: forwards;
  `}

  ${props => props.mv_position && css`
    left: ${ props.mv_position[0] - (350/2) + 'px'};
    top:  ${ props.mv_position[1] + 30 + 'px'};
  `}

  ${props => props.expendornot && css`
    animation: ${ExpandTooltipsAnimation} .4s;
    animation-fill-mode: forwards;
  `}
`;

const Fatality = styled.p`
  font-family: 'Roboto';
  font-size: 20px;
  font-weight: 300;
  color: white;
  margin: 0;
  position: absolute;
  top: 7px;
  right: 10px;

  &:before{
    content: 'Fatality: ';
    color: #b6b7ca;
    font-size: 9px;
    font-weight: 400;
    right: 7px;
    position: relative;
  }
`;

const Country = styled.p<{ region?: string }>`
  font-family: 'Roboto';
  font-size: 11px;
  font-weight: 400;
  color: white;
  margin: 0;
  left: 41px;
  position: absolute;
  width: 100%;
  top: 10px;

  &:after{
    content:${props => props.region ? "'" + props.region + "'" : ''};
    position: absolute;
    color: white;
    top: 17px;
    left: 0;
  }

  &:before{
    content: '';
    width: 6px;
    position: absolute;
    height: 30px;
    background-color: #fff;
    left: -15px;
  }
`;

const Event = styled.p<{ expendornot?: boolean }>`
  font-family: 'Roboto';
  font-size: 18px;
  font-weight: 900;
  color: white;
  margin: 0;
  top: 55px;
  position: relative;
  left: 27px;
  width: 95%;

  &:after{
    content: ${props => !props.expendornot ? "'Click to expand'" : '""'};
    text-decoration: underline;
    color: #b6b7ca;
    font-size: 9px;
    font-weight: 400;
    position: relative;
    top: 0px;
    left: 5px;
  }
`;

const ExpandNotes = styled.p`
  font-family: 'Roboto';
  font-size: 12px;
  font-weight: 100;
  left: 25px;
  position: relative;
  top: 62px;
  width: 88%;
  line-height: 1.8;
`;

const ExpandSource = styled.p<{ hideText?: boolean }>`
  font-family: 'Roboto';
  font-size: 12px;
  font-weight: 500;
  color: #d3d3e6;
  position: absolute;
  bottom: 0;
  right: 10px;
  ${props => !props.hideText && css`
    display: none;
  `}
`;

const ExitButton = styled.button`
  font-family: 'Roboto';
  font-size: 10px;
  position: absolute;
  left: 5px;
  top: 5px;
  color: white;
  background: none;
  border: none;
  cursor: pointer;
  opacity: .7;
  transition: all 300ms;
  &:hover{
    opacity: 1;
    font-size: 15px;
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function toUpper(str: string): string {
  return str.toLowerCase().split(' ').map(word => word[0].toUpperCase() + word.substr(1)).join(' ');
}

const GlobeTooltips: React.FC<GlobeTooltipsProps> = (props) => {
  const {
    mv_tooltips,
    mv_show,
    mv_position,
    tooltips_clicked,
    tooltips_expendInfo,
    tooltips_onexit,
    tooltips_onclick,
  } = props;

  const id = mv_tooltips[0];
  const cot = mv_tooltips[1] as string[];
  const fat = mv_tooltips[2] as number;
  const evt = mv_tooltips[3] as number;
  // int = mv_tooltips[4] (not used in render)

  let expandNoteText: string | undefined;
  const limitation_note = 459;
  if (tooltips_expendInfo[0] != undefined) {
    const temp = tooltips_expendInfo[0].notes.toString().length;
    expandNoteText = temp > limitation_note
      ? tooltips_expendInfo[0].notes.slice(0, limitation_note) + '...'
      : tooltips_expendInfo[0].notes;
  }

  let expend_source_text: string | undefined;
  const limitation_source = 50;
  if (tooltips_expendInfo[0] != undefined) {
    const t = tooltips_expendInfo[0].source
      .replace(/[-a-zA-Z0-9@:%_+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_+.~#?&//=]*)?/gi, '')
      .replace(/;/g, '');
    const temp = t.toString().length;
    expend_source_text = temp > limitation_source
      ? 'Source: ' + t.slice(0, limitation_note)
      : 'Source: ' + t;
  }

  return (
    <TooltipWarpper
      showornot={mv_show}
      mv_position={mv_position}
      expendornot={tooltips_clicked}
      onClick={() => !tooltips_clicked && tooltips_onclick()}
    >
      <ExitButton onClick={() => tooltips_onexit()}>x</ExitButton>
      <Country region={cot && cot[1]}> {cot && cot[0]} </Country>
      <Fatality> {fat} </Fatality>
      <Event expendornot={tooltips_clicked}> {evt !== undefined && warDict.eventDict[evt] ? toUpper(warDict.eventDict[evt]) : ''} </Event>
      <ExpandNotes> {expandNoteText} </ExpandNotes>
      <ExpandSource hideText={tooltips_clicked}>{expend_source_text}</ExpandSource>
    </TooltipWarpper>
  );
};

export default GlobeTooltips;
