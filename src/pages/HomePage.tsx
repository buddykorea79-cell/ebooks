import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Book, BookType, Category } from '../types/database'
import { BOOK_TYPE_LABELS } from '../types/database'
import { fetchPublishedBooks } from '../api/books'
import { fetchCategories } from '../api/categories'
import ErrorAlert from '../components/ErrorAlert'
import TypeBadge from '../components/TypeBadge'

type TypeFilter = 'all' | BookType

const FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'book', label: BOOK_TYPE_LABELS.book },
  { value: 'guide', label: BOOK_TYPE_LABELS.guide },
  { value: 'manual', label: BOOK_TYPE_LABELS.manual },
]

interface CategoryGroup {
  key: string
  name: string
  books: Book[]
}

export default function HomePage() {
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TypeFilter>('all')

  useEffect(() => {
    async function load() {
      try {
        const [b, c] = await Promise.all([fetchPublishedBooks(), fetchCategories()])
        setBooks(b)
        setCategories(c)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`목록을 불러오지 못했습니다: ${msg}`)
      }
    }
    load()
  }, [])

  const filtered =
    books === null ? [] : filter === 'all' ? books : books.filter((b) => b.type === filter)

  const groups: CategoryGroup[] = []
  for (const cat of categories) {
    const inCat = filtered.filter((b) => b.category_id === cat.id)
    if (inCat.length > 0) groups.push({ key: cat.id, name: cat.name, books: inCat })
  }
  const uncategorized = filtered.filter(
    (b) => !b.category_id || !categories.some((c) => c.id === b.category_id),
  )
  if (uncategorized.length > 0) groups.push({ key: '__none__', name: '미분류', books: uncategorized })

  return (
    <div>
      {/* 히어로 */}
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-12 text-center text-white sm:px-10 sm:py-16">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          libro<span className="text-blue-200">space</span>
        </h1>
        <p className="mt-3 text-lg font-medium text-blue-100 sm:text-xl">지식이 모이는 공간</p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-blue-100/90 sm:text-base">
          도서·가이드·매뉴얼을 계층형 메뉴로 정리하고, HTML 콘텐츠를 그대로 담아
          누구에게나 공유하세요.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={user ? '/my' : '/signup'}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow hover:bg-blue-50"
          >
            {user ? '내 서재로 가기' : '무료로 시작하기'}
          </Link>
          <Link
            to="/docs"
            className="rounded-lg border border-white/50 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            사용 방법 보기
          </Link>
        </div>
      </section>

      <h2 className="mt-10 text-2xl font-bold">공개 도서</h2>

      <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition sm:flex-none sm:px-5 ${
              filter === f.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {books === null && !error && <p className="mt-6 text-gray-500">불러오는 중…</p>}

      {books !== null && groups.length === 0 && (
        <p className="mt-6 text-gray-500">
          {filter === 'all'
            ? '아직 공개된 도서가 없습니다.'
            : '해당 유형의 공개된 도서가 없습니다.'}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800">{group.name}</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.books.map((book) => (
              <Link
                key={book.id}
                to={`/book/${book.id}`}
                className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
              >
                <TypeBadge type={book.type} />
                <h3 className="mt-2 truncate text-base font-semibold">{book.title}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-gray-500">
                  {book.description ?? ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
