import {watchCard,clearCards,openPlayer,closePlayer} from "./playback.js";
import {searchable,queryTerms,rank} from "./reference-search.js";
const $ = id => document.getElementById(id);
const make = (tag,text="") => Object.assign(document.createElement(tag),{textContent:text});
const display = s => s.replaceAll("-"," ");
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
const byId=new Map(), index=new Map();
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
    const img=make("img");img.loading="lazy";img.alt="";img.referrerPolicy="no-referrer";
    img.addEventListener("load",()=>img.classList.add("ready"),{once:true});
    img.addEventListener("error",()=>{if(img.src!==row.thumbnail)img.src=row.thumbnail;else img.remove()});
    img.src=row.stream?.poster||row.thumbnail;box.append(img);
  }
  return box;
}
function card(row){
  const a=make("a");a.href="#ref="+row.id;a.className="ref-card";
  const thumb=imageBox(row,"div","ref-thumb");
  watchCard(thumb,[row.stream?.preview,row.preview]);
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
  const terms=queryTerms(query),look=$("ref-look").value;
  results=entries.flatMap((r,i)=>{
    if((fmt&&r.format!==fmt)||(kind&&!r.kind.includes(kind)))return [];
    if(look && !r.tags.includes(look) && !r.techniques.includes(look))return [];
    const score=rank(index.get(r.id),terms);
    if(score<0)return [];
    return [{r,score,i}];
  }).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.r);
  shown=0;clearCards($("ref-list"));$("ref-list").replaceChildren();fill();$("ref-clear").hidden=!(query||fmt||kind||look);
  if(sync){
    const u=new URL(location.href);
    for(const [key,value] of [["q",query],["format",fmt],["kind",kind],["look",look]]){if(value)u.searchParams.set(key,value);else u.searchParams.delete(key)}
    u.hash="references";history.replaceState(null,"",u);
  }
}
function claudePrompt(r){
  const approach=modality.find(k=>r.techniques.includes(k))||modality.find(k=>r.tags.includes(k))||"general";
  const [needs,beat]=designs[approach];
  const resources=new URL("remakes/"+encodeURIComponent(r.id)+"/",document.baseURI);
  const file=name=>new URL(name,resources).href;
  return [
    "Help me design an original video using my own material. My motion reference is “"+r.title+"” by @"+r.creator+" ("+r.format+", "+[...r.tags,...r.techniques].map(display).slice(0,6).join(", ")+"). "+r.url,
    "Available project assets and helper list: "+file("assets.json")+"\nEditable shot timings: "+file("edit.json")+"\nOpening shot’s helper HTML (source text): "+file("opening.html.txt")+"\nProject files if needed: "+new URL("../"+r.id+".zip",resources).href,
    r.remakeBasis==="rebuilt"?"The project is a studio reconstruction with editable graphics.":"The project is a style starter. Use the reference for visual direction and the helper for implementation.",
    "Start by asking what the viewer should remember and which assets I already have. For this look, useful inputs include "+needs+". Let me attach rough material, brand colors, copy or a screenshot. Use what I provide and ask before sourcing or generating anything missing.",
    "Before coding, propose one opening frame using my assets. Ask what should move, where it should land in the next frame, and how fast it should feel. Offer two concrete motion choices if I’m unsure. A possible direction: "+beat,
    "After I choose, adapt one helper for a 3–5 second pilot. Read only the files needed for that shot. If a link is unavailable in chat, ask for the relevant file or reference frame. Once I approve the motion, extend the existing timeline. For revisions, change only the affected shot."
  ].join("\n\n");
}
function openReference(r){
  if(dialog.open&&selected===r)return;
  selected=r;
  $("ref-title").textContent=r.title;$("ref-by").textContent="@"+r.creator+" · "+r.date;
  $("ref-facts").textContent=[r.format,...r.tags.map(display),r.stack,r.model].filter(Boolean).join(" · ");
  $("ref-tech").textContent=r.techniques.length?"Indexed techniques: "+r.techniques.join(", ")+".":"";
  const holder=$("ref-view");holder.replaceChildren();
  openPlayer(holder,[r.stream?.video,r.video],r.stream?.poster||r.thumbnail,()=>{
    const fallback=make("p","Video unavailable here. ");fallback.append(link("Open on Prompt Motion ↗",r.url));
    holder.replaceChildren(fallback);
  });
  const links=[link("Original "+r.kind.join(" & ")+" ↗",r.url)];
  if(r.post)links.push(link("Creator’s post ↗",r.post));
  if(r.stream?.sourcePost)links.push(link("Video by @"+new URL(r.stream.sourcePost).pathname.split("/")[1]+" ↗",r.stream.sourcePost));
  if(r.skill)links.push(link("Skill repository ↗",r.skill));
  $("ref-links").replaceChildren(...links);
  $("ref-copy-status").textContent="";$("ref-manual").hidden=true;
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
}
function route(){
  const id=location.hash.startsWith("#ref=")?location.hash.slice(5):"";
  if(byId.has(id))openReference(byId.get(id));else if(dialog.open)dialog.close();
}
dialog.addEventListener("close",()=>{
  closePlayer();
  $("ref-view").replaceChildren();
  if(selected&&location.hash==="#ref="+selected.id){const u=new URL(location.href);u.hash="references";history.replaceState(null,"",u)}
  selected=null;
  if(returnFocus?.isConnected)returnFocus.focus();else if(location.hash==="#references")$("ref-query").focus({preventScroll:true});
});
$("ref-close").addEventListener("click",()=>dialog.close());
$("ref-copy").addEventListener("click",async()=>{
  const row=selected;if(!row)return;
  const prompt=claudePrompt(row);
  try{
    await navigator.clipboard.writeText(prompt);
    if(selected===row)$("ref-copy-status").textContent="Copied. Paste into a Claude chat.";
  }catch{
    if(selected!==row)return;
    const field=$("ref-manual");field.value=prompt;field.hidden=false;field.focus();field.select();
    $("ref-copy-status").textContent="Prompt selected. Use your device’s Copy command.";
  }
});
document.querySelector(".ref-search").addEventListener("submit",e=>e.preventDefault());
$("ref-more").addEventListener("click",fill);
$("ref-clear").addEventListener("click",()=>{document.querySelector(".ref-search").reset();filter();$("ref-query").focus()});
for(const id of ["ref-query","ref-format","ref-kind","ref-look"])$(id).addEventListener("input",()=>filter());
window.addEventListener("hashchange",route);
try{
  const res=await fetch("reference-index.json");if(!res.ok)throw Error();
  entries=(await res.json()).entries;
  for(const r of entries){
    byId.set(r.id,r);
    index.set(r.id,searchable(r));
  }
  for(const [label,key] of [["Visual elements","tags"],["Techniques","techniques"]]){
    const group=make("optgroup");group.label=label;
    for(const value of [...new Set(entries.flatMap(r=>r[key]))].sort()){
      const opt=make("option",display(value));opt.value=value;group.append(opt);
    }
    $("ref-look").append(group);
  }
  $("ref-query").value=params.get("q")||"";
  for(const [key,id] of [["format","ref-format"],["kind","ref-kind"],["look","ref-look"]]){
    const val=params.get(key);if([...$(id).options].some(x=>x.value===val))$(id).value=val;
  }
  filter(false);route();
}catch{$("ref-count").replaceChildren("The reference index could not load. ",link("Browse Prompt Motion ↗","https://prompt-motion.com/"))}
