/**
 * Shared email + password validation. Client-side UX gate (the backend also
 * validates on signup). Keep this the single source of truth so every screen
 * (SignUp, Login, ForgotPassword, Settings) applies identical rules.
 */

// A stricter "is this a plausible real email" check than the old
// /^[^\s@]+@[^\s@]+\.[^\s@]+$/ (which accepted junk like "a@b.c"). Requires a
// proper local part, a domain, and a 2+ letter TLD; rejects consecutive dots,
// leading/trailing dots or dashes on the domain, and over-long values.
export const isValidEmail = (email) => {
  if (!email) return false;
  const e = String(email).trim();
  if (e.length > 254) return false;
  if (e.includes('..')) return false;
  const re = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  if (!re.test(e)) return false;
  const [local, domain] = e.split('@');
  if (!local || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
};

// Password strength rules — shown live to the user and enforced on submit.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
];

export const passwordChecks = (password = '') =>
  PASSWORD_RULES.map((r) => ({ key: r.key, label: r.label, ok: r.test(password) }));

export const isValidPassword = (password = '') => PASSWORD_RULES.every((r) => r.test(password));

// First unmet rule's label (for a single-line error), or null when valid.
export const firstPasswordProblem = (password = '') => {
  const bad = PASSWORD_RULES.find((r) => !r.test(password));
  return bad ? bad.label : null;
};
