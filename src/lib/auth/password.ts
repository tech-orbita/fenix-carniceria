export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > PASSWORD_MAX_LENGTH) return "La contraseña no puede superar 72 caracteres.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return undefined;
}
