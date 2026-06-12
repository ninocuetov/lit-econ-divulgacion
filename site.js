const state = {
  rounds: [],
  currentRound: null,
  currentVersion: "short",
};

const VERSION_LABELS = {
  short: "Versión breve",
  long: "Versión extendida",
  technical: "Nota técnica",
};

const CONTENT_VERSION = "20260611-12";

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

function renderMechanismIcon(type = "nodes") {
  const icons = {
    search: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="21" cy="21" r="11"></circle><path d="M30 30l9 9"></path><path d="M16 21h10"></path></svg>`,
    nodes: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="12" cy="24" r="5"></circle><circle cx="34" cy="14" r="5"></circle><circle cx="36" cy="34" r="5"></circle><path d="M17 22l12-6"></path><path d="M17 26l14 6"></path></svg>`,
    balance: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 9v30"></path><path d="M13 16h22"></path><path d="M16 16l-7 13h14l-7-13z"></path><path d="M32 16l-7 13h14l-7-13z"></path><path d="M18 39h12"></path></svg>`,
    steps: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 36h9v-8h9v-8h12"></path><path d="M11 15h8"></path><path d="M11 21h12"></path></svg>`,
    office: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 39V10h20v29"></path><path d="M10 39h28"></path><path d="M19 16h3M26 16h3M19 23h3M26 23h3M19 30h3M26 30h3"></path></svg>`,
    shield: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8l15 6v10c0 9-6 15-15 18C15 39 9 33 9 24V14l15-6z"></path><path d="M18 24l4 4 8-9"></path></svg>`,
    route: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 36c8-2 6-12 14-12s7-9 15-11"></path><circle cx="10" cy="37" r="4"></circle><circle cx="41" cy="13" r="4"></circle><path d="M20 12h9"></path><path d="M20 17h14"></path></svg>`,
    capture: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="14"></circle><circle cx="24" cy="24" r="6"></circle><path d="M24 5v8M24 35v8M5 24h8M35 24h8"></path></svg>`,
  };

  return `<span class="mechanism-icon">${icons[type] || icons.nodes}</span>`;
}

function renderReadingMeta(reading) {
  return `
    <p class="reading-meta">
      <span><em>${escapeHtml(reading.title)}</em></span>
      <span>${escapeHtml(reading.authors)} (${escapeHtml(reading.year)}) · ${escapeHtml(reading.journal)}</span>
    </p>
  `;
}

function buildReadingsBySection(readings = []) {
  return readings.reduce((accumulator, reading) => {
    accumulator[String(reading.section)] = reading;
    return accumulator;
  }, {});
}

function renderMarkdown(source, basePath = "", options = {}) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let quote = [];
  const readingsBySection = buildReadingsBySection(options.readings);

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

  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item)}</p>`).join("")}</blockquote>`);
      quote = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    if (options.suppressReadingLines && /^\*.+\*\s+[—-]\s+.+\(\d{4}\)$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      flushQuote();
      const src = image[2].startsWith("http") ? image[2] : `${basePath}/${image[2]}`;
      html.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}">`);
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      const section = heading[2].match(/^(\d+)\./);
      if (level === 2 && section && readingsBySection[section[1]]) {
        html.push(renderReadingMeta(readingsBySection[section[1]]));
      }
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushQuote();
      list.push(bullet[1]);
      continue;
    }

    const blockquote = trimmed.match(/^>\s+(.+)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushQuote();
  return html.join("\n");
}

function renderShortMessage(source, basePath = "") {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let quote = [];
  let firstTextBlock = true;
  let pendingTitleAfterKicker = false;

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

  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item)}</p>`).join("")}</blockquote>`);
      quote = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushAll();
      const src = image[2].startsWith("http") ? image[2] : `${basePath}/${image[2]}`;
      html.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}">`);
      firstTextBlock = false;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      firstTextBlock = false;
      continue;
    }

    const numberedHeading = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedHeading) {
      flushAll();
      html.push(`<h2><span>${escapeHtml(numberedHeading[1])}</span>${inlineMarkdown(numberedHeading[2])}</h2>`);
      firstTextBlock = false;
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushQuote();
      list.push(bullet[1]);
      firstTextBlock = false;
      continue;
    }

    const blockquote = trimmed.match(/^>\s+(.+)$/);
    if (blockquote) {
      flushParagraph();
      flushList();
      quote.push(blockquote[1]);
      firstTextBlock = false;
      continue;
    }

    const firstLineWithTitle = trimmed.match(/^(Ronda\s+\d+)[:.]\s+(.+)$/i);
    if (firstTextBlock && firstLineWithTitle) {
      flushAll();
      html.push(`<p class="short-kicker-line">${inlineMarkdown(firstLineWithTitle[1])}</p>`);
      html.push(`<h1>${inlineMarkdown(firstLineWithTitle[2])}</h1>`);
      firstTextBlock = false;
      continue;
    }

    if (firstTextBlock && /^Ronda\s+\d+$/i.test(trimmed)) {
      flushAll();
      html.push(`<p class="short-kicker-line">${inlineMarkdown(trimmed)}</p>`);
      pendingTitleAfterKicker = true;
      firstTextBlock = false;
      continue;
    }

    if (pendingTitleAfterKicker) {
      flushAll();
      html.push(`<h1>${inlineMarkdown(trimmed)}</h1>`);
      pendingTitleAfterKicker = false;
      continue;
    }

    paragraph.push(trimmed);
    firstTextBlock = false;
  }

  flushAll();
  return html.join("\n");
}

async function loadRounds() {
  const response = await fetch(`rondas.json?v=${CONTENT_VERSION}`);
  state.rounds = await response.json();
}

function renderIndex() {
  const list = document.querySelector("#round-list");
  if (!list) return;

  const publishedRounds = state.rounds.filter((round) => round.published !== false);

  list.innerHTML = publishedRounds
    .map(
      (round) => {
        const mechanismPreview = (round.mechanisms || [])
          .slice(0, 4)
          .map(
            (item) => `
              <span>
                ${renderMechanismIcon(item.icon)}
                ${escapeHtml(item.label)}
              </span>
            `
          )
          .join("");

        return `
        <article class="archive-item">
          <div class="archive-copy">
            <p class="archive-number">${round.number}</p>
            <h3><a href="ronda.html?id=${round.id}&version=long">${round.title}</a></h3>
            <p>${round.summary}</p>
          </div>
          <nav class="archive-links" aria-label="Enlaces de ${round.number}">
            <a href="ronda.html?id=${round.id}&version=short">Versión corta</a>
            ${round.technical ? `<a href="ronda.html?id=${round.id}&version=technical">Nota técnica</a>` : ""}
            ${round.pdf ? `<a href="${round.pdf}">PDF</a>` : ""}
          </nav>
          ${mechanismPreview ? `<div class="mechanism-preview">${mechanismPreview}</div>` : ""}
        </article>
      `;
      }
    )
    .join("");
}

function setDownloads(round, sourcePath) {
  const pdf = document.querySelector("#pdf-link");
  const docx = document.querySelector("#docx-link");
  const source = document.querySelector("#source-link");
  const technical = document.querySelector("#technical-link");

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

  if (technical) {
    technical.hidden = !round.technical;
    if (round.technical) {
      technical.href = `ronda.html?id=${round.id}&version=technical`;
      technical.classList.toggle("active", state.currentVersion === "technical");
    }
  }
}

function renderMechanismMap(round) {
  const mechanisms = round.mechanisms || [];
  if (!mechanisms.length) return "";

  const mechanismItems = mechanisms
    .map(
      (item, index) => `
        <li>
          <div class="mechanism-head">
            ${renderMechanismIcon(item.icon)}
            <span class="mechanism-step">${index + 1}</span>
          </div>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.text)}</p>
        </li>
      `
    )
    .join("");

  return `
    <aside class="reading-tools" aria-label="Mapa de mecanismos">
      <section class="mechanism-map">
        <p class="eyebrow">Síntesis visual</p>
        <h2>Mapa de mecanismos</h2>
        <ol>${mechanismItems}</ol>
      </section>
    </aside>
  `;
}

function renderSideGlossary(round) {
  const glossary = round.glossary || [];
  if (!glossary.length) return "";

  const glossaryItems = glossary
    .map(
      (item) => `
        <div>
          <dt>${escapeHtml(item.term)}</dt>
          <dd>${escapeHtml(item.definition)}</dd>
        </div>
      `
    )
    .join("");

  return `
    <section class="glossary-card">
      <p class="eyebrow">Conceptos</p>
      <h2>Glosario breve</h2>
      <dl>${glossaryItems}</dl>
    </section>
  `;
}

function injectMechanismMap(markup, support) {
  if (!support) return markup;
  const marker = "<h2>Preguntas para discutir</h2>";
  if (markup.includes(marker)) {
    return markup.replace(marker, `${support}${marker}`);
  }
  return `${markup}${support}`;
}

async function renderRound() {
  const content = document.querySelector("#content");
  const title = document.querySelector("#round-title");
  if (!content || !title || !location.pathname.endsWith("ronda.html")) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || state.rounds[0]?.id;
  state.currentRound = state.rounds.find((round) => round.id === id) || state.rounds[0];
  const requestedVersion = params.get("version");
  state.currentVersion =
    requestedVersion === "technical" && state.currentRound.technical
      ? "technical"
      : requestedVersion === "long"
        ? "long"
        : "short";

  const round = state.currentRound;
  const filename =
    state.currentVersion === "technical"
      ? round.technical
      : state.currentVersion === "long"
        ? round.long
        : round.short;
  const sourcePath = `${round.folder}/${filename}`;

  document.title = `${round.number}: ${round.title} | ${VERSION_LABELS[state.currentVersion]}`;
  document.querySelector("#round-kicker").textContent = round.number;
  title.textContent = round.title;
  document.querySelector("#round-summary").textContent = round.summary;

  document.querySelector("#short-tab").classList.toggle("active", state.currentVersion === "short");
  document.querySelector("#long-tab").classList.toggle("active", state.currentVersion === "long");
  document.querySelector("#short-tab").setAttribute("aria-selected", state.currentVersion === "short");
  document.querySelector("#long-tab").setAttribute("aria-selected", state.currentVersion === "long");

  const response = await fetch(`${sourcePath}?v=${CONTENT_VERSION}`);
  const text = await response.text();
  const articleMarkup =
    state.currentVersion === "short"
      ? renderShortMessage(text, round.folder)
      : renderMarkdown(text, round.folder, {
          readings: state.currentVersion === "long" ? round.readings : [],
          suppressReadingLines: state.currentVersion === "long",
        });
  const mechanismMap = state.currentVersion === "long" ? renderMechanismMap(round) : "";
  content.classList.toggle("short-article", state.currentVersion === "short");
  content.innerHTML = injectMechanismMap(articleMarkup, mechanismMap);
  const sideGlossary = document.querySelector("#side-glossary");
  if (sideGlossary) {
    sideGlossary.innerHTML = state.currentVersion === "long" ? renderSideGlossary(round) : "";
  }
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

async function init() {
  await loadRounds();
  renderIndex();
  await renderRound();
  wireRoundTabs();
}

init().catch((error) => {
  const content = document.querySelector("#content") || document.querySelector("#round-list");
  if (content) content.innerHTML = `<p>No se pudo cargar el contenido: ${escapeHtml(error.message)}</p>`;
});
