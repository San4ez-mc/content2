import { describe, it, expect } from "vitest";
import { sanitizeConfigInput } from "./sellerConfigInput";

const ok = (b: Record<string, unknown>) => { const r = sanitizeConfigInput(b); if (!r.ok) throw new Error(r.error); return r.data; };
const err = (b: Record<string, unknown>) => { const r = sanitizeConfigInput(b); return r.ok ? "" : r.error; };

describe("sanitizeConfigInput", () => {
  it("приймає коректні значення й обрізає пробіли", () => {
    const d = ok({ status: "testing", mode: "paid_consult", sellerName: "  Ден ", handoffTelegramId: "345126254", bookingUrl: "https://cal.com/x", priceAmount: "2500", currency: "uah", monthlyDialogLimit: 300 });
    expect(d).toMatchObject({ status: "testing", mode: "paid_consult", sellerName: "Ден", handoffTelegramId: "345126254", bookingUrl: "https://cal.com/x", priceAmount: 2500, currency: "UAH", monthlyDialogLimit: 300 });
  });
  it("не чіпає поля, яких нема у запиті", () => expect(Object.keys(ok({ sellerName: "Ден" }))).toEqual(["sellerName"]));
  it("відхиляє невідомий статус і режим", () => { expect(err({ status: "go" })).toMatch(/status/); expect(err({ mode: "free" })).toMatch(/mode/); });
  it("посилання на запис: лише http(s), без javascript:", () => {
    expect(err({ bookingUrl: "javascript:alert(1)" })).toMatch(/http/);
    expect(err({ bookingUrl: "ftp://x" })).toMatch(/http/);
    expect(ok({ bookingUrl: "" }).bookingUrl).toBeNull();
  });
  it("Telegram ID лише числовий", () => {
    expect(err({ handoffTelegramId: "@olexandr" })).toMatch(/числом/);
    expect(err({ handoffTelegramId: "123" })).toMatch(/числом/);
    expect(ok({ handoffTelegramId: "" }).handoffTelegramId).toBeNull();
  });
  it("сума й ліміт: цілі числа в межах", () => {
    expect(err({ priceAmount: "12.5" })).toMatch(/цілим/);
    expect(err({ priceAmount: -1 })).toMatch(/цілим/);
    expect(ok({ priceAmount: "" }).priceAmount).toBeNull();
    expect(err({ monthlyDialogLimit: 0 })).toMatch(/Ліміт/);
  });
  it("тестери: рядок через кому розбирається, дублі прибираються, нечислові відхиляються", () => {
    expect(ok({ testAllowlist: "11111, 22222;11111" }).testAllowlist).toEqual(["11111", "22222"]);
    expect(err({ testAllowlist: ["abc"] })).toMatch(/числові/);
  });
  it("тексти: лише відомі ключі, порожні прибираються", () => {
    expect(ok({ texts: { greeting: " Привіт ", nudge: "" } }).texts).toEqual({ greeting: "Привіт" });
    expect(err({ texts: { evil: "x" } })).toMatch(/Невідомий ключ/);
  });
  it("валюта лише зі списку; конектор без сміття", () => {
    expect(err({ currency: "BTC" })).toMatch(/Валюта/);
    expect(err({ paymentConnectorId: "a b; drop" })).toMatch(/конектора/);
  });
});

import { prefillPatch } from "./sellerConfigInput";
describe("prefillPatch", () => {
  it("заповнює порожні поля", () => {
    expect(prefillPatch(null, { sellerName: "Ден", sellerTitle: "ШІ-продавець Олександра", handoffTelegramId: "345126254" }))
      .toEqual({ sellerName: "Ден", sellerTitle: "ШІ-продавець Олександра", handoffTelegramId: "345126254" });
  });
  it("не перезаписує те, що вже заповнено", () => {
    expect(prefillPatch({ sellerName: "Софія", bookingNote: "" }, { sellerName: "Ден", bookingNote: "пишіть у Telegram" })).toEqual({ bookingNote: "пишіть у Telegram" });
  });
  it("пропускає невалідне, решту приймає", () => {
    const p = prefillPatch({}, { handoffTelegramId: "@olexandr", bookingUrl: "javascript:alert(1)", allowedContacts: "t.me/olexandrmatsuk" });
    expect(p).toEqual({ allowedContacts: "t.me/olexandrmatsuk" });
  });
  it("статус, режим, оплату й тестерів не чіпає", () => {
    expect(prefillPatch({}, { status: "live", mode: "paid_consult", priceAmount: 100, paymentConnectorId: "abcdefgh12", testAllowlist: ["12345"], sellerName: "Ден" })).toEqual({ sellerName: "Ден" });
  });
  it("порожні значення ігнорує", () => expect(prefillPatch({}, { sellerName: "  ", bookingNote: null })).toEqual({}));
});
