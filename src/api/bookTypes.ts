import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BookTypeRow } from '../types/database'
import { DEFAULT_BOOK_TYPES } from '../types/database'

export async function fetchBookTypes(): Promise<BookTypeRow[]> {
  const { data, error } = await supabase
    .from('book_types')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as BookTypeRow[]
}

export async function createBookType(id: string, name: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('book_types')
    .insert({ id, name, sort_order: sortOrder })
  if (error) throw error
}

export async function updateBookType(
  id: string,
  patch: { name?: string; sort_order?: number },
): Promise<void> {
  const { error } = await supabase.from('book_types').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteBookType(id: string): Promise<void> {
  const { error } = await supabase.from('book_types').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------
// 화면 곳곳(배지, 폼)에서 유형 목록이 필요하므로 모듈 캐시로 1회만 조회.
// book_types 테이블이 아직 없으면 기본 3종으로 대체(fail-soft).
// ---------------------------------------------------------------

let cache: BookTypeRow[] | null = null
let inflight: Promise<BookTypeRow[]> | null = null

function loadBookTypesOnce(): Promise<BookTypeRow[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetchBookTypes()
      .then((rows) => {
        cache = rows.length > 0 ? rows : DEFAULT_BOOK_TYPES
        return cache
      })
      .catch(() => {
        inflight = null // 실패 시 다음 마운트에서 재시도
        return DEFAULT_BOOK_TYPES
      })
  }
  return inflight
}

/** 관리자 페이지에서 유형 변경 후 캐시를 비워 다른 화면이 새로 읽게 함 */
export function invalidateBookTypesCache(): void {
  cache = null
  inflight = null
}

export function useBookTypes(): BookTypeRow[] {
  const [types, setTypes] = useState<BookTypeRow[]>(cache ?? DEFAULT_BOOK_TYPES)
  useEffect(() => {
    let cancelled = false
    loadBookTypesOnce().then((rows) => {
      if (!cancelled) setTypes(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return types
}
