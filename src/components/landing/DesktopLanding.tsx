import React, { useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import * as d3 from 'd3';
import { Link } from 'react-router-dom';
// SVG imported as React component via vite-plugin-svgr (exportType: 'default')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import HamburgerIconRaw from './icon_hamburger.svg';
const HamburgerIcon = HamburgerIconRaw as unknown as React.FC<React.SVGProps<SVGSVGElement>>;

/* TODO
  Remove window.setInterval(),
  use keyframes instead to achieve animation loop
*/

interface AnimationProps {
  $animation?: boolean;
}

interface VideoLoopProps {
  $videoLoop?: boolean;
}

interface WikiProps {
  $wikiOn?: boolean;
}

const Wrapper = styled.div<AnimationProps>`
  & ::selection {
    text-shadow: 0 0 0.8rem #de2279;
    background: rgba(54, 56, 126, 0.1);
    color: #b6b6cc;
    }

  & > a:first-child{
    z-index: 100;
    font-family: 'Ubuntu',sans-serif;
    font-weight: 900;
    font-size: 18px;
    color: white;
    text-decoration: none;
    padding-left: 30px;
    position: fixed;
    z-index: 999;
    transition: top 1200ms, opacity 2500ms, filter 200ms;
    top: ${props => (props.$animation ? '9px' : '-300px')};
    opacity: ${props => (props.$animation ? 1 : 0)};
    &:hover{
      filter:drop-shadow(0px 2px 8px #bebee4);
    }
  }

  & > a:first-child:after{
    content: 'A Comparitive Study on Conflicts and Human Movement';
    font-family: 'Ubuntu';
    font-weight: 100;
    color: white;
    opacity: ${props => (props.$animation ? 0.4 : 0)};
    transition: 2400ms all;
    font-size: 11px;
    position: relative;
    left: ${props => (props.$animation ? '20px' : '-20px')};
    bottom: 1px;
    width: 300px;
    word-spacing: 3px;
  }
`;

const Intro = styled.div<AnimationProps & VideoLoopProps & WikiProps>`
  color: white;
  position: absolute;
  width: 30px;
  font-family: 'Ubuntu',sans-serif;
  cursor: pointer;
  z-index: 1000;
  top: ${props => props.$animation?'14px':'-300px'};
  opacity: ${props => props.$animation?1:0};
  ${props => !props.$wikiOn
  ? css`
    transition: top 1200ms, opacity 2500ms, filter 1500ms, right 400ms;
    right: 50px;
    font-weight: 500;
    font-size: 12px;
  `
  : css`
    transition: top 200ms, opacity 2500ms, filter 1500ms, right cubic-bezier(0.73, 0.02, 0.58, 0.78) 400ms;
    right: ${() => window.innerWidth - 60 +'px'};
    top: 54px;
    font-weight: 900;
    font-size: 18px;
  `}

  filter: ${props =>{
    if(!props.$wikiOn){
      return props.$videoLoop
        ? 'drop-shadow(0px 2px 11px #ff8b38) contrast(700%)'
        : 'drop-shadow(0px 2px 30px #08081b)'
    }else{
      return 'drop-shadow(0px 2px 30px #08081b)'
    }
  }};


  &:hover{
    filter: drop-shadow(0px 2px 8px #bebee4);
  }
  &>svg{
    ${props => !props.$wikiOn
    ? css`
      top: -4px;
      left: 30px;
    `
    : css`
      top: 0;
      left: 42px;
    `}
    fill: white;
    position: absolute;
    width: 20px;
  }
`;
const IntroPage = styled.div<WikiProps>`
  width: 100%;
  transform: ${props => props.$wikiOn ? 'translateX(0%)' : 'translateX(100%)'};
  height: 100%;
  bottom: 0;
  right: 0;
  z-index: 998;
  opacity: ${props => props.$wikiOn ? '0.98' : '0'};
  transition: transform cubic-bezier(0.73, 0.02, 0.58, 0.78) 400ms, opacity 400ms, background 1600ms;
  position: absolute;
  background: rgba(30, 30, 47, 0.98);
`;
const Exit = styled.div`
  color: white;
  position: absolute;
  right: 50px;
  top: 10px;
  font-size: 30px;
  font-weight: 500;
  font-family: 'Ubuntu';
  cursor: pointer;
  &:hover{
    opacity: 1;
    transition: filter 200ms, opacity 800ms;
    filter:drop-shadow(0px 2px 8px #bebee4);
  }
`;
const IntroWrapper = styled.div<WikiProps>`
  position: relative;
  bottom: -120px;
  width: 40%;
  height: 80%;
  float: left;
  margin: 0px 5%;
  overflow-y: hidden;
  opacity: ${props => props.$wikiOn ? '0.98' : '0'};
  transition: opacity cubic-bezier(0.96, 0.03, 0.4, 1.3) 2000ms;
  &::after{
    content: '';
    width: 130%;
    bottom: -20px;
    height: 0px;
    box-shadow: 0px 0px 140px 70px rgb(29, 28, 45);
    position: absolute;
  }
`;
const IntroParagraph = styled.p`
  color: white;
  font-family: 'Ubuntu';
  font-size: 15px;
  font-weight: 100;
  line-height: 2;
  letter-spacing: 0.7px;
  text-align: left;
`;
const IntroInnerWrapper = styled.div`

  height: calc(80% - 20px);
  overflow-y: scroll;
  bottom: 20px;
  position: absolute;

  &::-webkit-scrollbar{width: 3px}
  &::-webkit-scrollbar-thumb {
    background-color: #35354a;
    -webkit-border-radius: 4px;
  }
`;
const Introtitle = styled.p`
  transition: all 1500ms;
  font-family: 'Ubuntu';
  font-size: 35px;
  font-weight: 700;
  margin-top: 0;
  color: white;
  position: fixed;
  &::after{
    content: 'Read before you explore!';
    font-size: 12px;
    font-weight: 500;
    font-family: 'Roboto';
    color: #f3f5ff;
    position: absolute;
    left: 0;
    top: 50px;
  }
`;
const Copyright = styled.p`
  font-family: 'Roboto';
  font-weight: 480;
  letter-spacing: 0.5px;
  color: white;
  background-color: #254852;
  padding: 5px 20px;
  border-radius: 3px;
  font-size: 12px;
  position: absolute;
  bottom: 0;
  right: 15px;
  padding-right: 30px;

  &>a{
    transition: all 400ms;
    color: #abb1d0;
  }
  &>a:hover{
    color: #1e1e2f;
  }
`;
const Quote = styled.p<AnimationProps & VideoLoopProps>`
  position: absolute;
  font-family: 'Playfair Display', serif;
  width: 60%;
  text-align: justify;
  top: ${props => props.$animation?'40%':'37%'};
  opacity: ${props => props.$animation?1:0};
  left: 50%;
  transform: translate(-50%,-50%);
  font-size: 30px;
  letter-spacing: 2px;
  line-height: 2;
  color: #ffffff;
  transition: top 2100ms,opacity 4300ms;
  z-index: 2;
  &::after{
    content: "- Filippo Grandi, Former UN High Commissioner for Refugees";
    position: absolute;
    font-family: serif;
    font-size: 15px;
    font-weight: 400;
    font-style: italic;
    letter-spacing: 0.5px;
    color: #ffffff;
    left: 0;
    bottom: ${props => props.$animation?'-50px':'-150px'};
    opacity: ${props => props.$animation?1:0};
    transition: bottom 2100ms,opacity 4300ms;
  }

  &>i{
    filter: ${props =>
      props.$videoLoop
        ? 'blur('+ Math.abs(d3.randomNormal(0,1)()) +'px'+')'
        : 'blur(' + Math.abs(d3.randomNormal(0,1)()) + 'px'+ ')'
    };
    transition: filter 4000ms, color 5000ms;
    color:
    ${props =>{
      const colorArr = ['pink','#cf2d13','#424866','#42664bb0']
      if(props.$videoLoop){
        const index = Math.floor(Math.random()*3);
        return colorArr[index];
      }else{
        const index = Math.floor(Math.random()*3);
        return colorArr[index];
      }
    }};
  }
`;
const Section = styled.section`
  height: 100vh;
`;
const Video = styled.video<AnimationProps & VideoLoopProps>`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    background-size: cover;
    transition: opacity 5500ms, filter 1550ms;
    opacity: ${props => (props.$animation ? 1 : 0)};
    filter: ${props => props.$videoLoop
      ? 'blur('+ Math.abs(d3.randomNormal(0,10)()) +'px'+') hue-rotate(0deg) contrast(1.2) saturate(0.8) brightness(0.5)'
      : 'blur(' + Math.abs(d3.randomNormal(0,10)()) + 'px'+ ') hue-rotate(0deg) contrast(1.2) saturate('+d3.randomUniform(1, 2.5)()+') brightness('+d3.randomUniform(0.4, 1.2)()+')'
    };

    @media (max-width:1590px) and (min-width: 1270px) {
      width: 140%;
    };

    @media (max-width: 1269px) {
      width: 180%;
    };

    @media (min-width:1590px){
      width: 125%;
    };

    @media (max-width:890px){
      width: 250%;
    };

    @media (max-width:650px){
      width: 500%;
    };
`;
const BoxShadow = styled.div`
  position: absolute;
  width: 100%;
  z-index: 1;
  box-shadow: 1px 10px 950px 230px rgba(1, 14, 23, 0.9);
`;
const Launch = styled.a<AnimationProps>`
  text-align: center;
  text-decoration: none;
  z-index: 100;
  position: absolute;
  left: 50%;
  bottom: ${props => props.$animation?'70px':'200px'};
  opacity: ${props => props.$animation?1:0};
  transition: background 2000ms, bottom 3000ms,opacity cubic-bezier(1, 0.03, 0.48, 1.01) 3500ms;
  transform: translateX(-50%);
  font-family: 'Ubuntu';
  font-size: 17px;
  color: white;
  background:rgba(234,86,0,.80);
  padding: 15px 45px;
  border-radius: 100px;
  border: 0px;
  &:hover{
    transition: all 400ms;
    background: rgba(234,86,0,1);
    border: 2px #231f419c solid;
    bottom: 72px;
  }
`;

const DesktopLanding: React.FC = () => {
  const [animation, setAnimation] = useState(false);
  const [videoLoop, setVideoLoop] = useState(false);
  const [wikiOn, setWikiOn] = useState(false);

  useEffect(() => {
    d3.select('#nav-show').style('display', 'none');
    const animTimer = window.setTimeout(() => setAnimation(true), 1000);
    const videoInterval = window.setInterval(() => setVideoLoop(prev => !prev), 1650);

    return () => {
      clearTimeout(animTimer);
      clearInterval(videoInterval);
    };
  }, []);

  return (
    <Wrapper $animation={animation}>
      <Link to="/">Refugee Flow</Link>
      <Intro
        $videoLoop={videoLoop}
        $wikiOn={wikiOn}
        $animation={animation}
        onClick={() => setWikiOn(prev => !prev)}
      >
        INFO
        <HamburgerIcon />
      </Intro>
      <IntroPage $wikiOn={wikiOn}>
        <Exit onClick={() => setWikiOn(prev => !prev)}>x</Exit>
        <IntroWrapper $wikiOn={wikiOn}>
          <Introtitle>Introduction</Introtitle>
          <IntroInnerWrapper>
            <IntroParagraph>
              To leave one's home country, community, and loved ones is a difficult prospect
              even in times of peace. As violence, persecution, and terror surge the only option for
              survival and security is to flee one's home.
            </IntroParagraph>
            <IntroParagraph>
              By mid-2024, the United Nations High Commissioner for Refugees reported that over 120 million
              people were forcibly displaced worldwide — nearly double the figure from just seven years prior.
              Conflict, persecution, violence, and human rights violations continue to drive this unprecedented crisis.
            </IntroParagraph>
            <IntroParagraph>
              To become a refugee is to be stripped of the foundations of a normal life — home, community,
              livelihood, and identity. Refugees are met with closed borders, hostile policies, and the
              indifference of nations that see them as a burden rather than as people. Yet each refugee
              makes the impossible choice to leave behind everything they know in search of safety.
            </IntroParagraph>
            <IntroParagraph>
              Every refugee represents a failure of the international community to protect its most vulnerable.
            </IntroParagraph>
          </IntroInnerWrapper>
        </IntroWrapper>

        <IntroWrapper $wikiOn={wikiOn}>
          <Introtitle>The Approach</Introtitle>
          <IntroInnerWrapper>
            <IntroParagraph>
              Refugee Flow draws on multiple authoritative sources to tell the story of how people become
              refugees. This project examines one of the fundamental drivers of the global refugee crisis:
              the collapse of order and stability across regions of the world.
            </IntroParagraph>
            <IntroParagraph>
              This visualization traces the impact of conflict, persecution, and violence on the lives of
              people in their home countries. It explores what drives millions to flee and the dangerous
              journeys they undertake.
            </IntroParagraph>
            <IntroParagraph>
              The project maps the routes taken by those who are forcibly displaced and documents the dangers
              they face along the way. Many who set out on these journeys never reach their destination. The
              data collected here presents where and how those lives were lost.
            </IntroParagraph>
          </IntroInnerWrapper>
        </IntroWrapper>


        <Copyright>Built by: <a href='https://willsu.io'>Will Su</a>, <a href="https://github.com/abinofbrooklyn">Abin Abraham</a></Copyright>
      </IntroPage>
      <div id="video">
        <BoxShadow />
        <Section>
          <Video $animation={animation} $videoLoop={videoLoop} autoPlay muted loop style={{ backgroundVideo: 'url(assets/img/hero.jpg)' } as React.CSSProperties}>
            <source src="https://player.vimeo.com/external/278983563.hd.mp4?s=df2675a8395d48ad7b455f155ae148361121b298&profile_id=175" />
          </Video>
          <Quote $videoLoop={videoLoop} $animation={animation}>
            "At <i>sea</i>, a frightening number of refugees and migrants are dying each year. On <i>land</i>, people fleeing war are finding their way blocked by closed <i>borders</i>. Closing borders does not solve the problem"
          </Quote>
        </Section>
      </div>
      <Launch $animation={animation} href="/conflict">Launch Visualization</Launch>
    </Wrapper>
  );
};

export default DesktopLanding;
