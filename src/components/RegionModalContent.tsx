import React, { useState, useRef, useEffect } from 'react';
import styled, { css } from 'styled-components';
import * as d3 from 'd3';
import _ from 'lodash';
import { countryCode } from '../data/warDictionary';
import { ScaleLoader } from 'react-spinners';
import { LoadingDivWrapper, LoaderGraphWrapper, LoadingIndicator } from './LoadingBar';

const RegionContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
  background-color: #15151cd1;
  box-shadow: 0px 16px 20px 11px rgba(6, 6, 14, 0.38);
  border-radius: 10px;
`;

const SectionContainer = styled.div`
  width: 100%;
  flex: 1;
  min-height: 0;
  position: relative;
`;

interface FadeProps {
  fade?: boolean;
}

const SectionItemWrapper = styled.div<FadeProps>`
  width: 95%;
  margin: 0 auto;
  height: 100%;
  overflow-y: scroll;
  opacity: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 10px;

  &::-webkit-scrollbar{
    width: 2px;
  }
  &::-webkit-scrollbar-thumb{
    background-color: #5a5a61;
    -webkit-border-radius: 4px;
  }

  ${props => props.fade && css`
    filter: brightness(0.3);
  `}
`;

const SectionItem = styled.div`
  height: 350px;
  background: #3535504d;
  position: relative;
  transition: all 800ms;
  &:hover{
    background: #353550b3;
  }
`;

const SectionTitle = styled.p`
  color: white;
  font-family: 'Roboto';
  font-size: 15px;
  font-weight: 100;
  text-align: center;
  text-transform: capitalize;
  top: 290px;
  position: absolute;
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
`;

interface BubbleProps {
  size?: number;
}

const Bubble = styled.div<BubbleProps>`
  border-radius:50%;
  background: #6A6A8C;
  top: 50%;
  left: 50%;
  transform: translate(-50%,-50%);
  position: absolute;
  transition: all 800ms;
  ${props => props.size !== undefined && css`
    width: ${props.size + 'px'};
    height: ${props.size + 'px'};
  `}
`;

interface FatNumProps {
  textChange?: string | false;
}

const Fat_num = styled.p<FatNumProps>`
  font-family: 'Roboto';
  font-weight: 600;
  color: white;
  font-size: 30px;
  position: absolute;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);

  &::after{
    ${props => props.textChange
      ? css` content: ${'\'Number of Fatality - ' + props.textChange + '\''};`
      : css` content: 'Total number of Fatality';`
    }
    font-weight: 300;
    font-size: 12px;
    position: absolute;
    width: 300px;
    top: 50px;
    left: 50%;
    text-align: center;
    transform: translateX(-50%);
  }
`;

interface MouseoverButtonProps {
  heightMap?: number;
  tag?: string;
}

const MouseoverButton = styled.div<MouseoverButtonProps>`
  width: calc((100% - 72px) / 9);
  height: ${props => (props.heightMap ?? 0) + 'px'};
  background: white;
  position: relative;
  top: 0;
  float: left;
  margin: 0 4px;
  cursor: pointer;
  transition: all 200ms;
  font-weight: 300;
  color: white;
  z-index: 100;

  &:after{
    content: ${props => "'" + (props.tag ?? '') + "'"};
    font-weight: inherit;
    font-size: 12px;
    position: absolute;
    top: 0px;
    padding-top: 20px;
    color: inherit;
    font-family: 'Roboto';
    left: 50%;
    text-align: center;
    transform: translateX(-50%);
  }
`;

interface CountryData {
  country: string;
  total_fat: number;
  fat_year: Record<string, number>;
}

interface RegionModalContentProps {
  data: unknown[];
  clickHandler: (country: string, yearIndex: number) => void;
  closeModal: () => void;
}

const RegionModalContent: React.FC<RegionModalContentProps> = ({ data, clickHandler, closeModal }) => {
  const [mv, setMv] = useState<boolean>(false);
  const [mv_year, setMvYear] = useState<number | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingText] = useState('Loading...');
  const [fadeOutModal, setFadeOutModal] = useState(false);

  const prevDataRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (prevDataRef.current !== data) {
      prevDataRef.current = data;
      d3.select('.sectionItemWrapper').style('opacity', 1);
      setLoadingStatus(false);
    }
  });

  const visualization = (d: unknown[]): React.ReactNode[] => {
    const sorted = _.sortBy(d as CountryData[], item => item.total_fat).reverse();
    const jsxArray: React.ReactNode[] = [];
    const minMax = d3.extent(sorted, item => item.total_fat) as [number, number];
    const scaler = d3.scaleLinear<number>().domain(minMax).range([0, 300]).nice();
    const heightMap_scaler = d3.scaleLinear<number>().domain(minMax).range([1, 20]).nice();

    for (let i = 0; i < sorted.length; i++) {
      const flagCode = (() => {
        const query = _.find(countryCode, _d => _d.full === sorted[i].country);
        if (query !== undefined) return query['code'];
        return undefined;
      })();
      void flagCode; // used for future flag display

      const yearKeys = Object.keys(sorted[i].fat_year);
      jsxArray[i] = (
        <SectionItem key={i}>
          {(() => {
            const mouseOverButtonGroup: React.ReactNode[] = [];
            yearKeys.forEach((_year, _i) => {
              mouseOverButtonGroup[_i] = (
                <MouseoverButton
                  key={_year}
                  tag={_year}
                  heightMap={heightMap_scaler(sorted[i].fat_year[_year])}
                  className={'section-mouseover-button-y' + _year}
                  onMouseOver={() => {
                    setMv(true);
                    setMvYear(_i);
                    d3.selectAll('.section-mouseover-button-y' + _year)
                      .style('background', 'rgb(255, 65, 65)')
                      .style('color', 'rgb(255, 65, 65)')
                      .style('font-weight', '900');
                  }}
                  onMouseOut={() => {
                    setMv(false);
                    setMvYear(null);
                    d3.selectAll('.section-mouseover-button-y' + _year)
                      .style('background', 'white')
                      .style('color', 'white')
                      .style('font-weight', '300');
                  }}
                  onClick={() => {
                    setLoadingStatus(true);
                    setFadeOutModal(true);
                    setTimeout(() => {
                      closeModal();
                      clickHandler(sorted[i].country, mv_year ?? _i);
                    }, 10);
                  }}
                />
              );
            });
            return mouseOverButtonGroup;
          })()}
          <SectionTitle>
            {sorted[i].country.charAt(0).toUpperCase() + sorted[i].country.toLowerCase().slice(1)}
          </SectionTitle>
          <Bubble
            size={mv && mv_year !== null
              ? scaler(sorted[i].fat_year[yearKeys[mv_year]])
              : scaler(sorted[i].total_fat)}
          />
          <Fat_num
            textChange={mv && mv_year !== null ? yearKeys[mv_year] : false}
          >
            {d3.format(',')(
              mv && mv_year !== null
                ? sorted[i].fat_year[yearKeys[mv_year]]
                : sorted[i].total_fat,
            )}
          </Fat_num>
        </SectionItem>
      );
    }

    return jsxArray;
  };

  return (
    <RegionContainer>
      <SectionContainer>
        <LoadingDivWrapper loading={loadingStatus} leftPercentage="50%" marginTop={-60}>
          <LoaderGraphWrapper>
            <ScaleLoader color="#ffffff" loading={loadingStatus} />
          </LoaderGraphWrapper>
          <LoadingIndicator>{loadingText}</LoadingIndicator>
        </LoadingDivWrapper>
        <SectionItemWrapper className="sectionItemWrapper" fade={fadeOutModal}>
          {visualization(data)}
        </SectionItemWrapper>
      </SectionContainer>
    </RegionContainer>
  );
};

export default RegionModalContent;
