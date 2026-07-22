import { supabase } from '../lib/supabase'
import type { Book } from '../types/database'

/** 본문(메뉴) 검색 결과 한 건 — 스니펫 생성용 원문 포함 */
export interface MenuHit {
  menuId: string
  menuTitle: string
  bookId: string
  bookTitle: string
  content: string | null
}

const LIMIT = 30

/** ilike 패턴에서 와일드카드로 해석되는 문자를 이스케이프 */
function likePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
}

/**
 * 공개 도서 검색 (제목 또는 설명).
 * .or() 문자열은 쉼표·괄호가 섞인 검색어에 취약하므로 쿼리를 나눠 합친다.
 */
export async function searchBooks(q: string): Promise<Book[]> {
  const pattern = likePattern(q)
  const base = () =>
    supabase.from('books').select('*').eq('is_published', true).limit(LIMIT)
  const [byTitle, byDesc] = await Promise.all([
    base().ilike('title', pattern),
    base().ilike('description', pattern),
  ])
  if (byTitle.error) throw byTitle.error
  if (byDesc.error) throw byDesc.error
  const seen = new Set<string>()
  const merged: Book[] = []
  for (const row of [...(byTitle.data as Book[]), ...(byDesc.data as Book[])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id)
      merged.push(row)
    }
  }
  return merged.slice(0, LIMIT)
}

interface MenuRow {
  id: string
  title: string
  book_id: string
  html_content: string | null
  books: { title: string } | null
}

/** 공개 도서의 메뉴 검색 (메뉴 제목 또는 본문 내용) */
export async function searchMenus(q: string): Promise<MenuHit[]> {
  const pattern = likePattern(q)
  const base = () =>
    supabase
      .from('book_menus')
      .select('id, title, book_id, html_content, books!inner(title, is_published)')
      .eq('books.is_published', true)
      .limit(LIMIT)
  const [byTitle, byContent] = await Promise.all([
    base().ilike('title', pattern),
    base().ilike('html_content', pattern),
  ])
  if (byTitle.error) throw byTitle.error
  if (byContent.error) throw byContent.error
  const seen = new Set<string>()
  const merged: MenuHit[] = []
  for (const row of [
    ...(byTitle.data as unknown as MenuRow[]),
    ...(byContent.data as unknown as MenuRow[]),
  ]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push({
      menuId: row.id,
      menuTitle: row.title,
      bookId: row.book_id,
      bookTitle: row.books?.title ?? '',
      content: row.html_content,
    })
  }
  return merged.slice(0, LIMIT)
}
