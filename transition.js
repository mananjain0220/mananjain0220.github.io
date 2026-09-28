import * as THREE from 'three';

// Render both live scenes only during the handoff. This replaces the white
// flash and hard camera cut; at rest we still render just one scene on demand.
export function createSceneTransition(renderer) {
  const type = renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const targets = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, {type, depthBuffer: true}));
  const material = new THREE.ShaderMaterial({
    uniforms: {first: {value: targets[0].texture}, second: {value: targets[1].texture}, blend: {value: 0}},
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D first;
      uniform sampler2D second;
      uniform float blend;
      varying vec2 vUv;
      void main() {
        vec4 color = mix(texture2D(first, vUv), texture2D(second, vUv), blend);
        gl_FragColor = vec4(color.rgb / max(color.a, 0.0001), color.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb *= gl_FragColor.a;
      }`,
  });
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false; scene.add(quad);
  return {
    resize(width, height) {
      const ratio = Math.min(renderer.getPixelRatio(), 1.25);
      targets.forEach(target => target.setSize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))));
    },
    render(firstScene, firstCamera, secondScene, secondCamera, blend) {
      renderer.setRenderTarget(targets[0]); renderer.render(firstScene, firstCamera);
      renderer.setRenderTarget(targets[1]); renderer.render(secondScene, secondCamera);
      renderer.setRenderTarget(null);
      material.uniforms.blend.value = blend;
      renderer.render(scene, camera);
    },
    dispose() { targets.forEach(target => target.dispose()); material.dispose(); geometry.dispose(); },
  };
}
