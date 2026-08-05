const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const modulePath = path.join(root, "writing", "writing-gallery.js");

class FakeElement {
  constructor(tagName = "") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.innerHTML = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

const fakeDocument = { createElement: (tagName) => new FakeElement(tagName) };

test("homepage writing selection prioritizes featured posts, then newest, and stops at four", () => {
  assert.ok(fs.existsSync(modulePath), "writing gallery module should exist");
  const gallery = require(modulePath);
  const posts = [
    { slug: "old-featured", date: "2026-07-01", featured: true },
    { slug: "new-regular", date: "2026-08-04", featured: false },
    { slug: "new-featured", date: "2026-08-02", featured: true },
    { slug: "regular-two", date: "2026-08-03", featured: false },
    { slug: "regular-three", date: "2026-08-01", featured: false },
  ];

  assert.deepEqual(
    gallery.selectHomepagePosts(posts, 4).map((post) => post.slug),
    ["new-featured", "old-featured", "new-regular", "regular-two"],
  );
});

test("writing cards expose responsive covers, metadata, and two explicit Xiaohongshu links", () => {
  assert.ok(fs.existsSync(modulePath), "writing gallery module should exist");
  const gallery = require(modulePath);
  const container = new FakeElement("div");
  const post = {
    title: "豆包柳暗花明的机会，在飞书吗？",
    date: "2026-08-02",
    category: "AI Product",
    url: "https://www.xiaohongshu.com/explore/example",
    cover: "assets/writing/doubao-feishu-800.webp",
    cover_srcset: "assets/writing/doubao-feishu-480.webp 480w, assets/writing/doubao-feishu-800.webp 800w",
    cover_width: 1086,
    cover_height: 1448,
    cover_position: "top",
  };

  gallery.renderGallery(fakeDocument, container, [post], {
    sizes: "(max-width: 639px) 100vw, 50vw",
  });

  const card = container.children[0];
  const coverLink = card.children[0];
  const image = coverLink.children[0];
  const meta = card.children[1];
  const titleLink = card.children[2].children[0];

  assert.equal(coverLink.href, post.url);
  assert.equal(coverLink.target, "_blank");
  assert.equal(coverLink.rel, "noopener noreferrer");
  assert.equal(image.src, post.cover);
  assert.equal(image.srcset, post.cover_srcset);
  assert.equal(image.sizes, "(max-width: 639px) 100vw, 50vw");
  assert.equal(image.loading, "lazy");
  assert.equal(image.width, 1086);
  assert.equal(image.height, 1448);
  assert.equal(image.attributes.style, "object-position:top");
  assert.equal(meta.textContent, "AUG 02, 2026 · AI PRODUCT");
  assert.equal(titleLink.href, post.url);
  assert.equal(titleLink.textContent, `${post.title} ↗`);
});

test("writing manifest and archive include the latest LibTV essay as a responsive collection", () => {
  const posts = JSON.parse(fs.readFileSync(path.join(root, "writing", "posts.json"), "utf8"));
  const archivePath = path.join(root, "writing.html");
  assert.equal(posts.length, 3);
  assert.deepEqual(posts.map((post) => post.date), ["2026-08-06", "2026-08-02", "2026-08-01"]);
  assert.deepEqual(
    {
      slug: posts[0].slug,
      title: posts[0].title,
      category: posts[0].category,
      coverPosition: posts[0].cover_position,
    },
    {
      slug: "libtv-model-makers",
      title: "借船出海，能靠岸吗？LibTV × 模型厂的 AI 应用生存博弈",
      category: "AI Product",
      coverPosition: "top",
    },
  );
  posts.forEach((post) => {
    assert.match(post.url, /^https:\/\/www\.xiaohongshu\.com\/explore\//);
    assert.ok(fs.existsSync(path.join(root, post.cover)));
    assert.match(post.cover_srcset, /480w[\s\S]*800w/);
    assert.match(post.cover_srcset, new RegExp(`${post.cover_width}w`));
  });

  assert.ok(fs.existsSync(archivePath), "writing archive should exist");
  const archive = fs.readFileSync(archivePath, "utf8");
  assert.match(archive, /id="writingArchive"/);
  assert.match(archive, /writing\/writing-gallery\.js/);
  assert.match(archive, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(archive, /@media\(max-width:900px\)[\s\S]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(archive, /@media\(max-width:620px\)[\s\S]*grid-template-columns:1fr/);
});

test("homepage presents writing as a three-column editorial gallery", () => {
  const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const writing = homepage.match(/<section class="section writing-section"[\s\S]*?<\/section>/)?.[0] || "";

  assert.match(writing, /Writing &amp; Thoughts/);
  assert.doesNotMatch(writing, /Visual essays on AI, products/);
  assert.match(writing, /Articles open on Xiaohongshu ↗/);
  assert.match(writing, /id="writing-list"/);
  assert.match(writing, /href="writing\.html"[^>]*>View all writing →/);
  assert.match(homepage, /<script src="writing\/writing-gallery\.js"><\/script>/);
  assert.match(homepage, /WritingGallery\.selectHomepagePosts\(posts,4\)/);
  assert.match(homepage, /\.writing-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(homepage, /\.writing-intro\{[^}]*max-width:720px[^}]*margin:0 0 1\.45rem/);
  assert.match(homepage, /\.writing-grid\{[^}]*max-width:none[^}]*margin:0;/);
  assert.match(homepage, /\.writing-actions\{[^}]*max-width:none[^}]*justify-content:flex-start/);
  assert.match(homepage, /\.writing-heading\{[^}]*font-size:clamp\(1\.65rem,2\.5vw,2\.25rem\)/);
  assert.match(homepage, /@media\(max-width:900px\)[\s\S]*?\.writing-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(homepage, /@media\(max-width:639px\)[\s\S]*?\.writing-grid\{grid-template-columns:1fr/);
});

test("writing archive keeps its introduction concise", () => {
  const archive = fs.readFileSync(path.join(root, "writing.html"), "utf8");
  assert.doesNotMatch(archive, /Visual essays on AI, products/);
  assert.match(archive, /Every article opens on Xiaohongshu ↗/);
});
