import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Book, BookMenu } from '../types/database'
import { fetchBook } from '../api/books'
import { fetchMenus } from '../api/menus'
import { buildMenuTree } from '../lib/menuTree'
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

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* custom_css는 뷰어 셸(사이드바·헤더 등)에 항상 주입.
          콘텐츠(iframe) 주입 여부는 css_apply_to_content가 결정한다 */}
      {book.custom_css && <style>{book.custom_css}</style>}
      <Sidebar book={book} menus={menus ?? []} activeMenuId={menuId ?? null} />
      <main className="min-w-0 flex-1 px-6 py-5">
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
                    html={activeMenu.html_content}
                    injectedCss={book.css_apply_to_content ? book.custom_css : null}
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
