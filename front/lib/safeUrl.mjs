/**
 * Devolve a URL somente se for absoluta http(s); caso contrário, ''.
 * Use em qualquer href/src que venha da API ou da URL da página
 * (impede javascript:, data:, vbscript: etc.).
 */
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
