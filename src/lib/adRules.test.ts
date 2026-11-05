import { describe, it, expect } from "vitest";
import { scanAd, formatAdContent, AD_CTA_BUTTONS } from "./adRules";

const good = {
  primary: "Заявки приходять уночі, а відповідаєте ви зранку. Покажу, як це закрити без нового працівника.",
  headline: "Розбір вашого процесу за годину",
  description: "Без підготовки",
  cta: "Записатися",
  link: "https://example.com/consult?utm_source=facebook",
  overlayTitle: "Заявки не губляться вночі",
  overlaySub: "Покажу, як це налаштувати",
  aspect: "4:5",
};
const types = (a: any, o?: any) => scanAd(a, o).map((v) => v.type);

describe("scanAd (гейт рекламного креативу)", () => {
  it("нормальний креатив проходить", () => {
    expect(scanAd(good)).toEqual([]);
  });
  it("ліміти: заголовок > 40, опис > 30, текст на картинці", () => {
    expect(types({ ...good, headline: "а".repeat(41) })).toContain("headline_long");
    expect(types({ ...good, description: "а".repeat(31) })).toContain("description_long");
    expect(types({ ...good, overlayTitle: "один два три чотири п'ять шість сім вісім дев'ять" })).toContain("overlay_title_long");
  });
  it("суть має вкластися в перші 125 символів першого рядка", () => {
    expect(types({ ...good, primary: "а".repeat(140) })).toContain("hook_hidden");
  });
  it("кнопка лише зі списку, посилання обов'язкове", () => {
    expect(types({ ...good, cta: "Купуй зараз" })).toContain("bad_cta");
    expect(types({ ...good, link: "" })).not.toContain("no_link"); // посилання додають у кабінеті Meta
    expect(types({ ...good, link: "" }, { requireLink: true })).toContain("no_link");
    expect(types({ ...good, link: "ftp://x" })).toContain("bad_link");
    for (const b of AD_CTA_BUTTONS) expect(types({ ...good, cta: b })).not.toContain("bad_cta");
  });
  it("політика Meta: гарантії, доходи, назва мережі, особисті ознаки", () => {
    expect(types({ ...good, primary: "Гарантуємо результат за тиждень." })).toContain("policy");
    expect(types({ ...good, headline: "100% окупність" })).toContain("policy");
    expect(types({ ...good, primary: "Ми працюємо в Instagram, дивіться." })).toContain("policy");
    expect(types({ ...good, primary: "Ви втомилися від боргів? Є вихід." })).toContain("policy");
    expect(types({ ...good, primary: "Ти у боргах і самотній?" })).toContain("policy");
  });
  it("ситуація замість особи — проходить", () => {
    expect(scanAd({ ...good, primary: "Повідомлення клієнтів губляться між чатами. Покажу, як зібрати їх в одному місці." })).toEqual([]);
  });
  it("жаргон ловиться на кирилиці (межі слів)", () => {
    expect(types({ ...good, primary: "Побудуємо воронку для вашого бізнесу." })).toContain("jargon");
    expect(types({ ...good, primary: "Збільшимо конверсію у заявки." })).toContain("jargon");
    expect(types({ ...good, primary: "Нові ліди щодня." })).toContain("jargon");
    // «лідер» — інше слово, не жаргон
    expect(types({ ...good, primary: "Лідер ринку радить: не втрачайте дзвінки." })).not.toContain("jargon");
  });
  it("тон: КАПС, оклики, емодзі", () => {
    expect(types({ ...good, primary: "ТЕРМІНОВО ПОДИВІТЬСЯ ЦЕ відео" })).toContain("caps");
    expect(types({ ...good, primary: "Дивись! Це круто! Не пропусти!" })).toContain("exclamation");
    expect(types({ ...good, primary: "Заявки 🔥🚀✨ не губляться" })).toContain("emoji");
  });
  it("стандарт письма діє й тут (стоп-слова)", () => {
    expect(types({ ...good, primary: "Слід зазначити, що заявки губляться." })).toContain("banned_word");
  });
});

describe("formatAdContent", () => {
  it("збирає блок для Ads Manager", () => {
    const t = formatAdContent(good);
    expect(t).toContain("Основний текст:");
    expect(t).toContain("Заголовок: Розбір вашого процесу за годину");
    expect(t).toContain("Кнопка: Записатися");
    expect(t).toContain("Текст на картинці: Заявки не губляться вночі / Покажу, як це налаштувати");
  });
});
