# Interactive Chapter Generation Guidelines

These rules are mandatory. Generate a clean, professional JSX chapter that uses the predefined chapter components supplied by Learn Forge. Do not invent a separate design system.

## 1. Component Contract

Generate exactly one default-exported React component:

```tsx
export default function Chapter({ theme = chapterTheme }) {
  return (
    <main className={cn("min-h-screen py-10", theme.page)}>
      <div className="mx-auto max-w-5xl space-y-12 px-4 sm:px-6 lg:px-8">
        <ChapterHero
          theme={theme}
          label="Chapter 01"
          title="Chapter title"
          promise="One sentence that tells the learner what they will understand by the end."
          goals={[
            "First learning goal.",
            "Second learning goal.",
            "Third learning goal."
          ]}
        />
        {/* numbered sections */}
      </div>
    </main>
  );
}
```

Rules:

- The generated component must accept `{ theme = chapterTheme }`.
- `chapterTheme` is available globally in the runtime.
- Pass `theme={theme}` to every predefined chapter component.
- Do not define color palettes inside the chapter.
- Do not choose accent colors directly in the generated code.
- Do not use Tailwind color classes like `text-indigo-700`, `bg-emerald-50`, `border-rose-200`, or arbitrary color values in generated JSX.
- Neutral layout classes are allowed: spacing, grid, flex, width, typography size/weight, radius, overflow, responsive classes.
- For charts, SVGs, and inline styles, use `theme.chartAccent`, `theme.chartMuted`, and the provided theme values instead of hardcoded colors.

## 2. Runtime APIs Available

Learn Forge injects a fixed runner scope before rendering generated chapters. The following names are already available in scope. Do not import them:

- React hooks such as `useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`
- `motion` and `AnimatePresence`
- lucide icons
- Recharts components
- `cn`
- `chapterTheme`
- Predefined chapter components: `ChapterHero`, `Section`, `SubSection`, `Summary`, `KeyTakeaways`, `Quizz`, `CodeBlock`, `DataTable`, `Quote`, `Timeline`, `ProcessFlow`, `CopyNote`

The injected chapter component list is defined in `src/chapter-components/contracts.ts` and wired into the runtime through `src/chapter-components/runnerScope.ts`.

Do not import local files. Do not define replacement versions of these components.

## 3. Required Chapter Shape

Every chapter must follow this structure:

1. Hero block
   - Use `<ChapterHero />`.
   - Include chapter label, title, one-sentence promise, and 2-4 learning goals.

2. Concept primer
   - Use `<Section />`.
   - Explain the central idea in plain language.
   - Include a definition, analogy, or mental model.

3. Core model
   - Use `<Section />`.
   - Use one of `<ProcessFlow />`, `<Timeline />`, `<DataTable />`, or a simple chart.
   - This must be the strongest organizing visual in the chapter.

4. Applied example
   - Use `<Section />`.
   - Include a concrete example with realistic values, decisions, or consequences.
   - Use `<Quote />`, `<CodeBlock />`, `<DataTable />`, or `<CopyNote />` if useful.

5. Interactive practice
   - Use `<Section />`.
   - Use `<Quizz />` for quiz interactions.
   - If the chapter needs non-quiz interactivity, use small local state for tabs, scenario choice, reveal, or slider, but keep all color usage routed through `theme`.

6. Recap
   - Use `<Section />`.
   - Use `<KeyTakeaways />` and optionally `<Summary />`.
   - End with one reflective question or next-step prompt.

Use section labels like `"01"`, `"02"`, `"03"` for consistent scanability.

## 4. Predefined Component API

### ChapterHero

Use for the opening hero block at the top of every chapter.

```tsx
<ChapterHero
  theme={theme}
  label="Chapter 01"
  title="The chapter title"
  promise="One sentence that tells the learner what they will understand by the end."
  goals={[
    "First learning goal.",
    "Second learning goal.",
    "Third learning goal."
  ]}
/>
```

Props:

- `theme`: required. Pass the current theme object.
- `label`: required string. Use a chapter label such as `"Chapter 01"` or `"01"`.
- `title`: required string.
- `promise`: required string. One concise sentence.
- `goals`: required array of 2-4 strings.

### Section

Use for every major chapter section.

```tsx
<Section
  theme={theme}
  label="01"
  title="Why the concept matters"
  description="One concise sentence that frames the section."
>
  <p className={cn("text-base leading-7", theme.mutedText)}>...</p>
</Section>
```

Props:

- `theme`: required. Pass the current theme object.
- `label`: required string. Use `"01"`, `"02"`, etc.
- `title`: required string.
- `description`: optional string.
- `children`: required JSX.

### SubSection

Use inside sections for smaller grouped explanations.

```tsx
<SubSection theme={theme} title="Signal before noise" description="A short setup sentence.">
  <p className={cn("text-sm leading-6", theme.mutedText)}>...</p>
</SubSection>
```

Props:

- `theme`: required.
- `title`: required string.
- `description`: optional string.
- `children`: optional JSX.

### Summary

Use for compact recap panels.

```tsx
<Summary theme={theme} title="What this means">
  <p>Short synthesis paragraph.</p>
  <p>Another short synthesis paragraph if needed.</p>
</Summary>
```

Props:

- `theme`: required.
- `title`: optional string.
- `children`: required JSX.

### KeyTakeaways

Use at the end of the chapter or after a dense model.

```tsx
<KeyTakeaways
  theme={theme}
  title="Key takeaways"
  items={[
    "First precise takeaway.",
    "Second precise takeaway.",
    "Third precise takeaway."
  ]}
/>
```

Props:

- `theme`: required.
- `title`: optional string.
- `items`: required array of strings.

### Quizz

Use this exact component for quizzes. The component is named `Quizz` with a capital Q. Do not use lowercase `<quizz>` because lowercase JSX creates a DOM tag instead of calling the React component.

```tsx
<Quizz
  theme={theme}
  eyebrow="Knowledge check"
  question="Which decision best matches the principle from this chapter?"
  options={[
    {
      label: "A precise answer option.",
      correct: true,
      explanation: "Explain why this option is correct in one or two sentences."
    },
    {
      label: "A plausible misconception.",
      correct: false,
      explanation: "Explain the misconception and point back to the core model."
    },
    {
      label: "Another plausible but incomplete answer.",
      correct: false,
      explanation: "Explain what this answer misses."
    }
  ]}
/>
```

Props:

- `theme`: required.
- `eyebrow`: optional string. Defaults to `"Knowledge check"`.
- `question`: required string.
- `options`: required array with 2-4 objects.
- `options[].label`: required answer text.
- `options[].correct`: required boolean. Exactly one option should be `true`.
- `options[].explanation`: required feedback text.
- `checkLabel`: optional string for the submit button.

Quiz rules:

- Use exactly one correct answer.
- Make wrong answers plausible and educational.
- Feedback must explain the reasoning, not just say correct or incorrect.
- Do not build a custom quiz UI when `Quizz` can handle it.

### CodeBlock

Use for code, formulas, pseudocode, commands, or structured text examples.

```tsx
<CodeBlock
  theme={theme}
  title="Minimal example"
  language="tsx"
  code={`const result = inputs.map(transform);`}
/>
```

Props:

- `theme`: required.
- `title`: optional string.
- `language`: optional string.
- `code`: required string.

### DataTable

Use for comparison tables, decision matrices, term definitions, or before/after examples.

```tsx
<DataTable
  theme={theme}
  caption="Comparison of two approaches"
  columns={["Approach", "Best when", "Tradeoff"]}
  rows={[
    ["Direct explanation", "The idea is unfamiliar", "Less discovery"],
    ["Guided practice", "The learner has context", "Takes more time"]
  ]}
/>
```

Props:

- `theme`: required.
- `caption`: optional string.
- `columns`: required array of strings.
- `rows`: required array of row arrays. Each row must match the number of columns.

### Quote

Use for memorable principles or short expert-style framing. Do not invent citations from real people.

```tsx
<Quote
  theme={theme}
  quote="A good model reduces the number of things the learner has to hold in memory."
  cite="Chapter principle"
/>
```

Props:

- `theme`: required.
- `quote`: required string.
- `cite`: optional string.

### Timeline

Use for chronological sequences, progression, lifecycle, or staged learning.

```tsx
<Timeline
  theme={theme}
  items={[
    { label: "Step 1", title: "Observe", description: "Identify the input or condition." },
    { label: "Step 2", title: "Interpret", description: "Connect the condition to the model." },
    { label: "Step 3", title: "Act", description: "Choose the response that follows from the model." }
  ]}
/>
```

Props:

- `theme`: required.
- `items`: required array.
- `items[].label`: optional string.
- `items[].title`: required string.
- `items[].description`: required string.

### ProcessFlow

Use for non-chronological workflows, systems, pipelines, and cause-effect models. Works with 2-5 steps.

```tsx
<ProcessFlow
  theme={theme}
  steps={[
    { title: "Input", description: "What enters the system." },
    { title: "Transformation", description: "What changes and why." },
    { title: "Output", description: "What the learner should inspect." }
  ]}
/>
```

Props:

- `theme`: required.
- `steps`: required array.
- `steps[].title`: required string.
- `steps[].description`: required string.

### CopyNote

Use for a small practical note, instruction, or implementation reminder.

```tsx
<CopyNote theme={theme}>
  Keep the decision rule visible before showing the worked example.
</CopyNote>
```

Props:

- `theme`: required.
- `children`: required JSX.

## 5. Theme Tokens

Generated chapters must route visual styling through the `theme` object. These tokens are available:

- `theme.page`
- `theme.surface`
- `theme.subtleSurface`
- `theme.border`
- `theme.text`
- `theme.mutedText`
- `theme.accentText`
- `theme.accentSurface`
- `theme.accentBorder`
- `theme.accentButton`
- `theme.accentButtonText`
- `theme.successSurface`
- `theme.successText`
- `theme.successBorder`
- `theme.successIcon`
- `theme.dangerSurface`
- `theme.dangerText`
- `theme.dangerBorder`
- `theme.dangerIcon`
- `theme.codeSurface`
- `theme.codeText`
- `theme.chartAccent`
- `theme.chartMuted`
- `theme.timelineConnector`
- `theme.optionIdle`

Allowed:

- `className={cn("rounded-2xl border p-5", theme.surface, theme.border)}`
- `className={cn("text-base leading-7", theme.mutedText)}`
- `stroke={theme.chartAccent}`
- `<Section theme={theme} ... />`

Not allowed:

- `className="text-indigo-700 bg-indigo-50 border-indigo-200"`
- `className="text-emerald-700"`
- `style={{ color: "#4f46e5" }}`
- local objects named `colors`, `palette`, `themeColors`, or similar.

Use the static `chapterTheme` argument for now. Do not attempt to personalize colors per course.

## 6. Professional Design Rules

- Keep the page calm, structured, and spacious.
- Use one centered container: `mx-auto max-w-5xl space-y-12 px-4 sm:px-6 lg:px-8`.
- Use grids only when they improve scanning: `grid gap-4 md:grid-cols-2` or `md:grid-cols-3`.
- Do not nest card-like panels more than one level deep.
- Avoid decorative gradients, blobs, glassmorphism, neon effects, and random illustration clutter.
- Do not make every element a card.
- Avoid dark full-page themes.
- Keep paragraph widths readable.
- Make generated text specific to the chapter topic.

## 7. Content Quality Rules

- Teach one chapter, not the entire course.
- Define key terms before using them heavily.
- Use precise examples with values, decisions, or consequences.
- Prefer short paragraphs and scannable structures.
- Avoid filler phrases like "in today's fast-paced world", "dive into", "unlock", and "game-changer".
- Do not invent citations, statistics, or named authorities.
- Do not include TODOs, placeholders, or notes to the developer.

## 8. Interaction Rules

- Use `Quizz` for quiz interactions.
- For non-quiz interactions, use only simple local state: selected scenario, active tab, reveal toggle, or slider value.
- Every interaction must have an obvious label and visible result.
- Do not use timers, randomness, local storage, network requests, or form submission.
- Buttons must use `type="button"`.
- Inputs must have labels.
- Do not create fake controls that do not affect the chapter.

## 9. Robustness Checklist

Before finalizing the component:

- All icons, arrays, variables, and helper functions are defined.
- The component renders with no props because `theme` defaults to `chapterTheme`.
- Every predefined component receives `theme={theme}`.
- Every `.map()` has a stable key.
- The default state renders complete content.
- Conditional UI cannot read from `null` or `undefined`.
- The code has no local imports and no markdown fences.
- The chapter uses predefined components wherever they fit.
- The hero uses `ChapterHero`, not a hand-built duplicate hero layout.
