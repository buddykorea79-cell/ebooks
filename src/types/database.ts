/** 유형 id (book_types.id). admin.sql 실행 전에는 'book'|'guide'|'manual' 고정 */
export type BookType = string

export interface BookTypeRow {
  id: BookType
  name: string
  sort_order: number
}

/** book_types 테이블이 아직 없을 때 사용하는 기본 유형 (schema.sql의 check 제약과 동일) */
export const DEFAULT_BOOK_TYPES: BookTypeRow[] = [
  { id: 'book', name: '도서', sort_order: 1 },
  { id: 'guide', name: '가이드', sort_order: 2 },
  { id: 'manual', name: '매뉴얼', sort_order: 3 },
]

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Profile {
  id: string
  nickname: string
  /** admin.sql 실행 전에는 컬럼이 없어 undefined */
  is_admin?: boolean
  created_at: string
}

export interface SiteSettings {
  id: number
  recommend_enabled: boolean
}

/** 메뉴 콘텐츠(html_content)를 어떤 형식으로 작성·렌더링할지 */
export type ContentFormat = 'html' | 'markdown'

/** 도서 구성 방식: 메뉴를 직접 구성 / 완성된 파일 하나 업로드 */
export type SourceMode = 'menu' | 'single'

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
  /** content-format.sql 실행 전에는 컬럼이 없어 undefined → 'html'로 간주 */
  content_format?: ContentFormat
  /** single-file.sql 실행 전에는 컬럼이 없어 undefined → 'menu'로 간주 */
  source_mode?: SourceMode
  /** 단일 파일 모드의 원문 (HTML 또는 마크다운) */
  single_content?: string | null
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
