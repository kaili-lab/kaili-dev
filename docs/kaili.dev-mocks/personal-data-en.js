// Placeholder content for the English mocks (English pages only list English published posts, D-026).
// All placeholder; Kai Li will replace it.

const nowUpdated = "2026-10-09";

// [date, title, summary, category, minutes]
const posts = [
  ["2026-09-02", "What six years of Java taught me about writing TypeScript services", "Types are not the hard part. Ownership, boundaries and where the transaction ends are.", "Engineering", 9],
  ["2026-08-18", "Moving Say Right from Next.js to Cloudflare Workers", "Cold starts, KV consistency, the Durable Object bill, and the $19 a month it saved.", "Engineering", 12],
  ["2026-07-30", "An AI-assisted workflow that doesn't rot the codebase", "Plan first, small diffs, tests as the contract. A year of Claude Code on real projects.", "AI", 15],
  ["2026-07-11", "Parsing plain-language tasks in Home Task", "Turning “send the quote tomorrow afternoon” into a due date, a time slot and a priority. Rules first, the model as a fallback.", "Projects", 8],
  ["2026-06-20", "Spaced repetition is a scheduling problem", "One SM-2 core behind Vocab Master and Say Right, and why I stopped there.", "Projects", 6],
];

const made = [
  { name: "Say Right", img: "say-right", status: "Maintained", url: "say-right.kaili.dev", repo: "github.com/kaili-lab/say-right",
    why: "I needed to practise English: start from a thought in Chinese, end up with natural English.",
    intro: "Write what you want to say in Chinese, try saying it in English yourself, then compare with a more natural version. The phrases you missed come back on a spaced-repetition schedule, so you practise sentences you actually want to say, not textbook ones." },
  { name: "Home Task", img: "home-task", status: "Maintained", url: "task.kaili.dev", repo: "github.com/kaili-lab/home-task",
    why: "My family kept forgetting things. Say one sentence, get a task with a time attached.",
    intro: "My family won't fill in forms, so there is only one input box. “Take the cat for her jab on Saturday morning” becomes a date, a time slot and a reminder; whatever the rules can't parse goes to a model, and a person confirms it once." },
  { name: "Vocab Master", img: "vocab-master", status: "Archived", url: "vocab.kaili.dev", repo: "github.com/kaili-lab/vocab-master",
    why: "Read in English and learn only the words you don't know yet.",
    intro: "Paste in some English, mark the words you don't know, and only those go into review. The scheduling core later moved into Say Right, so this one stops here." },
];

const books = [
  { title: "A Philosophy of Software Design", author: "John Ousterhout", status: "Reading", note: "Second time through. This time I'm watching how “deep modules” show up in my own code." },
  { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", status: "Finished", finished: "2026-08", note: "Chapters 5 and 7 are worth rereading every year.", post: "Moving Say Right from Next.js to Cloudflare Workers" },
  { title: "置身事内", author: "Lan Xiaohuan", status: "Finished", finished: "2026-05", note: "The first book that made local-government spending in China make sense to me." },
  { title: "The Pragmatic Programmer", author: "David Thomas, Andrew Hunt", status: "Finished", finished: "2026-02" },
  { title: "Thinking in Systems", author: "Donella H. Meadows", status: "Finished", finished: "2025-11", note: "Stocks and flows. I've used the lens everywhere since." },
  { title: "Principles", author: "Ray Dalio", status: "Finished", finished: "2025-07" },
  { title: "Refactoring", author: "Martin Fowler", status: "Finished", finished: "2025-03", note: "Small steps, each one runnable. It became the basis of my AI workflow.", post: "An AI-assisted workflow that doesn't rot the codebase" },
];

const quote = ["Programs must be written for people to read, and only incidentally for machines to execute.", "Abelson & Sussman, Structure and Interpretation of Computer Programs, preface"];
