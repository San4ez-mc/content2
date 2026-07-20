// #248 Конструктор постів — канонічні елементи (за методологією #247).
// Значення id стабільні (використовуються як ключі у WinningPattern.kind/value та полях PostGroup).

export type Option = { id: string; label: string; hint?: string };

// Тема / намір (Ф3.6) — поле PostGroup.intent
export const INTENTS: Option[] = [
  { id: "educate", label: "Навчання", hint: "корисність, як зробити" },
  { id: "sell", label: "Продаж", hint: "офер, анонс, заклик купити" },
  { id: "trust", label: "Довіра", hint: "кейси, соц.доказ, прозорість" },
  { id: "storytelling", label: "Історія", hint: "наратив, особисте" },
  { id: "entertainment", label: "Розвага", hint: "легкий, емоційний" },
];

// Структура тексту (скелет) — поле PostGroup.structureId
export const STRUCTURES: Option[] = [
  { id: "aida", label: "AIDA-lite", hint: "Біль → Рішення → Кейс → CTA" },
  { id: "pas", label: "PAS", hint: "Проблема → Підсилення → Рішення → CTA" },
  { id: "case", label: "Кейс", hint: "Результат → Було → Що зробили → Стало → CTA" },
  { id: "insight", label: "Інсайт / думка", hint: "Теза → Контекст → Поворот → Обговорення" },
  { id: "listicle", label: "Лістикл", hint: "«N способів…» → пункти → Збережи" },
  { id: "provocation", label: "Провокація", hint: "Непопулярна думка → Аргумент → Нюанс → CTA" },
];

// Тип хука — зберігається як префікс/маркер; текст — у hookA/hookB
export const HOOK_TYPES: Option[] = [
  { id: "question", label: "Питання", hint: "«Чому X не працює?»" },
  { id: "provocation", label: "Провокація", hint: "«Непопулярна думка:…»" },
  { id: "stat", label: "Цифра/статистика", hint: "«N% втрачають…»" },
  { id: "promise", label: "Обіцянка/результат", hint: "«Як досягти X за Y…»" },
  { id: "pain", label: "Біль (дзеркало)", hint: "«Ти відкриваєш… і знову…»" },
  { id: "story", label: "Історія-відкриття", hint: "«Клієнт прийшов з…»" },
  { id: "counter", label: "Контрінтуїція", hint: "«Роби навпаки:…»" },
  { id: "listicle", label: "Лістикл-анонс", hint: "«N способів…»" },
];

// Тип доказу — поле PostGroup.evidenceType
export const EVIDENCE_TYPES: Option[] = [
  { id: "case", label: "Кейс із цифрами" },
  { id: "example", label: "Приклад/демо" },
  { id: "story", label: "Особистий досвід" },
];

export const CONSTRUCTOR_GROUPS = { INTENTS, STRUCTURES, HOOK_TYPES, EVIDENCE_TYPES } as const;

// Мапа WinningPattern.kind → яке поле елемента воно оцінює
export const PATTERN_KIND_BY_ELEMENT: Record<string, string> = {
  intent: "topic", // намір ≈ тематичний патерн
  structure: "structure",
  hookType: "hook",
  evidenceType: "pain", // тип доказу лягає у «pain/evidence» патерн
};
