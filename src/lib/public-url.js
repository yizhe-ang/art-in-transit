const BASE_URL = import.meta.env.BASE_URL ?? "/"

export function publicUrl(path) {
  const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path

  return `${base}${normalizedPath}`
}
