async function buildFilm() {
  const pk = K.paper, stage = document.querySelector('main');
  const project = await (await fetch('shots.json')).json();
  await pk.ready();
  const shots = project.shots;
  if (!Array.isArray(shots) || !shots.length) throw Error('Add at least one shot.');
  let duration = 0;
  for (const [i, shot] of shots.entries()) {
    if (!Number.isFinite(shot.start) || Math.abs(shot.start - duration) > 0.001 ||
        !Number.isFinite(shot.duration) || shot.duration <= 0 ||
        !Number.isFinite(shot.cue) || shot.cue < 0 || shot.cue >= shot.duration)
      throw Error('Check the start, duration and cue for shot ' + (i + 1));
    if (!['masthead','exhibit','reveal'].includes(shot.layout) ||
        ![shot.title,shot.caption].every(t => typeof t === 'string' && t.length && !/[<>]/.test(t)))
      throw Error('Check layout and plain text for shot ' + (i + 1));
    duration += shot.duration;
  }
  const camera = pk.camera(stage, {cues:shots.map((s,i) => ({t:s.start, y:i*1080}))});
  const scenes = [];
  for (const [i,s] of shots.entries()) {
    const page = pk.scene(camera.world,{y:1080*i});
    const dark = s.layout === 'exhibit', centered = s.layout === 'masthead';
    const ink = dark ? pk.C.paper : pk.C.ink;
    const fx = [pk.ground(page,{variant:dark?'newsprint':'cream',seed:i+1,ink:.12})];
    if (s.layout === 'reveal') fx.push(pk.tornStrip(page,{x:-60,y:140,w:2100,h:260,angle:-4,color:pk.C.sky,at:0,seed:3}));
    const x = centered ? 1060 : dark ? 520 : 1410;
    fx.push(pk.disc(page,{x,y:580,r:250,color:dark?pk.C.red:pk.C.sky,at:0,z:1}));
    const img = await pk.loadImage(s.image);
    const height = centered ? 510 : 680;
    const width = Math.max(1,Math.min(740,Math.round(height * img.width / img.height)));
    const art = s.fullColor ? img : pk.halftone(img,{w:width,pitch:5,angle:45,seed:i+1});
    fx.push(pk.cutout(page,{img:art,scale:s.fullColor?width/img.width:1,x,y:centered?665:575,rot:dark?-9:4,enter:centered?'rise':'tumble',at:s.cue,seed:i+1,z:3}));
    const textX = centered ? 960 : dark ? 980 : 165;
    const align = centered?'center':'left';
    const measure = document.createElement('canvas').getContext('2d');
    const fit = (text,font,maxWidth,maxSize) => {
      measure.font = maxSize+'px '+font;
      return Math.min(maxSize, Math.floor(maxSize*maxWidth/Math.max(1,measure.measureText(text).width)));
    };
    if (centered) fx.push(pk.masthead(page,{word:s.title,x:960,y:540,size:fit(s.title,pk.F.serif,1590,410),at:-.35,stagger:.045,color:ink,z:2}));
    else fx.push(pk.words(page,{text:s.title,x:textX,y:590,size:fit(s.title,pk.F.serif,800,204),color:ink,at:.06,italic:true,z:4}));
    fx.push(pk.words(page,{text:s.caption,x:textX,y:centered?993:724,align,size:fit(s.caption,pk.F.ui,centered?1550:760,54),font:'ui',color:ink,at:s.cue+.12,z:5}));
    scenes.push({page,fx});
  }
  const overlay = pk.overlay(stage,{z:90});
  window.seek = t => {
    camera.seek(t);
    const position = camera.at(t).y / 1080;
    scenes.forEach(({page,fx},i) => {
      page.style.display = Math.abs(position-i)<1.12?'':'none';
      if (page.style.display !== 'none') for (const effect of fx) effect.seek(t-shots[i].start);
    });
    overlay.seek(t);
  };
  const exporting = new URLSearchParams(location.search).has('export');
  document.querySelector('footer').hidden = exporting;
  if (exporting) document.querySelector('footer').style.display='none';
  function resize() {
    const scale = Math.min(innerWidth/1920,(innerHeight-(exporting?0:58))/1080);
    stage.style.transform = 'scale('+scale+')';
    stage.style.left = (innerWidth-1920*scale)/2+'px';
  }
  onresize=resize; resize(); window.seek(0);
  window.duration=duration; window.ready=true;
  if (exporting) return;
  const play=document.querySelector('button'), scrub=document.querySelector('input'), time=document.querySelector('output');
  const audio=project.audio?new Audio(project.audio):null;
  let frame=0, started=0;
  scrub.max=duration; play.disabled=false;
  function show(t) { window.seek(t); scrub.value=t; time.value=t.toFixed(1)+' s'; }
  function stop() { cancelAnimationFrame(frame); frame=0; play.textContent='Play'; if(audio) audio.pause(); }
  function tick() {
    const t=Math.min(duration,(performance.now()-started)/1000);
    show(t); if(t>=duration) stop(); else frame=requestAnimationFrame(tick);
  }
  play.onclick=async () => {
    if(frame) return stop();
    const t=+scrub.value>=duration?0:+scrub.value;
    if(audio){audio.currentTime=t; await audio.play();}
    started=performance.now()-1000*t; play.textContent='Pause'; tick();
  };
  scrub.oninput=()=>{ stop(); show(+scrub.value); };
  show(0);
}
buildFilm().catch(e=>{window.filmError=String(e);document.querySelector('output').textContent=String(e);console.error(e);});
