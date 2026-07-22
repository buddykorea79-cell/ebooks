import { supabase } from '../lib/supabase'
import type { Book, BookType, ContentFormat } from '../types/database'

export interface BookInput {
  category_id: string | null
  type: BookType
  title: string
  description?: string | null
  content_format?: ContentFormat
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
  is_published?: boolean
}

/** content-format.sql 실행 전 DB에는 컬럼이 없어 저장이 통째로 실패하므로, 해당 필드만 빼고 재시도 */
function isMissingContentFormatColumn(error: { message?: string } | null): boolean {
  return typeof error?.message === 'string' && error.message.includes('content_format')
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
    if (isMissingContentFormatColumn(error) && input.content_format !== undefined) {
      const { content_format: _omit, ...rest } = input
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
    if (isMissingContentFormatColumn(error) && patch.content_format !== undefined) {
      const { content_format: _omit, ...rest } = patch
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
