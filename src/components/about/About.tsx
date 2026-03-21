import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

import DownloadLink from './downloadLink/DownloadLink';
import Accordion from './accordion/Accordion';
import Paragraph from './paragraph/Paragraph';

import { accordions, accordionsDefaultVisibility } from './config/accordionsConfig';

const Wrapper = styled.div<{ animate: boolean }>`
  height: 100vh;
  overflow-x: scroll;
  &::-webkit-scrollbar { width: 6px };
  &::-webkit-scrollbar-thumb {
    background-color: #91eae3;
    -webkit-border-radius: 16px;
  }
  transition: all 400ms;
  opacity: ${props => (props.animate ? 1 : 0)};

  & ::selection {
    text-shadow: 0 0 0.8rem #9DD4FF;
    background: #13b0f330;
    color: #0af5dd;
  }
`;

const Content = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 40px 100px;
`;

const About: React.FC = () => {
  const [AccordionsVisibility, setAccordionsVisibility] = useState(accordionsDefaultVisibility);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimate(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Wrapper animate={animate}>
      <Content>
        <DownloadLink />

        {accordions.map(({ name, contents }) => (
          <Accordion
            key={name}
            isClosed={AccordionsVisibility[name].isClosed}
            onToggle={() => setAccordionsVisibility({
              ...AccordionsVisibility,
              [name]: { isClosed: !AccordionsVisibility[name].isClosed },
            })}
            animate={animate}
            title={name}
          >
            {contents.map((content, i) => (
              <Paragraph
                key={i}
                animate={animate}
                isClosed={AccordionsVisibility[name].isClosed}
                {...content}
              />
            ))}
          </Accordion>
        ))}
      </Content>
    </Wrapper>
  );
};

export default About;
