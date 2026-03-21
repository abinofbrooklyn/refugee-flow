import React, { useState, useRef, useEffect } from 'react';
import styled, { css } from 'styled-components';
import _ from 'lodash';
import type { RouteDeath } from '../types/api';

import RefugeeRoute_textArea_contentManager from './RefugeeRoute_textArea_contentManager';

/** IBC data shape — keyed by route name */
type IbcData = Record<string, unknown[]>;

interface Props {
  currentRouteName: string | undefined;
  route_death: RouteDeath[];
  route_IBC: IbcData;
  selected_data: string | null;
  clickedPointRemoved: boolean;
  onCollapseToggle: () => void;
  slideoutCollapsed: boolean;
}

const Wrapper = styled.div<{ $toggle?: boolean }>`
  height: ${window.innerHeight - 40 + 'px'};
  position: relative;
  float: right;
  width: 55%;
  margin: 0;
  right: 0;
  transform: ${props => props.$toggle ? `translateX(calc(100% - 48px))` : 'translateX(0)'};
  background: ${props => props.$toggle ? '#1111177a': '#111117'};
  box-shadow: 5px 0px 78px -6px rgba(0,0,0,0.62);
  transition: transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1), background 400ms ease;
  z-index: 2;
  will-change: transform;

  @media (max-width: 1100px) {
    width: 45%;
  }

  @media (max-width: 900px) {
    width: 35%;
  }
`;
const Icon = styled.img`
  position: absolute;
  width: 70px;
  left: -10px;
  top: -16px;
  cursor: pointer;
  opacity: .6;
  transition: all 300ms;
  z-index: 2;
  &:hover{
    opacity: 1;
  }
`;
const CollapseButton = styled.div`
  width: 25px;
  height: 50px;
  border-radius: 3px;
  background: #1D2133;
  position: absolute;
  transform: translateY(-50%);
  top: 50%;
  left: -30px;
  cursor: pointer;
  z-index: 3;

  &>svg{
    top: 50%;
    left: 47%;
    fill: white;
    position: relative;
    transform: translate(-50%,-50%);
    width: 20px;
  }
`;
const TabWrapper = styled.div`
  width: 83%;
  height: 40px;
  position: absolute;
  top: 0px;
  left: 41%;
  transform: translateX(-50%);
`;
const TabItem = styled.div<{ $tabIndex: number; $currentTab: number; $clickedPointRemoved?: boolean }>`
  height: 100%;
  background: ${props => props.$tabIndex === props.$currentTab? '#2D2D3F' : '#2d2d3f00'};
  position: relative;
  float: left;
  width: 30%;
  margin: 0 5px;
  text-align: center;
  cursor: ${props => props.$tabIndex === 3 ? 'default':'pointer'};
  opacity: ${props => {
    if(props.$clickedPointRemoved && props.$tabIndex === 3){
      return 0
    }else{
      return 1
    }
  }};
  border-radius: 4px;
  transition: all 400ms;
  &::before{
    content: '';
    transition: all 400ms;
    width: ${props => props.$tabIndex === props.$currentTab? '98%' : '0%'};
    ${props => props.$tabIndex === props.$currentTab && css`
      position: absolute;
      height: 4px;
      border-radius: 1px;
      background-color: #fff;
      left: 1%;
      bottom: 0;
    `}
  }
  &:focus {outline:0;}
`;
const TabText = styled.p`
  font-family: 'Roboto';
  font-size: 15px;
  color: white;
  margin: auto;
  position: relative;
  top: 45%;
  transform: translateY(-50%);

  &::selection {
    text-shadow: none;
    background: none;
    color: none;
  }
`;

const RefugeeRoute_textArea: React.FC<Props> = ({
  currentRouteName,
  route_death,
  route_IBC,
  selected_data,
  clickedPointRemoved,
  onCollapseToggle,
  slideoutCollapsed,
}) => {
  const [currentTab, setCurrentTab] = useState<number>(1);
  const selectedDataPointRef = useRef<string | null>(null);

  // When selected_data changes: switch to tab 3
  // When clickedPointRemoved: switch back to tab 1
  useEffect(() => {
    selectedDataPointRef.current = selected_data;
    if (selected_data != null) setCurrentTab(3);
  }, [selected_data]);

  useEffect(() => {
    if (clickedPointRemoved) setCurrentTab(1);
  }, [clickedPointRemoved]);

  // If switching to a route without IBC data while on IBC tab, go back to Basic Info
  useEffect(() => {
    const ibcKey = currentRouteName === 'Others' ? 'Other' : currentRouteName;
    if (currentTab === 2 && ibcKey && !route_IBC[ibcKey]) {
      setCurrentTab(1);
    }
  }, [currentRouteName, currentTab, route_IBC]);

  const handleTabClick = (index: number) => {
    setCurrentTab(index);
  };

  // mapbox nav position will change if the tab collapsed
  const navCtrl = document.querySelector('.mapboxgl-ctrl-top-right') as HTMLElement | null;
  if (navCtrl) navCtrl.style.right = slideoutCollapsed ? '3.3%' : '57%';

  const ibcKey = currentRouteName === 'Others' ? 'Other' : currentRouteName;

  return (
    <Wrapper $toggle={slideoutCollapsed}>
      <Icon src='/assets/route_icon.svg' />
      <CollapseButton onClick={onCollapseToggle}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M190.4 354.1L91.9 256l98.4-98.1-30-29.9L32 256l128.4 128 30-29.9zm131.2 0L420 256l-98.4-98.1 30-29.9L480 256 351.6 384l-30-29.9z"/></svg></CollapseButton>
      {/* tab nav */}
      <TabWrapper>
        <TabItem onClick={() => handleTabClick(1)} $tabIndex={1} $currentTab={currentTab}><TabText>Basic Info</TabText></TabItem>
        {ibcKey && route_IBC[ibcKey] && (
          <TabItem onClick={() => handleTabClick(2)} $tabIndex={2} $currentTab={currentTab}><TabText>IBC Involved Country</TabText></TabItem>
        )}
        <TabItem
          onClick={() => !clickedPointRemoved && selected_data && handleTabClick(3)}
          $tabIndex={3}
          $clickedPointRemoved={clickedPointRemoved}
          $currentTab={currentTab}
        ><TabText>Current Select Point</TabText></TabItem>
      </TabWrapper>
      <RefugeeRoute_textArea_contentManager
        currentRouteName={currentRouteName}
        currentTab={currentTab}
        selected_dataPoint={selectedDataPointRef.current}
        route_death_data={route_death}
        IBC_data={route_IBC}
      />
    </Wrapper>
  );
};

export default RefugeeRoute_textArea;
