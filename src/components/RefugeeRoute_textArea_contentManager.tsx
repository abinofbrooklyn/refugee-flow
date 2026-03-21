import React, { useState, useEffect } from 'react';
import type { RouteDeath } from '../types/api';
import RefugeeRoute_textArea_content_basicInfo from './RefugeeRoute_textArea_content_basicInfo';
import RefugeeRoute_textArea_content_ibcCountry from './RefugeeRoute_textArea_content_ibcCountry';
import RefugeeRoute_textArea_content_currentSelectedPoint from './RefugeeRoute_textArea_content_currentSelectedPoint';

type IbcData = Record<string, unknown[]>;

interface Props {
  currentRouteName: string | undefined;
  currentTab: number;
  selected_dataPoint: string | null;
  route_death_data: RouteDeath[];
  IBC_data: IbcData;
}

const RefugeeRoute_textArea_contentManager: React.FC<Props> = ({
  currentRouteName,
  currentTab,
  selected_dataPoint,
  route_death_data,
  IBC_data,
}) => {
  const switchingContent = () => {
    if (currentTab === 1) {
      return (
        <RefugeeRoute_textArea_content_basicInfo
          route_death_data={route_death_data}
          currentRouteName={currentRouteName}
        />
      );
    } else if (currentTab === 2) {
      const ibcKey = currentRouteName === 'Others' ? 'Other' : currentRouteName;
      if (!ibcKey || !IBC_data[ibcKey]) {
        return (
          <RefugeeRoute_textArea_content_basicInfo
            route_death_data={route_death_data}
            currentRouteName={currentRouteName}
          />
        );
      }
      return (
        <RefugeeRoute_textArea_content_ibcCountry
          IBC_data={IBC_data}
          currentRouteName={currentRouteName}
        />
      );
    } else if (currentTab === 3) {
      return (
        <RefugeeRoute_textArea_content_currentSelectedPoint
          selected_dataPoint={selected_dataPoint}
        />
      );
    }
    return null;
  };

  return <>{switchingContent()}</>;
};

export default RefugeeRoute_textArea_contentManager;
