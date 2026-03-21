import React from 'react';
import styled, { css } from 'styled-components';

interface ParagraphProps {
  animate?: boolean;
  isClosed?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const Text = styled.p<ParagraphProps>`
  transition: opacity cubic-bezier(0.13, 0.01, 0.02, 0.92) 1500ms;
  color: #d0d0e0;
  font-family: 'Roboto';
  font-size: 14px;
  font-weight: 300;
  opacity: ${props => (props.animate ? 1 : 0)};
  line-height: 1.8;
  margin: 8px 0;

  &>em>a{
    transition: color 800ms;
    font-family: 'Tajawal';
    font-size: 20px;
    font-weight: 200;
    font-style: normal;
    text-decoration: none;
    color: #9cddf7;
    letter-spacing: 1px;
    cursor: pointer;
    border-bottom: 1px solid rgba(156, 221, 247, 0.3);

    &:hover{
      color: #f2fbff;
      border-bottom-color: #f2fbff;
    }
  }

  &>a{
    transition: color 800ms;
    font-family: 'Roboto';
    font-size: 14px;
    font-weight: 300;
    font-style: normal;
    text-decoration: none;
    color: #9cddf7;
    cursor: pointer;
    border-bottom: 1px solid rgba(156, 221, 247, 0.3);
    &:hover {
      color: #f2fbff;
      border-bottom-color: #f2fbff;
    }
  }

  ${props => props.isClosed && (css`display: none;`)}
`;

const Paragraph: React.FC<ParagraphProps> = (props) => <Text {...props} />;

export default Paragraph;
