// Every admin form runs its inputs through these before calling the API.
// Each validator returns null (valid) or a specific, actionable error
// string - never a generic "invalid input".

export function validateGw(value) {
  if (value === "" || value === null || value === undefined) return "Gameweek is required.";
  const n = Number(value);
  if (!Number.isInteger(n)) return "Gameweek must be a whole number, e.g. 7.";
  if (n < 1 || n > 38) return "Gameweek must be between 1 and 38.";
  return null;
}

export function validateEntryId(value, label = "Entry ID") {
  if (value === "" || value === null || value === undefined) return `${label} is required.`;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return `${label} must be a positive whole number (find it in the manager's FPL team URL).`;
  return null;
}

export function validateRequired(value, label) {
  if (!value || String(value).trim() === "") return `${label} is required.`;
  return null;
}

export function validatePositiveNumber(value, label) {
  if (value === "" || value === null || value === undefined) return `${label} is required.`;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return `${label} must be a positive number.`;
  return null;
}

export function validatePhone(value) {
  if (!value || value.trim() === "") return "Phone number is required.";
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (digitsOnly.length < 8) return "Phone number looks too short - include the country code, e.g. +91 8860570665.";
  return null;
}

// Runs a list of [validatorResult] and returns the first error found, or
// null if everything passed. Usage: firstError([validateGw(gw), validateRequired(name, "Name")])
export function firstError(results) {
  return results.find((r) => r !== null) || null;
}
