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

/** 표지가 없는 도서의 대체 표지 색 — 서가처럼 보이도록 id로 갈라 준다 */
const COVER_TONES = [
  'bg-brand-700',
  'bg-slate-700',
  'bg-teal-700',
  'bg-rose-700',
  'bg-amber-700',
  'bg-violet-700',
]

function toneOf(id: string): string {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % 997
  return COVER_TONES[sum % COVER_TONES.length]
}

/** 표지 이미지가 없으면 제목을 넣은 표지를 그려 준다 */
function BookCover({ book }: { book: Book }) {
  if (book.cover_url) {
    return (
      <img
        src={book.cover_url}
        alt={`${book.title} 표지`}
        loading="lazy"
        className="aspect-3/4 w-full object-cover"
      />
    )
  }
  return (
    <div
      className={`relative flex aspect-3/4 w-full flex-col justify-between p-4 ${toneOf(book.id)}`}
    >
      {/* 책등 */}
      <span className="absolute inset-y-0 left-0 w-1.5 bg-black/20" />
      <span className="text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase">
        LibroSpace
      </span>
      <span className="line-clamp-4 text-sm leading-snug font-bold break-keep text-white">
        {book.title}
      </span>
    </div>
  )
}

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
  // 관리자가 주소를 넣었을 때만 'EduTalk' 버튼을 보여준다
  const [edutalkUrl, setEdutalkUrl] = useState<string | null>(null)

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
          setEdutalkUrl(settings?.edutalk_url?.trim() || null)
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
    ? [...visible]
        .filter((b) => (recCounts[b.id] ?? 0) > 0)
        .sort(byRecommended)
        .slice(0, featuredCount)
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
      {/* 히어로 — 이 사이트가 무엇인지 한눈에 */}
      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-brand-50/60 px-6 py-12 sm:px-10 sm:py-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-brand-700">
            AI · IT · 교육 교재
          </span>
          <h1 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight text-gray-900 sm:text-[2.6rem]">
            오늘의 AI, IT 이야기가 모여,
            <br className="hidden sm:block" /> 내일을 그려보는 공간
          </h1>
          <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
            <span className="font-semibold text-gray-800">LibroSpace</span>는 AI·IT 분야의 도서와
            실무 가이드, 강의용 실습 교재를 만들고 함께 보는 전자책 플랫폼입니다. 목차를 세우고
            본문을 쓰면 그대로 읽기 좋은 책이 됩니다.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/my"
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              내 교재 만들기
            </Link>
            {edutalkUrl && (
              <a
                href={edutalkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                교육생과 대화하기 (EduTalk)
                <span aria-hidden="true" className="text-gray-400">
                  ↗
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      <div id="books" className="mt-12 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">공개 도서</h2>
          <p className="mt-1 text-sm text-gray-500">
            {books === null
              ? '불러오는 중…'
              : `누구나 읽을 수 있는 ${all.length}권이 올라와 있습니다.`}
          </p>
        </div>
        {books !== null && visible.length > 0 && !splitSections && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
            {sortLabel}
          </span>
        )}
      </div>

      {/* 분류 필터 */}
      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {books === null && !error && (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="aspect-3/4 w-full animate-pulse bg-gray-100" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {books !== null && visible.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-base font-medium text-gray-700">
            {filter === 'all'
              ? '아직 공개된 도서가 없습니다.'
              : '이 분류에는 아직 공개된 도서가 없습니다.'}
          </p>
          <p className="mt-1.5 text-sm text-gray-500">
            내 서재에서 첫 도서를 만들어 공개해 보세요.
          </p>
          <Link
            to="/my"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            내 서재로 가기
          </Link>
        </div>
      )}

      {sections.map((section) =>
        section.books.length === 0 ? null : (
          <section key={section.key} className="mt-8 first:mt-6">
            {section.title && (
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="h-4 w-1 rounded-full bg-brand-600" />
                {section.title}
              </h3>
            )}
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {section.books.map((book) => (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
                >
                  <div className="overflow-hidden">
                    <div className="transition-transform duration-300 group-hover:scale-[1.03]">
                      <BookCover book={book} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-sm leading-snug font-semibold break-keep text-gray-900 group-hover:text-brand-700 sm:text-[15px]">
                      {book.title}
                    </h3>
                    {nicknames[book.owner_id] && (
                      <p className="mt-1 truncate text-xs text-gray-400">
                        {nicknames[book.owner_id]}
                      </p>
                    )}
                    {book.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
                        {book.description}
                      </p>
                    )}
                    {/* 유형 배지(+추천)는 카드 최하단 고정 */}
                    <div className="mt-auto flex items-center justify-between pt-3">
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
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                            myRecs.has(book.id)
                              ? 'border-brand-300 bg-brand-50 text-brand-600'
                              : 'border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600'
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
