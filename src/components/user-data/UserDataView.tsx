"use client";

import { useState } from "react";

interface Data {
  projectId: string;
  projectName: string;
  brand: { id: string; category: string; title: string; content: string; updatedAt: string }[];
  sourceDocs: { id: string; category: string; title: string; content: string; updatedAt: string }[];
  personas: { id: string; name: string; age: number | null; gender: string | null; type: string | null; pains: string | null; goals: string | null; tone: string | null; forbiddenWords: string | null; triggers: string | null; objections: string | null; language: string | null }[];
  products: { id: string; name: string; description: string | null; price: string | null; audience: string | null; pains: string | null; transformation: string | null; benefits: string | null; priority: number | null; leadMagnets: { id: string; name: string }[] }[];
  cases: { id: string; title: string; niche: string | null; problem: string | null; solution: string | null; metrics: Record<string, any> | null; allowedClaims: string | null }[];
  strategy: { version: number; contentPillars: any; intentDistribution: any } | null;
  topicsCount: number;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs text-fg-muted mt-1">
      <span className="uppercase tracking-wide text-fg-subtle">{label}:</span> {value}
    </p>
  );
}

function Section({
  title, count, section, projectId, children, empty, defaultOpen = true, noDownload = false, subtitle,
}: {
  title: string; count: number; section: string; projectId: string; children: React.ReactNode; empty?: string; defaultOpen?: boolean; noDownload?: boolean; subtitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl bg-canvas-subtle overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span className="text-fg-subtle text-xs">{open ? "▾" : "▸"}</span>
          {title}
          <span className="text-[10px] px-1.5 py-0.5 bg-border/60 text-fg-muted rounded-full">{count}</span>
          {subtitle && <span className="text-[11px] font-normal text-fg-subtle">{subtitle}</span>}
        </button>
        {count > 0 && !noDownload && (
          <a
            href={`/api/brand-doc?projectId=${projectId}&section=${section}`}
            className="text-xs px-2.5 py-1 rounded border border-border text-fg-muted hover:text-fg hover:bg-canvas transition-colors"
            title={`Завантажити «${title}» у .docx`}
          >
            ⬇ .docx
          </a>
        )}
      </div>
      {open && (
        <div className="p-4 space-y-3">
          {count === 0 ? <p className="text-xs text-fg-subtle">{empty || "Немає даних"}</p> : children}
        </div>
      )}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-lg bg-canvas">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-fg-subtle truncate">{subtitle}</p>}
        </div>
        <span className="text-fg-subtle text-xs shrink-0 ml-2">{open ? "згорнути" : "переглянути"}</span>
      </button>
      {open && children && <div className="px-3 pb-3 border-t border-border/60 pt-2">{children}</div>}
    </div>
  );
}

export function UserDataView({ data }: { data: Data }) {
  const { projectId } = data;
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function syncVector() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch(`/api/vector/sync?projectId=${projectId}`, { method: "POST" });
      const j = await r.json();
      if (j.ok) setSyncMsg({ ok: true, text: `✅ Проіндексовано ${j.ingested} записів у базу знань` });
      else setSyncMsg({ ok: false, text: j.reason || "Помилка синхронізації" });
    } catch (e: any) {
      setSyncMsg({ ok: false, text: e.message || "Помилка" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div>
          <p className="text-sm font-semibold text-fg">Дані користувача — {data.projectName}</p>
          <p className="text-xs text-fg-muted">Уся база бренду: бренд-профіль, персони, продукти, кейси, стратегія. Переглянути й скачати.</p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && (
            <span className={`text-[11px] ${syncMsg.ok ? "text-success" : "text-danger"}`}>{syncMsg.text}</span>
          )}
          <button
            onClick={syncVector}
            disabled={syncing}
            className="text-xs px-3 py-1 rounded border border-border text-fg-muted hover:text-fg hover:bg-canvas transition-colors disabled:opacity-50"
            title="Проіндексувати всі дані у векторну базу знань (Client Static)"
          >
            {syncing ? "Синхронізація…" : "🔄 У базу знань"}
          </button>
          <a
            href={`/api/brand-doc?projectId=${projectId}&section=all`}
            className="btn-primary text-xs px-3 py-1"
            title="Завантажити весь бренд-профіль у .docx"
          >
            ⬇ Завантажити все .docx
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 max-w-3xl w-full mx-auto">
        {/* Бренд і Tone of Voice */}
        <Section title="Бренд і Tone of Voice" count={data.brand.length} section="brand" projectId={projectId} empty="Ще немає бренд-гайду. Заповнюється онбордингом або вручну.">
          {data.brand.map((b) => (
            <Card key={b.id} title={b.title} subtitle={`категорія: ${b.category}`}>
              <p className="text-xs text-fg-muted whitespace-pre-wrap">{b.content}</p>
            </Card>
          ))}
        </Section>

        {/* Персони */}
        <Section title="Персони (ЦА)" count={data.personas.length} section="persona" projectId={projectId} empty="Ще немає персон.">
          {data.personas.map((p) => (
            <Card key={p.id} title={p.name} subtitle={[p.age ? `${p.age} р.` : null, p.gender, p.type].filter(Boolean).join(" · ") || undefined}>
              <Row label="Тон голосу" value={p.tone} />
              <Row label="Уникати" value={p.forbiddenWords} />
              <Row label="Болі" value={p.pains} />
              <Row label="Цілі/мрії" value={p.goals} />
              <Row label="Тригери" value={p.triggers} />
              <Row label="Заперечення" value={p.objections} />
              <Row label="Мова" value={p.language} />
            </Card>
          ))}
        </Section>

        {/* Продукти */}
        <Section title="Продукти" count={data.products.length} section="product" projectId={projectId} empty="Ще немає продуктів.">
          {data.products.map((p) => (
            <Card key={p.id} title={p.name} subtitle={[p.price, p.priority ? `пріоритет ${p.priority}` : null].filter(Boolean).join(" · ") || undefined}>
              <Row label="Опис" value={p.description} />
              <Row label="Болі, які закриває" value={p.pains} />
              <Row label="Трансформація" value={p.transformation} />
              <Row label="Переваги" value={p.benefits} />
              <Row label="ЦА" value={p.audience} />
              <Row label="Лід-магніти" value={p.leadMagnets.map((m) => m.name).join(", ") || null} />
            </Card>
          ))}
        </Section>

        {/* Кейси */}
        <Section title="Кейси" count={data.cases.length} section="case" projectId={projectId} empty="Ще немає кейсів. Критично для контенту — кейси беруться тільки звідси (case integrity).">
          {data.cases.map((c) => (
            <Card key={c.id} title={c.title} subtitle={c.niche || undefined}>
              <Row label="Проблема" value={c.problem} />
              <Row label="Рішення" value={c.solution} />
              <Row label="Результати" value={c.metrics ? Object.entries(c.metrics).map(([k, v]) => `${k}: ${v}`).join(", ") : null} />
              <Row label="Дозволені формулювання" value={c.allowedClaims} />
            </Card>
          ))}
        </Section>

        {/* SMM-стратегія */}
        <Section title="SMM-стратегія" count={data.strategy ? 1 : 0} section="strategy" projectId={projectId} empty="Ще немає стратегії.">
          {data.strategy && (
            <Card title={`Стратегія (версія ${data.strategy.version})`} subtitle="контент-стовпи + баланс цілей">
              <Row label="Контент-стовпи" value={Array.isArray(data.strategy.contentPillars) ? data.strategy.contentPillars.join(", ") : null} />
              <Row label="Баланс цілей" value={data.strategy.intentDistribution && typeof data.strategy.intentDistribution === "object" ? Object.entries(data.strategy.intentDistribution).map(([k, v]) => `${k} ${v}`).join(", ") : null} />
            </Card>
          )}
        </Section>

        {/* Банк тем — лінк на окрему сторінку */}
        <div className="border border-border rounded-xl bg-canvas-subtle px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-fg">Банк тем</p>
            <p className="text-xs text-fg-muted">{data.topicsCount} тем — керування на окремій сторінці</p>
          </div>
          <a href="/topics" className="text-xs text-accent hover:underline">Відкрити «Теми» →</a>
        </div>

        {/* Вихідні матеріали (джерело) — сирі завантажені документи. НЕ база генерації:
            вони вже розібрані в структуру вище. Лишаються для довідки + точкового пошуку. */}
        {data.sourceDocs.length > 0 && (
          <Section
            title="Вихідні матеріали (джерело)"
            count={data.sourceDocs.length}
            section="source"
            projectId={projectId}
            defaultOpen={false}
            noDownload
            subtitle="завантажені доки — джерело, не база контент-плану"
          >
            {data.sourceDocs.map((d) => (
              <Card key={d.id} title={d.title} subtitle={`категорія: ${d.category}`}>
                <p className="text-xs text-fg-muted whitespace-pre-wrap">{d.content}</p>
              </Card>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
