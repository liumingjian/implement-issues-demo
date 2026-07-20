export const PAGE_SIZE = 20;

export function parseTimelineState(url) {
  const requested = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  return { page: Number.isInteger(requested) && requested > 0 ? requested : 1 };
}

export function pageHref(page) {
  return page > 1 ? `/?page=${page}` : "/";
}

export function practiceSlug(id) {
  return id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

export function orderPractices(records) {
  return [...records].sort((a, b) => {
    const dateDifference = b.data.date.valueOf() - a.data.date.valueOf();
    return dateDifference || b.id.localeCompare(a.id, "en");
  });
}

export function groupPractices(items) {
  const groups = [];
  for (const item of items) {
    const key = item.data.date.toISOString().slice(0, 7);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function buildTimeline(records, { showDrafts, page }) {
  const sorted = orderPractices(records);
  const visible = showDrafts ? sorted : sorted.filter(({ data }) => !data.draft);
  const totalPages = Math.ceil(visible.length / PAGE_SIZE);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages);
  const items = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return {
    items,
    groups: groupPractices(items),
    page: safePage,
    totalPages,
    emptyReason: sorted.length === 0 ? "none" : visible.length === 0 ? "drafts-hidden" : null,
  };
}
