/**
 * Logs apenas em desenvolvimento — em produção não expõe objetos de erro no DevTools.
 */

export const devLog = {
  error(...args) {
    if (import.meta.env.DEV) {
      console.error(...args)
    }
  },
  warn(...args) {
    if (import.meta.env.DEV) {
      console.warn(...args)
    }
  },
}
