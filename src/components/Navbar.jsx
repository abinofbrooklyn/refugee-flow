import React from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import withRouter6 from './router/withRouter6';

const NavbarContainer = styled.div`
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
    content: 'A Comparative Study on Global Conflict and Human Movement';
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
const Nav = styled.nav`
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

  ${props => props.currentPage === "conflict" && css`
    > a:first-child{
      color: #ffffff;
      border-bottom-color: #8e95ce;
    }
  `}

  ${props => props.currentPage === "route" && css`
    > a:nth-child(2){
      color: #ffffff;
      border-bottom-color: #8e95ce;
    }
  `}

  ${props => props.currentPage === "about" && css`
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
class Navbar extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      hovered: false,
      loadBar: false,
      currentPage:null
    }
  }

  componentDidMount(){
    this.setState({loadBar: !this.state.loadBar},() =>{
      setTimeout(() => this.setState({loadBar: !this.state.loadBar}), 8000);
    });

    const regex_route = RegExp('route','gi');
    const regex_conflict = RegExp('conflict','gi');
    const regex_about = RegExp('about','gi');

    this.updateCurrentPage(window.location.pathname);
  }

  componentDidUpdate(prevProps) {
    if (this.props.location && prevProps.location &&
        this.props.location.pathname !== prevProps.location.pathname) {
      sessionStorage.setItem('lastPage', prevProps.location.pathname);
      this.updateCurrentPage(this.props.location.pathname);
    }
  }

  updateCurrentPage(pathname) {
    const regex_route = RegExp('route','gi');
    const regex_conflict = RegExp('conflict','gi');
    const regex_about = RegExp('about','gi');

    if(regex_route.test(pathname)){
      this.setState({currentPage: 'route'})
    }
    else if (regex_conflict.test(pathname)) {
      this.setState({currentPage: 'conflict'})
    }
    else if (regex_about.test(pathname)) {
      this.setState({currentPage: 'about'})
    } else {
      this.setState({currentPage: null})
    }
  }

  render(){

    return (
      <NavbarContainer
        $loadBar={this.state.loadBar}
        $hovered={this.state.hovered} id="nav-show">
          <Link to='/'
            onMouseOver={() => this.setState({hovered: true})}
            onMouseOut={() => this.setState({hovered: false})}>
            Refugee Flow
          </Link>
          <Nav currentPage={this.state.currentPage}>
            <Link to='/conflict' onClick={() => this.setState({currentPage: 'conflict'})}>Conflict</Link>
            <Link to='/route/EasternMediterranean' onClick={() => this.setState({currentPage: 'route'})}>Route</Link>
            <Link to='/about' onClick={() => this.setState({currentPage: 'about'})}>About</Link>

            <a onClick={() => window.open('https://donate.unhcr.org/us-en/redirect')}>Donate</a>
          </Nav>
        </NavbarContainer>
    )
  }

}
export default withRouter6(Navbar);
