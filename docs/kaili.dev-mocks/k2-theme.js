// 主题切换（D-116）：浅色 / 深色 / 跟随系统，默认跟随系统，手动选择记在 localStorage。
// 放在 <head> 里同步执行，先于页面绘制设置 data-theme，避免先闪一下浅色。
(() => {
  const KEY = "theme";
  const media = matchMedia("(prefers-color-scheme: dark)");
  const pref = () => localStorage.getItem(KEY) || "system";
  const apply = () => {
    const p = pref();
    document.documentElement.dataset.theme = p === "system" ? (media.matches ? "dark" : "light") : p;
    document.querySelectorAll(".theme button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === p)));
  };
  apply();
  media.addEventListener("change", apply);
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".theme button").forEach(b => b.addEventListener("click", () => {
      b.dataset.mode === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, b.dataset.mode);
      apply();
    }));
    apply();
  });
})();
