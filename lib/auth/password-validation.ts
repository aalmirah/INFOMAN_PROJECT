export function validatePasswordPair(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < 6) {
    return "Use a password with at least 6 characters.";
  }
  if (password !== confirmation) {
    return "Passwords do not match.";
  }
  return null;
}
