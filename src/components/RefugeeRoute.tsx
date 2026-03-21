import React, { useState, useEffect, useCallback } from 'react';
import _ from 'lodash';
import { ScaleLoader } from 'react-spinners';
import { useParams } from 'react-router-dom';

import { get_routeDeath, get_routeIBC } from './../utils/api';
import type { RouteDeath, IbcCrossing } from '../types/api';
import RefugeeRoute_titleGroup from './RefugeeRoute_titleGroup';
import RefugeeRoute_textArea from './RefugeeRoute_textArea';
import RefugeeRoute_map from './RefugeeRoute_map';
import RefugeeRoute_map_popup from './RefugeeRoute_map_popup';

const ROUTE_NAMES = [
  "Eastern Mediterranean",
  "Central Mediterranean",
  "Western Mediterranean",
  "English Channel",
  "Western Balkans",
  "Eastern Land Borders",
  "Americas",
  "Western African",
  "Horn of Africa",
  "East & Southern Africa",
  "Iran-Afghanistan Corridor",
  "South & East Asia",
];

const toSlug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

/** IBC data shape returned from the API — keyed by route name */
type IbcData = Record<string, IbcCrossing[]>;

const RefugeeRoute: React.FC = () => {
  const { arg } = useParams<{ arg: string }>();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [routeDeath, setRouteDeath] = useState<RouteDeath[] | null>(null);
  const [routeIBC, setRouteIBC] = useState<IbcData | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(
    () => _.find(ROUTE_NAMES, d => toSlug(d) === arg)
  );
  const [bannedCategory, setBannedCategory] = useState<string[] | null>(null);
  const [clickedDatapoint, setClickedDatapoint] = useState<string | null>(null);
  const [clickedPointRemoved, setClickedPointRemoved] = useState<boolean>(true);
  const [slideoutCollapsed, setSlideoutCollapsed] = useState<boolean>(false);

  const checkCurrentRouteName = useCallback((ibcData: IbcData, deathData: RouteDeath[]) => {
    if (!arg) return;
    // Check IBC routes first
    for (const route in ibcData) {
      if (toSlug(route) === arg) {
        setCurrentRouteName(route);
        return;
      }
    }
    // Also check route_death routes (for Americas and other non-IBC routes)
    if (deathData) {
      const deathRoutes = [...new Set(deathData.map(d => d.route))];
      for (const route of deathRoutes) {
        if (route && toSlug(route) === arg) {
          setCurrentRouteName(route);
          return;
        }
      }
    }
  }, [arg]);

  const fetchRefugeeRoutes = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([get_routeDeath(), get_routeIBC()])
      .then(([d, _d]) => {
        // get_routeIBC returns IbcCrossing[] but the component uses it as a dict keyed by route
        // The actual API returns a dict object; cast accordingly
        const ibcData = _d as unknown as IbcData;
        setRouteDeath(d);
        setRouteIBC(ibcData);
        setLoading(false);
        checkCurrentRouteName(_.clone(ibcData), d);
      })
      .catch(() => {
        setLoading(false);
        setError('Failed to load route data. Please refresh.');
      });
  }, [checkCurrentRouteName]);

  useEffect(() => {
    fetchRefugeeRoutes();
  }, [fetchRefugeeRoutes]);

  const bannedCategoryRef = React.useRef<string[]>([]);

  const passBannedCategoryManager = useCallback((category: string) => {
    const list = bannedCategoryRef.current;
    const idx = list.indexOf(category);
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      list.push(category);
    }
    setBannedCategory([...list]);
  }, []);

  const passClickedPointManager = useCallback((point: object) => {
    setClickedDatapoint(JSON.stringify(point));
    setClickedPointRemoved(false);
  }, []);

  const passRemoveClickedPointManager = useCallback(() => {
    setClickedPointRemoved(true);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e' }}>
        <ScaleLoader color={'#ffffff'} loading={true} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e' }}>
        <p style={{ color: '#ff6b6b', fontFamily: 'Roboto', fontWeight: 300, fontSize: '16px', textAlign: 'center' }}>
          {error}
        </p>
      </div>
    );
  }

  const map = (
    <RefugeeRoute_map
      data={routeDeath!}
      currentRouteName={currentRouteName}
      banned_category={bannedCategory}
      slideoutCollapsed={slideoutCollapsed}
      passClickedPointManager={passClickedPointManager}
      passRemoveClickedPointManager={passRemoveClickedPointManager}
    />
  );

  const map_popup = <RefugeeRoute_map_popup />;

  const title = (
    <RefugeeRoute_titleGroup
      currentRouteName={currentRouteName}
      changeRouteManager={setCurrentRouteName}
      passBannedCategoryManager={passBannedCategoryManager}
    />
  );

  const textArea = (
    <RefugeeRoute_textArea
      currentRouteName={currentRouteName}
      route_death={routeDeath!}
      route_IBC={routeIBC!}
      selected_data={clickedDatapoint}
      clickedPointRemoved={clickedPointRemoved}
      onCollapseToggle={() => setSlideoutCollapsed(prev => !prev)}
      slideoutCollapsed={slideoutCollapsed}
    />
  );

  return (
    <div style={{ position: 'relative' }}>
      {routeDeath && title}
      {routeDeath && map}
      {routeDeath && map_popup}
      {routeDeath && textArea}
    </div>
  );
};

export default RefugeeRoute;
