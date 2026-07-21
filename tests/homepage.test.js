const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.className = "";
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.attributes = {};
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}
  getAttribute(name) { return this.attributes[name] || ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector(selector) {
    if (selector === ".shelf-row") {
      const row = new FakeElement();
      this.children.push(row);
      return row;
    }
    return null;
  }
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
    ["shelfTooltip", new FakeElement("shelfTooltip")],
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
    { title: "Book A", author: "Author A", date: "2026-07-20", status: "reading", theme: "AI", link: "https://example.com/a" },
    { title: "Book B", author: "Author B", date: "2026-07-19", status: "want", theme: "AI", link: "https://example.com/b" },
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
  };

  vm.runInNewContext(homepageScript(), context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return elements;
}

test("reading shelf still renders when optional podcast source list is absent", async () => {
  const elements = await runHomepage();
  assert.ok(elements.get("shelves").children.length > 0);
});

test("reading shelf occupies the hero visual column instead of a duplicate section", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const hero = html.match(/<header class="hero"[\s\S]*?<\/header>/)?.[0] || "";

  assert.match(hero, /class="hero-copy"/);
  assert.match(hero, /class="hero-reading"/);
  assert.match(hero, />Recent reading</);
  assert.match(hero, /id="shelves"/);
  assert.match(hero, /href="reading\.html"/);
  assert.doesNotMatch(html, /<section class="section" id="reading"/);
  assert.match(html, /\.hero\{display:grid/);
  assert.match(html, /\.slice\(0,4\)/);
  assert.match(html, /@media\(max-width:768px\)[\s\S]*?\.hero\{grid-template-columns:1fr/);
  assert.match(html, /@media\(max-width:639px\)[\s\S]*?\.hero-reading \.shelf-row\{overflow:visible\}/);
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

test("books expose reading status and tactile page details", async () => {
  const elements = await runHomepage();
  const shelfWrapper = elements.get("shelves").children[0];
  const shelf = shelfWrapper.children[0];
  const books = shelf.children;

  assert.match(books[0].className, /book-status-reading/);
  assert.match(books[0].innerHTML, /book-page-edge/);
  assert.equal(books[0].style.height, "108px");
  assert.equal(books[0].getAttribute("title"), "");
  assert.doesNotMatch(books[0].innerHTML, /book-tooltip/);
  assert.match(books[1].className, /book-status-want/);
});

test("books use one viewport-level tooltip without native tooltip duplication", () => {
  ["index.html", "reading.html"].forEach((filename) => {
    const html = fs.readFileSync(path.join(__dirname, "..", filename), "utf8");
    assert.match(html, /class="shelf-tooltip" id="shelfTooltip"/);
    assert.match(html, /\.shelf-tooltip\{position:fixed/);
    assert.match(html, /function positionBookTooltip/);
    assert.doesNotMatch(html, /setAttribute\("title"/);
    assert.doesNotMatch(html, /class="book-tooltip"/);
  });
});

test("full bookshelf uses the same tactile shelf system", () => {
  const readingHtml = fs.readFileSync(path.join(__dirname, "..", "reading.html"), "utf8");
  assert.match(readingHtml, /\.book::before/);
  assert.match(readingHtml, /\.shelf::before/);
  assert.match(readingHtml, /book-page-edge/);
  assert.match(readingHtml, /book-status-/);
});
