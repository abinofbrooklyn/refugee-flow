import React from 'react';

import * as THREE from 'three';

class Simple extends React.Component{

  constructor(props) {
    super(props);
    console.log(props);
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
    this.animate = this.animate.bind(this)

  }

  componentDidMount(){
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75,width/height,0.1,1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    const geometry = new THREE.BoxGeometry(1, 1, 1);

    const material = new THREE.MeshBasicMaterial({ color: this.props.ss });
    const cube = new THREE.Mesh(geometry, material);

    camera.position.z = 4;
    scene.add(cube);
    renderer.setClearColor('#000000');
    renderer.setSize(width, height);

    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.material = material
    this.cube = cube

    this.mount.appendChild(this.renderer.domElement)
    this.start();

  }

  componentWillUnmount() {
    this.stop();
    this.mount.removeChild(this.renderer.domElement);
  }

  componentWillReceiveProps(e) {
    console.log(e);

    this.cube.material = new THREE.MeshBasicMaterial({ color: e.ss });

  }

  start() {
    if (!this.frameId) {

      this.frameId = requestAnimationFrame(this.animate)
    }
  }

  stop() {
    cancelAnimationFrame(this.frameId);
  }

  animate() {

    this.cube.rotation.x += 0.01
    this.cube.rotation.y += 0.01

    this.renderScene()

    this.frameId = window.requestAnimationFrame(this.animate)

  }

  renderScene() {
    this.renderer.render(this.scene, this.camera)
  }



  render() {
    return(
      <div
        style={{ width: '400px', height: '400px' }}
        ref={(mount) => {return this.mount = mount }}
      />

    )
  }

}


export default Simple;
