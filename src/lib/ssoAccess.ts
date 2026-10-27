// Доступи content2 з SSO (27.10, рішення власника: «SSO єдине джерело правди по доступах»).
// Хто, до яких проєктів і з якою роллю — вирішує SSO (Access.product = "content2"); content2 більше не тримає власних списків для тих,
// хто входить через SSO. Читаємо через /oauth/permissions і коротко кешуємо (відкликання доступу діє за хвилину, а не через 30 днів сесії).
// SSO недоступний: ще годину працюємо зі старою відповіддю, далі доступ закритий (безпека важливіша за зручність).

const SSO_URL = process.env.SSO_URL || "http://localhost:4600";
const PRODUCT = "content2";
const FRESH_MS = 45_000;
const STALE_MS = 60 * 60_000;

export type SsoAccess = { role: string; projectIds: string[]; pageIds: string[]; canEdit: boolean };

/** Власники (bootstrap): як у SSO, завжди суперадміни, щоб не втратити доступ, якщо запис у SSO зник. */
export const OWNER_EMAILS = (process.env.SSO_OWNER_EMAILS || "olexandrmatsuk@gmail.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isOwnerEmail = (email?: string | null) => !!email && OWNER_EMAILS.includes(email.toLowerCase());

const cache = new Map<string, { at: number; v: SsoAccess }>();

export async function fetchSsoAccess(ssoUserId: string): Promise<SsoAccess | null> {
  const hit = cache.get(ssoUserId);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.v;
  try {
    const r = await fetch(`${SSO_URL}/oauth/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.SSO_CLIENT_ID, client_secret: process.env.SSO_CLIENT_SECRET, userId: ssoUserId, product: PRODUCT }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = (await r.json()) as Partial<SsoAccess>;
    const v: SsoAccess = {
      role: String(j.role || "none"),
      projectIds: Array.isArray(j.projectIds) ? j.projectIds.map(String) : [],
      pageIds: Array.isArray(j.pageIds) ? j.pageIds.map(String) : [],
      canEdit: j.canEdit !== false,
    };
    cache.set(ssoUserId, { at: Date.now(), v });
    return v;
  } catch {
    return hit && Date.now() - hit.at < STALE_MS ? hit.v : null;
  }
}

/** Права людини в content2 за SSO: global = бачить усі проєкти й адмінку; інакше лише projectIds. */
export async function ssoAccessOf(ssoUserId: string, email?: string | null): Promise<{ global: boolean; projectIds: string[]; canEdit: boolean }> {
  if (isOwnerEmail(email)) return { global: true, projectIds: [], canEdit: true };
  const a = await fetchSsoAccess(ssoUserId);
  if (!a || a.role === "none") return { global: false, projectIds: [], canEdit: true };
  if (a.role === "superadmin") return { global: true, projectIds: [], canEdit: true };
  return { global: false, projectIds: a.projectIds, canEdit: a.canEdit };
}
