import { describe, it, expect } from "vitest";
import { compileBrief, computeAccess, computeReadiness, docMap, parseDoc, DOC, DOC_PREFIX, type BriefInput } from "./sellerBrief";

const doc = (key: string, content: string) => ({ title: DOC_PREFIX + key, content });
const baseConfig = {
  status: "live", mode: "book_consult", sellerName: "Ден", sellerTitle: "ШІ-продавець Олександра Мацука",
  handoffTelegramId: "345126254", bookingUrl: "https://cal.com/x", allowedContacts: "t.me/olexandrmatsuk", testAllowlist: ["111"], texts: {},
};
const full = (): BriefInput => ({
  project: { id: "p1", name: "Олександр" },
  config: { ...baseConfig },
  products: [{ id: "pr1", name: "Розбір процесу", description: "60-90 хв онлайн", price: "2500 грн", audience: "власники бізнесу", priority: 1 }],
  cases: [{ title: "Акти за 30 секунд", niche: "послуги", problem: "20 хв на акт", solution: "кнопка", allowedClaims: "20 хвилин → 30 секунд" }],
  personas: [{ name: "Власник", forbiddenWords: "проблема" }],
  founder: { core: "AI-автоматизатор", interactionStyle: "по-справі" },
  docs: [
    doc(DOC.never, "Що бот не обіцяє: гарантії результату, знижки [підтверджено експертом]"),
    doc(DOC.handoff, "Коли звати людину: скарга, питання про договір [підтверджено експертом]"),
    doc(DOC.qualify, "Що з'ясувати: сфера, скільки людей, скільки годин [підтверджено експертом]"),
  ],
  facts: [],
});

describe("parseDoc", () => {
  it("знімає службові позначки й розпізнає підтвердження", () => {
    const p = parseDoc("Заголовок поля: значення один [підтверджено експертом]\nІнше поле: значення два [з матеріалів, потребує перевірки]");
    expect(p.value).toBe("значення один\nзначення два");
    expect(p.confirmed).toBe(false);
    expect(p.hasUnconfirmed).toBe(true);
  });
  it("усе підтверджено → confirmed", () => {
    expect(parseDoc("Поле: так [підтверджено експертом]").confirmed).toBe(true);
  });
  it("порожній текст → не підтверджено", () => {
    expect(parseDoc("").confirmed).toBe(false);
  });
});

describe("docMap", () => {
  it("ігнорує чужі документи й прибрані експертом", () => {
    const m = docMap([doc(DOC.never, "Прибрано експертом."), { title: "Інше", content: "x" }, doc(DOC.faq, "Питання: a [підтверджено експертом]")]);
    expect(m[DOC.never]).toBeUndefined();
    expect(m[DOC.faq].value).toBe("a");
    expect(Object.keys(m)).toEqual([DOC.faq]);
  });
});

describe("готовність", () => {
  it("повний комплект готовий", () => {
    const b = compileBrief(full());
    expect(b.readiness.ready).toBe(true);
    expect(b.readiness.missing).toEqual([]);
  });
  it("без ціни, пересилання лідів і заборон — не готово", () => {
    const i = full();
    i.products[0].price = "";
    i.config!.handoffTelegramId = "";
    i.docs = [];
    const b = compileBrief(i);
    expect(b.readiness.ready).toBe(false);
    expect(b.readiness.missing).toEqual(expect.arrayContaining(["ціна послуги", "Telegram ID, куди слати гарячих лідів", "що бот ніколи не має обіцяти", "коли передавати розмову людині"]));
  });
  it("титул «ШІ-продавець» без експерта не проходить", () => {
    const i = full(); i.config!.sellerTitle = "ШІ-продавець";
    expect(compileBrief(i).readiness.missing.join()).toMatch(/представляє експерта/);
  });
  it("оплата вперед за замовчуванням заблокована (двигун бере чужий конектор)", () => {
    const i = full(); i.config!.mode = "paid_consult"; i.config!.priceAmount = 100; i.config!.paymentConnectorId = "conn-12345678";
    const b = compileBrief(i);
    expect(b.readiness.ready).toBe(false);
    expect(b.readiness.missing.join()).toMatch(/оплата вперед поки недоступна/);
    expect(b.paymentSupported).toBe(false);
  });
  it("paid_consult вимагає суму й конектор оплати (коли двигун це вміє)", () => {
    const i = full(); i.config!.mode = "paid_consult";
    const miss = compileBrief(i, null, { paidSupported: true }).readiness.missing.join();
    expect(miss).toMatch(/сума оплати/); expect(miss).toMatch(/платіжний конектор/);
    i.config!.priceAmount = 2500; i.config!.paymentConnectorId = "c1";
    expect(compileBrief(i, null, { paidSupported: true }).readiness.ready).toBe(true);
  });
  it("запис описано лише в документі онбордингу — достатньо", () => {
    const i = full(); i.config!.bookingUrl = ""; i.docs.push(doc(DOC.booking, "Запис: пишіть у Telegram [підтверджено експертом]"));
    expect(compileBrief(i).readiness.ready).toBe(true);
  });
  it("у платному режимі відсутність опису запису не блокує", () => {
    const i = full(); i.config!.mode = "paid_consult"; i.config!.priceAmount = 100; i.config!.paymentConnectorId = "conn-12345678"; i.config!.bookingUrl = "";
    const b = compileBrief(i, null, { paidSupported: true });
    expect(b.readiness.ready).toBe(true);
    expect(b.readiness.warnings.join()).toMatch(/як записуються/);
  });
  it("непідтверджені заборони дають попередження, не блок", () => {
    const i = full(); i.docs[0] = doc(DOC.never, "Що не обіцяє: гарантії [з матеріалів, потребує перевірки]");
    const r = computeReadiness(i, docMap(i.docs), i.products[0]);
    expect(r.ready).toBe(true);
    expect(r.warnings.join()).toMatch(/не підтверджено експертом/);
  });
  it("кейс без дозволених формулювань → попередження", () => {
    const i = full(); i.cases[0].allowedClaims = "";
    expect(compileBrief(i).readiness.warnings.join()).toMatch(/дозволені формулювання/);
  });
  it("немає налаштувань взагалі — не готово", () => {
    const i = full(); i.config = null;
    expect(compileBrief(i).readiness.ready).toBe(false);
  });
});

describe("доступ", () => {
  const ready = { ready: true, missing: [], warnings: [] };
  const notReady = { ready: false, missing: ["ціна"], warnings: [] };
  it("live+готово → усім", () => expect(computeAccess("live", ready, [], "5").allowed).toBe(true));
  it("live+не готово → блок, але тестер проходить", () => {
    expect(computeAccess("live", notReady, ["111"], "5").allowed).toBe(false);
    expect(computeAccess("live", notReady, ["111"], "111").allowed).toBe(true);
  });
  it("testing → лише список", () => {
    expect(computeAccess("testing", ready, ["111"], "111").allowed).toBe(true);
    expect(computeAccess("testing", ready, ["111"], "222").allowed).toBe(false);
  });
  it("paused → нікому, навіть тестерам", () => expect(computeAccess("paused", ready, ["111"], "111").allowed).toBe(false));
  it("draft → тільки тестери", () => {
    expect(computeAccess("draft", ready, [], "1").allowed).toBe(false);
    expect(computeAccess("draft", ready, ["1"], "1").allowed).toBe(true);
  });
  it("без telegramId тестовий доступ неможливий", () => expect(computeAccess("testing", ready, ["111"], undefined).allowed).toBe(false));
});

describe("блоки промпту", () => {
  it("правила містять контакти, заборони, чесність щодо ШІ, виклик людини", () => {
    const r = compileBrief(full()).blocks.rules;
    expect(r).toMatch(/t\.me\/olexandrmatsuk/);
    expect(r).toMatch(/гарантії результату/);
    expect(r).toMatch(/Ти ШІ-продавець/);
    expect(r).toMatch(/скарга, питання про договір/);
  });
  it("кейс без дозволених формулювань забороняє цифри", () => {
    const i = full(); i.cases[0].allowedClaims = "";
    expect(compileBrief(i).blocks.proof).toMatch(/ДОЗВОЛЕНИХ ФОРМУЛЮВАНЬ НЕМАЄ/);
  });
  it("кейс з дозволеними формулюваннями їх наводить", () => {
    expect(compileBrief(full()).blocks.proof).toMatch(/ДОЗВОЛЕНО казати: 20 хвилин → 30 секунд/);
  });
  it("без кейсів — заборона вигадувати", () => {
    const i = full(); i.cases = [];
    expect(compileBrief(i).blocks.proof).toMatch(/Не вигадуй прикладів/);
  });
  it("без дозволених контактів — жодних контактів не називати", () => {
    const i = full(); i.config!.allowedContacts = "";
    expect(compileBrief(i).blocks.rules).toMatch(/Жодних контактів експерта не називай/);
  });
  it("блок офера бере ціну з продукту, а не вигадує", () => {
    const o = compileBrief(full()).blocks.offer;
    expect(o).toMatch(/Ціна: 2500 грн/); expect(o).toMatch(/Розбір процесу/);
  });
  it("факти з датами потрапляють у бриф тільки актуальні", () => {
    const i = full();
    i.facts = [
      { title: "Акція", content: "діє", isActive: true, validFrom: null, validUntil: null, supersededAt: null } as never,
      { title: "Стара", content: "не діє", isActive: true, validFrom: null, validUntil: null, supersededAt: new Date("2020-01-01") } as never,
    ];
    const f = compileBrief(i).blocks.facts;
    expect(f).toMatch(/Акція/); expect(f).not.toMatch(/Стара: не діє/);
  });
  it("все разом містить усі блоки, а порожніх розділів немає", () => {
    const a = compileBrief(full()).blocks.all;
    expect(a).toMatch(/ПРО ПОСЛУГУ/); expect(a).toMatch(/КЕЙСИ/); expect(a).toMatch(/ФАКТИ — НІЧОГО НЕ ВИГАДУЙ/); expect(a).toMatch(/ГОЛОС І СТИЛЬ/);
    expect(a).not.toMatch(/\n\n\n/);
  });
});

describe("тексти й імʼя", () => {
  it("привітання складається з імені й титулу", () => {
    const t = compileBrief(full()).texts.greeting;
    expect(t).toMatch(/Я Ден, ШІ-продавець Олександра Мацука/);
    expect(t).toMatch(/Розбір процесу/);
  });
  it("перевизначення тексту з налаштувань діє, порожнє — ні", () => {
    const i = full(); i.config!.texts = { greeting: "Вітаю!", nudge: "  " };
    const t = compileBrief(i).texts;
    expect(t.greeting).toBe("Вітаю!"); expect(t.nudge).toMatch(/Не набридаю/);
  });
  it("імʼя продавця береться з документа онбордингу, якщо в налаштуваннях порожнє", () => {
    const i = full(); i.config!.sellerName = ""; i.docs.push(doc(DOC.name, "Імʼя: Софія [підтверджено експертом]"));
    expect(compileBrief(i).expert.sellerName).toBe("Софія");
  });
  it("розкриття ШІ завжди чесне", () => expect(compileBrief(full()).expert.disclosure).toBe("honest_ai"));
  it("замість готових відповідей бриф дає напрями", () => {
    const d = compileBrief(full()).directions;
    expect(Object.keys(d)).toEqual(expect.arrayContaining(["greeting", "notRelevant", "softExit", "nudge", "direct", "paid", "afterEnd"]));
    expect(d.greeting).toMatch(/^Привітайся/);
    expect(d.greeting).not.toMatch(/^Привіт!/);
  });
  it("напрям з налаштувань замінює типовий, чужі ключі ігноруються", () => {
    const i = full(); i.config!.texts = { greeting: "Привітайся жартома", bogus: "x" };
    const d = compileBrief(i).directions;
    expect(d.greeting).toBe("Привітайся жартома");
    expect(d).not.toHaveProperty("bogus");
  });
  it("часті запитання подаються як напрям, а не готовий текст", () => {
    const i = full(); i.docs.push(doc(DOC.faq, "Питання: дорого? Суть відповіді: порахувати втрати від повільних відповідей [підтверджено експертом]"));
    expect(compileBrief(i).blocks.faq).toMatch(/НАПРЯМ ВІДПОВІДЕЙ/);
  });

  it("контакти експерта є в брифі та в тексті передачі напряму", () => {
    const b = compileBrief(full());
    expect(b.expert.contacts).toBe("t.me/olexandrmatsuk");
    expect(b.texts.direct).toContain("t.me/olexandrmatsuk");
  });
  it("без контактів текст передачі не вигадує їх", () => {
    const i = full(); i.config!.allowedContacts = "";
    expect(compileBrief(i).texts.direct).not.toMatch(/Якщо зручніше самому/);
  });
  it("текст після оплати є за замовчуванням", () => expect(compileBrief(full()).texts.paid).toMatch(/Оплату отримано/));

  it("мітки експерта не дублюються в правилах", () => {
    const i = full();
    i.docs[0] = doc(DOC.never, "Що бот не обіцяє: гарантії результату, знижки " + "[підтверджено експертом]");
    i.docs[1] = doc(DOC.handoff, "Передати розмову Олександру, якщо: скарга, питання про договір [підтверджено експертом]");
    const r = compileBrief(i).blocks.rules;
    expect(r).toContain("ЗАБОРОНЕНО обіцяти/стверджувати: гарантії результату");
    expect(r).toContain("Негайно передай розмову експерту (скажи, що він напише сам), якщо: скарга");
    expect(r).not.toMatch(/Передати розмову Олександру, якщо/);
  });
  it("мітка «Передавати розмову …, коли:» теж прибирається", () => {
    const i = full();
    i.docs[1] = doc(DOC.handoff, "Передавати розмову Олександру, коли: скарга; договір [підтверджено експертом]");
    const r = compileBrief(i).blocks.rules;
    expect(r).toContain("напише сам), якщо: скарга; договір");
  });
  it("стиль не повторюється двічі, якщо профіль експерта дослівно його дублює", () => {
    const i = full();
    i.docs.push(doc(DOC.style, "Стиль: на «ти», жваво [підтверджено експертом]"));
    i.founder = { core: "AI-автоматизатор", interactionStyle: "на «ти», жваво" };
    const tone = compileBrief(i).blocks.tone;
    expect(tone.split("на «ти», жваво").length - 1).toBe(1);
  });
});
