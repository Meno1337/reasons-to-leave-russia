const CATEGORIES = [
  "ЗАКОНЫ",
  "ЦЕНЗУРА",
  "ПОЛИЦИЯ",
  "ЛГБТ",
  "ИНТЕРНЕТ",
  "ОБРАЗОВАНИЕ",
  "КУЛЬТУРА",
  "ЭКОНОМИКА",
  "МОБИЛИЗАЦИЯ",
  "ВЫБОРЫ",
  "ДРУГОЕ"
];

const resultsSection = document.getElementById('results');
const toggleViewBtn = document.getElementById('toggleView');

let isCardsView = true;
toggleViewBtn.addEventListener('click', () => {
  isCardsView = !isCardsView;
  if(isCardsView) {
    resultsSection.classList.add('cards');
    resultsSection.classList.remove('list');
    toggleViewBtn.textContent = 'Вид: блоки';
  } else {
    resultsSection.classList.remove('cards');
    resultsSection.classList.add('list');
    toggleViewBtn.textContent = 'Вид: список';
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "add") initAdd();
});

// ---------- HOME ----------
async function initHome() {
  const data = await fetch("data/entries.json").then(r => r.json()).catch(() => ({entries:[]}));
  const entries = data.entries || [];
  const q = $("#q"), yearMin = $("#yearMin"), yearMax = $("#yearMax"),
        yearMinLabel = $("#yearMinLabel"), yearMaxLabel = $("#yearMaxLabel"),
        onlyVerified = $("#onlyVerified"), catList = $("#catList");

  // categories
  CATEGORIES.forEach(cat => {
    const id = `cat_${cat}`;
    const label = el("label", {}, [
      el("input", {type:"checkbox", value:cat}),
      document.createTextNode(" " + cat)
    ]);
    label.htmlFor = id;
    catList.appendChild(label);
  });

  // sync labels
  const syncYears = () => {
    if (+yearMin.value > +yearMax.value) {
      [yearMin.value, yearMax.value] = [yearMax.value, yearMin.value];
    }
    yearMinLabel.textContent = yearMin.value;
    yearMaxLabel.textContent = yearMax.value;
    render();
  };
  ["input","change"].forEach(e => {
    yearMin.addEventListener(e, syncYears);
    yearMax.addEventListener(e, syncYears);
  });

  q.addEventListener("input", debounce(render, 120));
  onlyVerified.addEventListener("change", render);
  catList.addEventListener("change", render);

  // modal
  const modal = $("#entryModal");
  $("#closeModal").addEventListener("click", () => modal.close());

  function render() {
    const term = q.value.trim().toLowerCase();
    const yMin = +yearMin.value, yMax = +yearMax.value;
    const cats = [...catList.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value);
    const results = entries.filter(e => {
      const inYears = e.yearFrom >= yMin && e.yearFrom <= yMax;
      const inCat = cats.length ? cats.includes(e.category) : true;
      const okStatus = onlyVerified.checked ? e.status === "VERIFIED" : true;
      const text = (e.title + " " + e.summary + " " + (e.tags||[]).join(" ") + " " + (e.body||""))
        .toLowerCase();
      const inText = term ? text.includes(term) : true;
      return inYears && inCat && okStatus && inText;
    }).sort((a,b)=> (b.yearFrom - a.yearFrom) || a.title.localeCompare(b.title));

    const wrap = $("#results");
    wrap.innerHTML = "";
    results.forEach(e => {
      const card = el("div", {class:"card"});
      card.append(
        el("div", {class:"badges"}, [
          badge(e.category),
          badge(String(e.yearFrom)),
          e.status === "VERIFIED" ? badge("VERIFIED") : null
        ].filter(Boolean))
      );
      card.append(el("h3", {}, [document.createTextNode(e.title)]));
      card.append(el("p", {class:"muted"}, [document.createTextNode(e.summary)]));
      const more = el("button", {class:"button ghost", onclick:()=>openEntry(e)}, ["Подробнее"]);
      card.append(more);
      wrap.append(card);
    });
    $("#count").textContent = results.length ? `Найдено записей: ${results.length}` : "Ничего не найдено.";
  }

  function openEntry(e) {
    const cont = $("#entryContent");
    cont.innerHTML = "";
    cont.append(el("h2", {}, [document.createTextNode(e.title)]));
    cont.append(el("p", {class:"muted"}, [document.createTextNode(`${e.category} · ${e.yearFrom}${e.yearTo? "–"+e.yearTo:""}`)]));
    if (e.body) cont.append(markdownToHtml(e.body));
    cont.append(el("h3", {}, ["Источники"]));
    if (e.sources?.length) {
      const ul = el("ul");
      e.sources.forEach(s => {
        const li = el("li");
        const a = el("a", {href:s.url, target:"_blank", rel:"noopener", class:"source"}, [document.createTextNode(s.title || s.url)]);
        li.append(a);
        if (s.publisher) li.append(document.createTextNode(` — ${s.publisher}`));
        if (s.publishedAt) li.append(document.createTextNode(` (${fmtDate(s.publishedAt)})`));
        ul.append(li);
      });
      cont.append(ul);
    } else {
      cont.append(el("p", {class:"muted"}, ["Источников нет"]));
    }
    $("#entryModal").showModal();
  }

  syncYears();
  render();
}

// ---------- ADD ----------
function initAdd() {
  // fill categories
  const catSel = document.querySelector('select[name="category"]');
  CATEGORIES.forEach(c => catSel.append(new Option(c, c)));

  // sources UI
  const sourcesWrap = $("#sources");
  $("#addSource").addEventListener("click", () => addSourceRow());
  addSourceRow(); // at least one

  // form submit
  $("#addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = readForm();
    const md = toMarkdown(data);
    $("#preview").textContent = md;
    download(`${data.yearFrom}-${data.slug}.md`, md, "text/markdown;charset=utf-8");
  });

  $("#copyIssue").addEventListener("click", () => {
    const data = readForm();
    const lines = [
      `Заголовок: ${data.title}`,
      `Категория: ${data.category}`,
      `Год: ${data.yearFrom}` + (data.yearTo ? `–${data.yearTo}` : ""),
      `Кратко: ${data.summary}`,
      `Нормативка: ${data.legalRef || "-"}`,
      `Источники:`,
      ...(data.sources.length ? data.sources.map(s => `- ${s.url} ${s.title ? `(${s.title})` : ""}`) : ["- (добавьте хотя бы один URL)"]),
      ``,
      `Текст:`,
      data.body || "(пусто)",
    ].join("\n");
    navigator.clipboard.writeText(lines).then(()=>alert("Скопировано. Вставьте в GitHub Issue."));
  });

  function addSourceRow() {
    const row = el("div", {class:"grid"});
    row.append(field("URL", `<input name="src_url" type="url" required placeholder="https://...">`));
    row.append(field("Заголовок", `<input name="src_title" placeholder="Название статьи">`));
    row.append(field("Издатель", `<input name="src_publisher" placeholder="СМИ/организация">`));
    row.append(field("Когда опубликовано", `<input name="src_publishedAt" type="date">`));
    sourcesWrap.append(row);
  }

  function readForm() {
    const f = document.forms[0];
    const sources = [...document.querySelectorAll('input[name="src_url"]')].map((_,i)=>({
      url: document.getElementsByName("src_url")[i].value.trim(),
      title: document.getElementsByName("src_title")[i].value.trim(),
      publisher: document.getElementsByName("src_publisher")[i].value.trim(),
      publishedAt: document.getElementsByName("src_publishedAt")[i].value
    })).filter(s=>s.url);

    const yearFrom = +f.yearFrom.value;
    if (yearFrom < 2010 || yearFrom > 2025) {
      alert("Год должен быть в диапазоне 2010–2025.");
      throw new Error("year out of range");
    }
    if (!sources.length) {
      alert("Добавьте минимум один источник (URL).");
      throw new Error("no sources");
    }

    return {
      slug: f.slug.value.trim(),
      title: f.title.value.trim(),
      summary: f.summary.value.trim(),
      category: f.category.value,
      tags: f.tags.value.split(",").map(s=>s.trim()).filter(Boolean),
      country: "RU",
      yearFrom,
      yearTo: f.yearTo.value ? +f.yearTo.value : null,
      dateStart: f.dateStart.value || null,
      dateEnd: f.dateEnd.value || null,
      impact: f.impact.value,
      legalRef: f.legalRef.value.trim(),
      status: f.status.value,
      sources,
      body: f.body.value
    };
  }

  function toMarkdown(d) {
    const fm = [
      "---",
      `slug: "${d.slug}"`,
      `title: "${escapeYaml(d.title)}"`,
      `summary: "${escapeYaml(d.summary)}"`,
      `category: "${d.category}"`,
      `tags: [${d.tags.map(t=>`"${escapeYaml(t)}"`).join(", ")}]`,
      `country: "RU"`,
      `yearFrom: ${d.yearFrom}`,
      `yearTo: ${d.yearTo ?? ""}`,
      `dateStart: ${d.dateStart ? `"${d.dateStart}"` : ""}`,
      `dateEnd: ${d.dateEnd ? `"${d.dateEnd}"` : ""}`,
      `impact: "${d.impact}"`,
      `legalRef: ${d.legalRef ? `"${escapeYaml(d.legalRef)}"` : ""}`,
      `status: "${d.status}"`,
      `sources:`,
      ...d.sources.map(s => `  - url: "${s.url}"${s.title?`\n    title: "${escapeYaml(s.title)}"`:""}${s.publisher?`\n    publisher: "${escapeYaml(s.publisher)}"`:""}${s.publishedAt?`\n    publishedAt: "${s.publishedAt}"`:""}`),
      "---",
      "",
      d.body || ""
    ].join("\n");
    return fm;
  }
}

// ---------- utils ----------
function $(sel){ return document.querySelector(sel); }
function el(tag, attrs={}, children=[]) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "onclick") n.addEventListener("click", v);
    else if (v != null) n.setAttribute(k, v);
  });
  (Array.isArray(children)?children:[children]).forEach(c => {
    if (c==null) return;
    n.append(c.nodeType ? c : document.createTextNode(c));
  });
  return n;
}
function badge(text){ return el("span", {class:"badge"}, [text]); }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); }; }
function fmtDate(s){ try{ return new Date(s).toLocaleDateString("ru-RU"); }catch{ return s; } }
function escapeYaml(s){ return s.replace(/"/g,'\\"'); }
function download(filename, text, mime="text/plain;charset=utf-8") {
  const blob = new Blob([text], {type:mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
// очень простой markdown -> html (заголовки/параграфы/списки/ссылки)
function markdownToHtml(md){
  const html = md
    .replace(/^### (.*$)/gim,'<h3>$1</h3>')
    .replace(/^## (.*$)/gim,'<h2>$1</h2>')
    .replace(/^# (.*$)/gim,'<h1>$1</h1>')
    .replace(/^\- (.*$)/gim,'<li>$1</li>')
    .replace(/\n\n/gim,'<p></p>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="source" href="$2" target="_blank" rel="noopener">$1</a>');
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}
