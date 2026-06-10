# ТЗ — Content Platform v2 (`content2.fineko.space`)

## 1. Загальний огляд

**Мета:** Повноцінна контент-платформа — пульт управління соціальними мережами з AI-асистентом, real-time генерацією медіа та мульти-акаунтним доступом.

**URL:** `https://content2.fineko.space`  
**Сервер:** VPS 173.242.62.180, nginx vhost → Node.js port 3001 (PM2)  
**База даних:** MySQL нова БД `fineko_content2` + Prisma ORM  
**Репозиторій:** GitHub `San4ez-mc/content2`  

---

## 2. Технологічний стек

| Шар | Технологія |
|-----|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Стилі | Tailwind CSS + shadcn/ui |
| БД | MySQL `fineko_content2` + Prisma ORM |
| Auth | NextAuth.js (credentials) + JWT |
| Real-time | Server-Sent Events (SSE) |
| Server state | TanStack Query v5 |
| Редактор | Tiptap |
| Drag & Drop | @dnd-kit |
| PM2 | port 3001 |

---

## 3. Архітектура доступів

### Ролі
| Роль | Можливості |
|------|-----------|
| `superadmin` | Всі проекти, управління юзерами |
| `admin` | Свої + запрошені проекти |
| `client` | Тільки свій проект |

### Нові таблиці auth
```sql
users           -- id, email, password_hash, name, role, created_at
project_users   -- user_id, project_id, role ('owner'|'editor'|'viewer')
invitations     -- id, email, project_id, token, expires_at, used_at
```

---

## 4. Модель даних — Post Group + Post Items

### Ключова концепція
**1 публікація = post_group + масив post_items**

```
post_groups   — "обгортка" публікації (що в календарі = 1 чип)
└── post_items[] — реальні одиниці контенту
```

### Типи груп
| type | Опис | Items |
|------|------|-------|
| `single` | Один пост (Instagram, LinkedIn) | 1 item |
| `carousel` | Карусель слайдів | N items (кожен = слайд) |
| `thread_chain` | Ланцюжок в Threads | N items (останній = CTA) |
| `stories` | Серія Stories | N items |

### Правило CTA
- `is_cta=true` — завжди тільки ОСТАННІЙ item в групі
- Посилання / кнопка — тільки там
- UI не дає поставити CTA на не-останній item

### Схема БД

```sql
-- Проекти
projects (id, name, is_active, created_at)

-- Соцмережі
social_networks (id, name, platform_key, icon, color, is_enabled, sort_order, project_id)

-- Категорії
categories (id, project_id, social_network_id, name, color, description)

-- Персонажі (аватари аудиторії)
personas (
  id, project_id, name, age, gender,
  type ENUM('TYPE_1','TYPE_2','TYPE_3'),
  pains TEXT,        -- болі та страхи
  goals TEXT,        -- бажання та цілі
  tone VARCHAR(255), -- тон комунікації
  forbidden_words TEXT,
  created_at
)

-- Групи постів
post_groups (
  id, project_id, persona_id,
  post_date DATE,
  social_network_id,
  type ENUM('single','carousel','thread_chain','stories'),
  audience ENUM('cold','warm1','warm2','hot1','hot2'),
  status ENUM('draft','scheduled','published','archived'),
  schedule_time TIME NULL,   -- конкретний час відправки (для scheduler)
  created_at, updated_at
)

-- Айтеми постів
post_items (
  id, group_id,
  order_index INT,
  content TEXT,
  image_prompt TEXT,
  image_path VARCHAR(500),
  image_type VARCHAR(50),     -- flux/ideogram/recraft/...
  generation_status ENUM('pending','generating','done','failed'),
  generation_error TEXT,
  is_cta BOOLEAN DEFAULT false,
  slide_title VARCHAR(255),   -- для carousel
  slide_subtitle VARCHAR(255),
  created_at, updated_at
)

-- Auth
users (id, email, password_hash, name, role ENUM('superadmin','admin','client'), created_at)
project_users (user_id, project_id, role ENUM('owner','editor','viewer'))
invitations (id, email, project_id, token, expires_at, used_at)

-- Чат
chat_sessions (id, project_id, user_id, session_key, created_at, last_activity)
chat_messages (id, session_id, role ENUM('user','assistant'), content TEXT, created_at)

-- Нотифікації
notifications (id, project_id, user_id, type, title, body, post_group_id, read_at, created_at)

-- Публікація (заготовка)
publication_queue (id, post_group_id, platform, scheduled_at, status, external_id, error_message)

-- Медіатека
media_items (id, project_id, file_path, file_name, mime_type, folder, tags JSON, ai_generated BOOL, created_at)

-- Налаштування розкладу
schedule_settings (
  id, project_id,
  monday JSON,    -- ["09:00","12:00","18:00"]
  tuesday JSON,
  wednesday JSON,
  thursday JSON,
  friday JSON,
  saturday JSON,
  sunday JSON,
  send_to_telegram BOOL DEFAULT true,
  telegram_chat_id VARCHAR(100),
  updated_at
)
```

---

## 5. UI/UX — Дизайн-система

### Тема
- **За замовчуванням:** темна (`#0d1117` bg, `#161b22` cards, `#30363d` borders)
- **Акцент:** `#3b82f6` → hover `#60a5fa`
- Перемикач ☀️/🌙, localStorage + user preferences в БД

### Топбар (40px висота)
```
[📋 CP2]  Контент | Категорії | Сховище | Типи | Мережі | Статистика    [🔔N] [☀️] [Avatar ▾]
```

### Мобайл
- Bottom navigation bar (5 іконок)
- Календар → тижневий вигляд
- Модалки → full-screen sheets

---

## 6. Сторінки

### 6.1 📅 Контент-план (головна)
- Вигляд: місячний календар (default), тижневий, денний
- Комірки мін. 140px висота
- Чипи: платформа + 60 символів + мініатюра зображення
- Клік → модалка з двома вкладками: Контент | Медіа
- Модалка Контент: Tiptap editor + лічильник символів, навігація між items (①②③...)
- Модалка Медіа: промпт, генератор, upload, статус генерації (real-time SSE)
- Клік по порожній комірці → quick create модалка
- Bulk: checkbox hover → floatable toolbar

### 6.2 📁 Категорії
- Картки по платформах
- Форма: назва, колір, мережа, тип клієнта, персонаж

### 6.3 👤 Персонажі (в меню разом з категоріями або окремо)
- Картки: ім'я, тип, болі, тон
- Прив'язка до категорій і постів

### 6.4 🗄️ Сховище (Медіатека)
- Grid/List, пошук, папки, теги
- Drag & drop upload
- Прикріплення до поста

### 6.5 📝 Типи контенту
- Список типів з промптами

### 6.6 🌐 Мережі
- Увімкнути/вимкнути
- Placeholder для API токенів

### 6.7 📊 Статистика
- Загальні лічильники + по платформах/статусах

### 6.8 ⚙️ Налаштування розкладу (в Налаштуваннях або Мережах)
- По кожному дню тижня: список часів відправки
- Telegram Chat ID для відправки
- Включити/вимкнути автовідправку

### 6.9 🤖 AI Чатик
- SSE-канал прив'язаний до userId
- Сесії в БД (chat_sessions + chat_messages)
- Управляє: постами, категоріями, персонажами, мережами, проектами
- Швидкі кнопки-підказки

### 6.10 🔔 Notification Center
- Dropdown у топбарі
- Типи: generation_done, generation_failed, scheduled_reminder

---

## 7. Real-time архітектура (SSE)

```
[Flows / Cron Scheduler]
      │
      ▼ POST /api/webhooks/generation-event
[Next.js API Route]
      ├── UPDATE post_items SET generation_status=...
      ├── INSERT notifications
      └── SSE broadcast → client EventSource
            ├── TanStack Query invalidate → refresh calendar
            ├── Notification bell +1
            └── Якщо модалка відкрита → оновити in place
```

### Webhook endpoints (для flows)
```
POST /api/webhooks/generation-event   — статус генерації
POST /api/webhooks/chat-reply         — відповідь AI
POST /api/webhooks/notify             — загальна нотифікація
POST /api/webhooks/scheduler-done     — підтвердження відправки
```

---

## 8. Scheduler (розклад відправки)

- Налаштовується в платформі: дні тижня + часи
- Cron на сервері викликає `/api/scheduler/run` (або flows webhook)
- Логіка: знаходить пости з `status=scheduled` і `schedule_time <= now`
- Відправляє через flows (content-scheduler бот) або напряму через TG API
- Після відправки: status → `published`, нотифікація в платформу

---

## 9. Публікація (заготовка на майбутнє)
- Архітектура є (publication_queue таблиця)
- UI: кнопка "Опублікувати" з tooltip "Незабаром"
- Не реалізовано

---

## 10. Поетапна реалізація

| Фаза | Що | Статус |
|------|----|--------|
| **0** | Scaffold + Prisma + Auth + nginx | 🔄 В роботі |
| **1** | Календар (read) + SSE + модалка поста | ⏳ |
| **2** | Редагування постів + AI чатик (з пам'яттю) | ⏳ |
| **3** | Категорії + Персонажі + Мережі | ⏳ |
| **4** | Сховище + Нотифікації + Статистика | ⏳ |
| **5** | Мультиюзер + запрошення + ролі | ⏳ |
| **6** | Scheduler UI + bulk ops + drag&drop + mobile | ⏳ |
