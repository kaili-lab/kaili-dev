const posts = [
  ["2026-09-02", "EN", "What six years of Java taught me about writing TypeScript services", "Types are not the hard part. Ownership, boundaries and where the transaction ends are."],
  ["2026-08-18", "中", "把 Say Right 从 Next.js 搬到 Cloudflare Workers：踩的坑和省的钱", "冷启动、KV 一致性、Durable Object 的账单模型，以及最后每月省下的 19 美元。"],
  ["2026-07-30", "EN", "A working setup for AI-assisted development that doesn't rot the codebase", "Plan first, small diffs, tests as the contract. Notes from a year of using Claude Code on real projects."],
  ["2026-07-11", "中", "自然语言建任务：Home Task 的解析层是怎么设计的", "一句「明天下午给客户发报价单」要变成截止时间、时段、优先级。规则先行，模型兜底。"],
  ["2026-06-20", "EN", "Spaced repetition is a scheduling problem", "Building the review queue for Vocab Master and Say Right on the same SM-2 core, and why I stopped there."],
  ["2026-05-28", "中", "六年后端转全栈，我最不适应的三件事", "状态在哪、错误给谁看、以及为什么前端的「完成」比后端晚很多。"],
  ["2026-05-06", "EN", "Reading code with an LLM: what to ask, what not to trust", "It is very good at telling you where to look and fairly bad at telling you what is true."],
  ["2026-04-14", "中", "为什么我给每个 side project 都写一份 CLAUDE.md", "不是为了 AI，是为了三个月后的自己。"],
];

const projects = [
  ["home-task", "Home Task", "Describe a task in plain language or voice; the app files it with due date, slot and priority. Personal and group lists in one view.", "React · Hono · PostgreSQL · LangChain", "task.kaili.dev", "kaili-lab/home-task"],
  ["say-right", "Say Right", "Start from an idea in Chinese, get natural English, keep it as a card and drill it with spaced repetition.", "React · Hono · Cloudflare Workers · OpenAI", "say-right.kaili.dev", "kaili-lab/say-right"],
  ["vocab-master", "Vocab Master", "Paste English text, see unfamiliar words explained in context, collect them, review on a schedule.", "React · Hono · PostgreSQL · Cloudflare Workers", "vocab.kaili.dev", "kaili-lab/vocab-master-v1"],
];

const repos = [
  ["kaili-lab/home-task", "TypeScript", "Natural-language task manager for small groups", "12"],
  ["kaili-lab/say-right", "TypeScript", "Chinese idea → natural English, with spaced repetition", "8"],
  ["kaili-lab/vocab-master-v1", "TypeScript", "Read English, learn only the words you need", "5"],
  ["kaili-lab/kaili.dev", "TypeScript", "This site. TanStack Start on Cloudflare", "2"],
];

const commits = [
  ["2h ago", "say-right", "fix: dedupe review queue when card edited during session"],
  ["yesterday", "home-task", "feat: parse relative dates in Chinese (下周三, 月底)"],
  ["3 days ago", "kaili.dev", "chore: move post index to build-time MDX"],
  ["5 days ago", "vocab-master-v1", "perf: cache word explanations per level in KV"],
];

function render() {
  const limit = Number(document.body.dataset.posts || posts.length);
  document.getElementById("posts").innerHTML = posts.slice(0, limit).map(([d, l, t, s]) => `
    <li class="post">
      <a href="#"><span class="date">${d}</span><span class="lang ${l === "EN" ? "en" : "zh"}">${l}</span>
      <span class="title">${t}</span><span class="summary">${s}</span></a>
    </li>`).join("");

  document.getElementById("projects").innerHTML = projects.map(([img, n, s, tech, live, gh]) => `
    <li class="card">
      <a href="#" class="shot"><img src="img/${img}.png" alt=""></a>
      <div class="meta">
        <h3>${n}</h3>
        <p>${s}</p>
        <p class="tech">${tech}</p>
        <p class="links"><a href="#">${live}</a><a href="#">${gh}</a></p>
      </div>
    </li>`).join("");

  document.getElementById("repos").innerHTML = repos.map(([n, lang, d, st]) => `
    <li class="repo"><a href="#"><span class="name">${n}</span><span class="desc">${d}</span><span class="stat">${lang} · ★ ${st}</span></a></li>`).join("");

  document.getElementById("commits").innerHTML = commits.map(([w, r, m]) => `
    <li class="commit"><span class="when">${w}</span><span class="repo-name">${r}</span><span class="msg">${m}</span></li>`).join("");

  const fontSel = document.getElementById("font-select");
  if (fontSel) {
    if (document.body.dataset.font) fontSel.value = document.body.dataset.font;
    const apply = () => { document.body.dataset.font = fontSel.value; };
    fontSel.addEventListener("change", apply);
    apply();
  }

  const toggle = document.getElementById("motto-toggle");
  toggle.addEventListener("change", () => document.body.classList.toggle("has-motto", toggle.checked));
  document.body.classList.toggle("has-motto", toggle.checked);
}
document.addEventListener("DOMContentLoaded", render);
