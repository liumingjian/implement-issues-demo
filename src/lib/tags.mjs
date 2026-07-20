import { buildTimeline } from "./timeline.mjs";

function compareTags(a, b) {
  return a.localeCompare(b, "en", { sensitivity: "base" }) || a.localeCompare(b, "en");
}

export function buildTagIndex(records, { showDrafts }) {
  const counts = new Map();
  const visible = showDrafts ? records : records.filter(({ data }) => !data.draft);
  for (const { data } of visible) {
    for (const tag of new Set(data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => compareTags(a, b)).map(([name, count]) => ({ name, count }));
}

export function buildTagTimeline(records, tag, options) {
  const tagged = records.filter(({ data }) => data.tags.includes(tag));
  return { known: tagged.length > 0, ...buildTimeline(tagged, options) };
}

export function tagHref(tag, page = 1) {
  const base = `/tags/${encodeURIComponent(tag)}/`;
  return page > 1 ? `${base}?page=${page}` : base;
}
