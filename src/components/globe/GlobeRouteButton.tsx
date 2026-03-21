import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import _ from 'lodash';
import * as d3 from 'd3';
import { get_routeCountryList, get_routeCrossingCount } from '../../utils/api';
import type { NavigateFunction } from 'react-router-dom';
import type { RouteCrossingCount } from '../../types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteCountryEntry {
  country: string;
  route: string[];
}

interface GlobeRouteButtonProps {
  navigate: NavigateFunction;
  country: string;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Icon = styled.img`
  position: absolute;
  width: 100px;
  left: 130px;
  top: 270px;
  cursor: pointer;
  opacity: .6;
  transition: all 300ms;
  z-index: 2;
  &:hover{
    opacity: 1;
  }
`;

const Icon_text = styled.p`
  font-weight: 300;
  color: white;
  font-size: 10px;
  position: absolute;
  left: 163px;
  top: 328px;
  -webkit-transition: opacity 500ms,top 300ms;
  transition: opacity 500ms,top 300ms;
  opacity: 0.5;
  font-family: 'Roboto';
  z-index: 2;
`;

const Icon_popup = styled.div`
  position: absolute;
  left: 145px;
  top: 280px;
  width: 250px;
  height: 200px;
  background-color: #1e1e29e0;
  border-radius: 5px;
  z-index: 1;
  display: none;
  opacity: 0;
`;

const Icon_popup_exit = styled.p`
  color: white;
  font-family: 'Helvetica';
  font-size: 14px;
  font-weight: 900;
  position: absolute;
  right: 13px;
  top: -8px;
  opacity: 0.5;
  transition: all 300ms;
  cursor: pointer;
  &:hover{
    opacity: 1;
  }
`;

const Icon_popup_title = styled.p`
  font-family: 'Roboto';
  font-size: 16px;
  color: #ececec;
  margin: 0;
  position: absolute;
  left: 70px;
  top: 15px;
`;

const Icon_popup_subtitle = styled.p`
  font-family: 'Roboto';
  font-weight: 100;
  font-size: 11px;
  line-height: 1.4;
  color: white;
  position: absolute;
  left: 70px;
  top: 31px;
  margin-right: 20px;
`;

const Route_list = styled.div`
  width: 94%;
  margin: 0 3%;
  height: 350px;
  position: absolute;
  bottom: 10px;
  overflow-x: scroll;

  &::-webkit-scrollbar{
    width: 1px;
    height: 0px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #5a5a61;
    -webkit-border-radius: 4px;
  }
`;

const Route_list_title = styled.p`
  color: white;
  left: 20px;
  position: absolute;
  top: 70px;
  font-family: 'Roboto';
  font-weight: 100;
  font-size: 10px;
`;

const Individual_route_listItem = styled.div`
  width: 94%;
  height: 50px;
  background: rgba(42, 42, 56, 0.6);
  margin: 7px 3%;
  cursor: pointer;
  transition: all 300ms;
  border: 1px rgba(50, 50, 74, 0.38) solid;
  &:hover{
    background: rgba(55, 55, 76, 1);
  }
`;

const Individual_route_listItem_title = styled.p`
  font-family: 'Roboto';
  font-size: 14px;
  font-weight: 300;
  color: white;
  position: relative;
  margin: 0;
  transform: translateY(-50%);
  left: 5px;
  top: 15px;
  text-shadow: 4px 2px 9px #909698a6;
`;

const Individual_route_listItem_crossCount = styled.p`
  font-family: 'Roboto';
  font-size: 12px;
  font-weight: 300;
  color: white;
  position: relative;
  margin: 0;
  transform:translateY(-52%);
  left: 5px;
  top: 16px;
  text-align: left;
  &>em{
    font-weight: 800;
  }
`;

const Click_note = styled.p`
  font-family: 'Roboto';
  font-size: 9px;
  font-weight: 300;
  color: white;
  position: relative;
  -webkit-text-decoration: underline;
  text-decoration: underline;
  right: 5px;
  text-align: right;
  top: -11px;
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GLOBAL_ROUTES = [
  'Eastern Mediterranean', 'Central Mediterranean', 'Western Mediterranean',
  'English Channel', 'Western Balkans', 'Eastern Land Borders', 'Americas',
  'Western African', 'Horn of Africa', 'East & Southern Africa',
  'Iran-Afghanistan Corridor', 'South & East Asia',
];

const GlobeRouteButton: React.FC<GlobeRouteButtonProps> = ({ navigate, country }) => {
  const [data, setData] = useState<RouteCountryEntry[]>([]);
  const [cross_count, setCrossCount] = useState<RouteCrossingCount[]>([]);
  const [popup_toggle, setPopupToggle] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get_routeCountryList()
      .then((d) => {
        const entries = d as unknown as RouteCountryEntry[];
        entries.push({ country: 'GLOBAL', route: GLOBAL_ROUTES });
        setData(entries);
      })
      .catch(() => setError('Failed to load route data.'));

    get_routeCrossingCount()
      .then((d: RouteCrossingCount[]) => setCrossCount(d))
      .catch(() => setError('Failed to load route data.'));
  }, []);

  // Toggle popup visibility via d3 (mirrors original imperative style)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel = (d3 as any).select('.route_popup');
    if (!popup_toggle) {
      sel.transition().duration(10).style('opacity', 0)
        .on('end', () => sel.style('width', '250px').style('height', '200px').style('display', 'none'))
        .on('interrupt', () => sel.style('width', '250px').style('height', '200px').style('display', 'none'));
    } else {
      sel.style('display', 'block');
      sel.style('width', '250px').style('height', '200px')
        .transition().duration(400)
        .ease(d3.easeCircle as (t: number) => number)
        .style('opacity', 1)
        .style('width', '350px')
        .style('height', '450px');
    }
  }, [popup_toggle]);

  function render_route_list() {
    const list_d = _.find(data, d => d.country === country);
    if (!list_d) return null;

    return list_d.route.map((routeName, i) => (
      <Individual_route_listItem
        key={'route_item_' + i}
        onClick={() => navigate('/route/' + routeName.replace(/[^a-zA-Z0-9]/g, ''))}
      >
        <Individual_route_listItem_title>{routeName + ' Route'}</Individual_route_listItem_title>
        <Individual_route_listItem_crossCount>
          Total Crossing - <em>{
            d3.format(',')(
              _.find(cross_count, _d => _d.route === routeName)?.total_cross ?? 0
            )
          }</em>
        </Individual_route_listItem_crossCount>
        <Click_note>Click for more...</Click_note>
      </Individual_route_listItem>
    ));
  }

  return (
    <div>
      <Icon_popup className="route_popup">
        <Icon_popup_exit onClick={() => setPopupToggle(false)}>x</Icon_popup_exit>
        <Icon_popup_title>
          Refugee Flee Route - {country.charAt(0).toUpperCase() + country.toLowerCase().slice(1)}
        </Icon_popup_title>
        <Icon_popup_subtitle>
          people can't get asylum application through or dont know how to. Include illegal border crossing(IBC).
        </Icon_popup_subtitle>
        <Route_list_title>Involved Routes</Route_list_title>
        <Route_list>
          {error
            ? <p style={{ color: '#ff6b6b', fontFamily: 'Roboto', fontWeight: 300, fontSize: '12px', padding: '10px' }}>{error}</p>
            : country && data.length > 0 ? render_route_list() : null
          }
        </Route_list>
      </Icon_popup>
      <Icon
        src='./assets/route_icon.svg'
        onClick={() => setPopupToggle(prev => !prev)}
      />
      <Icon_text data-annotation="Refugee Routes|View migration routes and death data">ROUTE</Icon_text>
    </div>
  );
};

export default GlobeRouteButton;
