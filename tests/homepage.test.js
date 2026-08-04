const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const readingModel = require("../reading/reading-manager.js");

class FakeElement {
  constructor(id = "", tagName = "div") {
    this.id = id;
    this.tagName = tagName.toUpperCase();
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
  classList = {
    _owner: null,
    add(name) {
      const el = this._owner;
      const parts = new Set(String(el.className || "").split(/\s+/).filter(Boolean));
      parts.add(name);
      el.className = [...parts].join(" ");
    },
    remove(name) {
      const el = this._owner;
      const parts = new Set(String(el.className || "").split(/\s+/).filter(Boolean));
      parts.delete(name);
      el.className = [...parts].join(" ");
    },
    toggle(name, force) {
      const el = this._owner;
      const parts = new Set(String(el.className || "").split(/\s+/).filter(Boolean));
      const should = force === undefined ? !parts.has(name) : !!force;
      if (should) parts.add(name); else parts.delete(name);
      el.className = [...parts].join(" ");
      return should;
    },
    contains(name) {
      return String(this._owner.className || "").split(/\s+/).includes(name);
    },
  };
}

function bindClassList(el) {
  el.classList._owner = el;
  return el;
}

function homepageScript() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return scripts.at(-1)[1];
}

async function runHomepage(options = {}) {
  const elements = new Map([
    ["cg", bindClassList(new FakeElement("cg"))],
    ["ts", bindClassList(new FakeElement("ts"))],
    ["logo", bindClassList(new FakeElement("logo"))],
    ["greeting", bindClassList(new FakeElement("greeting"))],
    ["clock", bindClassList(new FakeElement("clock"))],
    ["writing-list", bindClassList(new FakeElement("writing-list"))],
    ["shelves", bindClassList(new FakeElement("shelves"))],
    ["readingCard", bindClassList(new FakeElement("readingCard"))],
    ["sideNav", bindClassList(new FakeElement("sideNav"))],
    ["top", bindClassList(new FakeElement("top"))],
  ]);
  elements.get("top").offsetTop = 0;
  elements.get("top").offsetHeight = 700;
  elements.get("top").getBoundingClientRect = () => ({ bottom: 700, top: 0, height: 700 });

  const documentElement = bindClassList(new FakeElement("html"));
  documentElement.setAttribute("data-theme", "warm");
  const sideNav = elements.get("sideNav");
  const hero = elements.get("top");
  const document = {
    documentElement,
    createElement: () => bindClassList(new FakeElement()),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (sel) => {
      if (sel === ".hero") return hero;
      if (sel === ".side-nav") return sideNav;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === ".side-nav a") return [];
      return [];
    },
  };
  const readingPosts = [
    { id: "book-a", title: "Book A", creator: "Author A", added_at: "2026-07-20", updated_at: "2026-07-20", status: "reading", type: "book", topics: ["AI"], url: "https://example.com/a" },
    { id: "book-b", title: "Book B", creator: "Author B", added_at: "2026-07-19", updated_at: "2026-07-19", status: "want", type: "book", topics: ["AI"], url: "https://example.com/b" },
  ];
  const fetch = async (url) => ({
    json: async () => url.includes("reading/") ? readingPosts : [],
  });
  const mediaQuery = { matches: false };
  const context = {
    document,
    fetch,
    localStorage: { getItem: () => null, setItem: () => {} },
    setInterval: () => 0,
    window: {
      addEventListener: () => {},
      scrollY: 0,
      innerHeight: 800,
      matchMedia: () => mediaQuery,
    },
    ReadingManagerModel: readingModel,
  };

  vm.runInNewContext(homepageScript(), context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return { elements, context, mediaQuery };
}

test("currently reading card still renders when optional podcast source list is absent", async () => {
  const { elements } = await runHomepage();
  assert.ok(elements.get("readingCard").children.length > 0);
});

test("hero uses character art plus a currently reading card instead of a duplicate section", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.match(hero, /class="hero-copy"/);
  assert.match(hero, /class="hero-visual"/);
  assert.match(hero, /class="hero-character"/);
  assert.match(hero, /src="assets\/hero-character\.jpg"/);
  assert.match(hero, /class="hero-reading"/);
  assert.match(hero, /Currently reading|id="readingCard"/);
  assert.match(hero, /id="readingCard"/);
  assert.match(html, /href="reading\.html"/);
  assert.doesNotMatch(html, /<section class="section" id="reading"/);
  assert.match(html, /\.wrap\{max-width:1120px/);
  assert.match(html, /\.hero\{[^}]*display:grid/);
  assert.match(html, /selectHomepageEntries\(posts,posts\.length\)/);
  assert.match(html, /@media\(max-width:768px\)[\s\S]*?\.hero\{grid-template-columns:1fr/);
  assert.doesNotMatch(hero, /shelf-row|class="book/);
  assert.doesNotMatch(html, /Page 128|42%|The Pragmatic Programmer/);
});

test("hero presents a poster greeting with Cobb identity and fixed tagline", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || "";
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.match(nav, /id="logo">Cobb<span class="nav-logo-dot">\.<\/span>/);
  assert.doesNotMatch(nav, /Do · Learn · Repeat/);
  assert.doesNotMatch(nav, /About|Experiments|Contact/);
  assert.match(nav, /href="editor\.html"/);
  assert.match(nav, /id="ts"/);
  assert.match(hero, /id="greeting"/);
  assert.match(hero, /I'm <span class="hl">Cobb<\/span>\./);
  assert.doesNotMatch(hero, /Cxn/);
  assert.match(hero, /I build things, write thoughts,/);
  assert.match(hero, /and keep learning\./);
  assert.doesNotMatch(hero, /AI Product Builder/i);
  assert.match(html, /\.hero h1\{[^}]*font-size:clamp\(/);
  assert.match(html, /assets\/hero-character\.jpg/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "hero-character.jpg")));
});

test("hero action buttons use GitHub mark SVG and mailbox emoji", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.match(hero, /href="https:\/\/github\.com\/Cobb04"/);
  assert.match(hero, /target="_blank"/);
  assert.match(hero, /rel="noopener noreferrer"/);
  assert.match(hero, /aria-hidden="true"><svg[\s\S]*?GitHub/);
  assert.doesNotMatch(hero, /🐙/);
  assert.match(hero, /aria-hidden="true">📮<\/span>Email/);
  assert.doesNotMatch(hero, /📧|Email me/);
  assert.match(hero, /mailto:chenxnovo49@gmail\.com/);
  assert.match(html, /\.hero \.socials a\{[^}]*min-height:52px/);
});

test("homepage podcast section shows only the three newest notes", async () => {
  const { elements } = await runHomepage();
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

test("currently reading card exposes real title, creator, type badge, and library link", async () => {
  const { elements } = await runHomepage();
  const card = elements.get("readingCard");
  const title = card.children.find((child) => child.className === "reading-card-title");
  const creator = card.children.find((child) => child.className === "reading-card-creator");
  const head = card.children.find((child) => child.className === "reading-card-head");
  const foot = card.children.find((child) => child.className === "reading-card-foot");
  const badge = head.children.find((child) => child.className === "reading-card-badge");
  const open = foot.children.find((child) => child.className === "reading-card-open");
  const library = foot.children.find((child) => child.className === "reading-card-library");

  assert.equal(title.textContent, "Book A");
  assert.equal(title.href, "https://example.com/a");
  assert.equal(creator.textContent, "Author A");
  assert.equal(badge.textContent, "Book");
  assert.equal(open.href, "https://example.com/a");
  assert.equal(library.href, "reading.html");
  assert.doesNotMatch(card.innerHTML + title.textContent + creator.textContent + badge.textContent, /Page 128|42%/);
});

test("side nav stays hidden while the hero is still in the primary viewport", async () => {
  const { elements } = await runHomepage();
  assert.equal(elements.get("sideNav").classList.contains("is-visible"), false);
  assert.match(
    fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"),
    /\.side-nav\{[^}]*opacity:0/,
  );
  assert.match(
    fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"),
    /prefers-reduced-motion:reduce[\s\S]*?\.side-nav\{transition:none\}/,
  );
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
  assert.match(homepage, /entry\.creator|p\.creator/);
  assert.match(homepage, /entry\.url|p\.url/);
  assert.match(homepage, /title\.textContent=entry\.title|title\.textContent=p\.title/);
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

test("theme toggle and greeting still use dynamic warm/terminal behavior", async () => {
  const { elements } = await runHomepage();
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(elements.get("greeting").textContent, /^(Morning|Afternoon|Evening)!$/);
  assert.match(html, /localStorage\.setItem\("theme"/);
  assert.match(html, /data-theme/);
  assert.match(html, /cobb@web:/);
  assert.match(html, /Cobb<span class="nav-logo-dot">\.<\/span>/);
});
