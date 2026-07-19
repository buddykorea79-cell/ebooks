import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Book, Category } from '../types/database'
import { createBook, deleteBook, fetchMyBooks } from '../api/books'
import { fetchCategories } from '../api/categories'
import BookForm, { type BookFormValues } from '../components/BookForm'
import ErrorAlert from '../components/ErrorAlert'
import TypeBadge from '../components/TypeBadge'

export default function MyLibraryPage() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [b, c] = await Promise.all([fetchMyBooks(), fetchCategories()])
      setBooks(b)
      setCategories(c)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`목록을 불러오지 못했습니다: ${msg}`)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(values: BookFormValues) {
    const book = await createBook(values) // 실패 시 BookForm이 에러를 표시
    navigate(`/book/${book.id}/edit`)
  }

  async function handleDelete(book: Book) {
    const ok = window.confirm(
      `'${book.title}'을(를) 삭제할까요?\n등록된 메뉴와 콘텐츠도 모두 함께 삭제되며 되돌릴 수 없습니다.`,
    )
    if (!ok) return
    setDeletingId(book.id)
    try {
      await deleteBook(book.id)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`삭제에 실패했습니다: ${msg}`)
    } finally {
      setDeletingId(null)
    }
  }

  function categoryName(id: string | null) {
    if (!id) return '미분류'
    return categories.find((c) => c.id === id)?.name ?? '미분류'
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 서재</h1>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + 새 도서 만들기
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold">새 도서 만들기</h2>
          <BookForm
            categories={categories}
            submitLabel="만들기"
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {books === null && !error && (
        <p className="mt-6 text-gray-500">불러오는 중…</p>
      )}

      {books !== null && books.length === 0 && !showCreate && (
        <p className="mt-6 text-gray-500">
          아직 만든 도서가 없습니다. 오른쪽 위 버튼으로 첫 도서를 만들어 보세요.
        </p>
      )}

      {books !== null && books.length > 0 && (
        <ul className="mt-4 space-y-3">
          {books.map((book) => (
            <li
              key={book.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TypeBadge type={book.type} />
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      book.is_published
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {book.is_published ? '공개' : '비공개'}
                  </span>
                  <span className="text-xs text-gray-400">{categoryName(book.category_id)}</span>
                </div>
                <h2 className="mt-1 truncate text-lg font-semibold">{book.title}</h2>
                {book.description && (
                  <p className="mt-0.5 truncate text-sm text-gray-500">{book.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={`/book/${book.id}`}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  보기
                </Link>
                <Link
                  to={`/book/${book.id}/edit`}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  편집
                </Link>
                <button
                  onClick={() => handleDelete(book)}
                  disabled={deletingId === book.id}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === book.id ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
