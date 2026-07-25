import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Book, Category, HomeLayout } from '../types/database'
import { fetchPublishedBooks } from '../api/books'
import { fetchCategories } from '../api/categories'
import { fetchNicknames } from '../api/profiles'
import { fetchSiteSettings } from '../api/settings'
import {
  addRecommendation,
  fetchMyRecommendations,
  fetchRecommendCounts,
  removeRecommendation,
} from '../api/recommendations'
import { useAuth } from '../contexts/AuthContext'
import ErrorAlert from '../components/ErrorAlert'
import TypeBadge from '../components/TypeBadge'

const UNCATEGORIZED = '__none__'

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all') // 'all' | category id | UNCATEGORIZED

  // 관리자 설정 (없으면 기본값: 최신순, 추천 기능 꺼짐)
  const [layout, setLayout] = useState<HomeLayout>('latest')
  const [featuredCount, setFeaturedCount] = useState(8)
  const [recommendEnabled, setRecommendEnabled] = useState(false)

  const [recCounts, setRecCounts] = useState<Record<string, number>>({})
  const [myRecs, setMyRecs] = useState<Set<string>>(new Set())
  const [recBusy, setRecBusy] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [b, c] = await Promise.all([fetchPublishedBooks(), fetchCategories()])
        setBooks(b)
        setCategories(c)
        try {
          setNicknames(await fetchNicknames(b.map((x) => x.owner_id)))
        } catch {
          // profiles 테이블이 아직 없어도 목록은 표시되어야 함
        }
        try {
          const settings = await fetchSiteSettings()
          setRecommendEnabled(settings?.recommend_enabled ?? false)
          setLayout(settings?.home_layout ?? 'latest')
          setFeaturedCount(settings?.home_featured_count ?? 8)
        } catch {
          // admin.sql 실행 전(site_settings 없음)에는 기본값으로 동작
        }
        try {
          // 추천 정렬에 필요하므로 추천 버튼 노출 여부와 무관하게 조회
          setRecCounts(await fetchRecommendCounts(b.map((x) => x.id)))
        } catch {
          // book_recommendations 테이블이 없으면 추천 수는 0으로 취급
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`목록을 불러오지 못했습니다: ${msg}`)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!recommendEnabled || !user) return
    let cancelled = false
    fetchMyRecommendations(user.id)
      .then((set) => {
        if (!cancelled) setMyRecs(set)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [recommendEnabled, user])

  async function handleRecommend(e: MouseEvent, book: Book) {
    // 카드 전체가 Link이므로 버튼 클릭이 상세로 이동하지 않게 차단
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      navigate('/login')
      return
    }
    if (recBusy) return
    const mine = myRecs.has(book.id)
    setRecBusy(book.id)
    try {
      if (mine) {
        await removeRecommendation(book.id, user.id)
        setMyRecs((s) => {
          const next = new Set(s)
          next.delete(book.id)
          return next
        })
        setRecCounts((c) => ({ ...c, [book.id]: Math.max(0, (c[book.id] ?? 1) - 1) }))
      } else {
        await addRecommendation(book.id, user.id)
        setMyRecs((s) => new Set(s).add(book.id))
        setRecCounts((c) => ({ ...c, [book.id]: (c[book.id] ?? 0) + 1 }))
      }
    } catch {
      // 실패 시 조용히 무시 (다음 클릭에서 재시도)
    } finally {
      setRecBusy(null)
    }
  }

  const all = books ?? []
  const hasUncategorized = all.some(
    (b) => !b.category_id || !categories.some((c) => c.id === b.category_id),
  )

  // 분류 필터 탭: 전체 + 각 분류 (+ 미분류 도서가 있으면 미분류)
  const filters: { value: string; label: string }[] = [
    { value: 'all', label: '전체' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    ...(hasUncategorized ? [{ value: UNCATEGORIZED, label: '미분류' }] : []),
  ]

  const visible =
    filter === 'all'
      ? all
      : filter === UNCATEGORIZED
        ? all.filter((b) => !b.category_id || !categories.some((c) => c.id === b.category_id))
        : all.filter((b) => b.category_id === filter)

  const byLatest = (a: Book, b: Book) => (a.created_at < b.created_at ? 1 : -1)
  const byRecommended = (a: Book, b: Book) =>
    (recCounts[b.id] ?? 0) - (recCounts[a.id] ?? 0) || byLatest(a, b)

  // 'both'는 '전체' 탭에서만 2단으로 나눈다 (분류를 고르면 목록 하나)
  const splitSections = layout === 'both' && filter === 'all'
  const featured = splitSections
    ? [...visible].filter((b) => (recCounts[b.id] ?? 0) > 0).sort(byRecommended).slice(0, featuredCount)
    : []
  const featuredIds = new Set(featured.map((b) => b.id))

  const sections: { key: string; title: string | null; books: Book[] }[] = splitSections
    ? [
        ...(featured.length > 0 ? [{ key: 'featured', title: '추천 도서', books: featured }] : []),
        {
          key: 'latest',
          title: featured.length > 0 ? '최신 도서' : null,
          books: [...visible].sort(byLatest).filter((b) => !featuredIds.has(b.id)),
        },
      ]
    : [
        {
          key: 'list',
          title: null,
          books: [...visible].sort(layout === 'recommended' ? byRecommended : byLatest),
        },
      ]

  const sortLabel = layout === 'recommended' ? '추천순' : '최신순'

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

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">공개 도서</h2>
        {books !== null && visible.length > 0 && !splitSections && (
          <span className="text-sm text-gray-400">{sortLabel}</span>
        )}
      </div>

      {/* 분류 필터 탭 */}
      <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 text-sm" role="tablist">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-md px-3 py-1.5 font-medium transition sm:px-5 ${
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

      {books !== null && visible.length === 0 && (
        <p className="mt-6 text-gray-500">
          {filter === 'all'
            ? '아직 공개된 도서가 없습니다.'
            : '해당 분류의 공개된 도서가 없습니다.'}
        </p>
      )}

      {sections.map((section) =>
        section.books.length === 0 ? null : (
          <section key={section.key} className="mt-8 first:mt-6">
            {section.title && (
              <h3 className="text-lg font-semibold text-gray-800">{section.title}</h3>
            )}
            <div
              className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 ${
                section.title ? 'mt-3' : ''
              }`}
            >
              {section.books.map((book) => (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-blue-300 hover:shadow-sm"
                >
                  {/* 표지: 세로(3:4) 비율 고정 */}
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={`${book.title} 표지`}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100 text-4xl">
                      📕
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="text-sm font-semibold break-keep sm:text-base">{book.title}</h3>
                    {nicknames[book.owner_id] && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {nicknames[book.owner_id]}
                      </p>
                    )}
                    {book.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{book.description}</p>
                    )}
                    {/* 유형 배지(+추천)는 카드 최하단 고정 */}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <TypeBadge type={book.type} />
                      {recommendEnabled && (
                        <button
                          onClick={(e) => handleRecommend(e, book)}
                          disabled={recBusy === book.id}
                          title={
                            user
                              ? myRecs.has(book.id)
                                ? '추천 취소'
                                : '추천'
                              : '로그인 후 추천할 수 있습니다'
                          }
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 ${
                            myRecs.has(book.id)
                              ? 'border-blue-300 bg-blue-50 text-blue-600'
                              : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          👍 {recCounts[book.id] ?? 0}
                        </button>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  )
}
