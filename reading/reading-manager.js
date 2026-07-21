(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ReadingManagerModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STATUSES = ["want", "reading", "read", "stopped"];
  var TYPES = ["article", "book", "paper", "podcast", "video"];

  function today(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    var date = value instanceof Date ? value : new Date(value || Date.now());
    return date.toISOString().slice(0, 10);
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "reading-item";
  }

  function cleanTopics(entry) {
    var source = Array.isArray(entry.topics) ? entry.topics : (entry.theme ? [entry.theme] : []);
    return source
      .map(function (topic) { return String(topic).trim(); })
      .filter(function (topic, index, topics) { return topic && topics.indexOf(topic) === index; });
  }

  function normalizeEntry(entry, now) {
    entry = entry || {};
    var currentDate = today(now);
    var addedAt = entry.added_at || entry.date || currentDate;
    var status = STATUSES.indexOf(entry.status) >= 0 ? entry.status : "want";
    var startedAt = entry.started_at || (status === "reading" || status === "read" ? addedAt : null);
    var finishedAt = entry.finished_at || (status === "read" ? entry.updated_at || addedAt : null);

    return {
      id: String(entry.id || slugify(entry.title)).trim(),
      title: String(entry.title || "").trim(),
      creator: String(entry.creator || entry.author || "").trim(),
      url: String(entry.url || entry.link || "").trim(),
      type: TYPES.indexOf(entry.type) >= 0 ? entry.type : "article",
      status: status,
      topics: cleanTopics(entry),
      added_at: today(addedAt),
      started_at: startedAt ? today(startedAt) : null,
      finished_at: finishedAt ? today(finishedAt) : null,
      updated_at: today(entry.updated_at || addedAt),
    };
  }

  function validateEntry(entry) {
    var errors = [];
    if (!entry || !String(entry.title || "").trim()) errors.push({ field: "title", message: "Title is required." });
    if (!entry || !String(entry.creator || "").trim()) errors.push({ field: "creator", message: "Creator is required." });
    try {
      var url = new URL(entry && entry.url ? entry.url : "");
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
    } catch (error) {
      errors.push({ field: "url", message: "Use a complete http or https URL." });
    }
    if (!entry || TYPES.indexOf(entry.type) < 0) errors.push({ field: "type", message: "Choose a supported type." });
    if (!entry || STATUSES.indexOf(entry.status) < 0) errors.push({ field: "status", message: "Choose a supported status." });
    return errors;
  }

  function transitionEntry(entry, nextStatus, now) {
    if (STATUSES.indexOf(nextStatus) < 0) throw new Error("Unsupported status: " + nextStatus);
    var next = normalizeEntry(entry, now);
    var changedAt = today(now);
    next.status = nextStatus;
    next.updated_at = changedAt;

    if (nextStatus === "want") {
      next.started_at = null;
      next.finished_at = null;
    } else if (nextStatus === "reading") {
      if (entry.status !== "reading") next.started_at = changedAt;
      next.finished_at = null;
    } else if (nextStatus === "read") {
      next.started_at = next.started_at || changedAt;
      if (entry.status !== "read") next.finished_at = changedAt;
    } else if (nextStatus === "stopped") {
      next.finished_at = null;
    }
    return next;
  }

  function compareUpdated(a, b) {
    var dateOrder = String(b.updated_at || b.added_at || "").localeCompare(String(a.updated_at || a.added_at || ""));
    return dateOrder || String(a.id || a.title || "").localeCompare(String(b.id || b.title || ""));
  }

  function selectHomepageEntries(entries, limit) {
    var normalized = (entries || [])
      .map(function (entry) { return normalizeEntry(entry); })
      .filter(function (entry) { return validateEntry(entry).length === 0; });
    var reading = normalized.filter(function (entry) { return entry.status === "reading"; }).sort(compareUpdated);
    var want = normalized.filter(function (entry) { return entry.status === "want"; }).sort(compareUpdated);
    return reading.concat(want).slice(0, typeof limit === "number" ? limit : 4);
  }

  function serializeEntries(entries) {
    var normalized = (entries || []).map(function (entry) { return normalizeEntry(entry); }).sort(compareUpdated);
    var seen = {};
    normalized.forEach(function (entry) {
      if (validateEntry(entry).length) throw new Error("Invalid reading entry: " + (entry.title || entry.id));
      if (seen[entry.id]) throw new Error("Duplicate reading id: " + entry.id);
      seen[entry.id] = true;
    });
    return JSON.stringify(normalized, null, 2) + "\n";
  }

  return {
    STATUSES: STATUSES.slice(),
    TYPES: TYPES.slice(),
    normalizeEntry: normalizeEntry,
    validateEntry: validateEntry,
    transitionEntry: transitionEntry,
    selectHomepageEntries: selectHomepageEntries,
    serializeEntries: serializeEntries,
    slugify: slugify,
  };
});
