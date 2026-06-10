const state = {
  rounds: [],
  currentRound: null,
  currentVersion: "short",
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const inlineMarkdown = (value) =>
  escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function renderMarkdown(source, basePath = "") {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      const src = image[2].startsWith("http") ? image[2] : `${basePath}/${image[2]}`;
      html.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}">`);
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

async function loadRounds() {
  const response = await fetch("rondas.json");
  state.rounds = await response.json();
}

function renderIndex() {
  const list = document.querySelector("#round-list");
  if (!list) return;

  list.innerHTML = state.rounds
    .map(
      (round) => `
        <article class="archive-item">
          <div class="archive-copy">
            <p class="archive-number">${round.number}</p>
            <h3>${round.title}</h3>
            <p>${round.summary}</p>
          </div>
          <nav class="archive-links" aria-label="Enlaces de ${round.number}">
            <a href="ronda.html?id=${round.id}&version=short">Versión corta</a>
            <a href="ronda.html?id=${round.id}&version=long">Versión larga</a>
            <a href="${round.pdf}">PDF</a>
          </nav>
        </article>
      `
    )
    .join("");
}

function setDownloads(round, sourcePath) {
  const pdf = document.querySelector("#pdf-link");
  const docx = document.querySelector("#docx-link");
  const source = document.querySelector("#source-link");

  if (pdf && round.pdf) {
    pdf.hidden = false;
    pdf.href = round.pdf;
  }

  if (docx && round.docx) {
    docx.hidden = false;
    docx.href = round.docx;
  }

  if (source) {
    source.hidden = false;
    source.href = sourcePath;
  }
}

async function renderRound() {
  const content = document.querySelector("#content");
  const title = document.querySelector("#round-title");
  if (!content || !title || !location.pathname.endsWith("ronda.html")) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || state.rounds[0]?.id;
  state.currentVersion = params.get("version") === "long" ? "long" : "short";
  state.currentRound = state.rounds.find((round) => round.id === id) || state.rounds[0];

  const round = state.currentRound;
  const filename = state.currentVersion === "long" ? round.long : round.short;
  const sourcePath = `${round.folder}/${filename}`;

  document.title = `${round.number}: ${round.title}`;
  document.querySelector("#round-kicker").textContent = round.number;
  title.textContent = round.title;
  document.querySelector("#round-summary").textContent = round.summary;

  document.querySelector("#short-tab").classList.toggle("active", state.currentVersion === "short");
  document.querySelector("#long-tab").classList.toggle("active", state.currentVersion === "long");
  document.querySelector("#short-tab").setAttribute("aria-selected", state.currentVersion === "short");
  document.querySelector("#long-tab").setAttribute("aria-selected", state.currentVersion === "long");

  const response = await fetch(sourcePath);
  const text = await response.text();
  content.innerHTML = renderMarkdown(text, round.folder);
  setDownloads(round, sourcePath);
}

function wireRoundTabs() {
  const shortTab = document.querySelector("#short-tab");
  const longTab = document.querySelector("#long-tab");
  if (!shortTab || !longTab) return;

  shortTab.addEventListener("click", () => {
    location.search = `?id=${state.currentRound.id}&version=short`;
  });

  longTab.addEventListener("click", () => {
    location.search = `?id=${state.currentRound.id}&version=long`;
  });
}

async function renderPlan() {
  const content = document.querySelector("#content");
  if (!content || !location.pathname.endsWith("plan.html")) return;

  const response = await fetch("contenido/PLAN_EDITORIAL.md");
  const text = await response.text();
  content.innerHTML = renderMarkdown(text, "contenido");
}

async function init() {
  await loadRounds();
  renderIndex();
  await renderRound();
  await renderPlan();
  wireRoundTabs();
}

init().catch((error) => {
  const content = document.querySelector("#content") || document.querySelector("#round-list");
  if (content) content.innerHTML = `<p>No se pudo cargar el contenido: ${escapeHtml(error.message)}</p>`;
});
