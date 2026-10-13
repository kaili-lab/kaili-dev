import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
async function rules(code, filePath = 'src/routes/guardrail-example.tsx') {
  const results = await eslint.lintText(code, { filePath })
  return results.flatMap((result) =>
    result.messages.map((message) => message.ruleId),
  )
}

describe('D-127: UI cannot import the data layer', () => {
  it.each([
    ["import '@/server/data/posts'", 'src/routes/guardrail-example.tsx'],
    ["import '#/server/data/posts'", 'src/components/guardrail-example.tsx'],
    ["import '../server/data/posts'", 'src/routes/guardrail-example.tsx'],
    [
      "import '../../server/data/posts'",
      'src/routes/nested/guardrail-example.tsx',
    ],
    ["export * from '@/server/data/posts'", 'src/lib/guardrail-example.ts'],
    ["void import('@/server/data/posts')", 'src/routes/guardrail-example.tsx'],
  ])('rejects %s from %s', async (code, filePath) => {
    expect(await rules(code, filePath)).toContain(
      'architecture/no-ui-data-import',
    )
  })
  it.each([
    ["import '@/features/posts'", 'src/routes/guardrail-example.tsx'],
    ["import '@/server/data/posts'", 'src/features/guardrail-example.ts'],
  ])('allows %s from %s', async (code, filePath) => {
    expect(await rules(code, filePath)).toEqual([])
  })
})
describe('React effects cannot set state synchronously', () => {
  it('rejects setState directly inside an effect', async () => {
    expect(
      await rules(`
        import { useEffect, useState } from 'react'
        export function Example() {
          const [value, setValue] = useState(false)
          useEffect(() => { setValue(true) }, [])
          return value
        }
      `),
    ).toContain('react-hooks/set-state-in-effect')
  })

  it('allows setState in an external callback scheduled by an effect', async () => {
    expect(
      await rules(`
        import { useEffect, useState } from 'react'
        export function Example() {
          const [value, setValue] = useState(false)
          useEffect(() => {
            const timer = setTimeout(() => setValue(true), 0)
            return () => clearTimeout(timer)
          }, [])
          return value
        }
      `),
    ).not.toContain('react-hooks/set-state-in-effect')
  })
})

describe('D-128 / D-129: Tailwind restrictions', () => {
  it.each([
    ['bg-[#fff]', 'better-tailwindcss/no-restricted-classes'],
    ['hover:bg-[#fff]', 'better-tailwindcss/no-restricted-classes'],
    ['bg-blue-500', 'better-tailwindcss/no-unknown-classes'],
    ['dark:text-red-500', 'better-tailwindcss/no-unknown-classes'],
    ['design-not-registered', 'better-tailwindcss/no-unknown-classes'],
    ['k2-not-registered', 'better-tailwindcss/no-unknown-classes'],
    ['catalogue-not-registered', 'better-tailwindcss/no-unknown-classes'],
    ['animate-spin', 'better-tailwindcss/no-restricted-classes'],
    ['motion-safe:animate-spin', 'better-tailwindcss/no-restricted-classes'],
  ])('rejects %s', async (className, rule) => {
    expect(
      await rules(
        `export const Example = () => <div className="${className}" />`,
      ),
    ).toContain(rule)
  })
  it('allows registered layout utilities', async () => {
    expect(
      await rules('export const Example = () => <div className="flex p-4" />'),
    ).toEqual([])
  })
  it.each([
    ['k2-wrap', 'src/routes/guardrail-example.tsx'],
    ['catalogue-label', 'src/components/design-catalogue.tsx'],
    ['entry-page', 'src/routes/guardrail-example.tsx'],
  ])(
    'allows defined component class %s from %s',
    async (className, filePath) => {
      expect(
        await rules(
          `export const Example = () => <div className="${className}" />`,
          filePath,
        ),
      ).toEqual([])
    },
  )
  it('rejects design-only classes from public routes', async () => {
    expect(
      await rules(
        'export const Example = () => <div className="catalogue-label" />',
      ),
    ).toContain('better-tailwindcss/no-unknown-classes')
  })
  it.each([
    ['catalogue-not-registered', 'better-tailwindcss/no-unknown-classes'],
    ['bg-blue-500', 'better-tailwindcss/no-unknown-classes'],
    ['animate-spin', 'better-tailwindcss/no-restricted-classes'],
  ])('keeps design catalogue restrictions for %s', async (className, rule) => {
    expect(
      await rules(
        `export const Example = () => <div className="${className}" />`,
        'src/components/design-catalogue.tsx',
      ),
    ).toContain(rule)
  })
})
