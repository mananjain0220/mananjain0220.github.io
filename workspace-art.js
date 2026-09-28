// Local code-native artwork. These schematics explain methods; they are not
// measured research results, live analyses or screenshots of private work.
import { workAreas, workOrder, screenLayout, screenTabs } from './profile.js?v=workspace-1';

import { palette } from './palette.js?v=palette-1';

const {screen: ink, paper, screenMuted: muted, screenAccent: highlight, accent} = palette;
function line(c, points, color = muted, width = 4) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke();
}
function box(c, x, y, w, h, r, fill, stroke) {
  c.beginPath(); c.roundRect(x,y,w,h,r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 3; c.stroke(); }
}
function circle(c, x, y, r, fill, stroke, width = 3) {
  c.beginPath(); c.arc(x,y,r,0,Math.PI*2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function label(c, text, x, y, size = 32, color = paper, align = 'left', font = 'Arial') {
  c.fillStyle = color; c.font = `${size}px ${font}`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(text,x,y);
}
function arrow(c, x1, y1, x2, y2, color = muted) {
  line(c, [[x1,y1],[x2,y2]], color, 4);
  const a = Math.atan2(y2-y1,x2-x1), s = 13;
  line(c, [[x2-s*Math.cos(a-.55),y2-s*Math.sin(a-.55)],[x2,y2],[x2-s*Math.cos(a+.55),y2-s*Math.sin(a+.55)]], color, 4);
}
function curve(c, points, color = muted, width = 5) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round';
  c.beginPath(); c.moveTo(points[0],points[1]); c.bezierCurveTo(...points.slice(2)); c.stroke();
}

// Deterministic symbolic wave, without axes, scores or synthetic measurements.
function signal(c, x, y, w, amplitude, color, width = 6) {
  const points = Array.from({length:81}, (_,i) => {
    const t = i/80;
    return [x+t*w,y-Math.sin(t*Math.PI*8)*Math.exp(-(((t-.5)*4)**2))*amplitude];
  });
  line(c,points,color,width);
}

function research(c) {
  // Aligned traces -> comparison aperture -> candidate attribution branches.
  box(c,158,332,470,292,18,palette.screenSurface,palette.screenLine);
  label(c,'OBSERVATIONS',184,378,25,muted);
  for (const [i,y] of [442,505,566].entries()) {
    line(c,[[186,y],[599,y]],palette.screenLine,2);
    signal(c,195,y,394,16+i*5,i===1?highlight:muted,5);
  }
  arrow(c,650,486,747,486);
  circle(c,870,486,91,palette.screenRaised,muted,3);
  circle(c,870,486,57,null,highlight,6);
  signal(c,817,486,106,26,paper,5);
  line(c,[[913,553],[944,592]],muted,7);
  label(c,'COMPARE',870,648,30,paper,'center');
  curve(c,[980,486,1095,486,1080,367,1200,367],muted,4);
  curve(c,[980,486,1100,486,1080,490,1200,490],highlight,5);
  curve(c,[980,486,1095,486,1080,613,1200,613],muted,4);
  for (const [i,y] of [367,490,613].entries()) {
    circle(c,1230,y,23, i===1?highlight:palette.screenSurface,i===1?highlight:muted,4);
    line(c,[[1277,y],[1350,y]],i===1?highlight:muted,5);
  }
  label(c,'ATTRIBUTION',1260,698,27,muted,'center');
}

function learning(c) {
  box(c,158,315,335,170,16,palette.screenSurface,palette.screenLine);
  label(c,'IMAGE',183,353,25,muted);
  box(c,290,369,153,86,7,muted);
  c.fillStyle=ink; c.beginPath(); c.moveTo(296,447); c.lineTo(337,397); c.lineTo(368,427); c.lineTo(396,395); c.lineTo(437,447); c.closePath(); c.fill();
  circle(c,415,383,10,highlight);
  box(c,158,531,335,170,16,palette.screenSurface,palette.screenLine);
  label(c,'TABULAR',183,570,25,muted);
  for (let y=0;y<3;y++) for (let x=0;x<5;x++) box(c,191+x*53,593+y*25,38,10,3,(x+y)%3===0?highlight:muted);
  curve(c,[510,403,673,403,612,497,745,497],muted,6);
  curve(c,[510,618,673,618,612,517,745,517],highlight,6);
  box(c,750,398,302,222,22,palette.screenRaised,muted);
  // A small explainable graph, shared with the ML / XAI sticker.
  for (const [a,b] of [[[805,453],[900,507]],[[805,559],[900,507]],[[900,507],[994,453]],[[900,507],[994,559]]]) line(c,[a,b],muted,5);
  for (const [x,y] of [[805,453],[805,559],[994,453],[994,559]]) circle(c,x,y,12,paper);
  circle(c,900,507,21,highlight);
  label(c,'FUSION',900,678,30,paper,'center');
  arrow(c,1080,507,1185,507);
  box(c,1215,432,148,148,74,null,muted);
  line(c,[[1250,507],[1278,535],[1327,480]],highlight,8);
  label(c,'EVALUATE',1290,678,27,muted,'center');
}

function engineering(c) {
  const centers = [347,769,1191];
  for (const x of centers) box(c,x-160,358,320,248,20,palette.screenSurface,palette.screenLine);
  line(c,[[308,430],[261,482],[308,534]],paper,9);
  line(c,[[386,430],[433,482],[386,534]],paper,9);
  line(c,[[366,419],[330,545]],highlight,8);
  for (const [i,y] of [420,479,538].entries()) {
    box(c,674,y,32,32,5,null,muted);
    line(c,[[681,y+16],[689,y+24],[702,y+7]],highlight,4);
    line(c,[[731,y+16],[859-i*23,y+16]],muted,8);
  }
  circle(c,1191,482,67,null,muted,4);
  line(c,[[1154,482],[1182,510],[1230,455]],highlight,9);
  arrow(c,526,482,589,482); arrow(c,947,482,1010,482);
  label(c,'IMPLEMENT',347,670,30,paper,'center');
  label(c,'TEST',769,670,30,paper,'center');
  label(c,'REVIEW',1191,670,30,paper,'center');
  line(c,[[1191,693],[1191,743],[347,743],[347,700]],palette.screenLine,3);
  line(c,[[334,714],[347,700],[360,714]],palette.screenLine,3);
}

export function drawWorkspacePreview(c, id) {
  if (!workOrder.includes(id)) throw new Error('Unknown work preview');
  const work = workAreas[id], index = workOrder.indexOf(id);
  c.save();
  c.clearRect(0,0,screenLayout.width,screenLayout.height);
  c.fillStyle=ink; c.fillRect(0,0,1536,996);
  c.fillStyle=palette.screenSurface; c.fillRect(0,0,1536,76);
  label(c,'m/j',76,51,36,paper,'left','Georgia');
  label(c,'WORK NOTES',180,49,25,muted,'left','monospace');
  label(c,'ILLUSTRATION / NOT RESULTS',1460,48,24,muted,'right','monospace');
  label(c,work.preview.label,100,147,27,highlight,'left','monospace');
  label(c,`${String(index+1).padStart(2,'0')} / 03`,1440,147,26,muted,'right','monospace');
  label(c,work.preview.title,100,237,76,paper,'left','Georgia');
  ({research,ml:learning,engineering})[id](c);
  label(c,work.preview.caption,100,808,31,muted);
  line(c,[[76,834],[1460,834]],palette.screenLine,2);
  // A restrained pager, not another copy of the left-hand work menu.
  for (const [i,tab] of screenTabs.entries()) {
    const active = tab.id === id;
    box(c,tab.x,tab.y,tab.width,tab.height,12,active?accent:null,active?null:palette.screenLine);
    label(c,String(i+1).padStart(2,'0'),tab.x+tab.width/2,tab.y+62,39,active?palette.white:muted,'center','monospace');
  }
  const open=screenLayout.open;
  box(c,open.x,open.y,open.width,open.height,12,accent);
  label(c,'Explore work ↗',open.x+open.width/2,open.y+62,38,palette.white,'center');
  c.restore();
}

// Three collectible, matte-paper emblems, intentionally not company logos.
// Work labels, palette and motifs correspond to the screen illustrations.
export function drawWorkspaceSticker(c, id) {
  if (!workOrder.includes(id)) throw new Error('Unknown work sticker');
  c.save(); c.clearRect(0,0,768,768);
  c.lineJoin='round'; c.lineCap='round';
  if (id==='research') {
    box(c,28,112,712,544,92,paper);
    box(c,43,127,682,514,80,null,ink);
    label(c,'01 / FIELD NOTES',384,211,27,ink,'center','monospace');
    for (const y of [287,356,425]) line(c,[[112,y],[656,y]],palette.line,3);
    signal(c,114,356,540,91,ink,13);
    circle(c,408,354,112,null,accent,10);
    line(c,[[489,437],[541,492]],accent,13);
    label(c,'RESEARCH',384,583,69,ink,'center','Arial');
  } else if (id==='ml') {
    circle(c,384,384,354,paper); circle(c,384,384,338,ink); circle(c,384,384,320,null,palette.screenLine,3);
    label(c,'02 / EXPERIMENTS',384,184,27,muted,'center','monospace');
    for (const [a,b] of [[[197,286],[382,375]],[[197,458],[382,375]],[[382,375],[568,286]],[[382,375],[568,458]]]) line(c,[a,b],muted,11);
    for (const [x,y] of [[197,286],[197,458],[568,286],[568,458]]) circle(c,x,y,28,paper);
    circle(c,382,375,52,highlight); circle(c,382,375,76,null,palette.screenLine,3);
    label(c,'ML / XAI',384,596,70,paper,'center');
  } else {
    // Ticket shape; the clipped corners distinguish it by silhouette too.
    c.beginPath(); c.moveTo(92,129); c.lineTo(676,129); c.lineTo(736,189); c.lineTo(736,579); c.lineTo(676,639); c.lineTo(92,639); c.lineTo(32,579); c.lineTo(32,189); c.closePath();
    c.fillStyle=paper; c.fill(); c.strokeStyle=ink; c.lineWidth=4; c.stroke();
    box(c,57,154,654,460,24,palette.stickerTint);
    label(c,'03 / ENGINEERING',384,223,27,ink,'center','monospace');
    line(c,[[270,303],[199,380],[270,457]],ink,17);
    line(c,[[500,303],[571,380],[500,457]],ink,17);
    line(c,[[321,382],[369,430],[456,328]],accent,18);
    label(c,'BUILD / TEST',384,557,60,ink,'center');
  }
  c.restore();
}
