// 文章页目录：桌面端始终展开，≤960px 默认折叠；滚动时高亮当前小节（只变色）。
(() => {
  const toc = document.getElementById("toc");
  const wide = matchMedia("(min-width: 961px)");
  const sync = () => { toc.open = wide.matches; };
  sync();
  wide.addEventListener("change", sync);

  const links = new Map([...toc.querySelectorAll("a")].map(a => [a.getAttribute("href").slice(1), a]));
  const heads = [...document.querySelectorAll(".prose h2[id], .prose h3[id]")];
  const mark = () => {
    let current = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top < 120) current = h;
    links.forEach(a => a.classList.remove("active"));
    links.get(current.id)?.classList.add("active");
  };
  addEventListener("scroll", mark, { passive: true });
  mark();
})();
