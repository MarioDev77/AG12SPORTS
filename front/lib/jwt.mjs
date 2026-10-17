/**
 * Lê só o campo `exp` (em ms) de um JWT, para agendar o logout automático.
 * NÃO valida assinatura — quem valida o token é sempre o servidor.
 * Devolve 0 se o token for ilegível ou não tiver exp numérico.
 */
export function jwtExpiryMs(token) {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(part)).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}
