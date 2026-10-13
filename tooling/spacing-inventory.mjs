import console from 'node:console'
import { createRequire } from 'node:module'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

// Reuse the CSS parser already supplied by the pinned Vite toolchain.
const postcss = createRequire(import.meta.resolve('vite/package.json'))(
  'postcss',
)
const root = fileURLToPath(new URL('../', import.meta.url))
const reference = path.join(root, 'docs/kaili.dev-mocks')
const output = path.join(root, 'docs/product/spacing-inventory.md')
const files = (await readdir(reference, { recursive: true }))
  .filter((name) => /\.(css|html)$/.test(name))
  .sort()
const spacing =
  /^(?:(?:scroll-)?(?:margin|padding)(?:-.+)?|(?:row-|column-)?gap|inset(?:-.+)?|top|right|bottom|left)$/
const typography = /^(?:line-height|letter-spacing|word-spacing)$/
const occurrences = []
const inputs = []

for (const file of files) {
  const source = await readFile(path.join(reference, file), 'utf8')
  const fragments = file.endsWith('.css')
    ? [{ css: source, offset: 0, kind: 'stylesheet' }]
    : [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(
        (match) => ({
          css: match[1],
          offset:
            source.slice(0, match.index + match[0].indexOf('>') + 1).split('\n')
              .length - 1,
          kind: 'style',
        }),
      )
  if (file.endsWith('.html')) {
    // The current references use quoted style attributes; include them if added.
    for (const match of source.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      fragments.push({
        css: `inline { ${match[2]} }`,
        offset: source.slice(0, match.index).split('\n').length - 1,
        kind: 'inline',
      })
    }
  }
  let declarations = 0
  for (const fragment of fragments) {
    const ast = postcss.parse(fragment.css, { from: file })
    ast.walkDecls((decl) => {
      const category = spacing.test(decl.prop)
        ? '布局间距'
        : typography.test(decl.prop)
          ? '排版（单列）'
          : null
      if (!category) return
      declarations++
      const context = []
      for (
        let parent = decl.parent;
        parent && parent.type !== 'root';
        parent = parent.parent
      ) {
        context.unshift(
          parent.type === 'atrule'
            ? `@${parent.name} ${parent.params}`
            : (parent.selector ?? parent.type),
        )
      }
      const values = postcss.list.space(decl.value)
      for (const [index, value] of values.entries()) {
        occurrences.push({
          category,
          value,
          file,
          line: (decl.source?.start?.line ?? 1) + fragment.offset,
          selector: context.join(' → '),
          property: decl.prop,
          declaration: decl.value,
          item: index + 1,
        })
      }
    })
  }
  inputs.push({ file, fragments: fragments.length, declarations })
}

const escape = (value) =>
  String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
let report = '# 参照稿间距清单（T2.4a）\n\n'
report +=
  '由 `node tooling/spacing-inventory.mjs` 生成；`node tooling/spacing-inventory.mjs --check` 重新扫描并核对文件内容。供 T2.4b 提出刻度和映射，本文不选刻度。\n\n'
report +=
  '统计所有本地 CSS 文件及 HTML 的 `<style>` / `style` 属性；共享 CSS 只按源文件计一次，不按引用它的页面重复计数。包括 margin、padding、gap、inset、四方向偏移、对应逻辑属性及 scroll-margin / scroll-padding；line-height、letter-spacing、word-spacing 另列。尺寸、边框、圆角、transform 不作为间距。\n\n'
report +=
  '次数按声明中实际写出的值计：`margin: 0 0 10px` 记两个 `0` 和一个 `10px`，不按浏览器展开为四边；重复选择器只计一条声明。保留原始写法与单位，不把 em、rem 换算成 px；auto 等非数值也列出，函数值作为整体。每条位置包含原文件行号、选择器、声明和值序号，可反查重复计数。\n\n'
report +=
  '## 扫描覆盖\n\n| 文件 | 样式片段 | 间距 / 排版声明数 |\n|---|---:|---:|\n'
for (const input of inputs)
  report += `| ${input.file} | ${input.fragments} | ${input.declarations} |\n`
for (const category of ['布局间距', '排版（单列）']) {
  const groups = new Map()
  for (const occurrence of occurrences.filter(
    (item) => item.category === category,
  )) {
    const group = groups.get(occurrence.value) ?? []
    group.push(occurrence)
    groups.set(occurrence.value, group)
  }
  report += `\n## ${category}\n\n| 值 | 次数 | 出现位置（声明内第 N 个值） |\n|---|---:|---|\n`
  for (const [value, matches] of [...groups].sort(([left], [right]) =>
    left.localeCompare(right, 'en', { numeric: true }),
  )) {
    const locations = matches
      .map(
        (item) =>
          `\`${escape(item.file)}:${item.line}\` ${escape(item.selector)} · \`${escape(item.property)}: ${escape(item.declaration)}\` · 第 ${item.item} 个`,
      )
      .join('<br>')
    report += `| \`${escape(value)}\` | ${matches.length} | ${locations} |\n`
  }
}
const count = inputs.reduce((total, item) => total + item.declarations, 0)
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== report)
    throw new Error(
      'Spacing inventory is stale. Run node tooling/spacing-inventory.mjs',
    )
  console.log(
    `Spacing inventory matches: ${inputs.length} files, ${count} declarations, ${occurrences.length} value occurrences.`,
  )
} else {
  await writeFile(output, report)
  console.log(
    `Wrote docs/product/spacing-inventory.md: ${inputs.length} files, ${count} declarations, ${occurrences.length} value occurrences.`,
  )
}
