"use strict";
const element = id => document.getElementById(id);
const make = (tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text || "";
  return node;
};
const catalog = window.studioCatalog;
const sourceBase = document.documentElement.dataset.sourceBase;
const toolLinks = {
  Shotcraft: "https://github.com/Vincentwei1021/video-shotcraft",
  HyperFrames: "https://github.com/heygen-com/hyperframes",
  "Herk · Vox": "https://github.com/nateherkai/herk-edit-kit",
  "Herk · Kallaway": "https://github.com/nateherkai/herk-edit-kit",
};
const byId = new Map(catalog.map(row => [row.id, row]));
const highlights = ["shotcraft/card-stack", "vox/t1-overview-agenda", "hyperframes/vox-annotate",
  "shotcraft/text-as-mask", "kallaway/t1-overview-beforeafter", "shotcraft/axis-rescale-shock",
  "hyperframes/agent-cursor", "vox/t1-stat-spotlight"];
const ordered = [];
const collections = [...new Set(catalog.map(row => row.group))].sort();
const groups = collections.map(group => catalog.filter(row => row.group === group && !highlights.includes(row.id)));
ordered.push(...highlights.map(id => byId.get(id)).filter(Boolean));
for (let i = 0; groups.some(group => i < group.length); i++) {
  for (const group of groups) if (group[i]) ordered.push(group[i]);
}
for (const group of collections) element("collection").add(new Option(group, group));
const dialog = element("detail");
let result = [];
let shown = 0;
let previousFocus;

function card(row) {
  const node = make("button");
  node.className = "card";
  node.type = "button";
  const art = make("div");
  art.className = "art";
  if (row.poster) {
    const img = make("img");
    img.src = row.poster;
    img.alt = "";
    img.loading = "lazy";
    art.append(img);
  } else {
    const hint = make("span", "View source example");
    hint.className = "fallback";
    art.append(hint);
  }
  if (row.video) {
    const play = make("span", "▶ Video");
    play.className = "play";
    art.append(play);
  }
  const label = make("span", row.group + " · " + row.category);
  label.className = "label";
  node.append(art, label, make("strong", row.title));
  node.addEventListener("click", () => { location.hash = encodeURIComponent(row.id); });
  return node;
}

function addPage() {
  const batch = result.slice(shown, shown + 32);
  element("grid").append(...batch.map(card));
  shown += batch.length;
  element("more").hidden = shown >= result.length;
  element("count").textContent = result.length ? shown + " of " + result.length + " shots" : "No matches. Try a shorter search.";
}
function filter() {
  const group = element("collection").value;
  const type = element("type").value;
  const terms = element("query").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  result = ordered.filter(row => {
    const info = [row.id, row.title, row.category, row.group, row.tags, row.desc].join(" ").toLowerCase();
    return (!group || row.group === group) && (!type || row[type]) && terms.every(term => info.includes(term));
  });
  shown = 0;
  element("grid").replaceChildren();
  addPage();
}
function link(text, href) {
  const node = make("a", text);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener";
  return node;
}
function restoreSelection() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ""; }
  const row = byId.get(id);
  if (!row) {
    if (dialog.open) dialog.close();
    return;
  }
  previousFocus = document.activeElement;
  element("name").textContent = row.title;
  element("family").textContent = row.group + " · " + row.category;
  element("description").textContent = row.desc || "";
  element("shotId").value = row.id;
  element("feedback").textContent = "";
  const art = element("art");
  art.replaceChildren();
  if (row.video || row.poster) {
    const media = make(row.video ? "video" : "img");
    if (row.video) {
      media.controls = true;
      media.playsInline = true;
      media.poster = row.poster || "";
      media.preload = "metadata";
    } else media.alt = "Example frame of " + row.title;
    media.src = row.video || row.poster;
    art.append(media);
  }
  element("sourcePath").textContent = "library/" + row.source;
  const links = element("links");
  links.replaceChildren(link("Editable source", sourceBase + row.source));
  if (row.recipe) links.append(link("Recipe", sourceBase + row.recipe));
  if (toolLinks[row.group]) links.append(link("Original tool", toolLinks[row.group]));
  if (row.web) links.append(link("Publisher example ↗", row.web));
  if (!dialog.open) dialog.showModal();
}
dialog.addEventListener("close", () => {
  element("art").replaceChildren();
  if (location.hash) history.replaceState(null, "", location.href.split("#")[0]);
  if (previousFocus?.isConnected) previousFocus.focus();
});
element("copy").addEventListener("click", async () => {
  const field = element("shotId");
  try {
    await navigator.clipboard.writeText(field.value);
    element("feedback").textContent = "Copied.";
  } catch {
    field.focus(); field.select();
    element("feedback").textContent = "ID selected. Use your device’s Copy command.";
  }
});
element("close").addEventListener("click", () => dialog.close());
element("more").addEventListener("click", addPage);
element("filters").addEventListener("input", filter);
element("filters").addEventListener("submit", event => event.preventDefault());
element("reset").addEventListener("click", () => { element("filters").reset(); filter(); });
window.addEventListener("hashchange", restoreSelection);
filter();
restoreSelection();
