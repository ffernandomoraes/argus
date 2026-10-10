// Igualdade rasa, para o `isEqual` do useStore: listas, Map, Set e objetos simples são iguais
// quando têm os mesmos itens (comparados com Object.is), um nível só. Qualquer outro objeto
// (Date, classes, o Text do CodeMirror) só é igual a ele mesmo.
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => Object.is(item, b[i]))
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false
    for (const [key, value] of a) if (!b.has(key) || !Object.is(value, b.get(key))) return false
    return true
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false
    for (const item of a) if (!b.has(item)) return false
    return true
  }
  if (!isPlain(a) || !isPlain(b)) return false

  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  return keys.every((key) => Object.hasOwn(y, key) && Object.is(x[key], y[key]))
}

function isPlain(value: object): boolean {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
