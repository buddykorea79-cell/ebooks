import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Book, Category } from '../types/database'
import { fetchBook, updateBook } from '../api/books'
import { fetchCategories } from '../api/categories'
import { useAuth } from '../contexts/AuthContext'
import BookForm, { type BookFormValues } from '../components/BookForm'
import CssEditorTab from '../components/CssEditorTab'
import ErrorAlert from '../components/ErrorAlert'
import MenuTreeEditor from '../components/MenuTreeEditor'

type Tab = 'info' | 'menus' | 'css'

const TABS: { value: Tab; label: string }[] = [
  { value: 'info', label: '기본정보' },
  { value: 'menus', label: '메뉴 관리' },
  { value: 'css', label: 'CSS' },
]

export default function BookEditPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const [book, setBook] = useState<Book | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [saved, setSaved] = useState(false)

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
        <Link to="/my" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← 내 서재로
        </Link>
      </div>
    )
  }
  if (user && book.owner_id !== user.id) {
    return (
      <div>
        <ErrorAlert message="내가 만든 도서만 편집할 수 있습니다." />
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← 홈으로
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <Link to="/my" className="text-sm text-blue-600 hover:underline">
            ← 내 서재
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold">{book.title}</h1>
        </div>
        <Link
          to={`/book/${book.id}`}
          className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          보기
        </Link>
      </div>

      <div className="mt-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                tab === t.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 전환 시 편집 중인 상태(메뉴 선택, CSS 초안)가 사라지지 않도록 hidden으로 유지 */}
      <div className="mt-6">
        <div className={tab === 'info' ? 'max-w-xl' : 'hidden'}>
          {saved && (
            <div className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              저장되었습니다 ✓
            </div>
          )}
          <BookForm
            categories={categories}
            initial={book}
            submitLabel="저장"
            onSubmit={handleSave}
          />
        </div>
        <div className={tab === 'menus' ? '' : 'hidden'}>
          <MenuTreeEditor book={book} />
        </div>
        <div className={tab === 'css' ? '' : 'hidden'}>
          <CssEditorTab book={book} onSaved={setBook} />
        </div>
      </div>
    </div>
  )
}
