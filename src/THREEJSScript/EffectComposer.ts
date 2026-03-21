/**
 * EffectComposer — vendored THREE.js post-processing script.
 *
 * This is legacy vendored code from an older THREE.js version that used global
 * THREE.* namespace assignment. It references THREE.CopyShader, THREE.ShaderPass,
 * and THREE.MaskPass which are not part of the modern three@0.165.0 public API.
 *
 * NOTE: This file is not imported anywhere in the current codebase. It is
 * preserved here per the locked decision to convert all vendored scripts to .ts
 * rather than leave them as .js with declaration files.
 *
 * @ts-expect-error directives below mark locations where this vendored code
 * accesses THREE.js internal/legacy APIs that have no type definitions.
 */

import * as THREE from 'three';

// Legacy THREE.js global namespace pattern — CopyShader and ShaderPass are not
// part of modern three@0.165.0 exports; accessing them via the THREE namespace
// is a legacy pattern from pre-module THREE.js.
type CopyShader = unknown;
type ShaderPass = {
  render: (
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    delta: number,
  ) => void;
  setSize: (width: number, height: number) => void;
  enabled: boolean;
  needsSwap: boolean;
};
type MaskPass = unknown;
type ClearMaskPass = unknown;

type RenderPass = ShaderPass;

interface EffectComposerInstance {
  renderer: THREE.WebGLRenderer;
  renderTarget1: THREE.WebGLRenderTarget;
  renderTarget2: THREE.WebGLRenderTarget;
  writeBuffer: THREE.WebGLRenderTarget;
  readBuffer: THREE.WebGLRenderTarget;
  passes: RenderPass[];
  copyPass: ShaderPass;
  swapBuffers: () => void;
  addPass: (pass: RenderPass) => void;
  insertPass: (pass: RenderPass, index: number) => void;
  render: (delta: number) => void;
  reset: (renderTarget?: THREE.WebGLRenderTarget) => void;
  setSize: (width: number, height: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const THREE_global = THREE as any;

function EffectComposerConstructor(
  this: EffectComposerInstance,
  renderer: THREE.WebGLRenderer,
  renderTarget?: THREE.WebGLRenderTarget,
): void {
  this.renderer = renderer;

  if (renderTarget === undefined) {
    const parameters = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
    };

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, parameters);
    renderTarget.texture.name = 'EffectComposer.rt1';
  }

  this.renderTarget1 = renderTarget;
  this.renderTarget2 = renderTarget.clone();
  this.renderTarget2.texture.name = 'EffectComposer.rt2';

  this.writeBuffer = this.renderTarget1;
  this.readBuffer = this.renderTarget2;

  this.passes = [];

  // dependencies
  if (THREE_global.CopyShader === undefined) {
    console.error('THREE.EffectComposer relies on THREE.CopyShader');
  }

  if (THREE_global.ShaderPass === undefined) {
    console.error('THREE.EffectComposer relies on THREE.ShaderPass');
  }

  this.copyPass = new THREE_global.ShaderPass(THREE_global.CopyShader) as ShaderPass;
}

Object.assign(EffectComposerConstructor.prototype, {
  swapBuffers(this: EffectComposerInstance): void {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  },

  addPass(this: EffectComposerInstance, pass: RenderPass): void {
    this.passes.push(pass);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    pass.setSize(size.width, size.height);
  },

  insertPass(this: EffectComposerInstance, pass: RenderPass, index: number): void {
    this.passes.splice(index, 0, pass);
  },

  render(this: EffectComposerInstance, delta: number): void {
    let maskActive = false;
    const il = this.passes.length;

    for (let i = 0; i < il; i++) {
      const pass = this.passes[i];

      if (pass.enabled === false) continue;

      pass.render(this.renderer, this.writeBuffer, this.readBuffer, delta);

      if (pass.needsSwap) {
        if (maskActive) {
          // @ts-expect-error -- vendored legacy: renderer.context is not in @types/three@0.165.0
          const context: WebGLRenderingContext = this.renderer.context;
          context.stencilFunc(context.NOTEQUAL, 1, 0xffffffff);
          this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, delta);
          context.stencilFunc(context.EQUAL, 1, 0xffffffff);
        }
        this.swapBuffers();
      }

      if (THREE_global.MaskPass !== undefined) {
        if (pass instanceof (THREE_global.MaskPass as { new(): MaskPass })) {
          maskActive = true;
        } else if (pass instanceof (THREE_global.ClearMaskPass as { new(): ClearMaskPass })) {
          maskActive = false;
        }
      }
    }
  },

  reset(this: EffectComposerInstance, renderTarget?: THREE.WebGLRenderTarget): void {
    if (renderTarget === undefined) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      renderTarget = this.renderTarget1.clone();
      renderTarget.setSize(size.width, size.height);
    }

    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  },

  setSize(this: EffectComposerInstance, width: number, height: number): void {
    this.renderTarget1.setSize(width, height);
    this.renderTarget2.setSize(width, height);

    for (let i = 0; i < this.passes.length; i++) {
      this.passes[i].setSize(width, height);
    }
  },
});

interface PassInstance {
  enabled: boolean;
  needsSwap: boolean;
  clear: boolean;
  renderToScreen: boolean;
  setSize: (width: number, height: number) => void;
  render: (
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    delta: number,
    maskActive: boolean,
  ) => void;
}

function PassConstructor(this: PassInstance): void {
  // if set to true, the pass is processed by the composer
  this.enabled = true;
  // if set to true, the pass indicates to swap read and write buffer after rendering
  this.needsSwap = true;
  // if set to true, the pass clears its buffer before rendering
  this.clear = false;
  // if set to true, the result of the pass is rendered to screen
  this.renderToScreen = false;
}

Object.assign(PassConstructor.prototype, {
  setSize(_width: number, _height: number): void {},

  render(
    _renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    _readBuffer: THREE.WebGLRenderTarget,
    _delta: number,
    _maskActive: boolean,
  ): void {
    console.error('THREE.Pass: .render() must be implemented in derived pass.');
  },
});

export { EffectComposerConstructor as EffectComposer, PassConstructor as Pass };
