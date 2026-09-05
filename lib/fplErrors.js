export const FPL_DOWN_MARKER = "FPL_TEMPORARILY_UNAVAILABLE";

export function isFplDownError(message) {
  return typeof message === "string" && message.includes(FPL_DOWN_MARKER);
}
