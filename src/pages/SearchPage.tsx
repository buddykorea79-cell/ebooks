import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Book } from '../types/database'
import { searchBooks, searchMenus, type MenuHit } from '../api/search'
import ErrorAlert from '../components/ErrorAlert'
import TypeBadge from '../components/TypeBadge'

/** 태그를 걷어낸 본문에서 검색어 주변 문맥을 잘라낸다 (하이라이트용 3분할) */
function makeSnippet(
  content: string,
  q: string,
  radius = 40,
): { before: string; match: string; after: string } | null {
  const text = content
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return null
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + q.length + radius)
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length, end) + (end < text.length ? '…' : ''),
  }
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = (searchParams.get('q') ?? '').trim()
  const [input, setInput] = useState(q)
  const [bookHits, setBookHits] = useState<Book[] | null>(null)
  const [menuHits, setMenuHits] = useState<MenuHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInput(q)
    if (!q) {
      setBookHits(null)
      setMenuHits(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([searchBooks(q), searchMenus(q)])
      .then(([b, m]) => {
        if (cancelled) return
        setBookHits(b)
        setMenuHits(m)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(`검색에 실패했습니다: ${msg}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [q])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next = input.trim()
    if (next) setSearchParams({ q: next })
  }

  const total = (bookHits?.length ?? 0) + (menuHits?.length ?? 0)

  return (
    <div>
      <h1 className="text-2xl font-bold">검색</h1>

      <form onSubmit={handleSubmit} className="mt-4 flex max-w-xl gap-2">
        <input
          autoFocus
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="도서 제목, 설명, 본문 내용 검색"
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          검색
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {!q && !error && (
        <p className="mt-6 text-gray-500">검색어를 입력하세요. 공개된 도서에서 찾습니다.</p>
      )}

      {loading && <p className="mt-6 text-gray-500">검색 중…</p>}

      {!loading && q && bookHits !== null && menuHits !== null && (
        <>
          <p className="mt-4 text-sm text-gray-500">
            '<span className="font-semibold text-gray-700">{q}</span>' 검색 결과 {total}건
          </p>

          {bookHits.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-800">도서 ({bookHits.length})</h2>
              <ul className="mt-3 space-y-2">
                {bookHits.map((book) => (
                  <li key={book.id}>
                    <Link
                      to={`/book/${book.id}`}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt=""
                          loading="lazy"
                          className="h-16 w-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-gray-100 text-xl">
                          📕
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="break-keep text-sm font-semibold sm:text-base">
                          {book.title}
                        </h3>
                        {book.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                            {book.description}
                          </p>
                        )}
                        <div className="mt-1">
                          <TypeBadge type={book.type} />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {menuHits.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-800">본문 ({menuHits.length})</h2>
              <ul className="mt-3 space-y-2">
                {menuHits.map((hit) => {
                  const snippet = hit.content ? makeSnippet(hit.content, q) : null
                  return (
                    <li key={hit.menuId}>
                      <Link
                        to={`/book/${hit.bookId}/${hit.menuId}`}
                        className="block rounded-lg border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm"
                      >
                        <p className="text-sm font-semibold">
                          📄 {hit.menuTitle}
                          <span className="ml-2 font-normal text-gray-400">{hit.bookTitle}</span>
                        </p>
                        {snippet && (
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            {snippet.before}
                            <mark className="rounded bg-yellow-100 px-0.5 text-gray-800">
                              {snippet.match}
                            </mark>
                            {snippet.after}
                          </p>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {total === 0 && (
            <p className="mt-6 text-gray-500">
              검색 결과가 없습니다. 다른 검색어로 시도해 보세요.
            </p>
          )}
        </>
      )}
    </div>
  )
}
