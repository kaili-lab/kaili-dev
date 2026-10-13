// 中文参照稿的占位内容。全部是占位，Kai Li 想好后替换。
// 中文界面只显示中文已发布文章（D-026），所以这里全部用中文标题。

const nowUpdated = "2026-10-09";

// [日期, 标题, 摘要, 分类, 阅读分钟数]
const posts = [
  ["2026-09-02", "写了六年 Java 之后，我怎么写 TypeScript 服务", "类型不是难点。所有权、边界、事务在哪里结束才是。", "工程", 9],
  ["2026-08-18", "把 Say Right 从 Next.js 搬到 Cloudflare Workers：踩的坑和省的钱", "冷启动、KV 一致性、Durable Object 的账单模型，以及最后每月省下的 19 美元。", "工程", 12],
  ["2026-07-30", "一套不会把代码库写烂的 AI 辅助开发流程", "先计划、小步提交、测试即契约。一年里在真实项目上用 Claude Code 的记录。", "AI", 15],
  ["2026-07-11", "自然语言建任务：Home Task 的解析层是怎么设计的", "一句「明天下午给客户发报价单」要变成截止时间、时段、优先级。规则先行，模型兜底。", "项目", 8],
  ["2026-06-20", "间隔重复其实是一个排程问题", "Vocab Master 和 Say Right 共用同一个 SM-2 核心，以及我为什么停在那里。", "项目", 6],
];

// 项目（D-115）。首页只用 name / why / url；多于 3 个时首页显示「全部 →」（D-113）
const made = [
  { name: "Say Right", img: "say-right", status: "在维护", url: "say-right.kaili.dev", repo: "github.com/kaili-lab/say-right",
    why: "我自己要练英语：从一句中文想法出发，练出地道的英文表达。",
    intro: "先用中文写下想说的话，再自己试着用英文说，最后对照更自然的说法。错过的表达会按间隔重复排进复习，练的是自己真正想说的句子，而不是课本上的。" },
  { name: "Home Task", img: "home-task", status: "在维护", url: "task.kaili.dev", repo: "github.com/kaili-lab/home-task",
    why: "家里人总忘事，说一句话就能建好带时间的任务。",
    intro: "家里人不愿意填表单，所以入口只有一个输入框。一句「周六上午带猫打疫苗」会被拆成日期、时段和提醒；拆不准的交给模型，再让人确认一次。" },
  { name: "Vocab Master", img: "vocab-master", status: "已停更", url: "vocab.kaili.dev", repo: "github.com/kaili-lab/vocab-master",
    why: "读英文时只学自己不认识的那几个词。",
    intro: "贴进一段英文，标出自己不认识的词，只把这些词放进复习。核心的排程后来并进了 Say Right，这个项目就停在这里了。" },
];

// 书架（D-114）。status: 在读 / 读完；finished: 读完年月；note: 我的一句话（可空）；post: 写过的文章标题（可空）
// 首页最多显示 3 本（在读优先，其次最近读完）；多于 3 本时显示「全部 →」
const books = [
  { title: "A Philosophy of Software Design", author: "John Ousterhout", status: "在读", note: "第二遍。这次在看「深模块」那几章怎么落到自己的代码里。" },
  { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", status: "读完", finished: "2026-08", note: "第五章和第七章值得每年重读一次。", post: "把 Say Right 从 Next.js 搬到 Cloudflare Workers：踩的坑和省的钱" },
  { title: "置身事内", author: "兰小欢", status: "读完", finished: "2026-05", note: "第一次看懂地方政府为什么那样花钱。" },
  { title: "The Pragmatic Programmer", author: "David Thomas, Andrew Hunt", status: "读完", finished: "2026-02" },
  { title: "Thinking in Systems", author: "Donella H. Meadows", status: "读完", finished: "2025-11", note: "存量和流量，这个视角后来到处都用得上。" },
  { title: "原则", author: "瑞·达利欧", status: "读完", finished: "2025-07" },
  { title: "Refactoring", author: "Martin Fowler", status: "读完", finished: "2025-03", note: "小步、每一步都能跑，这是后来写 AI 开发流程的底子。", post: "一套不会把代码库写烂的 AI 辅助开发流程" },
];

// 摘抄：[内容, 出处]
const quote = ["程序首先是写给人读的，只是顺便能让机器执行。", "Harold Abelson，《计算机程序的构造和解释》序言（意译）"];
