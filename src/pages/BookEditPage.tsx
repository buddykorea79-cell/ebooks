import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Book, BookMenu, Category } from '../types/database'
import { fetchBook, updateBook } from '../api/books'
import { fetchCategories } from '../api/categories'
import { fetchMenus } from '../api/menus'
import { useAuth } from '../contexts/AuthContext'
import BookForm, { type BookFormValues } from '../components/BookForm'
import ContentEditorTab from '../components/ContentEditorTab'
import CoverUploader from '../components/CoverUploader'
import CssEditorTab from '../components/CssEditorTab'
import ErrorAlert from '../components/ErrorAlert'
import MenuTreeEditor from '../components/MenuTreeEditor'
import PdfUploadTab from '../components/PdfUploadTab'
import SingleContentTab from '../components/SingleContentTab'

type Tab = 'info' | 'menus' | 'content' | 'css'

export default function BookEditPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const [book, setBook] = useState<Book | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [menus, setMenus] = useState<BookMenu[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [saved, setSaved] = useState(false)

  // 목차 관리 탭과 콘텐츠 작성 탭이 같은 목록을 보도록 여기서 소유한다
  const reloadMenus = useCallback(async () => {
    if (!bookId) return
    setMenus(await fetchMenus(bookId))
  }, [bookId])

  useEffect(() => {
    async function load() {
      if (!bookId) return
      setLoading(true)
      setError(null)
      try {
        const [b, c] = await Promise.all([fetchBook(bookId), fetchCategories()])
        setBook(b)
        setCategories(c)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`도서를 불러오지 못했습니다: ${msg}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bookId])

  useEffect(() => {
    reloadMenus().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      setMenuError(`메뉴를 불러오지 못했습니다: ${msg}`)
    })
  }, [reloadMenus])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(t)
  }, [saved])

  async function handleSave(values: BookFormValues) {
    if (!book) return
    const updated = await updateBook(book.id, values) // 실패 시 BookForm이 에러를 표시
    setBook(updated)
    setSaved(true)
  }

  if (loading) {
    return <p className="text-gray-500">불러오는 중…</p>
  }
  if (error) {
    return <ErrorAlert message={error} />
  }
  if (!book) {
    return (
      <div>
        <ErrorAlert message="도서를 찾을 수 없습니다. 삭제되었거나 접근 권한이 없습니다." />
        <Link to="/my" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← 내 서재로
        </Link>
      </div>
    )
  }
  if (user && book.owner_id !== user.id) {
    return (
      <div>
        <ErrorAlert message="내가 만든 도서만 편집할 수 있습니다." />
        <Link to="/" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← 홈으로
        </Link>
      </div>
    )
  }

  const mode = book.source_mode ?? 'menu'
  const singleMode = mode === 'single'
  const pdfMode = mode === 'pdf'
  // 파일 하나로 끝나는 모드(single/pdf)는 목차·본문 탭을 나누지 않는다
  const tabs: { value: Tab; label: string; badge?: string }[] = pdfMode
    ? [
        { value: 'info', label: '기본정보' },
        { value: 'menus', label: 'PDF 파일' },
        { value: 'css', label: 'CSS' },
      ]
    : singleMode
      ? [
          { value: 'info', label: '기본정보' },
          { value: 'menus', label: '파일 업로드' },
          { value: 'css', label: 'CSS' },
        ]
      : [
          { value: 'info', label: '기본정보' },
          { value: 'menus', label: '목차 관리', badge: menus ? String(menus.length) : undefined },
          { value: 'content', label: '콘텐츠 작성' },
          { value: 'css', label: 'CSS' },
        ]

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/my" className="text-sm text-brand-600 hover:underline">
            ← 내 서재
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold">{book.title}</h1>
        </div>
        <Link
          to={`/book/${book.id}`}
          className="shrink-0 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          보기 ↗
        </Link>
      </div>

      <div className="mt-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = tab === t.value
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {t.label}
                {t.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                      isActive ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 탭 전환 시 편집 중인 상태(선택한 꼭지, 초안, CSS)가 사라지지 않도록 hidden으로 유지 */}
      <div className="mt-6">
        <div className={tab === 'info' ? '' : 'hidden'}>
          {saved && (
            <div className="mb-4 max-w-xl rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              저장되었습니다 ✓
            </div>
          )}
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="max-w-xl flex-1">
              <BookForm
                categories={categories}
                initial={book}
                submitLabel="저장"
                onSubmit={handleSave}
              />
            </div>
            <CoverUploader book={book} onSaved={setBook} />
          </div>
        </div>

        <div className={tab === 'menus' ? '' : 'hidden'}>
          {pdfMode ? (
            <PdfUploadTab book={book} onSaved={setBook} />
          ) : singleMode ? (
            <SingleContentTab book={book} onSaved={setBook} />
          ) : (
            <>
              {menuError && (
                <div className="mb-4 max-w-3xl">
                  <ErrorAlert message={menuError} />
                </div>
              )}
              <MenuTreeEditor book={book} menus={menus} onChanged={reloadMenus} />
            </>
          )}
        </div>

        {!singleMode && !pdfMode && (
          <div className={tab === 'content' ? '' : 'hidden'}>
            <ContentEditorTab
              book={book}
              menus={menus}
              onSaved={reloadMenus}
              active={tab === 'content'}
            />
          </div>
        )}

        <div className={tab === 'css' ? '' : 'hidden'}>
          <CssEditorTab book={book} onSaved={setBook} />
        </div>
      </div>
    </div>
  )
}
