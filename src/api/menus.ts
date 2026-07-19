import { supabase } from '../lib/supabase'
import type { BookMenu } from '../types/database'

export interface MenuInput {
  book_id: string
  parent_id?: string | null
  title: string
  sort_order?: number
}

export interface MenuPatch {
  parent_id?: string | null
  title?: string
  sort_order?: number
  html_content?: string | null
}

/** 도서의 전체 메뉴 (트리 구성은 클라이언트에서 parent_id + sort_order로) */
export async function fetchMenus(bookId: string): Promise<BookMenu[]> {
  const { data, error } = await supabase
    .from('book_menus')
    .select('*')
    .eq('book_id', bookId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as BookMenu[]
}

export async function createMenu(input: MenuInput): Promise<BookMenu> {
  const { data, error } = await supabase.from('book_menus').insert(input).select().single()
  if (error) throw error
  return data as BookMenu
}

export async function updateMenu(id: string, patch: MenuPatch): Promise<BookMenu> {
  const { data, error } = await supabase
    .from('book_menus')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as BookMenu
}

/** 이동/들여쓰기/내어쓰기로 생긴 위치 변경분을 일괄 반영 */
export async function updateMenuPositions(
  updates: { id: string; parent_id: string | null; sort_order: number }[],
): Promise<void> {
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from('book_menus')
        .update({ parent_id: u.parent_id, sort_order: u.sort_order })
        .eq('id', u.id),
    ),
  )
  for (const { error } of results) {
    if (error) throw error
  }
}

/** 하위 메뉴는 DB의 on delete cascade로 함께 삭제됨 */
export async function deleteMenu(id: string): Promise<void> {
  const { error } = await supabase.from('book_menus').delete().eq('id', id)
  if (error) throw error
}
