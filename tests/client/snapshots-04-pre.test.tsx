/**
 * Pre-conversion snapshots for Phase 07 Plan 04 component conversions.
 * Captures baseline rendering of all 10 components before class→functional conversion.
 * After conversion, re-run to confirm zero rendering regressions.
 */

// Mock d3 — used by Annotation and landing components for DOM manipulation.
// d3 ships ESM-only in v7; snapshot tests use structural output only, not d3 behaviour.
jest.mock('d3', () => ({
  select: jest.fn(() => ({ style: jest.fn(() => ({})) })),
  randomNormal: jest.fn(() => () => 0.5),
  randomUniform: jest.fn(() => () => 0.5),
}));

import React from 'react';
import renderer from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from '../../src/redux/store';

// About group
import About from '../../src/components/about/About';
import Accordion from '../../src/components/about/accordion/Accordion';
import DownloadLink from '../../src/components/about/downloadLink/DownloadLink';
import Paragraph from '../../src/components/about/paragraph/Paragraph';

// Annotation
import Annotation from '../../src/components/Annotation';

// Navbar (uses withRouter6 and needs router + redux)
import Navbar from '../../src/components/Navbar';

// Landing
import DesktopLanding from '../../src/components/landing/DesktopLanding';
import MobileLanding from '../../src/components/landing/MobileLanding';

// Mock window.setTimeout and setInterval so landing pages don't start timers
beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

// Mock MutationObserver for Annotation
global.MutationObserver = class {
  observe() {}
  disconnect() {}
} as unknown as typeof MutationObserver;

describe('Pre-conversion snapshots — about components', () => {
  test('About renders', () => {
    const tree = renderer
      .create(
        <MemoryRouter>
          <About />
        </MemoryRouter>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('Accordion renders open', () => {
    const tree = renderer
      .create(
        <Accordion isClosed={false} animate={true} title="TEST" onToggle={() => {}}>
          <span>child</span>
        </Accordion>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('Accordion renders closed', () => {
    const tree = renderer
      .create(
        <Accordion isClosed={true} animate={false} title="CLOSED" onToggle={() => {}}>
          <span>child</span>
        </Accordion>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('DownloadLink renders', () => {
    const tree = renderer.create(<DownloadLink />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('Paragraph renders', () => {
    const tree = renderer
      .create(
        <Paragraph animate={true} isClosed={false}>
          Hello world
        </Paragraph>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});

describe('Pre-conversion snapshots — annotation', () => {
  test('Annotation renders', () => {
    const tree = renderer.create(<Annotation />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});

describe('Pre-conversion snapshots — navbar', () => {
  test('Navbar renders in router + redux context', () => {
    const tree = renderer
      .create(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/conflict']}>
            <Navbar />
          </MemoryRouter>
        </Provider>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});

describe('Pre-conversion snapshots — landing', () => {
  test('DesktopLanding renders', () => {
    const tree = renderer
      .create(
        <MemoryRouter>
          <DesktopLanding />
        </MemoryRouter>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('MobileLanding renders', () => {
    const tree = renderer.create(<MobileLanding />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
