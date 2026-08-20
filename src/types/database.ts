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
  /** 그룹리더 여부. groups.sql 실행 전에는 컬럼이 없어 undefined */
  is_group_leader?: boolean
  /** AI 작성 도우미 사용 허용 여부. ai-assist.sql 실행 전에는 컬럼이 없어 undefined → 미허용 */
  ai_enabled?: boolean
  created_at: string
}

/** 그룹 설명 최대 길이 (groups.sql의 check 제약과 동일) */
export const MAX_GROUP_DESCRIPTION_LENGTH = 100

/** 회원이 소속될 수 있는 그룹 (groups.sql) */
export interface Group {
  id: string
  name: string
  /** 그룹 설명(선택, 최대 100자). description 컬럼 추가 전에는 undefined */
  description?: string | null
  leader_id: string
  created_at: string
}

/** 그룹 소속 (groups.sql) */
export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
}

/** 그룹당 회원가입 시 선택 가능한 최대 그룹 수 */
export const MAX_GROUPS_PER_MEMBER = 3

/** 그룹리더가 만드는 프로젝트(과제 게시판) (projects.sql) */
export interface Project {
  id: string
  group_id: string
  title: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

/** 프로젝트 게시판에 올라오는 제출물 (projects.sql) */
export interface ProjectPost {
  id: string
  project_id: string
  author_id: string
  title: string
  content: string | null
  image_url: string | null
  video_url: string | null
  link_url: string | null
  link_title: string | null
  link_description: string | null
  link_image: string | null
  created_at: string
  updated_at: string
}

/** 프로젝트 게시글에 첨부된 파일 (projects.sql) */
export interface ProjectPostFile {
  id: string
  post_id: string
  url: string
  name: string
  size: number | null
  created_at: string
}

/** 회원별 AI 사용량 (ai_usage_summary 뷰) */
export interface AiUsageSummary {
  user_id: string
  request_count: number
  /** 누적 원화 비용 (BizRouter usage.cost 합계) */
  total_cost: number
  last_used_at: string | null
}

/**
 * 홈 도서 목록 구성 방식
 * - latest: 최신순 한 목록
 * - recommended: 추천순 한 목록 (동점이면 최신순)
 * - both: '추천 도서' 섹션 + '최신 도서' 섹션 2단
 */
export type HomeLayout = 'latest' | 'recommended' | 'both'

export const HOME_LAYOUT_LABELS: Record<HomeLayout, string> = {
  latest: '최신순',
  recommended: '추천순',
  both: '추천 + 최신 2단',
}

export interface SiteSettings {
  id: number
  recommend_enabled: boolean
  /** home-layout.sql 실행 전에는 컬럼이 없어 undefined → 'latest'로 간주 */
  home_layout?: HomeLayout
  home_featured_count?: number
  /**
   * 한 번에 올릴 수 있는 파일 최대 크기(MB) — HTML · MD · PDF 공통.
   * upload-limits.sql 실행 전에는 컬럼이 없어 undefined
   */
  upload_max_mb?: number
  /**
   * @deprecated upload_max_mb로 통합됨. upload-limits.sql 실행 전 배포본을 위해
   * 값을 읽을 때만 예비로 참고한다 (저장은 upload_max_mb로만 한다)
   */
  pdf_max_mb?: number
  /** EduTalk(교육생과 대화하기) 주소. 비어 있으면 홈에 버튼을 감춘다 */
  edutalk_url?: string | null
}

/** 업로드 최대 크기 선택지 (관리자 화면) */
export const UPLOAD_MAX_MB_OPTIONS = [10, 20, 50, 100, 200, 300] as const

/** upload-limits.sql 실행 전 기본값 */
export const DEFAULT_UPLOAD_MAX_MB = 50

/**
 * 설정에서 업로드 상한(MB)을 꺼낸다.
 * upload-limits.sql 실행 전이면 예전 pdf_max_mb를, 그것도 없으면 기본값을 쓴다.
 */
export function resolveUploadMaxMb(settings: SiteSettings | null | undefined): number {
  const raw = settings?.upload_max_mb ?? settings?.pdf_max_mb
  return typeof raw === 'number' && raw > 0 ? raw : DEFAULT_UPLOAD_MAX_MB
}

/** 메뉴 콘텐츠(html_content)를 어떤 형식으로 작성·렌더링할지 */
export type ContentFormat = 'html' | 'markdown'

/** 도서 구성 방식: 메뉴를 직접 구성 / 완성된 HTML·MD 파일 하나 / PDF 한 개 */
export type SourceMode = 'menu' | 'single' | 'pdf'

/** 도서 공개 범위: 공개 / 비공개 / 그룹공개 */
export type BookVisibility = 'public' | 'private' | 'group'

export const BOOK_VISIBILITY_LABELS: Record<BookVisibility, string> = {
  public: '공개',
  private: '비공개',
  group: '그룹공개',
}

/**
 * book-visibility.sql 실행 전에는 visibility 컬럼이 없으므로
 * is_published로 공개/비공개만 대신 판정한다.
 */
export function resolveBookVisibility(book: Pick<Book, 'visibility' | 'is_published'>): BookVisibility {
  return book.visibility ?? (book.is_published ? 'public' : 'private')
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
  /** content-format.sql 실행 전에는 컬럼이 없어 undefined → 'html'로 간주 */
  content_format?: ContentFormat
  /** single-file.sql 실행 전에는 컬럼이 없어 undefined → 'menu'로 간주 */
  source_mode?: SourceMode
  /**
   * 공개 범위. book-visibility.sql 실행 전에는 컬럼이 없어 undefined →
   * is_published 값으로 공개/비공개만 간주한다.
   */
  visibility?: BookVisibility
  /** 그룹공개일 때 어느 그룹에 공개할지. book-visibility.sql 실행 전에는 undefined */
  group_id?: string | null
  /**
   * 단일 파일 모드의 파일 주소 (Cloudflare R2). upload-limits.sql 실행 전에는 undefined.
   * PDF와 같은 구조로, 파일 본체는 R2에 있고 DB에는 주소만 둔다.
   */
  single_url?: string | null
  single_name?: string | null
  single_size?: number | null
  /**
   * @deprecated R2 업로드(single_url)로 대체됨.
   * 예전에 본문을 DB에 직접 넣어 둔 도서를 계속 열기 위해 남겨 둔다.
   */
  single_content?: string | null
  /** PDF 모드의 파일 주소 (Cloudflare R2). pdf-mode.sql 실행 전에는 컬럼이 없어 undefined */
  pdf_url?: string | null
  pdf_name?: string | null
  pdf_size?: number | null
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
