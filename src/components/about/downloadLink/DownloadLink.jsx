import React from 'react';
import styled from 'styled-components';

import DownloadIcon from './icon_download.svg';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 0;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 300ms;

  &:hover {
    opacity: 1;
  }
`;

const Label = styled.span`
  font-family: 'Tajawal';
  font-size: 14px;
  font-weight: 200;
  color: white;
  text-decoration: underline;
`;

const MEDIA_KIT_LINK = 'https://drive.google.com/drive/folders/1hR2JjaMN8DzXA8VyixHJ5zAiolnpoTSF?usp=sharing';

const DownloadLink = () => (
  <Wrapper onClick={() => window.open(MEDIA_KIT_LINK, '_blank')}>
    <DownloadIcon width="16" height="16" />
    <Label>Download Press Kit</Label>
  </Wrapper>
);

export default DownloadLink;
