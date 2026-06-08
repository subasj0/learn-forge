import { CheckCircle2, ChevronRight, Copy, Quote as QuoteIcon, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ChapterTheme = {
  page: string;
  surface: string;
  subtleSurface: string;
  border: string;
  text: string;
  mutedText: string;
  accentText: string;
  accentSurface: string;
  accentBorder: string;
  accentButton: string;
  accentButtonText: string;
  successSurface: string;
  successText: string;
  successBorder: string;
  successIcon: string;
  dangerSurface: string;
  dangerText: string;
  dangerBorder: string;
  dangerIcon: string;
  codeSurface: string;
  codeText: string;
  chartAccent: string;
  chartMuted: string;
  timelineConnector: string;
  optionIdle: string;
};

export const DEFAULT_CHAPTER_THEME: ChapterTheme = {
  page: "bg-slate-50",
  surface: "bg-white",
  subtleSurface: "bg-slate-100",
  border: "border-slate-200",
  text: "text-slate-950",
  mutedText: "text-slate-600",
  accentText: "text-indigo-700",
  accentSurface: "bg-indigo-50",
  accentBorder: "border-indigo-200",
  accentButton: "bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300",
  accentButtonText: "text-white",
  successSurface: "bg-emerald-50",
  successText: "text-emerald-800",
  successBorder: "border-emerald-300",
  successIcon: "text-emerald-700",
  dangerSurface: "bg-rose-50",
  dangerText: "text-rose-800",
  dangerBorder: "border-rose-300",
  dangerIcon: "text-rose-700",
  codeSurface: "bg-slate-950",
  codeText: "text-slate-100",
  chartAccent: "#4f46e5",
  chartMuted: "#94a3b8",
  timelineConnector: "before:bg-slate-200",
  optionIdle: "bg-white hover:bg-slate-50",
};

type ThemedProps = {
  theme?: ChapterTheme;
  className?: string;
};

function getTheme(theme?: ChapterTheme) {
  return theme || DEFAULT_CHAPTER_THEME;
}

function flowGridClass(stepCount: number) {
  if (stepCount <= 1) return "grid-cols-1";
  if (stepCount === 2) return "md:grid-cols-2";
  if (stepCount === 3) return "md:grid-cols-3";
  if (stepCount === 4) return "md:grid-cols-2 lg:grid-cols-4";
  return "md:grid-cols-2 lg:grid-cols-3";
}

export function ChapterHero({
  theme,
  label,
  title,
  promise,
  goals,
  className,
}: ThemedProps & {
  label: string;
  title: string;
  promise: string;
  goals: string[];
}) {
  const t = getTheme(theme);

  return (
    <header className={cn("rounded-2xl border p-6 sm:p-8", t.surface, t.border, className)}>
      <div className={cn("text-xs font-semibold uppercase tracking-[0.18em]", t.accentText)}>{label}</div>
      <h1 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.text)}>{title}</h1>
      <p className={cn("mt-4 max-w-3xl text-base leading-7 sm:text-lg", t.mutedText)}>{promise}</p>
      {goals.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {goals.map((goal, index) => (
            <li
              key={`${goal}-${index}`}
              className={cn("flex gap-3 rounded-xl border p-4", t.accentSurface, t.accentBorder)}
            >
              <CheckCircle2 className={cn("mt-0.5 h-5 w-5 shrink-0", t.accentText)} />
              <span className={cn("text-sm leading-6", t.text)}>{goal}</span>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

export function Section({
  theme,
  label,
  title,
  description,
  children,
  className,
}: ThemedProps & {
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const t = getTheme(theme);

  return (
    <section className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <div className={cn("text-xs font-semibold uppercase tracking-[0.18em]", t.accentText)}>{label}</div>
        <h2 className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", t.text)}>{title}</h2>
        {description && <p className={cn("max-w-3xl text-base leading-7", t.mutedText)}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function SubSection({
  theme,
  title,
  description,
  children,
  className,
}: ThemedProps & {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const t = getTheme(theme);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <h3 className={cn("text-lg font-semibold", t.text)}>{title}</h3>
        {description && <p className={cn("text-sm leading-6", t.mutedText)}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Summary({
  theme,
  title = "Summary",
  children,
  className,
}: ThemedProps & {
  title?: string;
  children: ReactNode;
}) {
  const t = getTheme(theme);

  return (
    <aside className={cn("rounded-2xl border p-5", t.surface, t.border, className)}>
      <h3 className={cn("mb-3 text-lg font-semibold", t.text)}>{title}</h3>
      <div className={cn("space-y-3 text-sm leading-6", t.mutedText)}>{children}</div>
    </aside>
  );
}

export function KeyTakeaways({
  theme,
  title = "Key takeaways",
  items,
  className,
}: ThemedProps & {
  title?: string;
  items: string[];
}) {
  const t = getTheme(theme);

  return (
    <div className={cn("rounded-2xl border p-5", t.surface, t.border, className)}>
      <h3 className={cn("mb-4 text-lg font-semibold", t.text)}>{title}</h3>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-3">
            <CheckCircle2 className={cn("mt-0.5 h-5 w-5 shrink-0", t.accentText)} />
            <span className={cn("text-sm leading-6", t.mutedText)}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Quizz({
  theme,
  eyebrow = "Knowledge check",
  question,
  options,
  checkLabel = "Check answer",
  className,
}: ThemedProps & {
  eyebrow?: string;
  question: string;
  checkLabel?: string;
  options: Array<{
    label: string;
    correct: boolean;
    explanation: string;
  }>;
}) {
  const t = getTheme(theme);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const selectedOption = selected === null ? null : options[selected];

  return (
    <div className={cn("rounded-2xl border p-5", t.surface, t.border, className)}>
      <div className={cn("mb-2 text-xs font-semibold uppercase tracking-[0.18em]", t.accentText)}>{eyebrow}</div>
      <h3 className={cn("text-lg font-semibold leading-7", t.text)}>{question}</h3>

      <div className="mt-5 space-y-3">
        {options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrectAfterSubmit = submitted && option.correct;
          const isWrongAfterSubmit = submitted && isSelected && !option.correct;

          return (
            <button
              key={`${option.label}-${index}`}
              type="button"
              disabled={submitted}
              onClick={() => setSelected(index)}
              className={cn(
                "flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left text-sm transition",
                t.border,
                isSelected && !submitted && cn(t.accentSurface, t.accentBorder),
                !isSelected && !submitted && t.optionIdle,
                isCorrectAfterSubmit && cn(t.successSurface, t.successBorder),
                isWrongAfterSubmit && cn(t.dangerSurface, t.dangerBorder),
              )}
            >
              <span className={cn("font-medium leading-6", t.text)}>{option.label}</span>
              {isCorrectAfterSubmit && <CheckCircle2 className={cn("h-5 w-5 shrink-0", t.successIcon)} />}
              {isWrongAfterSubmit && <XCircle className={cn("h-5 w-5 shrink-0", t.dangerIcon)} />}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {!submitted ? (
          <button
            type="button"
            disabled={selected === null}
            onClick={() => setSubmitted(true)}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed",
              t.accentButton,
              t.accentButtonText,
            )}
          >
            {checkLabel}
          </button>
        ) : (
          <div
            className={cn(
              "rounded-xl border p-4 text-sm leading-6",
              selectedOption?.correct
                ? cn(t.successSurface, t.successText, t.successBorder)
                : cn(t.dangerSurface, t.dangerText, t.dangerBorder),
            )}
          >
            <strong>{selectedOption?.correct ? "Correct. " : "Not quite. "}</strong>
            {selectedOption?.explanation}
          </div>
        )}
      </div>
    </div>
  );
}

export function CodeBlock({
  theme,
  title,
  language,
  code,
  className,
}: ThemedProps & {
  title?: string;
  language?: string;
  code: string;
}) {
  const t = getTheme(theme);

  return (
    <figure className={cn("overflow-hidden rounded-2xl border", t.border, className)}>
      {(title || language) && (
        <figcaption className={cn("flex items-center justify-between border-b px-4 py-3", t.surface, t.border)}>
          <span className={cn("text-sm font-semibold", t.text)}>{title || "Code example"}</span>
          {language && <span className={cn("text-xs font-medium uppercase tracking-wide", t.mutedText)}>{language}</span>}
        </figcaption>
      )}
      <pre className={cn("overflow-x-auto p-4 text-sm leading-6", t.codeSurface, t.codeText)}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export function DataTable({
  theme,
  columns,
  rows,
  caption,
  className,
}: ThemedProps & {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  caption?: string;
}) {
  const t = getTheme(theme);

  return (
    <div className={cn("overflow-hidden rounded-2xl border", t.surface, t.border, className)}>
      {caption && <div className={cn("border-b px-4 py-3 text-sm font-semibold", t.border, t.text)}>{caption}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead className={t.subtleSurface}>
            <tr>
              {columns.map((column, index) => (
                <th key={`${column}-${index}`} className={cn("border-b px-4 py-3 font-semibold", t.border, t.text)}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className={cn("border-b px-4 py-3 leading-6", t.border, t.mutedText)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Quote({
  theme,
  quote,
  cite,
  className,
}: ThemedProps & {
  quote: string;
  cite?: string;
}) {
  const t = getTheme(theme);

  return (
    <figure className={cn("rounded-2xl border p-5", t.accentSurface, t.accentBorder, className)}>
      <QuoteIcon className={cn("mb-3 h-5 w-5", t.accentText)} />
      <blockquote className={cn("text-base font-medium leading-7", t.text)}>{quote}</blockquote>
      {cite && <figcaption className={cn("mt-3 text-sm", t.mutedText)}>{cite}</figcaption>}
    </figure>
  );
}

export function Timeline({
  theme,
  items,
  className,
}: ThemedProps & {
  items: Array<{
    label?: string;
    title: string;
    description: string;
  }>;
}) {
  const t = getTheme(theme);

  return (
    <ol className={cn("rounded-2xl border p-5", t.surface, t.border, className)}>
      {items.map((item, index) => (
        <li
          key={`${item.title}-${index}`}
          className={cn(
            "relative pb-6 pl-8 last:pb-0",
            index !== items.length - 1 && cn("before:absolute before:left-[9px] before:top-6 before:h-full before:w-px", t.timelineConnector),
          )}
        >
          <span
            className={cn(
              "absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
              t.accentSurface,
              t.accentText,
            )}
          >
            {index + 1}
          </span>
          {item.label && <div className={cn("text-xs font-semibold uppercase tracking-wide", t.accentText)}>{item.label}</div>}
          <h3 className={cn("text-base font-semibold", t.text)}>{item.title}</h3>
          <p className={cn("mt-1 text-sm leading-6", t.mutedText)}>{item.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function ProcessFlow({
  theme,
  steps,
  className,
}: ThemedProps & {
  steps: Array<{
    title: string;
    description: string;
  }>;
}) {
  const t = getTheme(theme);

  return (
    <div className={cn("grid gap-3", flowGridClass(steps.length), className)}>
      {steps.map((step, index) => (
        <div key={`${step.title}-${index}`} className={cn("relative rounded-2xl border p-4", t.surface, t.border)}>
          <div
            className={cn(
              "mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
              t.accentSurface,
              t.accentText,
            )}
          >
            {index + 1}
          </div>
          <h3 className={cn("text-base font-semibold", t.text)}>{step.title}</h3>
          <p className={cn("mt-2 text-sm leading-6", t.mutedText)}>{step.description}</p>
          {index < steps.length - 1 && (
            <ChevronRight className={cn("absolute right-3 top-5 hidden h-5 w-5 md:block", t.accentText)} />
          )}
        </div>
      ))}
    </div>
  );
}

export function CopyNote({
  theme,
  children,
  className,
}: ThemedProps & {
  children: ReactNode;
}) {
  const t = getTheme(theme);

  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", t.subtleSurface, t.border, className)}>
      <Copy className={cn("mt-0.5 h-4 w-4 shrink-0", t.accentText)} />
      <div className={cn("text-sm leading-6", t.mutedText)}>{children}</div>
    </div>
  );
}
