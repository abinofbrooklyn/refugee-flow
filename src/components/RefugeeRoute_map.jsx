import React from 'react';
import styled from 'styled-components';
import _ from 'lodash';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as d3 from 'd3';
import * as d3CanvasTransition from 'd3-canvas-transition';
import { color_map } from '../data/routeDictionary';
import '../stylesheets/RefugeeRoute_map.css';

import dataDict from '../data/IBC_crossingCountByCountry.json';

// Map new IOM cause_of_death categories to original display categories
const CAUSE_MAP = {
  "Drowning": "drowning or exhaustion related death",
  "Vehicle accident / death linked to hazardous transport": "violent accidental death (transport; blown in minefield...)",
  "Accidental death": "violent accidental death (transport; blown in minefield...)",
  "Violence": "authorities related death",
  "Harsh environmental conditions / lack of adequate shelter, food, water": "unknown - supposedly exhaustion related death",
  "Sickness / lack of access to adequate healthcare": "unknown - supposedly exhaustion related death",
  "Mixed or unknown": "other",
};
const mapCause = (cause) => {
  if (!cause) return "other";
  if (CAUSE_MAP[cause]) return CAUSE_MAP[cause];
  const parts = cause.split(',');
  for (const p of parts) { if (CAUSE_MAP[p]) return CAUSE_MAP[p]; }
  return cause; // return as-is if it's already an old category
};

export default class RefugeeRoute_map extends React.Component {

  constructor(props){
    super(props);
    this.passRemoveClickedPointManager = props.passRemoveClickedPointManager;
    this.passClickedPointManager = props.passClickedPointManager;
    this.currentRouteName = props.currentRouteName;
    this.data = _.groupBy(props.data,d => d.route);
    this.currentMapParams = _.find(dataDict,d => d.route === this.currentRouteName) || dataDict[0];
    this.canvas_overlay_render = this.canvas_overlay_render.bind(this);
    this.canvas_overlay_drawCall = this.canvas_overlay_drawCall.bind(this);
    this.handleMousemove = this.handleMousemove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.state = {
      mouseover_toggle: true,
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps){
    this.banned_category = nextProps.banned_category;
    this.data = _.groupBy(nextProps.data,d => d.route);
    this.currentMapParams = _.find(dataDict,d => d.route === nextProps.currentRouteName) || dataDict[0];

    if(this.currentRouteName != nextProps.currentRouteName){
      this.currentRouteName = nextProps.currentRouteName;
      this.canvas_overlay_render(() => this.map.flyTo({center: [this.currentMapParams.center_lng,this.currentMapParams.center_lat],zoom:this.currentMapParams.zoom}));
    }else{
      this.canvas_overlay_render();
    }
  }

  componentDidMount() {
    this.map = new maplibregl.Map({
      container: this.mapContainer,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      attributionControl: false,
      center: [this.currentMapParams.center_lng,this.currentMapParams.center_lat],
      zoom: this.currentMapParams.zoom,
      // bearing: -14.57,
      // pitch: 39.50,
    }).addControl(new maplibregl.NavigationControl(),'top-right');

    this.mapContainer_width = this.mapContainer.offsetWidth;
    this.mapContainer_height = this.mapContainer.offsetHeight;

    d3.select(this.map.getCanvasContainer())
      .append('canvas')
      .attr('height',this.mapContainer_height)
      .attr('width',this.mapContainer_width)
      .style('opacity',0.999)
      .style('position','absolute')
      .style('top','0')
      .style('left','0')
      .style('pointer-events','none')
      .attr('class','canvas_overlay');

    this.size_change =1;
    this.canvas = document.querySelector('.canvas_overlay');
    this.ctx = this.canvas.getContext('2d');
    this.myZoom = {start: this.map.getZoom() , end: this.map.getZoom()};

    this.map.on('zoomstart',(e) => this.myZoom.start = this.map.getZoom());
    this.map.on('zoomend',(e) => this.myZoom.end = this.map.getZoom());
    this.map.on('viewreset', () => this.canvas_overlay_render());
    this.map.on('move', () => this.canvas_overlay_render());

    // traverse data points
    this.map.on('mousemove',this.handleMousemove); // check moseovered point;
    this.map.on('click',this.handleClick)
    this.canvas_overlay_render();
  }

  handleMousemove(e){
    let p = this.tree.find(e.point.x, e.point.y);
    if(p) this.intersected_id = p.id;
    this.canvas_overlay_render();
    // console.log(p.cause_of_death);
  }

  handleClick(e){
    let p = this.tree.find(e.point.x, e.point.y);
    if(p && this.state.mouseover_toggle) this.passClickedPointManager(p);

    this.setState({mouseover_toggle: !this.state.mouseover_toggle},() =>{

      if(p){
        // register/cancel mousemove listener
        !this.state.mouseover_toggle
          ? this.map.off('mousemove',this.handleMousemove)
          : this.map.on('mousemove',this.handleMousemove);
        // fly
        !this.state.mouseover_toggle
          ? this.canvas_overlay_render(() => this.map.flyTo({center: [p.lng,p.lat],zoom:10, offset:[-500,0]}))
          : this.canvas_overlay_render(() => this.map.flyTo({center: [p.lng,p.lat],zoom:9, offset:[-500,0]}));
        // inform cancel selected points
        this.state.mouseover_toggle && this.passRemoveClickedPointManager();
      }
    });
  }

  canvas_overlay_render(cb){
    this.data_filtered = [];
    // this.ctx.save();
    this.ctx.clearRect(0, 0, this.mapContainer_width, this.mapContainer_height);
    // this.ctx.translate(this.mapContainer_width/2, this.mapContainer_height/2);
    // this.ctx.scale((2) * 0.5 / Math.PI * Math.pow(2, this.map.getZoom()),(2) * 0.5 / Math.PI * Math.pow(2, this.map.getZoom()));

    if(this.currentRouteName){

      this.sizeScaler = d3.scaleLinear()
        .domain(d3.extent(this.data[this.currentRouteName], d => +d.dead_and_missing))
        .range([2,50]);
      // individual cases
      if(this.currentRouteName === 'Others'){
        // max > 500
        this.sizeScaler = d3.scaleLinear()
          .domain(d3.extent(this.data[this.currentRouteName], d => +d.dead_and_missing))
          .range([2,200]);
      }
      // individual cases
      if(this.currentRouteName === 'Central Mediterranean'){
        // max > 500
        this.sizeScaler = d3.scaleLinear()
          .domain(d3.extent(this.data[this.currentRouteName], d => +d.dead_and_missing))
          .range([2,120]);
      }
    }

    this.currentRouteName && this.data[this.currentRouteName].forEach(d =>{
      const mappedCause = mapCause(d.cause_of_death);
      if(this.banned_category != undefined && this.banned_category.length >0){
        let check = _.find(this.banned_category,banned => banned === mappedCause);
        if(!check){
          this.data_filtered.push(d);
          this.canvas_overlay_drawCall(d, mappedCause);
        }
      }else{
        this.data_filtered.push(d);
        this.canvas_overlay_drawCall(d, mappedCause);
      }
    })
    // this.ctx.restore();
    // quadtree optimized mouseover
    this.tree = d3.quadtree()
      .extent([0,0], [this.mapContainer_width,this.mapContainer_height])
      .x(d => d.map_coord_x)
      .y(d => d.map_coord_y)
      .addAll(this.data_filtered);

    cb && cb();

  }

  canvas_overlay_drawCall(d, mappedCause){
    if(-90 > d.lat || d.lat > 90){
      // data corruption on raw data part
      var ready = this.map.project(new maplibregl.LngLat(d.lng,90));
    }else{
      var ready = this.map.project(new maplibregl.LngLat(d.lng,d.lat));
    }
    d.map_coord_x = ready.x;
    d.map_coord_y = ready.y;
    let size = this.sizeScaler(+d.dead_and_missing) * this.size_change;
    const causeLookup = mappedCause || mapCause(d.cause_of_death);
    var colorEntry = _.find(color_map,_d =>_d.key === causeLookup);
    var color = colorEntry ? colorEntry.value : '#5CFFE2CC';

    if(this.intersected_id && d.id === this.intersected_id) var color =  '#FFFFFFDE';

    //set up new path & required method after clear method
    this.ctx.beginPath();
    this.ctx.moveTo(d.map_coord_x + size , d.map_coord_y);
    this.ctx.arc(d.map_coord_x, d.map_coord_y, size  , 0, Math.PI*2);
    if((this.intersected_id && d.id === this.intersected_id) && !this.state.mouseover_toggle){
      this.ctx.strokeStyle="#666C82CC";
      this.ctx.lineWidth=10;
      this.ctx.stroke();
    }
    // Bright outline + glow for incidents with media coverage
    if(d.description){
      this.ctx.shadowColor = '#FFFFFF';
      this.ctx.shadowBlur = 8;
      this.ctx.strokeStyle="#FFFFFFDD";
      this.ctx.lineWidth=2;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }
    this.ctx.fillStyle = color;
    this.ctx.fill();
    // this.ctx.restore();
  }

  componentWillUnmount() {
    if (this.map) this.map.remove();
  }

  render(){
    const style = {
      position: 'absolute',
      width: '100%',
      height: window.innerHeight - 40 + 'px',
      zIndex: 0,
    };
    return <div style={style} ref={el => this.mapContainer = el} />
  }
}
