(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WritingGallery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function byNewest(a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  }

  function selectHomepagePosts(posts, limit) {
    var maxItems = typeof limit === "number" ? limit : 4;
    var featured = posts.filter(function (post) { return post.featured; }).sort(byNewest);
    var regular = posts.filter(function (post) { return !post.featured; }).sort(byNewest);
    return featured.concat(regular).slice(0, maxItems);
  }

  function formatDate(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) return String(value || "").toUpperCase();
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var month = months[Number(parts[1]) - 1] || parts[1];
    return month + " " + parts[2] + ", " + parts[0];
  }

  function externalLink(document, className, url) {
    var link = document.createElement("a");
    link.className = className;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function createCard(document, post, options, index) {
    options = options || {};
    index = typeof index === "number" ? index : 0;
    var card = document.createElement("article");
    card.className = "writing-card";

    var coverLink = externalLink(document, "writing-cover-link", post.url);
    coverLink.setAttribute("aria-label", post.title + "（在小红书打开）");
    var image = document.createElement("img");
    image.className = "writing-cover";
    image.src = post.cover;
    image.srcset = post.cover_srcset;
    image.sizes = options.sizes || "(max-width: 639px) 100vw, 50vw";
    image.width = post.cover_width;
    image.height = post.cover_height;
    image.loading = index < (options.eagerCount || 0) ? "eager" : "lazy";
    image.decoding = "async";
    image.alt = "文章封面：" + post.title;
    if (post.cover_position) image.setAttribute("style", "object-position:" + post.cover_position);
    coverLink.appendChild(image);

    var meta = document.createElement("p");
    meta.className = "writing-meta";
    meta.textContent = formatDate(post.date) + " · " + String(post.category || "Essay").toUpperCase();

    var heading = document.createElement("h3");
    heading.className = "writing-card-title";
    var titleLink = externalLink(document, "writing-title-link", post.url);
    titleLink.textContent = post.title + " ↗";
    heading.appendChild(titleLink);

    card.appendChild(coverLink);
    card.appendChild(meta);
    card.appendChild(heading);
    return card;
  }

  function renderGallery(document, container, posts, options) {
    var settings = options || {};
    settings.sizes = settings.sizes || "(max-width: 639px) 100vw, 50vw";
    container.innerHTML = "";
    posts.forEach(function (post, index) {
      container.appendChild(createCard(document, post, settings, index));
    });
  }

  return {
    createCard: createCard,
    formatDate: formatDate,
    renderGallery: renderGallery,
    selectHomepagePosts: selectHomepagePosts,
  };
});
