import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
      {/* 히어로: 배경 없이 문구만 */}
      <section className="py-10 text-center sm:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          지식이 모이는 공간,{' '}
          <span className="text-4xl sm:text-5xl">
            <span className="text-blue-600">Libro</span>Space
          </span>
        </h1>
      </section>

      <h2 className="text-2xl font-bold">공개 도서</h2>

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
                {book.cover_url && (
                  <img
                    src={book.cover_url}
                    alt={`${book.title} 표지`}
                    loading="lazy"
                    className="mb-3 h-40 w-full rounded object-cover"
                  />
                )}
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
