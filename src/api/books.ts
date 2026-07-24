import { supabase } from '../lib/supabase'
import type { Book, BookType, ContentFormat, SourceMode } from '../types/database'

export interface BookInput {
  category_id: string | null
  type: BookType
  title: string
  description?: string | null
  content_format?: ContentFormat
  source_mode?: SourceMode
  is_published?: boolean
}

export interface BookPatch {
  category_id?: string | null
  type?: BookType
  title?: string
  description?: string | null
  cover_url?: string | null
  custom_css?: string | null
  css_apply_to_content?: boolean
  content_format?: ContentFormat
  source_mode?: SourceMode
  single_content?: string | null
  is_published?: boolean
}

/** 마이그레이션(content-format.sql, single-file.sql) 전 DB에는 없는 컬럼들 */
const OPTIONAL_BOOK_COLUMNS = ['content_format', 'source_mode', 'single_content'] as const

/**
 * 컬럼 누락 에러면 신규 컬럼만 뺀 재시도용 행을 돌려준다.
 * 재시도할 게 남지 않거나 무관한 에러면 null (원래 에러를 던질 것).
 */
function stripOptionalColumns(
  row: BookInput | BookPatch,
  error: { message?: string } | null,
): Record<string, unknown> | null {
  const msg = typeof error?.message === 'string' ? error.message : ''
  if (!OPTIONAL_BOOK_COLUMNS.some((c) => msg.includes(c))) return null
  const rest: Record<string, unknown> = { ...row }
  let changed = false
  for (const c of OPTIONAL_BOOK_COLUMNS) {
    if (c in rest) {
      delete rest[c]
      changed = true
    }
  }
  if (!changed || Object.keys(rest).length === 0) return null
  return rest
}

/** 공개된 도서 목록 (홈). type을 주면 해당 유형만 필터 */
export async function fetchPublishedBooks(type?: BookType): Promise<Book[]> {
  let query = supabase
    .from('books')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  if (type) query = query.eq('type', type)
  const { data, error } = await query
  if (error) throw error
  return data as Book[]
}

/** 내 도서 전체 (비공개 포함) */
export async function fetchMyBooks(): Promise<Book[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Book[]
}

export async function fetchBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Book | null
}

export async function createBook(input: BookInput): Promise<Book> {
  const { data, error } = await supabase.from('books').insert(input).select().single()
  if (error) {
    const rest = stripOptionalColumns(input, error)
    if (rest) {
      const retry = await supabase.from('books').insert(rest).select().single()
      if (retry.error) throw retry.error
      return retry.data as Book
    }
    throw error
  }
  return data as Book
}

export async function updateBook(id: string, patch: BookPatch): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    const rest = stripOptionalColumns(patch, error)
    if (rest) {
      const retry = await supabase.from('books').update(rest).eq('id', id).select().single()
      if (retry.error) throw retry.error
      return retry.data as Book
    }
    throw error
  }
  return data as Book
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}
