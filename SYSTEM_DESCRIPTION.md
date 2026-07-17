# Контент платформа (content2) — опис системи для ШІ

> Призначення файлу: дати іншому ШІ/агенту повне розуміння системи без читання всього
> коду. Складено 2026-07-17 на основі коду, схеми Prisma, `docs/TZ.md`, git-історії.
> Частина аудиту #246. Пов'язано: `ECOSYSTEM.md` в корені екосистеми, задачі бакета 240.

## 1. Що це
Мультитенантна SaaS **контент-платформа** — пульт керування контент-планом соцмереж з
ШІ-асистентом, генерацією медіа й real-time оновленнями. Працює у парі з **Telegram-ботом
«контент менеджер»** (агент у flows), який через API-інструменти створює/редагує пости,
генерує зображення/відео, бере теми й правила.

- URL: `content2.fineko.space` · VPS 173.242.62.180 · PM2 порт 3001 · nginx+SSL.
- Репо: San4ez-mc/content2 (branch main).

## 2. Стек
Next.js 14 (App Router) + TypeScript · **PostgreSQL + Prisma** (⚠️ у `TZ.md` написано MySQL —
насправді Postgres, див. §12) · NextAuth (credentials+JWT) · TanStack Query v5 · Tiptap
(редактор) · @dnd-kit · Radix UI/shadcn + Tailwind · Server-Sent Events (real-time).

## 3. Архітектура (три учасники)
```
Веб-пульт (Next.js)  ←→  БД (Postgres/Prisma)
      ▲  │ SSE (генерація/нотифікації)
      │  ▼
Бот «контент менеджер» (flows) ──/api/agent-tools?action=…&token=…──►  платформа
      │
      ▼ генерація зображень/відео (воронки flows) ──webhook /api/webhooks/generation-event──► платформа → SSE
```
- **Веб** — керування руками (календар, редактор, категорії, сховище…).
- **Бот** — керування через діалог: викликає `/api/agent-tools` (токен = проєкт).
- **flows** — виконує важкі задачі (генерація медіа, розсилки) і б'є вебхуками назад.

## 4. Доступи (мультитенант)
- Глобальні ролі `User.role`: `superadmin` (усі проєкти+юзери), `admin` (свої+запрошені),
  `client` (свій проєкт).
- Проєкт = тенант. `ProjectUser.role`: `owner|editor|viewer`. Запрошення по email
  (`Invitation` + `/invite/[token]`).
- **Усе прив'язано до `projectId`** — категорії, персони, пости, теми, знання, продукти,
  розклад. Тобто мультитенант уже закладено в моделі (важливо для #258).

## 5. Модель даних (Prisma, згруповано)
- **Тенант/доступ:** `User`, `Project`, `ProjectUser`, `Invitation`.
- **Контент-план:** `SocialNetwork` (платформи), `Category`, `Persona` (аватар ЦА: болі,
  цілі, тон, заборонені слова), `PostGroup` (1 публікація = чип у календарі; типи
  single/carousel/thread_chain/stories; audience cold→hot; status draft/scheduled/published),
  `PostItem` (одиниці: контент, image_prompt, image_path, generation_status, is_cta —
  CTA лише на останньому item).
- **Медіа:** `MediaItem` (файли, теги, ai_generated), генерація через flows + SSE-статус.
- **Знання й структура:** `KnowledgeEntry` (правила/стиль/тон/заборони, addedBy user|bot),
  `ContentType` (типи з промптами/структурою), `ContentTopic` (банк тем: рубрика→тема→пост,
  status idea|planned|used, 14-денний cooldown повторного використання).
- **Продаж:** `Product` (що продаємо), `LeadMagnet` (1 продукт→N магнітів; кожен веде на
  воронку flows через `funnelSlug`/`botUsername`/`baseStartParam` = deep-link).
- **ШІ-чат:** `ChatSession`, `ChatMessage`.
- **Розклад/публікація:** `ScheduleSettings` (часи по днях тижня + Telegram digest),
  `PublicationQueue` (заготовка), `Notification`.
- **Глобальні інструменти:** `ContentTool` (slug, aiDescription, paramsSchema — синхронізуються
  для бота через `/api/tools/sync` і `/api/tools/for-bot`).

## 6. Сторінки веб-пульта (`src/app/(dashboard)`)
Головна (календар контент-плану), `categories`, `content-types`, `products`, `lead-magnets`,
`networks`, `topics`, `storage` (медіатека), `stats`, `tools`, `admin` (юзери/запрошення).
Календар: місяць/тиждень/день, модалка поста (Контент з Tiptap + Медіа з генерацією),
quick-create, bulk, пошук по всіх місяцях, мобільний stacked-вигляд.

## 7. Бот «контент менеджер» — інструменти (`/api/agent-tools`)
Дії (токен визначає проєкт): `list_posts, get_post, create_post, edit_post, delete_post,
delete_posts, regenerate_image, send_media, list_media, get_rules, save_rule, get_topics,
get_structures, get_products, get_lead_magnets, mark_topics_used, create_avatar_reel`.
Тобто бот повністю веде контент-план: додає/міняє пости, генерує медіа, тягне теми/правила/
продукти й запускає воронку сценариста аватар-Reels.

## 8. API-ендпоінти (`src/app/api`)
CRUD: `posts` (+`/generate`, `/items`, `/bulk-import`), `categories`, `personas`,
`content-types`, `topics`, `products`, `lead-magnets`, `knowledge`, `networks`, `media`,
`schedule`, `stats`. Сервіс: `agent-tools`, `tools/(sync|for-bot)`, `chat/(send|session)`,
`sse/project/[id]`, `scheduler/run`, `generation-watchdog`, `link-stats`, `admin/*`.
Вебхуки для flows: `webhooks/(generation-event|chat-reply|chat-placeholders|save-knowledge)`.

## 9. Real-time (SSE) і генерація
Клієнт слухає `/api/sse/project/[id]`. flows після генерації медіа шле
`POST /api/webhooks/generation-event` → платформа оновлює `PostItem.generation_status`,
створює `Notification`, робить SSE-broadcast → календар/дзвіночок/модалка оновлюються.
Є watchdog завислих генерацій (`generation-watchdog`).

## 10. Продаж і трекінг
Продукти→лід-магніти→воронки flows (deep-link `t.me/<bot>?start=<payload>`). Пер-пост
трекінг кліків: генеруються унікальні посилання (`<code>_<postNum>`), статистика в
`link-stats` / на лід-магнітах. Контент-план орієнтований на продукти (щоб контент вів до продажу).

## 11. Незакриті скарги / задачі (бакет 240 + спостереження)
> Джерело — задачі трекера (бакет 240) + git-історія. Окремого лог-файлу скарг у репо/claude-mem
> не знайдено (див. §13 — якщо скарги записані деінде, треба долучити).

| # | Скарга/задача | Статус за кодом/git |
|---|---|---|
| #242 | Деплой адмінки: base-link завжди карткою; прибрати «гонку vite-білдів», один чистий білд | ⚠️ «vite» — а тут Next.js. Схоже, стосується ІНШОЇ адмінки/кодбази (не content2). Уточнити. |
| #243 | `/categories` порожні — знайти джерело категорій постів і заповнити; відцентрувати текст+кнопку | ⏳ відкрито. Є `categories` CRUD + `admin/migrate-categories` (міграція з legacy) — джерело може бути там. |
| #244 | У картці поста показувати тему і категорію створення | ⏳ відкрито (ContentTopic є, але зв'язок теми з постом у картці не підтверджено). |
| #245 | Продукти й лід-магніти через MCP/бота | ✅ схоже ЗРОБЛЕНО (git 08ef397; сторінки products/lead-magnets + бот-інструменти get_products/get_lead_magnets). |
| #246 | Аудит контент-ботів + що доробити для продажу як продукту | 🔄 цей документ — частина аудиту. |
| #247 | Дослідження структур постів/рілсів і хуки (методологія) | ⏳ відкрито (є `get_structures`, але це не дослідження). |
| #248 | Конструктор постів + бали ефективності елементів | ⏳ відкрито (скорингу ефективності немає). |
| #258 | Розділити документи content2 по компаніях (multi-tenant) | 🟡 БАЗОВО вже є: усе прив'язано до `projectId`. Лишається рознести спільне (структури/методологія→flows) від індивідуального (теми/знання per-project) + пошук по Drive клієнта через вектор-мікросервіс (#263). |

## 12. Нестиковки / технічний борг (помічено при аналізі)
- **`docs/TZ.md` каже MySQL, реально PostgreSQL** (schema `provider = "postgresql"`). Оновити ТЗ.
- **Два конфіги Next поруч:** `next.config.mjs` І `next.config.ts` — неясно, який діє; ризик
  плутанини білдів (можливо саме сюди дивиться скарга #242 про «гонку білдів»). Перевірити/прибрати зайвий.
- `docs/SETUP.md` містить застарілий локальний шлях (`C:/Users/Admin/Documents/My Workspace/content2`).
- ТЗ описує деякі фази як «наступні», але git показує, що багато вже зроблено (медіасховище,
  bulk-import, invitations, топіки, продукти) — ТЗ відстає від реальності.

## 13. Що уточнити у власника
- Де записані «скарги по контент платформі / контент менеджеру 2.0 / вебу»? У репо й claude-mem
  окремого списку немає — я звів з бакета 240 + коду. Якщо є ще джерело (чат, документ, діалоги
  з ботом) — дай, додам сюди.
- #242 з «vite» — це точно про content2 (Next.js) чи про іншу адмінку/бота? Уточнити кодбазу.
