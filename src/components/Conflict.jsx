import React from 'react';
import _ from 'lodash';
import * as d3 from 'd3';

import GlobeContainer from './globe/GlobeContainer';
import AsyApplicationContainer from './asylumApplication/AsyApplicationContainer';
import Annotation from './Annotation';
import withRouter6 from './router/withRouter6';

class Conflict extends React.Component {
  constructor(props) {
    super(props);
    this.state = { stillLoading: true };

    this.loadingManager = this.loadingManager.bind(this);
  }

  evokePrompt = _.once(() => {
    const fromLanding = sessionStorage.getItem('lastPage') === '/landing' ||
      !sessionStorage.getItem('lastPage');
    if (!fromLanding) return;
    !this.state.stillLoading && _.delay(() => {
      d3.select('.annotation-wrapper').style('display','block').style('opacity','1');
    }, 2000 )
  })

  loadingManager(boolean){
    this.setState({ stillLoading: boolean});
  }

  render() {

    return (
      <div>
        { (() => !this.state.stillLoading && this.evokePrompt() )() }
        <Annotation />
        <GlobeContainer
          loadingManager={this.loadingManager}
          navigate={this.props.navigate}
        />
        <AsyApplicationContainer
          loadingManager={this.state.stillLoading}
        />
      </div>
    )
  }
}

export default withRouter6(Conflict);
