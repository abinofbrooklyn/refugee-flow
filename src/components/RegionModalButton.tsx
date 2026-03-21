import React, { useState, useRef } from 'react';
import styled, { css } from 'styled-components';
import RegionModalCreator from './RegionModalCreator';
import RegionModalNav from './RegionModalNav';
import RegionModalContent from './RegionModalContent';

const SwitchCountryButton = styled.button`
  cursor: pointer;
  color: white;
  font-family: 'Ubuntu';
  font-size: 15px;
  font-weight: 700;
  background: #3f415845;
  position: absolute;
  top: 110px;
  padding: 8px 20px 9px 50px;
  border-radius: 3px;
  border: 1px solid;
  border-color: #3f41581c;
  transition: background 400ms, border-color 1000ms;
  &:hover{
    background: #3f415894;
    border-color: #555875cf;
  }
  &:before{
    background-image: url(./assets/location_icon.png);
    background-size: 50%;
    background-repeat: no-repeat;
    width: 26px;
    height: 25px;
    content: "";
    bottom: 0px;
    right: 127px;
    position: absolute;
  }
`;

interface CurrentCountryTagProps {
  $currentCountry?: string;
}

const CurrentCountryTag = styled.div<CurrentCountryTagProps>`
  background: #3f415891;
  position: absolute;
  top: 110px;
  color: white;
  left: 187px;
  padding: ${props => props.$currentCountry !== 'GLOBAL' ? '5px 15px 5px 25px' : '5px 15px 5px 15px'};
  border-radius: 4px;
  border: 1px solid #060610b5;
  font-family: 'Roboto';
  font-size: 10px;
  font-weight: 400;
  cursor: ${props => props.$currentCountry !== 'GLOBAL' ? 'pointer' : 'default'};
  transition: all 400ms;

  ${props => props.$currentCountry !== 'GLOBAL' && css`
    background: #3f4158;
    border-color: #8387b185;
  `};

  &:before{
    ${props => props.$currentCountry && css`
      content: ${props.$currentCountry !== 'GLOBAL' ? "'x'" : "none"};
    `}
    font-weight: 300;
    color: white;
    font-size: 12px;
    position: absolute;
    left: 10px;
    top: 2px;
  }
  &:hover{
    ${props => props.$currentCountry !== 'GLOBAL' && css`
      background: #2b2c3c;
      border-color: #2e9493cc;
    `};
  }
`;

const RegionTitle = styled.p`
  font-family: 'Roboto';
  font-size: 25px;
  color: white;
  font-weight: 300;
  z-index: 1;
  padding: 20px 30px 0;
  margin: 0 0 40px 0;

  &::after{
    content: 'Select a region to view regional conflict data. Click on a year to view conflict data for a selected country by year';
    font-weight: 300;
    color: white;
    font-size: 12px;
    display: block;
    margin-top: 10px;
  }
`;

const ModalInnerContainer = styled.div`
  width: 100%;
`;

interface RegionModalButtonProps {
  data: unknown;
  currentCountry: string;
  countryChangeHandler: (country: string, yearIndex: number) => void;
  removeCountryHandler: () => void;
  children?: React.ReactNode;
}

const RegionModalButton: React.FC<RegionModalButtonProps> = ({
  data,
  currentCountry,
  countryChangeHandler,
  removeCountryHandler,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [visualizeSectionData, setVisualizeSectionData] = useState<unknown[]>([]);

  const dataRef = useRef(data);
  dataRef.current = data;

  const handleToggleModal = () => {
    setShowModal(prev => !prev);
  };

  const passCountryToRegion = (regionData: Record<string, unknown[]>, currentSelection: string) => {
    setVisualizeSectionData(regionData[currentSelection]);
  };

  return (
    <div>
      <SwitchCountryButton
        type="button"
        data-annotation="Select Region|View conflict data for a specific country or region"
        onClick={handleToggleModal}
      >
        Select Region
      </SwitchCountryButton>
      <CurrentCountryTag $currentCountry={currentCountry} onClick={removeCountryHandler}>
        {currentCountry}
      </CurrentCountryTag>

      <RegionModalCreator showModal={showModal} onCloseRequest={handleToggleModal}>
        <ModalInnerContainer>
          <RegionTitle>Explore Regional Conflicts</RegionTitle>
          <RegionModalNav data={data} pass={passCountryToRegion} />
        </ModalInnerContainer>
        {visualizeSectionData.length > 0 && (
          <RegionModalContent
            data={visualizeSectionData}
            clickHandler={countryChangeHandler}
            closeModal={handleToggleModal}
          />
        )}
      </RegionModalCreator>
    </div>
  );
};

export default RegionModalButton;
