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

test("homepage podcast section shows only the three newest notes", async () => {
  const elements = await runHomepage();
  const podcasts = elements.get("cg").children;
  assert.equal(podcasts.length, 3);
  assert.match(podcasts[0].innerHTML, /2026-07-19/);
});

test("books expose reading status and tactile page details", async () => {
  const elements = await runHomepage();
  const shelfWrapper = elements.get("shelves").children[0];
  const shelf = shelfWrapper.children[0];
  const books = shelf.children;

  assert.match(books[0].className, /book-status-reading/);
  assert.match(books[0].innerHTML, /book-page-edge/);
  assert.equal(books[0].getAttribute("title"), "Book A by Author A");
  assert.match(books[1].className, /book-status-want/);
});

test("full bookshelf uses the same tactile shelf system", () => {
  const readingHtml = fs.readFileSync(path.join(__dirname, "..", "reading.html"), "utf8");
  assert.match(readingHtml, /\.book::before/);
  assert.match(readingHtml, /\.shelf::before/);
  assert.match(readingHtml, /book-page-edge/);
  assert.match(readingHtml, /book-status-/);
});
