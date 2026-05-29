const store = {}

export function getCache(key) {
  return store[key]
}

export function setCache(key, data) {
  store[key] = data
}

export function clearCache() {
  Object.keys(store).forEach(k => delete store[k])
}
