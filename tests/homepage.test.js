const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const readingModel = require("../reading/reading-manager.js");

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.className = "";
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.disabled = false;
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === "") this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }
  dispatch(type, event = {}) {
    (this.listeners[type] || []).forEach((listener) => listener({
      preventDefault() {},
      currentTarget: this,
      target: this,
      key: event.key,
    }));
  }
  focus() { this.attributes.focused = "true"; }
  getAttribute(name) { return this.attributes[name] || ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
}

function homepageScript() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return scripts.at(-1)[1];
}

async function runHomepage() {
  const elements = new Map([
    ["cg", new FakeElement("cg")],
    ["ts", new FakeElement("ts")],
    ["logo", new FakeElement("logo")],
    ["greeting", new FakeElement("greeting")],
    ["clock", new FakeElement("clock")],
    ["writing-list", new FakeElement("writing-list")],
    ["shelves", new FakeElement("shelves")],
    ["readingDeckStage", new FakeElement("readingDeckStage")],
  ]);
  const documentElement = new FakeElement("html");
  documentElement.setAttribute("data-theme", "warm");
  const document = {
    documentElement,
    createElement: () => new FakeElement(),
    getElementById: (id) => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const readingPosts = [
    { id: "book-a", title: "Book A", creator: "Author A", added_at: "2026-07-20", updated_at: "2026-07-20", status: "reading", type: "book", topics: ["AI"], url: "https://example.com/a" },
    { id: "book-b", title: "Book B", creator: "Author B", added_at: "2026-07-19", updated_at: "2026-07-19", status: "want", type: "book", topics: ["AI"], url: "https://example.com/b" },
  ];
  const fetch = async (url) => ({
    json: async () => url.includes("reading/") ? readingPosts : [],
  });
  const context = {
    document,
    fetch,
    localStorage: { getItem: () => null, setItem: () => {} },
    setInterval: () => 0,
    window: { addEventListener: () => {}, scrollY: 0, innerHeight: 800 },
    ReadingManagerModel: readingModel,
  };

  vm.runInNewContext(homepageScript(), context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return elements;
}

test("reading deck still renders when optional podcast source list is absent", async () => {
  const elements = await runHomepage();
  assert.ok(elements.get("readingDeckStage").children.length > 0);
});

test("reading card occupies the hero visual column instead of a duplicate section", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.match(hero, /class="hero-copy"/);
  assert.match(hero, /class="hero-reading"/);
  assert.match(hero, />Currently reading</);
  assert.match(hero, /class="reading-deck"/);
  assert.match(hero, /id="readingDeckStage"/);
  assert.match(hero, /href="reading\.html"/);
  assert.doesNotMatch(hero, /role="tablist"|reading-deck-tab|readingCount|upNextCount|Up next|Now reading|reading-deck-preview/);
  assert.doesNotMatch(html, /<section class="section" id="reading"/);
  assert.match(html, /--page-max-width:1400px/);
  assert.match(html, /\.hero\{display:grid/);
  assert.match(html, /selectHomepageEntries\(posts,posts\.length\)/);
  assert.match(html, /@media\(max-width:768px\)[\s\S]*?\.hero\{grid-template-columns:1fr/);
  assert.doesNotMatch(hero, /shelf-row|class="book/);
});

test("hero keeps its compact introduction and real navigation", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const nav = html.match(/<nav class="nav">[\s\S]*?<\/nav>/)?.[0] || "";
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.match(nav, /class="nav-brand"/);
  assert.match(nav, /id="logo"[^>]*>Cobb[\s\S]*?nav-logo-dot/);
  assert.doesNotMatch(nav, /Do · Learn · Repeat\./);
  assert.doesNotMatch(hero, /AI Product Builder/i);
  assert.match(hero, /class="hero-title"/);
  assert.match(hero, /id="greeting"/);
  assert.match(hero, /I'm <span class="hero-name">Cobb<\/span>\./);
  assert.match(hero, /class="hero-tagline"[\s\S]*?One day, you’ll use something I made\./);
  assert.match(html, /\.hero-title\{[^}]*font-size:clamp\(/);
  assert.match(html, /\.hero-title\{[^}]*letter-spacing:-\.035em/);
  assert.match(html, /\.hero-tagline\{[^}]*letter-spacing:0/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?[^\"]*family=IBM\+Plex\+Mono:wght@300;400;500/);
  assert.match(html, /\.hero-tagline\{[^}]*font:400[^}]*'IBM Plex Mono',var\(--font-mono\),monospace/);
  assert.match(html, /\[data-theme="terminal"\] \.hero-tagline\{font-family:var\(--font-mono\);letter-spacing:0\}/);
  assert.match(html, /\.hero-clock\{[^}]*display:none/);
  assert.match(html, /\.hero\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(html, /\.hero-reading\{[^}]*position:absolute/);
  assert.match(html, /class="nav-links"[\s\S]*class="nav-actions"/);
  assert.match(html, /--page-max-width:1400px/);
});

test("hero actions use the selected GitHub mark and postal emoji", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";
  const github = hero.match(/<a class="social-button" href="https:\/\/github\.com\/Cobb04"[\s\S]*?<\/a>/)?.[0] || "";
  const email = hero.match(/<a class="social-button" href="mailto:chenxnovo49@gmail\.com"[\s\S]*?<\/a>/)?.[0] || "";

  assert.match(github, /target="_blank"/);
  assert.match(github, /rel="noopener noreferrer"/);
  assert.match(github, /<svg[^>]+aria-hidden="true"[^>]+>[\s\S]*?fill="currentColor"/);
  assert.match(github, />GitHub</);
  assert.match(email, /<span class="social-emoji" aria-hidden="true">📮<\/span>/);
  assert.match(email, />Email</);
  assert.doesNotMatch(hero, /🐙|📧|Email me/);
});

test("hero keeps the original character as a separate accessible-hidden asset", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const characterPath = path.join(__dirname, "..", "assets", "hero-character.jpg");
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.ok(fs.existsSync(characterPath));
  assert.match(hero, /<img class="hero-character" src="assets\/hero-character\.jpg" alt="" aria-hidden="true" width="1260" height="1226"/);
  assert.match(html, /\.hero-character\{[\s\S]*?mix-blend-mode:multiply/);
  assert.doesNotMatch(hero, /data:image|ChatGPT Image/);
});

test("side navigation waits until the hero leaves the viewport", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /class="side-nav"[^>]*aria-label="Page sections"/);
  assert.match(html, /\.side-nav\{[^}]*opacity:0/);
  assert.match(html, /\.side-nav\.is-visible\{[^}]*opacity:1/);
  assert.match(html, /new (?:window\.)?IntersectionObserver/);
  assert.doesNotMatch(html, /window\.addEventListener\("scroll"/);
});

test("mobile hero keeps the next section below the first viewport", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /@media\(max-width:768px\)[\s\S]*?\.hero\{[^}]*min-height:calc\(100svh - 133px\)/);
});

test("homepage podcast section shows only the three newest notes", async () => {
  const elements = await runHomepage();
  const podcasts = elements.get("cg").children;
  assert.equal(podcasts.length, 3);
  assert.match(podcasts[0].innerHTML, /2026-07-19/);
});

test("homepage keeps semantic structure and readable contrast", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<main>[\s\S]*?<header class="hero"[\s\S]*?<\/main>/);
  assert.match(html, /podcast-copy"><h3>/);
  assert.match(html, /<object[^>]+aria-label="INFJ desktop pet working"/);
  assert.match(html, /--text3:#716B63/);
  assert.match(html, /\.footer a\{[^}]*text-decoration:underline/);
});

test("homepage reading card renders one real currently-reading entry", async () => {
  const elements = await runHomepage();
  const stage = elements.get("readingDeckStage");
  const activeCard = stage.children[0];

  assert.match(activeCard.className, /reading-deck-card/);
  assert.equal(activeCard.href, "https://example.com/a");
  assert.equal(activeCard.rel, "noopener noreferrer");
  assert.equal(activeCard.getAttribute("aria-label"), "Book A by Author A, open book");
  assert.equal(activeCard.children[1].textContent, "Book A");
  assert.equal(activeCard.children[2].textContent, "Author A");
  assert.equal(activeCard.children[3].textContent, "Open book ↗");
});

test("the full bookshelf keeps its viewport tooltip without homepage duplication", () => {
  const readingHtml = fs.readFileSync(path.join(__dirname, "..", "reading.html"), "utf8");
  const homepage = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(readingHtml, /class="shelf-tooltip" id="shelfTooltip"/);
  assert.match(readingHtml, /\.shelf-tooltip\{position:fixed/);
  assert.match(readingHtml, /function positionBookTooltip/);
  assert.doesNotMatch(homepage, /id="shelfTooltip"/);
  assert.doesNotMatch(homepage, /function positionBookTooltip/);
});

test("reading card stays compact and has no queue animation", () => {
  const homepage = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(homepage, /\.reading-deck\{[^}]*min-height:260px/);
  assert.doesNotMatch(homepage, /deck-preview-in|reading-deck-preview|reading-deck-tabs|reading-deck-tab/);
});

test("full bookshelf uses the same tactile shelf system", () => {
  const readingHtml = fs.readFileSync(path.join(__dirname, "..", "reading.html"), "utf8");
  assert.match(readingHtml, /\.book::before/);
  assert.match(readingHtml, /\.shelf::before/);
  assert.match(readingHtml, /book-page-edge/);
  assert.match(readingHtml, /book-status-/);
});

test("editor reuses one page for writing and reading management", () => {
  const editor = fs.readFileSync(path.join(__dirname, "..", "editor.html"), "utf8");

  assert.match(editor, /<script src="reading\/reading-manager\.js"><\/script>/);
  assert.match(editor, /role="tablist"/);
  assert.match(editor, /id="writing-tab"/);
  assert.match(editor, /id="reading-tab"/);
  assert.match(editor, /id="writing-panel"/);
  assert.match(editor, /id="reading-panel"/);
  assert.match(editor, /id="reading-form"/);
  assert.match(editor, /id="reading-list"/);
  assert.match(editor, /id="reading-status-filter"/);
  assert.match(editor, /id="reading-search"/);
  assert.match(editor, /downloadReadingJson/);
  assert.doesNotMatch(editor, /github[_ -]?token/i);
  assert.match(editor, /@media\(max-width:720px\)[\s\S]*?\.manager-grid\{grid-template-columns:1fr\}/);
});

test("public shelves share the mixed-media reading model", () => {
  const homepage = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const reading = fs.readFileSync(path.join(__dirname, "..", "reading.html"), "utf8");

  assert.match(homepage, /<script src="reading\/reading-manager\.js"><\/script>/);
  assert.match(homepage, /selectHomepageEntries\(posts,posts\.length\)/);
  assert.match(homepage, /p\.creator/);
  assert.match(homepage, /p\.url/);
  assert.match(homepage, /title\.textContent=p\.title/);
  assert.match(homepage, /action\.textContent="Open "\+p\.type/);
  assert.doesNotMatch(homepage, /spine-title|book-page-edge|shelfColors/);

  assert.match(reading, /<script src="reading\/reading-manager\.js"><\/script>/);
  assert.match(reading, /id="statusFilters"/);
  assert.match(reading, /id="typeFilter"/);
  assert.match(reading, /id="topicFilter"/);
  assert.match(reading, /data-status="read"/);
  assert.match(reading, /data-status="stopped"/);
  assert.match(reading, /p\.topics/);
  assert.match(reading, /p\.type/);
  assert.match(reading, /shelf-compact/);
  assert.match(reading, /groups\[topic\]\.length<=4/);
});
