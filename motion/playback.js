// Cards acquire a media resource only while visible. Both galleries share one preference.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let override;
try {
  const saved = localStorage.getItem("studio-preview-motion");
  if (saved !== null) override = saved === "on";
} catch {}
const enabled = () => override ?? !reduced.matches;
export {enabled as previewsEnabled};
const cards = new Map();
let detail;
let resumeDetail = false;

function stop(clip) {
  if (!clip) return;
  clip.dispose();
}

function player(host, urls, controls, poster, onFailure) {
  const sources = [...new Set(urls.filter(Boolean))];
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.controls = controls;
  video.preload = controls ? "metadata" : "none";
  if (poster && controls) video.poster = poster;
  if (!controls) video.setAttribute("aria-hidden", "true");
  host.append(video);
  let alive = true, current = 0, timer, requested = false;
  function play() {
    requested = true;
    video.play().catch(()=>{}); // Native controls remain available if autoplay is blocked.
  }
  function load() {
    clearTimeout(timer);
    if (!alive) return;
    if (current >= sources.length) {
      video.hidden = true;
      onFailure?.();
      return;
    }
    video.src = sources[current++];
    if (requested) play();
    timer = setTimeout(load, 12000);
  }
  video.addEventListener("loadedmetadata",()=>clearTimeout(timer));
  video.addEventListener("playing",()=>host.classList.add("playing"));
  video.addEventListener("error",load);
  load();
  return {video, play, dispose() {
    alive = false;
    clearTimeout(timer);
    video.removeEventListener("error",load);
    video.pause(); video.removeAttribute("src"); video.load(); video.remove();
    host.classList.remove("playing");
  }};
}

function syncCard(host, state) {
  const active = state.visible && enabled() && !document.hidden && !document.querySelector("dialog[open]");
  if (active && !state.clip) {
    state.clip = player(host,state.urls,false);
    state.clip.play();
  } else if (!active && state.clip) {
    stop(state.clip);
    state.clip = null;
  }
}
const observer = new IntersectionObserver(items=>{
  for (const item of items) {
    const state = cards.get(item.target);
    if (!state) continue;
    state.visible = item.isIntersecting && item.intersectionRatio >= .1;
    syncCard(item.target,state);
  }
}, {threshold:[0,.1]});

export function watchCard(host, urls) {
  if (!urls.some(Boolean)) return;
  cards.set(host,{urls,visible:false,clip:null});
  observer.observe(host);
}
export function clearCards(container) {
  for (const [host,state] of cards) if (container.contains(host)) {
    observer.unobserve(host); stop(state.clip); cards.delete(host);
  }
}
export function closePlayer() {
  stop(detail); detail = null; resumeDetail = false;
}
export function openPlayer(host, urls, poster, onFailure) {
  closePlayer();
  detail = player(host,urls,true,poster,onFailure);
  if (enabled() && !document.hidden) detail.play();
}
function sync() {
  for (const [host,state] of cards) syncCard(host,state);
  for (const button of document.querySelectorAll("[data-motion-control]")) {
    button.textContent = enabled() ? "Pause previews" : "Play previews";
    button.setAttribute("aria-pressed",String(enabled()));
  }
}
document.querySelectorAll("[data-motion-control]").forEach(button=>button.addEventListener("click",()=>{
  override = !enabled();
  try { localStorage.setItem("studio-preview-motion", override ? "on" : "off"); } catch {}
  sync();
}));
const dialogs = new MutationObserver(sync);
document.querySelectorAll("dialog").forEach(d=>dialogs.observe(d,{attributes:true,attributeFilter:["open"]}));
document.addEventListener("visibilitychange",()=>{
  if (detail && document.hidden) {resumeDetail = !detail.video.paused; detail.video.pause();}
  else if (detail && resumeDetail && enabled()) {resumeDetail=false;detail.play();}
  sync();
});
reduced.addEventListener("change",()=>{if (!enabled()) detail?.video.pause();sync();});
sync();
