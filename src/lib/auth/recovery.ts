export const PASSWORD_RECOVERY_PATH = "/restablecer-contrasena";

export function passwordRecoveryRedirect(requestUrl: string | URL) {
  return new URL(PASSWORD_RECOVERY_PATH, requestUrl);
}
