const input = document.querySelector("[data-search-input]");
const toggle = document.querySelector("[data-search-drafts]");
const resultsNode = document.querySelector("[data-search-results]");
const statusNode = document.querySelector("[data-search-status]");
const progressNode = document.querySelector("[data-search-progress]");
const moreButton = document.querySelector("[data-search-more]");
const template = document.querySelector("[data-search-result-template]");

if (input && toggle && resultsNode && statusNode && progressNode && moreButton && template) {
  const preferenceKey = "a-workbench-show-drafts";
  const stateKey = "a-search-navigation-state";
  const pageSize = 20;
  let requestId = 0;
  let timer;
  let matches = [];
  let visibleCount = pageSize;
  let restoredScroll = null;
  const indexes = new Map();

  async function loadIndex(path) {
    if (!indexes.has(path)) indexes.set(path, import(/* @vite-ignore */ path));
    return indexes.get(path);
  }

  function setUrl(query) {
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function saveState() {
    sessionStorage.setItem(stateKey, JSON.stringify({ query: input.value, visibleCount, scrollY: window.scrollY }));
  }

  function evidence(data) {
    const excerpt = data.excerpt?.trim();
    if (excerpt) return excerpt;
    return data.meta?.summary || "暂无摘要";
  }

  function render() {
    resultsNode.replaceChildren();
    for (const match of matches.slice(0, visibleCount)) {
      const fragment = template.content.cloneNode(true);
      const link = fragment.querySelector("[data-result-link]");
      link.href = match.data.url;
      link.textContent = match.data.meta?.title || match.data.url;
      link.addEventListener("click", saveState);
    fragment.querySelector("[data-result-evidence]").textContent = evidence(match.data);
      const tags = fragment.querySelector("[data-result-tags]");
      for (const tag of [].concat(match.data.meta?.tag || [])) {
        const item = document.createElement("li");
        item.textContent = tag;
        tags.append(item);
      }
      resultsNode.append(fragment);
    }
    const shown = Math.min(visibleCount, matches.length);
    progressNode.hidden = matches.length === 0;
    progressNode.textContent = `已显示 ${shown} / ${matches.length} 项`;
    moreButton.hidden = shown >= matches.length;
    if (restoredScroll !== null) {
      requestAnimationFrame(() => scrollTo(0, restoredScroll));
      restoredScroll = null;
    }
  }

  async function searchIndex(path, query) {
    const index = await loadIndex(path);
    await index.init();
    const response = await index.search(query);
    return Promise.all(response.results.map(async (result) => ({ score: result.score, data: await result.data() })));
  }

  async function runSearch(query) {
    const currentRequest = ++requestId;
    if (!query) {
      statusNode.textContent = "输入查询开始搜索。";
      matches = [];
      render();
      return;
    }
    if ([...query].length < 2) {
      statusNode.textContent = "输入至少两个字符后开始搜索。";
      matches = [];
      render();
      return;
    }

    statusNode.textContent = "正在搜索…";
    try {
      const searches = [searchIndex("/pagefind-public/pagefind.js", query)];
      if (toggle.checked) searches.push(searchIndex("/pagefind-drafts/pagefind.js", query));
      const groups = await Promise.all(searches);
      if (currentRequest !== requestId) return;
      const unique = new Map();
      for (const match of groups.flat()) {
        const previous = unique.get(match.data.url);
        if (!previous || match.score > previous.score) unique.set(match.data.url, match);
      }
      matches = [...unique.values()].sort((left, right) =>
        right.score - left.score || String(right.data.meta?.date || "").localeCompare(String(left.data.meta?.date || "")) || left.data.url.localeCompare(right.data.url));
      statusNode.textContent = matches.length ? `找到 ${matches.length} 项匹配实践。` : "没有找到匹配的实践。";
      render();
    } catch {
      if (currentRequest !== requestId) return;
      matches = [];
      statusNode.textContent = "搜索服务暂时不可用，请稍后重试。";
      render();
    }
  }

  function schedule() {
    clearTimeout(timer);
    requestId += 1;
    const query = input.value.trim();
    setUrl(query);
    timer = setTimeout(() => runSearch(query), 200);
  }

  moreButton.addEventListener("click", () => {
    visibleCount += pageSize;
    render();
  });
  input.addEventListener("input", () => {
    visibleCount = pageSize;
    schedule();
  });
  toggle.addEventListener("change", () => {
    localStorage.setItem(preferenceKey, String(toggle.checked));
    visibleCount = pageSize;
    schedule();
  });
  addEventListener("pagehide", saveState);

  const params = new URLSearchParams(location.search);
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(stateKey) || "null");
  } catch {
    sessionStorage.removeItem(stateKey);
  }
  input.value = params.get("q") || "";
  toggle.checked = localStorage.getItem(preferenceKey) === "true";
  if (saved?.query === input.value) {
    visibleCount = saved.visibleCount || pageSize;
    restoredScroll = saved.scrollY || 0;
  }
  runSearch(input.value.trim());
}
