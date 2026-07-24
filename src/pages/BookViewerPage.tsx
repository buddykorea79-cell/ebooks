import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Book, BookMenu } from '../types/database'
import { fetchBook } from '../api/books'
import { fetchMenus } from '../api/menus'
import { buildMenuTree } from '../lib/menuTree'
import { MARKDOWN_BASE_CSS, renderMarkdown, splitMarkdownSections } from '../lib/markdown'
import ErrorAlert from '../components/ErrorAlert'
import HtmlViewer from '../components/HtmlViewer'
import Sidebar from '../components/Sidebar'
import TypeBadge from '../components/TypeBadge'

export default function BookViewerPage() {
  const { bookId, menuId } = useParams<{ bookId: string; menuId: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [menus, setMenus] = useState<BookMenu[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isSingle = book !== null && (book.source_mode ?? 'menu') === 'single'
  const isMarkdown = book !== null && (book.content_format ?? 'html') === 'markdown'
  // 단일 HTML 파일: 메뉴 없이 전체 화면으로 렌더링
  const isSingleHtml = isSingle && !isMarkdown

  useEffect(() => {
    async function load() {
      if (!bookId) return
      setLoading(true)
      setError(null)
      try {
        const [b, m] = await Promise.all([fetchBook(bookId), fetchMenus(bookId)])
        setBook(b)
        setMenus(m)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`도서를 불러오지 못했습니다: ${msg}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bookId])

  // 단일 마크다운 파일: H1·H2 기준으로 분할한 섹션을 가상 메뉴 트리로 사용
  const virtualMenus = useMemo<BookMenu[] | null>(() => {
    if (!book || !isSingle || !isMarkdown) return null
    return splitMarkdownSections(book.single_content ?? '').map((s, i) => ({
      id: s.id,
      book_id: book.id,
      parent_id: s.parentId,
      title: s.title,
      sort_order: i,
      html_content: s.content,
      updated_at: '',
    }))
  }, [book, isSingle, isMarkdown])

  const effectiveMenus = virtualMenus ?? menus

  // menuId 없이 들어오면 트리상 첫 메뉴로 이동 (단일 HTML 모드는 메뉴가 없으므로 제외)
  useEffect(() => {
    if (isSingleHtml) return
    if (!menuId && bookId && effectiveMenus && effectiveMenus.length > 0) {
      const tree = buildMenuTree(effectiveMenus)
      if (tree.length > 0) {
        navigate(`/book/${bookId}/${tree[0].menu.id}`, { replace: true })
      }
    }
  }, [menuId, bookId, effectiveMenus, isSingleHtml, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
        불러오는 중…
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <ErrorAlert
            message={error ?? '도서를 찾을 수 없습니다. 삭제되었거나 비공개 상태입니다.'}
          />
          <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            ← 홈으로
          </Link>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------
  // 단일 HTML 파일 모드: 좌측 메뉴 없이 상단 바 + 전체 폭 콘텐츠
  // ---------------------------------------------------------------
  if (isSingleHtml) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        {book.custom_css && <style>{book.custom_css}</style>}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
          <Link
            to="/"
            className="shrink-0 rounded border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-100"
          >
            ← 홈
          </Link>
          <TypeBadge type={book.type} />
          {!book.is_published && (
            <span className="inline-block shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              비공개
            </span>
          )}
          <span className="min-w-0 truncate text-sm font-semibold">{book.title}</span>
        </div>
        <main className="bg-white">
          {book.single_content ? (
            <HtmlViewer
              menuId="single"
              html={book.single_content}
              injectedCss={book.css_apply_to_content ? book.custom_css : null}
              minHeight={400}
            />
          ) : (
            <p className="px-6 py-10 text-gray-500">아직 업로드된 콘텐츠가 없습니다.</p>
          )}
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------------
  // 메뉴 구성 모드 + 단일 마크다운 모드(자동 목차): 사이드바 레이아웃
  // ---------------------------------------------------------------
  const activeMenu =
    menuId && effectiveMenus ? (effectiveMenus.find((m) => m.id === menuId) ?? null) : null
  const contentCss =
    [
      isMarkdown ? MARKDOWN_BASE_CSS : '',
      book.css_apply_to_content ? (book.custom_css ?? '') : '',
    ]
      .filter(Boolean)
      .join('\n') || null
  const emptyMessage = isSingle
    ? '아직 업로드된 콘텐츠가 없습니다.'
    : '아직 등록된 메뉴가 없습니다.'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 md:flex">
      {/* custom_css는 뷰어 셸(사이드바·헤더 등)에 항상 주입.
          콘텐츠(iframe) 주입 여부는 css_apply_to_content가 결정한다 */}
      {book.custom_css && <style>{book.custom_css}</style>}

      {/* 모바일 전용 상단 바 */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="목차 열기"
          className="shrink-0 rounded border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          ☰ 목차
        </button>
        <span className="min-w-0 truncate text-sm font-semibold">{book.title}</span>
      </div>

      {/* 모바일 드로어 배경 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바: 모바일=슬라이드 드로어, md 이상=항상 표시 */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:z-auto md:shrink-0 md:translate-x-0 md:transition-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          book={book}
          menus={effectiveMenus ?? []}
          activeMenuId={menuId ?? null}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        {effectiveMenus !== null && effectiveMenus.length === 0 && (
          <p className="text-gray-500">{emptyMessage}</p>
        )}

        {menuId && effectiveMenus !== null && effectiveMenus.length > 0 && !activeMenu && (
          <ErrorAlert message="메뉴를 찾을 수 없습니다. 삭제되었을 수 있습니다." />
        )}

        {activeMenu && (
          <article>
            <h2 className="border-b border-gray-200 pb-3 text-xl font-bold">
              {activeMenu.title}
            </h2>
            <div className="mt-4">
              {activeMenu.html_content ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <HtmlViewer
                    menuId={activeMenu.id}
                    html={
                      isMarkdown ? renderMarkdown(activeMenu.html_content) : activeMenu.html_content
                    }
                    injectedCss={contentCss}
                  />
                </div>
              ) : (
                <p className="text-gray-400">아직 콘텐츠가 없습니다.</p>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  )
}
