import { orderPractices } from "./timeline.mjs";

export function practiceNeighbors(records, currentId, showDrafts) {
  const current = records.find(({ id }) => id === currentId);
  const visible = orderPractices(records.filter(({ data }) => showDrafts || !data.draft || data === current?.data));
  const index = visible.findIndex(({ id }) => id === currentId);
  return {
    newer: index > 0 ? visible[index - 1] : null,
    older: index >= 0 ? visible[index + 1] ?? null : null,
  };
}
