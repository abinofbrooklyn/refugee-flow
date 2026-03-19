import React from 'react';
import styled, { css } from 'styled-components';
import _ from 'lodash';

import RefugeeRoute_textArea_contentManager from './RefugeeRoute_textArea_contentManager';

const Wrapper = styled.div`
  height: ${window.innerHeight - 40 + 'px'};
  position: relative;
  float: right;
  width: 55%;
  margin: 0;
  right:   ${props => props.toggle ? (-window.innerWidth * 0.55) + 21 + 27 + 'px' : 0};${'' /* +27 is showing the route icon */}
  background: ${props => props.toggle ? '#1111177a': '#111117'};
  box-shadow: 5px 0px 78px -6px rgba(0,0,0,0.62);
  z-index: 1;
  transition: all cubic-bezier(0.63, 0.13, 0.01, 0.99) 500ms;
  z-index: 2;

  @media (max-width: 1100px) {
    width: 45%;
  }

  @media (max-width: 900px) {
    width: 35%;
  }
`
const Icon = styled.img`
  position: absolute;
  width: 70px;
  left: -10px;
  top: -16px;
  cursor: pointer;
  opacity: .6;
  transition: all 300ms;
  z-index: 2;
  &:hover{
    opacity: 1;
  }
`
const CollapseButton = styled.div`
  width: 25px;
  height: 50px;
  border-radius: 3px;
  background: #1D2133;
  position: absolute;
  transform: translateY(-50%);
  top: 50%;
  left: -30px;
  cursor: pointer;
  z-index: 3;

  &>svg{
    top: 50%;
    left: 47%;
    fill: white;
    position: relative;
    transform: translate(-50%,-50%);
    width: 20px;
  }
`
const TabWrapper = styled.div`
  width: 83%;
  height: 40px;
  position: absolute;
  top: 0px;
  ${'' /* left: 52%; */}
  left: 41%;
  transform: translateX(-50%);
`
const TabItem = styled.div`
  height: 100%;
  background: ${props => props.tabIndex === props.currentTab? '#2D2D3F' : '#2d2d3f00'};
  position: relative;
  float: left;
  width: 30%;
  margin: 0 5px;
  text-align: center;
  cursor: ${props => props.tabIndex === 3 ? 'default':'pointer'};
  opacity: ${props => {
    if(props.clickedPointRemoved && props.tabIndex === 3){
      return 0
    }else{
      return 1
    }
  }};
  border-radius: 4px;
  transition: all 400ms;
  &::before{
    content: '';
    transition: all 400ms;
    width: ${props => props.tabIndex === props.currentTab? '98%' : '0%'};
    ${props => props.tabIndex === props.currentTab && css`
      position: absolute;
      height: 4px;
      border-radius: 1px;
      background-color: #fff;
      left: 1%;
      bottom: 0;
    `}
  }
  &:focus {outline:0;}
`
const TabText = styled.p`
  font-family: 'Roboto';
  font-size: 15px;
  color: white;
  margin: auto;
  position: relative;
  top: 45%;
  transform: translateY(-50%);

  &::selection {
    text-shadow: none;
    background: none;
    color: none;
  }
`

export default class RefugeeRoute_textArea extends React.Component {

  constructor(props){
    super(props);
    this.state = {
      currentTab: 1,
    }
    this.handleTabClick = this.handleTabClick.bind(this);
    this.clickedPointRemoved = props.clickedPointRemoved;

    this.currentRouteName = props.currentRouteName;
    this.route_death_data = this.props.route_death;
    this.IBC_data = this.props.route_IBC;
  }

  UNSAFE_componentWillReceiveProps(nextProps){
    this.currentRouteName = nextProps.currentRouteName;

    this.selected_dataPoint = nextProps.selected_data;
    this.clickedPointRemoved = nextProps.clickedPointRemoved;
    if(this.selected_dataPoint != null) this.setState({currentTab: 3});
    if(this.clickedPointRemoved) this.setState({currentTab: 1});
    // If switching to a route without IBC data while on IBC tab, go back to Basic Info
    const ibcKey = nextProps.currentRouteName === 'Others' ? 'Other' : nextProps.currentRouteName;
    if (this.state.currentTab === 2 && !this.IBC_data[ibcKey]) {
      this.setState({currentTab: 1});
    }
  }

  handleTabClick(index){
    this.setState({currentTab: index});
  }



  render(){

    // mapbox nav position will change if the tab collapsed
    const navCtrl = document.querySelector('.mapboxgl-ctrl-top-right');
    if (navCtrl) navCtrl.style.right = this.props.slideoutCollapsed ? '3.3%' : '57%';

    return(
      <Wrapper toggle={this.props.slideoutCollapsed}>
        <Icon src='/assets/route_icon.svg'></Icon>
        <CollapseButton onClick={this.props.onCollapseToggle}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M190.4 354.1L91.9 256l98.4-98.1-30-29.9L32 256l128.4 128 30-29.9zm131.2 0L420 256l-98.4-98.1 30-29.9L480 256 351.6 384l-30-29.9z"/></svg></CollapseButton>
        {/* tab nav */}
        <TabWrapper>
          <TabItem onClick={()=> this.handleTabClick(1)} tabIndex={1} currentTab={this.state.currentTab}><TabText>Basic Info</TabText></TabItem>
          {this.IBC_data[this.currentRouteName === 'Others' ? 'Other' : this.currentRouteName] && (
            <TabItem onClick={()=> this.handleTabClick(2)} tabIndex={2} currentTab={this.state.currentTab}><TabText>IBC Involved Country</TabText></TabItem>
          )}
          <TabItem onClick={()=> !this.clickedPointRemoved && this.selected_dataPoint && this.handleTabClick(3)} tabIndex={3} clickedPointRemoved ={this.clickedPointRemoved} currentTab={this.state.currentTab}><TabText>Current Select Point</TabText></TabItem>
        </TabWrapper>
        <RefugeeRoute_textArea_contentManager
          currentRouteName = {this.currentRouteName}
          currentTab={this.state.currentTab}
          selected_dataPoint={this.selected_dataPoint}
          route_death_data = {this.route_death_data}
          IBC_data = {this.IBC_data}
        />
      </Wrapper>
    )
  }
}
