// Supabase returns at most 1000 rows per request. This walks the result in
// pages so callers get every row. `build` must return a fresh query each call
// and should include a deterministic order (add `id` as a tie-breaker).
export async function fetchAll(build, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}
