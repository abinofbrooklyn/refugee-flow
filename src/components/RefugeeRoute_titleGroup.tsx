import React, { useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import _ from 'lodash';
import { color_map } from '../data/routeDictionary';
import dataDict from '../data/IBC_crossingCountByCountry.json';

const Wrapper = styled.div`
  position: absolute;
  width: 100%;
  z-index: 1;
  height: 0;
  box-shadow: 1px 10px 950px 180px rgba(0,0,0,0.82);
  top: 10px;
`;
const Title = styled.p`
  color: white;
  font-family: 'Roboto';
  font-size: 26px;
  font-weight: 200;
  margin: 0;
  top: 30px;
  left: 60px;
  position: relative;
  width: 400px;
  cursor: default;

  &:after{
    content: 'An exploration of the causes of death and injury faced by migrants on their chosen routes.';
    left: -30px;
    color: white;
    position: absolute;
    top: 40px;
    width: 450px;
    font-family: 'Roboto';
    font-weight: 400;
    font-size: 12px;
  }
`;
const Button_previous = styled.div<{ disabled?: boolean }>`
  position: absolute;
  width: 22px;
  left: 30px;
  top: 30px;
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  opacity: ${props => props.disabled ? 0.15 : 0.6};
  transition: all 300ms;
  margin: 0;
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};

  &:hover{opacity: ${props => props.disabled ? 0.15 : 1};}
`;
const Button_next = styled.div<{ disabled?: boolean }>`
  position: relative;
  width: 22px;
  left: 30px;
  top: 11px;
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  opacity: ${props => props.disabled ? 0.15 : 0.6};
  transition: all 300ms;
  margin: 0;
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};

  &:hover{opacity: ${props => props.disabled ? 0.15 : 1};}
`;
const Legend = styled.div`
  left: 30px;
  top: 60px;
  position: relative;
  width: 45%;
`;
const LegendItem = styled.p<{ color: string; hide?: boolean }>`
  color: #121217;
  font-size: 10px;
  font-family: 'Roboto';
  font-weight: 500;
  background: ${props => props.color};
  position: relative;
  float: left;
  padding: 5px;
  border-radius: 5px;
  margin: 5px 9px 0px 0px;
  opacity: ${props => props.hide ? 0.15 : 0.85};
  transition: all 300ms;
  cursor: pointer;
  &:hover{
    opacity: ${props => props.hide ? 0.3 : 1};
  }
`;

const Instructions = styled.div`
  left: 30px;
  bottom: 20px;
  position: fixed;
  background: #f5f5ff21;
  border-radius: 2px;
  transition: all 400ms;
  cursor: default;
  &>p{
    color: #ffffffde;
    font-size: 12px;
    font-family: 'Roboto';
    font-weight: 300;
    padding: 0 10px;
    margin: 5px 0;
  }

  &:hover{
    background: #2a467d54;
    &>p{
      color: #ffffff;
    }
  }
`;

interface Props {
  currentRouteName: string | undefined;
  changeRouteManager: (name: string) => void;
  passBannedCategoryManager: (category: string) => void;
}

const toSlug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

const RefugeeRoute_titleGroup: React.FC<Props> = ({ currentRouteName, changeRouteManager, passBannedCategoryManager }) => {
  const [legendHide, setLegendHide] = useState<Record<number, boolean>>({});

  const handleClick = (type: 'previous' | 'next') => {
    const index = _.findIndex(dataDict, d => d.route === currentRouteName);
    if (type === 'previous') {
      if (index !== -1 && index > 0) {
        changeRouteManager(dataDict[index - 1].route);
      }
    } else if (type === 'next') {
      if (index !== -1 && index < dataDict.length - 1) {
        changeRouteManager(dataDict[index + 1].route);
      }
    }
  };

  const handleRouting = (type: 'previous' | 'next'): string => {
    const index = _.findIndex(dataDict, d => d.route === currentRouteName);
    if (index === -1) return currentRouteName ? toSlug(currentRouteName) : '';
    if (type === 'previous') {
      return index > 0 ? toSlug(dataDict[index - 1].route) : toSlug(dataDict[index].route);
    } else {
      return index < dataDict.length - 1 ? toSlug(dataDict[index + 1].route) : toSlug(dataDict[index].route);
    }
  };

  const handleLegendClick = (category: string, index: number) => {
    passBannedCategoryManager(category);
    setLegendHide(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const legendGenerator = () => {
    return color_map.map((d, i) => {
      let text = '';
      if (d.key === 'malicious intent related death / manslaughter') {
        text = 'Malicious intent related death / Manslaughter';
      } else if (d.key === 'unknown - supposedly exhaustion related death') {
        text = 'Unknown - Supposedly exhaustion related death';
      } else {
        text = d.key.charAt(0).toUpperCase() + d.key.substr(1);
      }
      return (
        <LegendItem
          key={'mapLegend_' + i}
          color={d.value}
          hide={legendHide[i]}
          onClick={() => handleLegendClick(d.key, i)}
        >{text}</LegendItem>
      );
    });
  };

  const index = _.findIndex(dataDict, d => d.route === currentRouteName);
  const isFirst = index <= 0;
  const isLast = index === -1 || index >= dataDict.length - 1;

  return (
    <Wrapper>
      <Title>{currentRouteName && currentRouteName}</Title>
      <>
        <Button_previous
          disabled={isFirst}
          onClick={() => !isFirst && handleClick('previous')}>
          <Link to={"/route/" + handleRouting('previous')}>
            <svg fill="white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M128 320l128-128 128 128z"/></svg>
          </Link>
        </Button_previous>

        <Button_next
          disabled={isLast}
          onClick={() => !isLast && handleClick('next')}>
          <Link to={"/route/" + handleRouting('next')}>
            <svg fill="white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M128 192l128 128 128-128z"/></svg>
          </Link>
        </Button_next>
      </>
      <Legend>{legendGenerator()}</Legend>

      <Instructions>
        <p>* Click the up/down arrow to switch between refugee route</p>
        <p>* Click on the text bubbles to add and remove filters on the map</p>
        <p>* Click the circles to access detailed information about the accident/event</p>
      </Instructions>
    </Wrapper>
  );
};

export default RefugeeRoute_titleGroup;
