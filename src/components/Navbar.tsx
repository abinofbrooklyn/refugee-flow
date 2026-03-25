import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled, { css } from 'styled-components';

interface NavContainerProps {
  $loadBar?: boolean;
  $hovered?: boolean;
}

interface NavProps {
  $currentPage: string | null;
}

const NavbarContainer = styled.div<NavContainerProps>`
  height: 40px;
  background: #2d2d4a;
  position: relative;
  box-shadow: inset 0px 11px 40px -11px rgba(0, 0, 0, 0.97);
  z-index: 2;
  transition: all 2000ms;

  &::before{
    content: '';
    width: ${props => props.$loadBar ? '100%':'0%'};
    height: 4px;
    background: #00ffb0bd;
    position: absolute;
    top: 0;
    transition: inherit;
  }

  > a:first-child{
    font-family: 'Ubuntu',sans-serif;
    font-weight: 900;
    font-size: 18px;
    color: white;
    text-decoration: none;
    padding-left: 30px;
    position: relative;
    transition: all 200ms;
    top: 9px;
    &:hover{
      filter: drop-shadow(0px 2px 5px #a2a2c9);

    }
  }

  > a:first-child:after{
    content: 'Mapping the Human Cost of Conflict';
    font-family: 'Ubuntu';
    font-weight: 100;
    color: white;
    opacity: 0.4;
    transition: 400ms all;
    font-size: 11px;
    position: relative;
    left: 20px;
    bottom: 1px;
    width: 300px;
    word-spacing: 3px;
    filter: drop-shadow(0px 0px 0px #000) !important;
  }

  & ::selection {
    background: none;
    color: none;
    }
`
const Nav = styled.nav<NavProps>`
  position: relative;
  right: -5px;
  float: right;
  top: 50%;
  transform: translateY(-50%);
  transition: all 400ms;
  > a {
    margin-right: 50px;
    font-family: 'Ubuntu';
    font-size: 14px;
    font-weight: 300;
    color: #a0a0b8;
    transition: all 300ms;
    text-decoration: none;
    cursor: pointer;
    padding: 10px 0;
    border-bottom: 2px solid transparent;
  }
  > a:hover{
    color: #ffffff;
  }

  ${props => props.$currentPage === "conflict" && css`
    > a:first-child{
      color: #ffffff;
      border-bottom-color: #8e95ce;
    }
  `}

  ${props => props.$currentPage === "route" && css`
    > a:nth-child(2){
      color: #ffffff;
      border-bottom-color: #8e95ce;
    }
  `}

  ${props => props.$currentPage === "about" && css`
    > a:nth-child(3){
      color: #ffffff;
      border-bottom-color: #8e95ce;
    }
  `}

  > a:nth-child(4){
    background: #8e95ce;
    padding: 5px 16px;
    color: #1a1a2e;
    margin-right: 15px !important;
    text-align: center;
    border-radius: 4px;
    border-bottom: none;
    font-weight: 500;
    &:hover{
      background: #a4aae0;
      color: #1a1a2e;
      border-bottom: none;
    }
  }
`

function updateCurrentPageFromPathname(pathname: string): string | null {
  if (/route/gi.test(pathname)) return 'route';
  if (/conflict/gi.test(pathname)) return 'conflict';
  if (/about/gi.test(pathname)) return 'about';
  return null;
}

const Navbar: React.FC = () => {
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const [loadBar, setLoadBar] = useState(false);
  const [currentPage, setCurrentPage] = useState<string | null>(() =>
    updateCurrentPageFromPathname(window.location.pathname)
  );

  useEffect(() => {
    setLoadBar(true);
    const timer = setTimeout(() => setLoadBar(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('lastPage', location.pathname);
    setCurrentPage(updateCurrentPageFromPathname(location.pathname));
  }, [location.pathname]);

  return (
    <NavbarContainer
      $loadBar={loadBar}
      $hovered={hovered}
      id="nav-show"
    >
      <Link
        to='/'
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
      >
        Refugee Flow
      </Link>
      <Nav $currentPage={currentPage}>
        <Link to='/conflict' onClick={() => setCurrentPage('conflict')}>Conflict</Link>
        <Link to='/route/EasternMediterranean' onClick={() => setCurrentPage('route')}>Route</Link>
        <Link to='/about' onClick={() => setCurrentPage('about')}>About</Link>

        <a onClick={() => window.open('https://donate.unhcr.org/us-en/redirect')}>Donate</a>
      </Nav>
    </NavbarContainer>
  );
};

export default Navbar;
