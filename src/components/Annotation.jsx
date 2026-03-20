import React from 'react';
import styled from 'styled-components';
import _ from 'lodash';
import * as d3 from 'd3';

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: #0d0d18e0;
  z-index: 20;
  transition: opacity 400ms;
  opacity: 0;
  bottom: 0;
  cursor: pointer;
`
const Title = styled.p`
  font-family: 'Roboto';
  font-size: 13px;
  font-weight: 300;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #8a8fb0;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  text-align: center;
  padding: 12px 0;
  background: rgba(20, 20, 35, 0.9);
  border-bottom: 1px solid rgba(142, 149, 206, 0.15);
  backdrop-filter: blur(8px);
  z-index: 100;
  margin: 0;
`
const LabelCard = styled.div`
  position: fixed;
  font-family: 'Roboto';
  color: white;
  pointer-events: none;
  background: rgba(20, 20, 35, 0.9);
  border: 1px solid rgba(142, 149, 206, 0.3);
  border-radius: 4px;
  padding: 6px 10px;
  z-index: 21;
`
const LT = styled.span`
  display: inline;
  font-size: 11px;
  font-weight: 500;
  margin-right: 6px;
`
const LD = styled.span`
  display: inline;
  font-size: 9px;
  font-weight: 200;
  color: #a0a0b8;
`

// Custom placement rules per annotation title
// Each returns { top, left } in viewport coordinates
const PLACEMENT = {
  'Select Region': (rect) => ({
    top: rect.top + rect.height / 2 - 12,
    left: rect.right + 40,
  }),
  'Map Filter': (rect) => ({
    top: rect.top + rect.height / 2 - 12,
    left: rect.right + 40,
  }),
  'Timeline': (rect) => ({
    // To the right of the timeline sidebar, vertically centered
    top: rect.top + 80,
    left: rect.right + 15,
  }),
  'Refugee Routes': (rect) => ({
    // Vertically centered with the route icon, to the right
    top: rect.top - 30,
    left: rect.right + 15,
  }),
  'Map Navigation': (rect) => ({
    // To the left of the zoom controls, aligned with buttons
    top: rect.top + 40,
    left: rect.left - 180,
  }),
  'Asylum Applications': (rect) => ({
    // Centered horizontally in the panel, near the top
    top: rect.top + 120,
    left: rect.left + 20,
  }),
  'Conflict Statistics': () => null, // Handled separately as 3 individual labels
  'Fatality Scale': (rect) => ({
    // Below the legend
    top: rect.bottom + 10,
    left: rect.left,
  }),
  'Data Sources': (rect) => ({
    // To the right of the data sources icon, shifted up
    top: rect.top - 15,
    left: rect.right + 15,
  }),
};

class Annotation extends React.Component {
  constructor(props) {
    super(props);
    this.state = { labels: [] };
  }

  componentDidMount() {
    this.scanLabels();
    this._resize = () => this.scanLabels();
    window.addEventListener('resize', this._resize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._resize);
  }

  scanLabels() {
    const els = document.querySelectorAll('[data-annotation]');
    const labels = [];

    els.forEach((el) => {
      const [title, desc] = el.getAttribute('data-annotation').split('|');
      const rect = el.getBoundingClientRect();
      const name = title.trim();
      const placer = PLACEMENT[name];

      if (placer) {
        const pos = placer(rect);
        if (pos) labels.push({ title: name, desc: desc.trim(), ...pos, key: name });
      }
    });

    // Add three individual stats labels based on the stats board layout
    // Stats board: bottom:50px, right:25%, width = (innerWidth*0.75 - 165 - 90)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const containerWidth = (vw * 0.75) - 165 - 90;
    const cardWidth = containerWidth / 4;
    const marginEnd = containerWidth / 20;
    const statsBottom = 50;
    const statsRight = vw * 0.25;
    const statsLeft = vw - statsRight - containerWidth;

    const statsY = vh - statsBottom - 40 - 35; // 40 = card height, 35 = label above

    const card0Left = statsLeft + marginEnd;
    const gapWidth = (containerWidth - (cardWidth * 3 + marginEnd * 2)) / 2;
    const card1Left = card0Left + cardWidth + gapWidth;
    const card2Left = card1Left + cardWidth + gapWidth;

    labels.push({ key: 'stat1', title: 'Total Fatality', desc: 'All fatalities for selected year', top: statsY, left: card0Left });
    labels.push({ key: 'stat2', title: 'Civilian Fatality', desc: 'Civilian deaths during selected year', top: statsY, left: card1Left });
    labels.push({ key: 'stat3', title: 'Conflict Count', desc: 'Armed conflicts during selected year', top: statsY, left: card2Left });

    this.setState({ labels });
  }

  render() {
    return (
      <Wrapper className='annotation-wrapper' onClick={() => {
        d3.select('.annotation-wrapper').style('opacity', '0');
        _.delay(() => d3.select('.annotation-wrapper').style('display', 'none'), 400);
      }}>
        <Title>Click anywhere to explore Refugee Flow</Title>
        {this.state.labels.map(l => (
          <LabelCard key={l.key} style={{ top: l.top, left: l.left }}>
            <LT>{l.title}</LT>
            <LD>{l.desc}</LD>
          </LabelCard>
        ))}
      </Wrapper>
    );
  }
}

export default Annotation;
