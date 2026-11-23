const normalize = value => value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const ignored = new Set("a an the for with and of in to me my i want something like that show find video videos animation animations animated using from some where it is".split(" "));
const words = value => normalize(value).split(" ").filter(word=>word && !ignored.has(word));
const vocabulary = {
  "kinetic-type":"kinetic typography text type lettering words letters titles moving bold",
  "product-ui":"product interface software app ui ux screen dashboard demo walkthrough screenshots",
  "photos":"photo photograph photography photos images stills portfolio",
  "charts":"data visualization chart charts graph stats numbers infographic",
  "diagrams":"diagram explainer flowchart process infographic",
  "characters":"character illustration figure people mascot",
  "particles":"particle specks dots dissolve", "music":"musical rhythmic rhythm beat sound audio",
  "phone":"phone mobile smartphone handset", "shapes":"shape geometric geometry abstract",
  "paper collage":"paper collage scrapbook cutout handmade vox",
  "hand drawn":"sketch handdrawn drawn pencil doodle drawing",
  "editorial":"editorial newspaper magazine documentary vox",
  "3D":"3d dimensional depth", "camera movement":"camera zoom pan dolly parallax",
  "shape morph":"morph morphs morphing transform transforms fluid transition",
  "grid layout":"tiles tiled grid gallery mosaic", "masked reveal":"reveal mask wipe",
  "beat sync":"beats music synchronized rhythm", "screen demo":"screen recording walkthrough demo",
  "Landscape":"wide horizontal 16 9", "Portrait":"vertical portrait reel story stories 9 16", "Square":"square 1 1",
};

// Permit one insertion, deletion, replacement or adjacent swap in longer words.
function near(a,b) {
  if (a.length<5 || Math.abs(a.length-b.length)>1) return false;
  let i=0;
  while (i<a.length && a[i]===b[i]) i++;
  if (a.length<b.length) return a.slice(i)===b.slice(i+1);
  if (a.length>b.length) return a.slice(i+1)===b.slice(i);
  return a.slice(i+1)===b.slice(i+1) ||
    (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2));
}
export function searchable(row) {
  const labels=[...row.tags,...row.techniques,row.format];
  const title=normalize(row.title+" "+row.creator);
  const tags=normalize(labels.join(" "));
  const intent=[];
  if (/\b(launch|promo|spot|teaser|trailer|ad|advertisement)\b/.test(normalize(row.title)))
    intent.push("launch promo promotion teaser advertising campaign trailer");
  if (/\b(showreel|portfolio|reel)\b/.test(normalize(row.title))) intent.push("portfolio showcase reel showreel");
  const metadata=[...intent,...labels.map(t=>vocabulary[t]||""),...row.kind,row.model||"",row.stack||""].join(" ");
  return {title,tags,terms:[...new Set(words([title,tags,metadata].join(" ")))]};
}
export function queryTerms(query) {
  return words(query).map(t=>({typographic:"typography",typographical:"typography",smartphones:"smartphone",
    collages:"collage",launches:"launch",morphs:"morph",morphing:"morph"})[t]||t);
}
export function rank(record,terms) {
  let score=0;
  for (const t of terms) {
    if (record.terms.includes(t)) {
      score+=record.title.split(" ").includes(t)?9:record.tags.split(" ").includes(t)?6:3;
    } else if (t.length>=3 && record.terms.some(w=>w.startsWith(t))) score+=2;
    else if (record.terms.some(w=>near(t,w))) score+=1;
    else return -1;
  }
  return score;
}
