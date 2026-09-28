import * as THREE from 'three';
function makeCanvas(width,height){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
function texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
export function makeLaptopMark() {
  const c = makeCanvas(512, 512), ctx = c.getContext('2d');
  ctx.fillStyle = '#7a8285';
  ctx.font = 'bold 156px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('m/j', 256, 256);
  return texture(c);
}

export function makeContactShadow() {
  const c = makeCanvas(512, 512), ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 256, 36, 256, 256, 247);
  gradient.addColorStop(0, 'rgba(35,39,42,.35)');
  gradient.addColorStop(.55, 'rgba(35,39,42,.14)');
  gradient.addColorStop(1, 'rgba(35,39,42,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  return texture(c);
}
