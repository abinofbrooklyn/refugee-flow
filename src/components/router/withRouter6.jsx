import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

function withRouter6(Component) {
  function ComponentWithRouterProp(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    return (
      <Component
        {...props}
        navigate={navigate}
        location={location}
        params={params}
      />
    );
  }
  ComponentWithRouterProp.displayName =
    `withRouter6(${Component.displayName || Component.name || 'Component'})`;
  return ComponentWithRouterProp;
}

export default withRouter6;
