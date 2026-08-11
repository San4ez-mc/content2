// Ваги реакцій для балу ефективності поста (E2). Конфіг — можна міняти.
// Продаж важить найбільше, перегляд — найменше.
export const SCORE_WEIGHTS: Record<string, number> = {
  views: 0.1, likes: 1, comments: 2, saves: 3, shares: 3, subscribes: 5, sales: 10,
};

export const REACTION_KEYS = Object.keys(SCORE_WEIGHTS);

// Зважений загальний бал з набору реакцій.
export function computeScore(reactions: Record<string, unknown>): number {
  let total = 0;
  for (const k of REACTION_KEYS) total += (Number(reactions[k]) || 0) * SCORE_WEIGHTS[k];
  return Math.round(total * 10) / 10;
}

// Нормалізований обʼєкт scores для збереження у PostGroup.scores.
export function buildScores(reactions: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of REACTION_KEYS) out[k] = Number(reactions[k]) || 0;
  out.total = computeScore(reactions);
  return out;
}
