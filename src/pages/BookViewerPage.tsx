import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Book, BookMenu } from '../types/database'
import { fetchBook } from '../api/books'
import { fetchMenus } from '../api/menus'
import { buildMenuTree } from '../lib/menuTree'
import { MARKDOWN_BASE_CSS, renderMarkdown } from '../lib/markdown'
import ErrorAlert from '../components/ErrorAlert'
import HtmlViewer from '../components/HtmlViewer'
import Sidebar from '../components/Sidebar'

export default function BookViewerPage() {
  const { bookId, menuId } = useParams<{ bookId: string; menuId: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [menus, setMenus] = useState<BookMenu[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  // menuId 없이 들어오면 트리상 첫 메뉴로 이동
  useEffect(() => {
    if (!menuId && bookId && menus && menus.length > 0) {
      const tree = buildMenuTree(menus)
      if (tree.length > 0) {
        navigate(`/book/${bookId}/${tree[0].menu.id}`, { replace: true })
      }
    }
  }, [menuId, bookId, menus, navigate])

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

  const activeMenu = menuId && menus ? (menus.find((m) => m.id === menuId) ?? null) : null
  const isMarkdown = (book.content_format ?? 'html') === 'markdown'
  const contentCss =
    [
      isMarkdown ? MARKDOWN_BASE_CSS : '',
      book.css_apply_to_content ? (book.custom_css ?? '') : '',
    ]
      .filter(Boolean)
      .join('\n') || null

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
          menus={menus ?? []}
          activeMenuId={menuId ?? null}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        {menus !== null && menus.length === 0 && (
          <p className="text-gray-500">아직 등록된 메뉴가 없습니다.</p>
        )}

        {menuId && menus !== null && menus.length > 0 && !activeMenu && (
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
