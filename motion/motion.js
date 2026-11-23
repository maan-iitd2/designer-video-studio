"use strict";
const $ = id => document.getElementById(id);
const el = (name, text) => Object.assign(document.createElement(name), {textContent:text || ""});
const dialog = $("editor");
const preferences = new Map();
let studies = [];
let active;
let activeSource = "";
let group = "All films";
let lastButton;
let hoverEnabled = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const sources = new Map();
function webLink(title,href){
  const a=el("a",title);a.href=href;a.target="_blank";a.rel="noopener";return a;
}
function previewPath(study,suffix){return "previews/"+study.id+suffix}
function stopHover(card){
  card.classList.remove("playing");
  const video=card.querySelector("video");
  if(video){video.pause();video.removeAttribute("src");video.load();video.remove()}
}
function stopAll(){document.querySelectorAll(".screen").forEach(stopHover)}
function makeCard(study){
  const card=el("button");card.type="button";card.className="film";card.setAttribute("aria-label","Watch and adapt "+study.title);
  const media=el("span");media.className="screen";
  const poster=el("img");poster.src=previewPath(study,".webp");poster.alt="";poster.width=960;poster.height=540;
  const play=el("span","▶");play.className="watch";play.setAttribute("aria-hidden","true");media.append(poster,play);
  card.addEventListener("pointerenter",async event=>{
    if(!hoverEnabled || event.pointerType!=="mouse" || dialog.open || media.querySelector("video"))return;
    const v=el("video");v.muted=true;v.playsInline=true;v.loop=true;v.src=previewPath(study,".mp4");media.insertBefore(v,play);
    try{await v.play();if(v.isConnected)media.classList.add("playing")}catch{if(v.isConnected)stopHover(media)}
  });
  card.addEventListener("pointerleave",()=>stopHover(media));
  card.addEventListener("click",()=>{lastButton=card;location.hash=study.id});
  const row=el("span");row.className="meta-row";
  const title=el("span",study.title);title.className="card-title";
  const duration=el("span","0:08");duration.className="duration";row.append(title,duration);
  const genre=el("span",study.genre);genre.className="card-genre";card.append(media,row,genre);return card;
}
function renderCards(){
  stopAll();$("films").replaceChildren(...studies.filter(s=>group==="All films"||s.genre===group).map(makeCard));
  for(const b of $("filters").children)b.setAttribute("aria-pressed",String(b.textContent===group));
}
function updateMotion(){const b=$("motion-toggle");b.textContent=hoverEnabled?"Hover previews on":"Hover previews off";b.setAttribute("aria-pressed",String(hoverEnabled))}
$("motion-toggle").addEventListener("click",()=>{hoverEnabled=!hoverEnabled;stopAll();updateMotion()});
function inputs(){return Object.fromEntries(["idea","format","script","words","assets"].map(id=>[id,$(id).value]))}
function updateBrief(){
  if(!active)return;
  const v=inputs();preferences.set(active.id,v);
  const variants={
    "Use my exact words":"Preserve my words verbatim. If I have not supplied them, ask me for them.",
    "Shape my notes":"Edit my notes into one concise script. Confirm any missing fact with me.",
    "Write a draft":"Write one concise draft from the facts I supply and show it before animation.",
    "Visuals only":"Build a visual story. Use only essential labels I approve."
  };
  const lines=[
    "Help me make a short film in this Claude chat. My visual reference is "+active.title+" ("+active.genre+").",
    "My idea: "+(v.idea.trim()||"Ask me what I want the viewer to see, feel or remember."),
    "Format: "+v.format+". Reference length: 8 seconds. Recompose for this frame; keep important words and images readable at phone size.",
    "Script: "+variants[v.script],
    v.words.trim() && "My words or notes: "+v.words.trim(),
    "Available material: "+(v.assets.trim()||"Ask which assets I already have. Use my real work for claims about my work."),
    "Visual direction: "+active.blurb,
    "Colour palette: "+active.palette.join(", ")+". Timing to adapt:\n"+active.beats.join("\n"),
    "Start with the single missing decision that would change the design. If the brief is clear, show a representative 3–5 second animated pilot as a self-contained HTML artifact with play and replay. Use the editable drawing code below to preserve the chosen movement. Treat any supplied reference frames as visual guidance. Ask me to attach the most important missing photo or sketch. Let me approve the look before expanding the film.",
    "Review the actual rendered pilot at phone size. Aim for 9/10 on each: composition and hierarchy; typography and readability; visual originality and fit to my story; motion, timing and continuity. Check sound sync only when audio is present. Cite a specific frame or timestamp for each weak point, fix the weakest choice and compare the same moment again. If you cannot view playback, ask for stills or my feedback and mark motion unverified. Keep any below-target score honest. Give me a clear creative choice instead of repeatedly regenerating.",
    "After approval, finish the sequence. Provide an editable animation; if your environment can render and verify an MP4, deliver that too. Use short replies and one decision at a time. All work should be possible in this chat.",
    activeSource && "Editable motion source for this reference (JavaScript, 960 × 540 canvas). Call drawFilm(ctx, seconds, images) on each frame; replace subject, images, copy and palette with mine. Image slots: "+(Object.keys(active.photos).join(", ")||"none")+".\n\n"+activeSource
  ];
  $("brief-preview").value=lines.filter(Boolean).join("\n\n");
}
async function openFilm(study){
  if(dialog.open && active===study)return;
  active=study;activeSource="";stopAll();
  $("film-title").textContent=study.title;
  $("film-meta").textContent=study.genre+"  /  8s  /  "+(study.id==="offbeat"?"Original beat · unmute to hear":"Silent film");
  $("summary").textContent=study.blurb;
  $("beats").replaceChildren(...study.beats.map(b=>el("li",b)));
  $("credits").replaceChildren(el("p","Original studio motion and art direction."),...study.credits.map(([title,url])=>webLink(title,url)));
  $("board").href=previewPath(study,"-frames.jpg");$("source").href=previewPath(study,"-motion.txt");
  const player=$("player");player.pause();player.src=previewPath(study,".mp4");player.poster=previewPath(study,".webp");player.muted=true;
  $("brief-form").reset();$("prompt-disclosure").open=false;document.querySelector(".film-copy details").open=false;
  $("review-fallback").hidden=true;$("review-status").textContent="";$("copy-review").closest("details").open=false;
  for(const [key,value] of Object.entries(preferences.get(study.id)||{}))$(key).value=value;
  $("assets").placeholder=study.inputs;$("status").textContent="";$("copy").disabled=true;updateBrief();
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
  if(!matchMedia("(prefers-reduced-motion: reduce)").matches)player.play().catch(()=>{});
  try{
    if(!sources.has(study.id)){
      const res=await fetch(previewPath(study,"-motion.txt"));if(!res.ok)throw Error();
      sources.set(study.id,await res.text());
    }
    if(active===study){activeSource=sources.get(study.id);updateBrief()}
  }catch{if(active===study)$("status").textContent="Motion source is unavailable. The brief includes the full timing and visual direction."}
  finally{if(active===study)$("copy").disabled=false}
}
function fromHash(){
  try{
    if(/^(shotcraft|vox|kallaway|hyperframes|example)\//.test(decodeURIComponent(location.hash.slice(1)))){
      location.replace("archive/"+location.hash);return;
    }
  }catch{return}
  const study=studies.find(s=>s.id===location.hash.slice(1));
  if(study)openFilm(study);else if(dialog.open)dialog.close();
}
$("close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("close",()=>{
  $("player").pause();if(active && location.hash==="#"+active.id)history.replaceState(null,"",location.href.split("#")[0]);
  active=undefined;activeSource="";if(lastButton?.isConnected)lastButton.focus();
});
dialog.addEventListener("click",e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
$("brief-form").addEventListener("input",()=>{updateBrief();$("status").textContent=""});
$("brief-form").addEventListener("submit",e=>e.preventDefault());
function critique(study){
  const v=inputs();
  return [
    "Review my motion-design draft like a demanding editorial art director. My intended look is "+study.title+" ("+study.genre+"). My subject: "+(v.idea.trim()||"ask if unclear")+". Output: "+v.format+".",
    "My taste references are the attached examples or frames. First identify the specific visual quality I am trying to achieve. Evaluate the result at phone size and across a cut. If you only have stills, distinguish what the images show from what needs motion playback. Ask for three timestamped frames and a screen recording or timing notes when needed.",
    "Target 9/10 on every applicable dimension. Score separately: (1) composition, focal hierarchy and cropping; (2) typography, contrast and reading time; (3) originality and connection to the actual subject; (4) choreography, transitions and pacing; (5) audio cue alignment when audio is present. A 7 is competent but generic, an 8 is strong with a specific visible weakness, a 9 has a distinctive choice that holds up at viewing size. State unverified axes explicitly.",
    "For each below-target score give a timestamp, the visible issue, and one precise edit. Give the most important fix first. Check for invented claims, buried subjects, illegible words and off-beat cues. Averages must not hide a weak dimension.",
    "If you have editable source and rendering tools, revise the weakest beat, render that interval and compare exactly the same moment before and after. Otherwise give me the change to request from the editing chat. Preserve the moments that already work. Let me make the final taste decision."
  ].join("\n\n");
}
$("copy-review").addEventListener("click",async()=>{
  if(!active)return;
  const text=critique(active);
  try{await navigator.clipboard.writeText(text);$("review-status").textContent="Copied. Paste into a fresh chat with your draft."}
  catch{const field=$("review-fallback");field.hidden=false;field.value=text;field.focus();field.select();$("review-status").textContent="Critique selected. Use your device’s Copy command."}
});
$("copy").addEventListener("click",async()=>{
  updateBrief();try{await navigator.clipboard.writeText($("brief-preview").value);$("status").textContent="Copied. Paste into Claude, then attach your material."}
  catch{$("prompt-disclosure").open=true;$("brief-preview").focus();$("brief-preview").select();$("status").textContent="Brief selected. Use your device’s Copy command."}
});
window.addEventListener("hashchange",fromHash);
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopAll();$("player").pause()}});
async function start(){
  const res=await fetch("films.json");if(!res.ok)throw Error();studies=await res.json();
  for(const genre of ["All films",...new Set(studies.map(s=>s.genre))]){
    const b=el("button",genre);b.type="button";b.className="chip";
    b.addEventListener("click",()=>{group=genre;renderCards()});$("filters").append(b);
  }
  updateMotion();renderCards();fromHash();
}
start().catch(()=>{$("films").textContent="The film index could not load. Refresh to try again."});
