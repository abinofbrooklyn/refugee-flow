import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { toLower, startCase } from 'lodash';
import styled, { css } from 'styled-components';
import { ScaleLoader } from 'react-spinners';

import { fetchData } from '../utils/fetchers';
import { useAppSelector } from '../../types/redux';

import { LoadingDivWrapper, LoaderGraphWrapper, LoadingIndicator } from '../LoadingBar';
import AsyApplicationChartContainer from './AsyApplicationChartContainer';

import tooltipIcon from './icon_tooltip.png';

const Background = styled.div`
  width: 25%;
  background: #0f1015f7;
  height: calc(100% - 40px);
  position: absolute;
  right: 0;
  top: 40px;
  box-shadow: 5px 0px 78px -6px rgba(0,0,0,0.62);
  display: flex;
  flex-direction: column;

  & ::selection {
    background: none;
    color: none;
    }
`;

const Title = styled.p`
  font-family: 'Roboto';
  font-size: 20px;
  font-weight: 300;
  color: white;
  margin-top: 15px;
  margin-left: 5%;
  margin-bottom: 25px;
  display: block;
  cursor: pointer;
  z-index: 5;
  transition: all 400ms;
  position: relative;
  &:hover{
    color: #d7d7ead4;
  }

  @media (max-width: 1245px) {
    font-size: 16px;
  }
  &:after{
    background-image: ${() => `url(${tooltipIcon})`};
    background-size: 14px 14px;
    display: inline-block;
    width: 14px;
    height: 14px;
    content: "";
    right: -5px;
    position: relative;
  }

  &:before{
    content: 'Asylum application submissions over time';
    font-weight: 100;
    color: white;
    font-size: 11px;
    letter-spacing: 0.7px;
    position: absolute;
    bottom: -18px;
    left: 0;
  }
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  height: 40px;
  margin: 5px 5% 0 5%;
  gap: 5px;
`;

interface SelectedProps {
  $selected?: number;
  $selectedYear?: string;
}

const CurrentYearButton = styled.button<SelectedProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 30px;
  cursor: pointer;
  font-family: 'Ubuntu';
  font-weight: 400;
  font-size: 11px;
  padding: 0 8px;
  background: #3f415845;
  border-radius: 3px;
  border: 1px solid;
  border-color: #3f41581c;
  transition: background 400ms,border-color 1000ms;
  color: white;
  margin-right: 5%;
  white-space: nowrap;

  &:hover{
    background: #2b2c3c;
    border-color: #2e9493cc;
  }
  ${props => props.$selected === 1 && css`
    background: #3f415894;
    border-color: #555875cf;
  `};
  &::after{
    content: ${ props => "'(" + props.$selectedYear + ")'" };
    color: white;
    font-weight: 700;
    font-size: 9px;
    margin-left: 7px;
    text-decoration: underline;
    text-decoration-color: #9ca6d6f7;
  }
`;

const AllYearButton = styled.button<SelectedProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 30px;
  cursor: pointer;
  font-family: 'Ubuntu';
  font-weight: 400;
  font-size: 11px;
  padding: 0 8px;
  background: #3f415845;
  border-radius: 3px;
  border: 1px solid;
  border-color: #3f41581c;
  transition: background 400ms,border-color 1000ms;
  color: white;
  white-space: nowrap;
  &:hover{
    background: #2b2c3c;
    border-color: #2e9493cc;
  }
  ${props => props.$selected === 2 && css`
    background: #3f415894;
    border-color: #555875cf;
  `};
`;

interface AsyApplicationContainerProps {
  loadingManager: boolean;
}

const AsyApplicationContainer: React.FC<AsyApplicationContainerProps> = ({ loadingManager: _loadingManager }) => {
  const selectedYear = useAppSelector(state => state.conflictReducer.selectedYear);
  const currentCountry = useAppSelector(state => state.conflictReducer.currentCountry);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingText] = useState('Loading...');
  const [buttonMode, setButtonMode] = useState(1);
  const [data, setData] = useState<unknown[]>([]);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const url = `${window.location.protocol}//${window.location.host}/data/asy_application_all`;
    fetchData(
      url,
      (d: unknown) => { if (isMountedRef.current) setData(d as unknown[]); },
      (status: boolean) => { if (isMountedRef.current) setLoadingStatus(status); },
    );
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buttonClick = (i: number) => {
    setButtonMode(i);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yearList = (data as any[]).length > 0 ? Object.keys((data as any[])[0]) : [];
  const currentYearLabel = yearList[selectedYear] || '';

  return (
    <Background data-annotation="Asylum Applications|Quarterly asylum application data by country">
      <Title
        onClick={() => d3.select('.annotation-wrapper')
          .style('display', 'block')
          .transition()
          .delay(10)
          .style('opacity', '1')
        }
      >
        {`Total Asylum Application | ${startCase(toLower(currentCountry))}`}
      </Title>
      <ButtonWrapper>
        <CurrentYearButton
          onClick={() => buttonClick(1)}
          $selected={buttonMode}
          $selectedYear={currentYearLabel}
        >
          SHOW CURRENT YEAR
        </CurrentYearButton>
        <AllYearButton
          onClick={() => buttonClick(2)}
          $selected={buttonMode}
        >
          SHOW ALL YEARS
        </AllYearButton>
      </ButtonWrapper>

      <LoadingDivWrapper
        $loading={loadingStatus}
        $leftPercentage="50%"
        $marginTop={-60}
      >
        <LoaderGraphWrapper>
          <ScaleLoader color="#ffffff" loading={loadingStatus} />
        </LoaderGraphWrapper>
        <LoadingIndicator>
          {loadingText}
        </LoadingIndicator>
      </LoadingDivWrapper>
      {data.length > 0 && (
        <AsyApplicationChartContainer
          selectedYear={selectedYear}
          currentCountry={currentCountry}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data={data as any}
          loadingManager={loadingStatus}
          chartMode={buttonMode}
        />
      )}
    </Background>
  );
};

export default AsyApplicationContainer;
