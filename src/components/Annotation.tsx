import React, { useState, useEffect, useRef } from 'react';
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
  white-space: nowrap;
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

const LABEL_PADDING = 8;

interface LabelPosition {
  top: number;
  left: number;
}

interface Label extends LabelPosition {
  title: string;
  desc: string;
  key: string;
}

type PlacementFn = (rect: DOMRect) => LabelPosition;

// Estimate label width for clamping
function estimateLabelWidth(title: string, desc: string): number {
  return title.length * 6.5 + desc.length * 5 + 32;
}

// Clamp position to stay within viewport
function clamp(pos: LabelPosition, title: string, desc: string): LabelPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const labelW = Math.min(estimateLabelWidth(title, desc), 300);
  const labelH = 28;

  return {
    top: Math.max(LABEL_PADDING + 40, Math.min(pos.top, vh - labelH - LABEL_PADDING)),
    left: Math.max(LABEL_PADDING, Math.min(pos.left, vw - labelW - LABEL_PADDING)),
  };
}

// Design-intent placement rules — position relative to element rect
// Each returns { top, left } in viewport coordinates
const PLACEMENT: Record<string, PlacementFn> = {
  'Select Region': (rect) => ({
    top: rect.top + rect.height / 2 - 12,
    left: rect.right + 40,
  }),
  'Map Filter': (rect) => ({
    top: rect.top + rect.height / 2 - 12,
    left: rect.right + 40,
  }),
  'Timeline': (rect) => ({
    top: rect.top + 80,
    left: rect.right + 15,
  }),
  'Refugee Routes': (rect) => ({
    top: rect.top - 30,
    left: rect.right + 15,
  }),
  'Map Navigation': (rect) => {
    const labelW = 220;
    // Place to the left if there's room, otherwise to the right
    const left = rect.left - labelW - 12 > 0
      ? rect.left - labelW - 12
      : rect.right + 12;
    return { top: rect.top + 40, left };
  },
  'Asylum Applications': (rect) => ({
    top: rect.top + 120,
    left: rect.left + 20,
  }),
  'Fatality Scale': (rect) => ({
    top: rect.bottom + 10,
    left: rect.left,
  }),
  'Data Sources': (rect) => ({
    top: rect.top - 15,
    left: rect.right + 15,
  }),
  'Total Fatality': (rect) => ({
    top: rect.top - 30,
    left: rect.left,
  }),
  'Civilian Fatality': (rect) => ({
    top: rect.top - 30,
    left: rect.left,
  }),
  'Armed Conflict Count': (rect) => ({
    top: rect.top - 30,
    left: rect.left,
  }),
};

// Fallback: place to the right of element, or left if no room, or below
function autoPosition(rect: DOMRect, title: string, desc: string): LabelPosition {
  const vw = window.innerWidth;
  const labelW = Math.min(estimateLabelWidth(title, desc), 300);
  const gap = 12;

  let top = rect.top + rect.height / 2 - 14;
  let left: number;

  if (rect.right + gap + labelW + LABEL_PADDING < vw) {
    left = rect.right + gap;
  } else if (rect.left - gap - labelW - LABEL_PADDING > 0) {
    left = rect.left - gap - labelW;
  } else {
    left = rect.left + rect.width / 2 - labelW / 2;
    top = rect.bottom + gap;
  }

  return { top, left };
}

const Annotation: React.FC = () => {
  const [labels, setLabels] = useState<Label[]>([]);
  const observerRef = useRef<MutationObserver | null>(null);

  const scanLabels = () => {
    const els = document.querySelectorAll('[data-annotation]');
    const newLabels: Label[] = [];

    els.forEach((el) => {
      const attr = el.getAttribute('data-annotation');
      if (!attr || !attr.includes('|')) return;
      const [title, desc] = attr.split('|');
      const name = title.trim();
      const description = desc.trim();
      const rect = el.getBoundingClientRect();

      // Skip elements not in the document flow (no position at all)
      if (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0) return;

      // Use design-intent placement if available, otherwise auto-position
      const placer = PLACEMENT[name];
      const rawPos = placer ? placer(rect) : autoPosition(rect, name, description);

      // Clamp to viewport bounds
      const pos = clamp(rawPos, name, description);
      newLabels.push({ title: name, desc: description, ...pos, key: name });
    });

    setLabels(newLabels);
  };

  useEffect(() => {
    const resizeHandler = _.debounce(() => scanLabels(), 150);
    window.addEventListener('resize', resizeHandler);

    // Watch for when overlay is made visible (triggered externally via d3)
    // and scan labels at that point — all other elements will have loaded
    observerRef.current = new MutationObserver(() => {
      const el = document.querySelector('.annotation-wrapper');
      if (el && getComputedStyle(el).display !== 'none') {
        scanLabels();
      }
    });
    const wrapper = document.querySelector('.annotation-wrapper');
    if (wrapper) {
      observerRef.current.observe(wrapper, { attributes: true, attributeFilter: ['style'] });
    }

    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <Wrapper className='annotation-wrapper' onClick={() => {
      d3.select('.annotation-wrapper').style('opacity', '0');
      _.delay(() => d3.select('.annotation-wrapper').style('display', 'none'), 400);
    }}>
      <Title>Click anywhere to explore Refugee Flow</Title>
      {labels.map(l => (
        <LabelCard key={l.key} style={{ top: l.top, left: l.left }}>
          <LT>{l.title}</LT>
          <LD>{l.desc}</LD>
        </LabelCard>
      ))}
    </Wrapper>
  );
};

export default Annotation;
