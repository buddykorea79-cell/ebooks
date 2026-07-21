import { supabase } from '../lib/supabase'

/** 도서별 추천 수 → { bookId: count } 맵 */
export async function fetchRecommendCounts(bookIds: string[]): Promise<Record<string, number>> {
  if (bookIds.length === 0) return {}
  const { data, error } = await supabase
    .from('book_recommendations')
    .select('book_id')
    .in('book_id', bookIds)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data as { book_id: string }[]) {
    counts[row.book_id] = (counts[row.book_id] ?? 0) + 1
  }
  return counts
}

/** 내가 추천한 도서 id 집합 */
export async function fetchMyRecommendations(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('book_recommendations')
    .select('book_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data as { book_id: string }[]).map((r) => r.book_id))
}

export async function addRecommendation(bookId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('book_recommendations')
    .insert({ book_id: bookId, user_id: userId })
  if (error) throw error
}

export async function removeRecommendation(bookId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('book_recommendations')
    .delete()
    .eq('book_id', bookId)
    .eq('user_id', userId)
  if (error) throw error
}
