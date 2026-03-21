/**
 * Baseline snapshots captured BEFORE Plan 06 JSX -> TSX conversions.
 * Run to generate .snap files; compare after conversion to verify zero regressions.
 */
import React from 'react';
import renderer from 'react-test-renderer';
import { Provider } from 'react-redux';
import store from '../../src/redux/store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal MemoryRouter from react-router-dom to avoid BrowserRouter side-effects */
import { MemoryRouter } from 'react-router-dom';

function withRedux(element: React.ReactElement) {
  return <Provider store={store}>{element}</Provider>;
}

function withReduxRouter(element: React.ReactElement) {
  return (
    <Provider store={store}>
      <MemoryRouter>{element}</MemoryRouter>
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Mock heavy dependencies that are not relevant to snapshot shape
// ---------------------------------------------------------------------------

// Mock d3 entirely — jsdom has no canvas context and d3 ESM sub-packages
// don't transform in Jest's CommonJS environment
jest.mock('d3', () => {
  const noop = () => chainable;
  const chainable: Record<string, unknown> = {};
  // Create a chainable object where all methods return itself
  ['select', 'selectAll', 'append', 'call', 'attr', 'style', 'text', 'datum',
    'enter', 'on', 'remove', 'transition', 'duration', 'delay', 'attrTween',
    'scaleLinear', 'scalePoint', 'scaleLog', 'scalePow', 'scaleTime',
    'axisBottom', 'axisLeft', 'line', 'format', 'extent', 'max', 'curveMonotoneX',
  ].forEach(m => { chainable[m] = noop; });
  chainable.domain = () => chainable;
  chainable.range = () => chainable;
  chainable.nice = () => chainable;
  chainable.invert = (v: unknown) => v;
  chainable.tickSize = () => chainable;
  chainable.tickFormat = () => chainable;
  chainable._groups = [[]];
  return chainable;
});

// Mock fetchData so AsyApplicationContainer doesn't trigger fetch on mount
jest.mock('../../src/components/utils/fetchers', () => ({
  fetchData: jest.fn(),
}));

// Mock react-modal to avoid portal issues in jsdom
jest.mock('react-modal', () => {
  const MockModal = ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null;
  MockModal.displayName = 'MockModal';
  return MockModal;
});

// Mock globe child — still a .jsx file, not relevant to these snapshots
jest.mock('../../src/components/globe/GlobeContainer', () => {
  const Mock = () => <div data-testid="globe-container" />;
  Mock.displayName = 'GlobeContainer';
  return Mock;
});

// Mock ScaleLoader from react-spinners
jest.mock('react-spinners', () => ({
  ScaleLoader: () => <div data-testid="scale-loader" />,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan 06 pre-conversion snapshots', () => {
  it('RegionModalCreator renders closed modal', () => {
    const RegionModalCreator = require('../../src/components/RegionModalCreator').default;
    const tree = renderer
      .create(<RegionModalCreator showModal={false} onCloseRequest={jest.fn()} />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('RegionModalCreator renders open modal with children', () => {
    const RegionModalCreator = require('../../src/components/RegionModalCreator').default;
    const tree = renderer
      .create(
        <RegionModalCreator showModal={true} onCloseRequest={jest.fn()}>
          <div>child content</div>
        </RegionModalCreator>,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('RegionModalNav renders region list', () => {
    const RegionModalNav = require('../../src/components/RegionModalNav').default;
    // Mock data: war events with basic structure
    const mockData = [
      {
        year: '2015',
        value: [[null, [{ cot: ['AFG'], fat: 10 }]]],
        scaler: { invert: (v: number) => v },
      },
    ];
    const tree = renderer
      .create(withRedux(<RegionModalNav data={mockData} pass={jest.fn()} />))
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('AsyApplicationContainer renders with loading state', () => {
    const AsyApplicationContainer = require('../../src/components/asylumApplication/AsyApplicationContainer')
      .default;
    const tree = renderer
      .create(
        withReduxRouter(<AsyApplicationContainer loadingManager={jest.fn()} />),
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
