export type BookType = 'book' | 'guide' | 'manual'

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  book: '도서',
  guide: '가이드',
  manual: '매뉴얼',
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Book {
  id: string
  category_id: string | null
  owner_id: string
  type: BookType
  title: string
  description: string | null
  cover_url: string | null
  custom_css: string | null
  css_apply_to_content: boolean
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface BookMenu {
  id: string
  book_id: string
  parent_id: string | null
  title: string
  sort_order: number
  html_content: string | null
  updated_at: string
}
