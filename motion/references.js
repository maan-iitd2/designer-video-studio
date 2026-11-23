const $ = id => document.getElementById(id);
const make = (tag,text="") => Object.assign(document.createElement(tag),{textContent:text});
const display = s => s.replaceAll("-"," ");
const norm = s => s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const alias = {
  "product-ui":"app interface software screen ui ux product demo",
  "kinetic-type":"type typography lettering text title words",
  "photos":"photography photograph photo photographs images pictures stills",
  "charts":"data visualization graph statistics numbers",
  "diagrams":"explainer flowchart flow diagram infographics process",
  "characters":"character illustration figures",
  "particles":"particle effects", "music":"music rhythm sound audio",
  "phone":"phone smartphone mobile device", "shapes":"geometry abstract geometric",
  "paper collage":"scrapbook cutout cutouts paper collage vox",
  "editorial":"editorial magazine newspaper engraving vox",
  "3D":"3d three dimensional", "camera movement":"camera zoom pan parallax dolly",
  "Landscape":"horizontal wide 16 9", "Portrait":"vertical reel 9 16", "Square":"square 1 1",
};
const designs = {
  "paper collage":["one cutout, two paper surfaces and a short heading","Introduce one object with its label. Tear or slide a foreground sheet to expose one detail. Reassemble the layers around the final line."],
  "shape morph":["two related silhouettes and a label for each","Start with one silhouette. Carry a recognisable edge into the second form. Hold on the changed meaning."],
  "grid layout":["three to five related images or pieces of work","Establish the whole grid. Pick one tile and expand it for the key detail. Return it to the set with a new label."],
  "charts":["a small verified dataset with units and a source","Show the baseline with its unit. Animate the one comparison that matters. Hold the result and credit the data."],
  "kinetic-type":["three to five short phrases","Set the first word at reading size. Match one typographic change to a shift in meaning. Settle on the final phrase long enough to read it."],
  "product-ui":["one real screen, one interaction and its result","Frame the starting screen. Show one cursor or finger action in close-up. Reveal the resulting state without changing the point of view."],
  "diagrams":["a process in three steps and the relationship between them","Place the first node. Draw a connection when the next idea is introduced. Pull out to show the whole relationship."],
  "characters":["a character sheet or drawing and one action","Establish the pose. Anticipate the main movement, release it, and hold the reaction."],
  "3D":["one object and a reproducible camera angle","Introduce the silhouette. Move the camera enough to reveal the form. Land on a clear final view."],
  "photos":["two or three related photographs and a caption","Frame one photo. Match a detail into the next image. Finish with the image that proves the point."],
  "music":["a short phrase and a tempo or sound reference","Establish a pulse. Give the strongest beat a visible change. Leave space after the final accent."],
  "shapes":["a small shape vocabulary and a two-colour palette","Introduce a shape. Transform one property at a time. Resolve the shapes into the final composition."],
  "captions":["a recording or transcript and the essential line","Open on the strongest spoken idea. Time the key words to speech. End with the speaker or the visual evidence."],
  "general":["one subject, one key detail and one closing line","Introduce the subject clearly. Change the framing to reveal one detail. Hold a final image that resolves the opening."]
};
const modality = ["paper collage","shape morph","charts","diagrams","product-ui","characters","captions","3D","grid layout","kinetic-type","photos","music","shapes"];
let entries=[], results=[], shown=0, selected;
const byId=new Map(), index=new Map(), saved=new Map();
const params=new URLSearchParams(location.search);
const dialog=$("ref-dialog");
let returnFocus;
function link(label,url){const a=make("a",label);a.href=url;a.target="_blank";a.rel="noopener";return a}
function imageBox(row,tag,klass){
  const box=make(tag);box.className=klass;
  const fallback=make("div");fallback.className="ref-placeholder";
  fallback.dataset.tint=String(row.creator.length%4);
  fallback.append(make("small","@"+row.creator),make("em",row.title));
  box.append(fallback);
  if(row.thumbnail){
    const img=make("img");img.src=row.thumbnail;img.loading="lazy";img.alt="";img.referrerPolicy="no-referrer";
    img.addEventListener("load",()=>img.classList.add("ready"),{once:true});
    img.addEventListener("error",()=>img.remove(),{once:true});box.append(img);
  }
  return box;
}
function card(row){
  const a=make("a");a.href="#ref="+row.id;a.className="ref-card";
  const thumb=imageBox(row,"div","ref-thumb");thumb.append(make("span",row.format));
  const labels=row.tags.length?row.tags.slice(0,2).map(display):row.kind;
  a.append(thumb,make("strong",row.title),make("small","@"+row.creator+" · "+labels.join(" / ")));
  a.addEventListener("click",()=>{returnFocus=a});return a;
}
function fill(){
  const part=results.slice(shown,shown+12);shown+=part.length;
  $("ref-list").append(...part.map(card));$("ref-more").hidden=shown>=results.length;
  $("ref-count").textContent=results.length?shown+" of "+results.length+" references":"No matches. Try one visual term or clear the filters.";
}
function filter(sync=true){
  const query=$("ref-query").value.trim(),fmt=$("ref-format").value,kind=$("ref-kind").value;
  const terms=norm(query).split(" ").filter(Boolean);
  results=entries.flatMap((r,i)=>{
    if((fmt&&r.format!==fmt)||(kind&&!r.kind.includes(kind)))return [];
    const [title,tags,all]=index.get(r.id);
    if(!terms.every(w=>all.includes(w)))return [];
    const score=terms.reduce((s,w)=>s+(title.includes(w)?5:0)+(tags.includes(w)?2:0),0);
    return [{r,score,i}];
  }).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.r);
  shown=0;$("ref-list").replaceChildren();fill();$("ref-clear").hidden=!(terms.length||fmt||kind);
  if(sync){
    const u=new URL(location.href);
    for(const [key,value] of [["q",query],["format",fmt],["kind",kind]]){if(value)u.searchParams.set(key,value);else u.searchParams.delete(key)}
    u.hash="references";history.replaceState(null,"",u);
  }
}
function adapt(){
  if(!selected)return;
  const r=selected;
  const idea=$("ref-idea").value.trim(),assets=$("ref-assets").value.trim(),format=$("ref-output").value,script=$("ref-script").value;
  saved.set(r.id,{idea,assets,format,script});
  const approach=modality.find(k=>r.tags.includes(k)||r.techniques.includes(k))||"general";
  const [needs,plan]=designs[approach];
  $("ref-text").value=[
    "Help me adapt a motion reference in this regular Claude chat. Reference: “"+r.title+"” by @"+r.creator+" on Prompt Motion. "+r.url,
    "My idea or supplied words: "+(idea||"Ask what the viewer should remember.")+"\nScript choice: "+script+". "+(script==="Use my exact words"?"Preserve my copy verbatim.":script==="Visuals only"?"Use only labels I approve.":"Use the facts I supply."),
    "Source attributes: "+[r.format,...r.tags.map(display),...(r.stack?[r.stack]:[])].join(", ")+". "+(r.techniques.length?"Indexed technique terms: "+r.techniques.join(", ")+".":""),
    "My output format: "+(format==="Match reference"?r.format:format)+". My available material: "+(assets||"ask me for the single most important missing asset")+". A useful starting set is "+needs+".",
    "Proposed storyboard for my own version: "+plan+" This is a suggested treatment. Confirm what I actually liked in the reference; ask for a timestamp or screenshot if you cannot view the clip. Do not claim to have watched it.",
    "Ask one creative question if the brief is unclear. Otherwise build a 3–5 second editable HTML animation pilot from my own assets and wording. Show the pilot before extending the film. Use the creator’s original prompt or skill only if I choose to provide it; the source page links to it.",
    "Aim for 9/10 on composition, phone-size typography, originality for my subject and timing. Review a visible frame or cut, give the weakest moment a timestamp, revise it once and compare. Mark any unobserved motion or audio as unverified."
  ].join("\n\n");
}
function openReference(r){
  if(dialog.open&&selected===r)return;
  selected=r;
  $("ref-title").textContent=r.title;$("ref-by").textContent="@"+r.creator+" · "+r.date;
  $("ref-facts").textContent=[r.format,...r.tags.map(display),r.stack,r.model].filter(Boolean).join(" · ");
  $("ref-tech").textContent=r.techniques.length?"Indexed techniques: "+r.techniques.join(", ")+".":"";
  const holder=$("ref-view");holder.replaceChildren();
  const cover=imageBox(r,"div","ref-cover"),watch=make("button","▶ Watch here");watch.type="button";cover.append(watch);holder.append(cover);
  watch.addEventListener("click",()=>{
    const postID=r.post?.match(/\/status\/(\d+)/)?.[1];
    const frame=make("iframe");frame.title=r.title+" · creator’s original post";
    frame.src=postID?"https://platform.twitter.com/embed/Tweet.html?id="+postID+"&dnt=true&theme=light":r.url;
    frame.allow="autoplay; encrypted-media; fullscreen; picture-in-picture";frame.allowFullscreen=true;frame.referrerPolicy="strict-origin-when-cross-origin";
    const fallback=make("p");fallback.className="fallback";fallback.append(link("Watch on Prompt Motion ↗",r.url));
    holder.replaceChildren(frame,fallback);
  },{once:true});
  const links=[link("Original "+r.kind.join(" & ")+" ↗",r.url)];
  if(r.post)links.push(link("Creator’s post ↗",r.post));
  if(r.skill)links.push(link("Skill repository ↗",r.skill));
  $("ref-links").replaceChildren(...links);
  $("edit-copy-status").hidden=true;
  $("ref-remake").href="remakes/"+encodeURIComponent(r.id)+".zip";
  $("ref-remake").download=r.id+".zip";
  const rebuilt=r.remakeBasis==="rebuilt";
  $("ref-remake").textContent=rebuilt?"Download scene-by-scene rebuild ↓":"Download style starter ↓";
  $("ref-basis").textContent=rebuilt
    ?"The studio rebuilt the visible sequence with editable graphics and a new soundtrack."
    :r.remakeBasis==="measured"?"Generic motion components use sampled colors and estimated cuts. The creator’s artwork appears in the reference player above."
    :"Generic motion components use timing and colors suggested by the catalog tags.";
  const sample=$("ref-render-preview");sample.hidden=!rebuilt;
  if(rebuilt)sample.href="previews/"+encodeURIComponent(r.id)+"-rebuild.mp4";else sample.removeAttribute("href");
  const draft=saved.get(r.id)||{idea:"",assets:"",format:"Match reference",script:"Shape my notes"};
  $("ref-idea").value=draft.idea;$("ref-assets").value=draft.assets;$("ref-output").value=draft.format;$("ref-script").value=draft.script;
  $("ref-brief-details").open=false;$("ref-status").textContent="";adapt();
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
}
function route(){
  const id=location.hash.startsWith("#ref=")?location.hash.slice(5):"";
  if(byId.has(id))openReference(byId.get(id));else if(dialog.open)dialog.close();
}
dialog.addEventListener("close",()=>{
  $("ref-view").replaceChildren();
  if(selected&&location.hash==="#ref="+selected.id){const u=new URL(location.href);u.hash="references";history.replaceState(null,"",u)}
  selected=null;
  if(returnFocus?.isConnected)returnFocus.focus();else if(location.hash==="#references")$("ref-query").focus({preventScroll:true});
});
$("ref-close").addEventListener("click",()=>dialog.close());
$("copy-edit-request").addEventListener("click",async()=>{
  const idea=$("ref-idea").value.trim(),assets=$("ref-assets").value.trim();
  const prompt=["Help me edit the attached HyperFrames edit.json for "+selected.title+".",
    idea?"My idea or words: "+idea:"Ask me what this video is for and what words or assets I already have.",
    assets?"My assets: "+assets:"",
    "Script preference: "+$("ref-script").value+". Format preference: "+$("ref-output").value+".",
    "Work within this project's included components. Change only the fields needed for my request. Preserve credits, provenance and the JSON structure. Use my supplied facts and filenames. Return the revised edit.json for my local renderer."].filter(Boolean).join("\n");
  const status=$("edit-copy-status");status.hidden=false;
  try{await navigator.clipboard.writeText(prompt);status.textContent="Copied. Attach edit.json and paste the request into Claude."}
  catch{status.textContent=prompt}
});
$("ref-copy").addEventListener("click",async()=>{
  adapt();const field=$("ref-text");
  try{await navigator.clipboard.writeText(field.value);$("ref-status").textContent="Copied. Paste into Claude and attach your own material."}
  catch{$("ref-brief-details").open=true;field.focus();field.select();$("ref-status").textContent="Brief selected. Use your device’s Copy command."}
});
$("ref-brief").addEventListener("input",()=>{adapt();$("ref-status").textContent=""});
$("ref-brief").addEventListener("submit",e=>e.preventDefault());
document.querySelector(".ref-search").addEventListener("submit",e=>e.preventDefault());
$("ref-more").addEventListener("click",fill);
$("ref-clear").addEventListener("click",()=>{document.querySelector(".ref-search").reset();filter();$("ref-query").focus()});
for(const id of ["ref-query","ref-format","ref-kind"])$(id).addEventListener("input",()=>filter());
window.addEventListener("hashchange",route);
try{
  const res=await fetch("reference-index.json");if(!res.ok)throw Error();
  entries=(await res.json()).entries;
  for(const r of entries){
    byId.set(r.id,r);
    const tags=[...r.tags,...r.techniques,r.format], title=norm(r.title+" "+r.creator), labels=norm(tags.join(" "));
    index.set(r.id,[title,labels,norm([title,labels,...tags.map(t=>alias[t]||""),...r.kind,r.model||"",r.stack||""].join(" "))]);
  }
  $("ref-query").value=params.get("q")||"";
  for(const [key,id] of [["format","ref-format"],["kind","ref-kind"]]){
    const val=params.get(key);if([...$(id).options].some(x=>x.value===val))$(id).value=val;
  }
  filter(false);route();
}catch{$("ref-count").replaceChildren("The reference index could not load. ",link("Browse Prompt Motion ↗","https://prompt-motion.com/"))}
