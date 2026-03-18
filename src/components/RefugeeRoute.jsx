import React from 'react';
import _ from 'lodash';
import { ScaleLoader } from 'react-spinners';

import { get_routeDeath, get_routeIBC } from './../utils/api';
import RefugeeRoute_titleGroup from './RefugeeRoute_titleGroup';
import RefugeeRoute_textArea from './RefugeeRoute_textArea';
import RefugeeRoute_map from './RefugeeRoute_map';
import RefugeeRoute_map_popup from './RefugeeRoute_map_popup';

export default class RefugeeRoute extends React.Component {

  constructor(props){
    super(props);
    this.state = {
        loading: true,
        error: null,
        currentRouteName: _.find(["Eastern Mediterranean","Central Mediterranean","Western Mediterranean","Western Balkans","Eastern Land Borders","Western African","Others" ],d => d.replace(' ','') === props.match.params.arg),
        banned_category: null,
        clicked_datapoint: null,
        clickedPointRemoved: true,
        mediaCoverageOnly: false,
    }
    this.fetchRefugeeRoutes = this.fetchRefugeeRoutes.bind(this);
    this.checkCurrentRouteName = this.checkCurrentRouteName.bind(this);
    this.changeRouteManager = this.changeRouteManager.bind(this);
    this.passBannedCategoryManager = this.passBannedCategoryManager.bind(this);
    this.toggleMediaCoverageOnly = this.toggleMediaCoverageOnly.bind(this);
    this.passClickedPointManager = this.passClickedPointManager.bind(this);
    this.passRemoveClickedPointManager = this.passRemoveClickedPointManager.bind(this);
    this.banned_category = [];
  }

  componentDidMount () {
    this.fetchRefugeeRoutes();
  }

  fetchRefugeeRoutes () {
    this.setState({ loading: true, error: null });
    Promise.all([get_routeDeath(), get_routeIBC()])
      .then(([d, _d]) => {
        this.setState({ route_death: d, route_IBC: _d, loading: false });
        this.checkCurrentRouteName(_.clone(_d));
      })
      .catch(() => {
        this.setState({ loading: false, error: 'Failed to load route data. Please refresh.' });
      });
  }

  checkCurrentRouteName(data){
    // Check IBC routes first
    for (var route in data) {
      if(route.replace(' ','') === this.props.match.params.arg){
        this.setState({currentRouteName: route})
        return;
      }
    }
    // Also check route_death routes (for Americas and other non-IBC routes)
    if (this.state.route_death) {
      const deathRoutes = [...new Set(this.state.route_death.map(d => d.route))];
      for (const route of deathRoutes) {
        if (route && route.replace(' ','') === this.props.match.params.arg) {
          this.setState({currentRouteName: route})
          return;
        }
      }
    }
  }

  changeRouteManager(name){
    this.setState({currentRouteName : name});
  }

  passBannedCategoryManager(category){
    if(_.find(this.banned_category,d => d === category)){
      for (var i = this.banned_category.length -1; i >= 0 ; i--) {
        if(this.banned_category[i] === category){
          this.banned_category.splice(i, 1);
        }
      }
    }else{
      this.banned_category.push(category);
    }

    this.setState({banned_category : this.banned_category});
  }

  toggleMediaCoverageOnly(){
    this.setState(prev => ({mediaCoverageOnly: !prev.mediaCoverageOnly}));
  }

  passClickedPointManager(point){
    this.setState({clicked_datapoint: JSON.stringify(point), clickedPointRemoved: false});
  }

  passRemoveClickedPointManager(){
    console.log('removed point manager called');
    this.setState({clickedPointRemoved: true});
  }

  render() {
    if (this.state.loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e' }}>
          <ScaleLoader color={'#ffffff'} loading={true} />
        </div>
      );
    }

    if (this.state.error) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e' }}>
          <p style={{ color: '#ff6b6b', fontFamily: 'Roboto', fontWeight: 300, fontSize: '16px', textAlign: 'center' }}>
            {this.state.error}
          </p>
        </div>
      );
    }

    const map = <RefugeeRoute_map
      data = {this.state.route_death}
      currentRouteName = {this.state.currentRouteName}
      banned_category = {this.state.banned_category}
      passClickedPointManager = {this.passClickedPointManager}
      passRemoveClickedPointManager = {this.passRemoveClickedPointManager}
    />

    const map_popup = <RefugeeRoute_map_popup/>

    const title = <RefugeeRoute_titleGroup
      currentRouteName = {this.state.currentRouteName}
      changeRouteManager = {this.changeRouteManager}
      passBannedCategoryManager = {this.passBannedCategoryManager}
    />

    const textArea = <RefugeeRoute_textArea
      currentRouteName = {this.state.currentRouteName}
      route_death = {this.state.route_death}
      route_IBC = {this.state.route_IBC}
      selected_data = {this.state.clicked_datapoint}
      clickedPointRemoved = {this.state.clickedPointRemoved}
    />
    return(
      <div style={{ position: 'relative' }}>
        {this.state.route_death && title}
        {this.state.route_death && map}
        {this.state.route_death && map_popup}
        {this.state.route_death && textArea}
      </div>
    )
  }
}
