import React from 'react';
import styled from 'styled-components';

interface AccordionProps {
  isClosed: boolean;
  animate: boolean;
  title: string;
  onToggle: () => void;
  children?: React.ReactNode;
}

const Wrapper = styled.div`
  width: 100%;
  position: relative;
  margin-top: 10px;
  border-bottom: 1px solid rgba(141, 216, 214, 0.3);
  padding-bottom: 8px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px 0;

  &:hover p {
    color: #ceeefb;
  }
`;

const Title = styled.p<{ animate: boolean }>`
  transition: font-size 800ms, color 800ms, filter 500ms;
  color: #8BDEFF;
  font-family: 'Tajawal';
  font-size: ${props => (props.animate ? '28px' : '0px')};
  font-weight: 200;
  font-style: normal;
  letter-spacing: 2px;
  margin: 0;
`;

const Toggle = styled.p`
  font-family: 'Roboto';
  font-size: 28px;
  font-weight: 100;
  color: white;
  opacity: .8;
  margin: 0;
  user-select: none;
  flex-shrink: 0;
  padding-left: 20px;
`;

const Accordion: React.FC<AccordionProps> = ({ isClosed, animate, title, onToggle, children = null }) => (
  <Wrapper>
    <Header onClick={onToggle}>
      <Title animate={animate}>{title}</Title>
      <Toggle>{isClosed ? '+' : '–'}</Toggle>
    </Header>
    {children}
  </Wrapper>
);

export default Accordion;
