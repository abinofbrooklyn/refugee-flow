import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import type { NavigateFunction, Params, Location } from 'react-router-dom';

export interface WithRouterProps {
  navigate: NavigateFunction;
  params: Readonly<Params<string>>;
  location: Location;
}

/**
 * withRouter6 HOC — injects v6 navigation hooks as props.
 *
 * This HOC provides a bridge for class components that cannot use hooks directly.
 * It will be progressively eliminated as components migrate to functional with hooks.
 * Once all consumers have been converted, this file can be removed.
 */
function withRouter6<P extends WithRouterProps>(
  Component: React.ComponentType<P>
): React.FC<Omit<P, keyof WithRouterProps>> {
  function ComponentWithRouterProp(props: Omit<P, keyof WithRouterProps>) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    return (
      <Component
        {...(props as P)}
        navigate={navigate}
        location={location}
        params={params}
      />
    );
  }
  ComponentWithRouterProp.displayName =
    `withRouter6(${(Component as { displayName?: string; name?: string }).displayName || Component.name || 'Component'})`;
  return ComponentWithRouterProp;
}

export default withRouter6;
