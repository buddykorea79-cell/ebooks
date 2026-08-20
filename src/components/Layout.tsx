import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authErrorMessage, signOut } from '../api/auth'

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-2.5 py-1.5 transition-colors ${
    isActive ? 'font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`
}

/** 펼친 책 모양 로고 마크 */
function BookMark() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
      <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
        <path
          d="M12 6.5C10.6 5.2 8.6 4.5 6 4.5c-.9 0-1.7.1-2.5.2v13c.8-.1 1.6-.2 2.5-.2 2.6 0 4.6.7 6 2m0-13c1.4-1.3 3.4-2 6-2 .9 0 1.7.1 2.5.2v13c-.8-.1-1.6-.2-2.5-.2-2.6 0-4.6.7-6 2m0-13v13"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** 헤더 검색창 (md 이상에서 표시, 모바일은 🔍 링크로 검색 페이지 이동) */
function HeaderSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next = q.trim()
    if (!next) return
    navigate(`/search?q=${encodeURIComponent(next)}`)
    setQ('')
  }

  return (
    <form onSubmit={handleSubmit} className="hidden min-w-0 flex-1 justify-center px-6 md:flex">
      <div className="relative w-full max-w-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="도서·본문 검색"
          aria-label="도서 검색"
          className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pr-4 pl-9 text-sm transition-colors placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-50 focus:outline-none"
        />
      </div>
      {/* 숨은 제출 버튼: 일부 환경에서 버튼 없는 폼의 Enter 암시적 제출이 안 되는 경우 대비 */}
      <button type="submit" className="sr-only">
        검색
      </button>
    </form>
  )
}

export default function Layout() {
  const { user, nickname, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    setSigningOut(true)
    setError(null)
    try {
      await signOut()
      navigate('/')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <BookMark />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-brand-600">Libro</span>Space
            </span>
          </Link>

          <HeaderSearch />

          <nav className="flex shrink-0 items-center gap-0.5 text-sm">
            <NavLink to="/search" aria-label="검색" className={(p) => `md:hidden ${navClass(p)}`}>
              🔍
            </NavLink>
            <NavLink to="/" className={navClass} end>
              홈
            </NavLink>
            <NavLink to="/docs" className={(p) => `hidden sm:block ${navClass(p)}`}>
              이용안내
            </NavLink>
            <NavLink to="/my" className={navClass}>
              내 서재
            </NavLink>
            {user && (
              <NavLink to="/account" className={navClass}>
                내 정보
              </NavLink>
            )}
            {isAdmin === true && (
              <NavLink to="/admin" className={navClass}>
                관리자
              </NavLink>
            )}
            {user ? (
              <div className="ml-1.5 flex items-center gap-2 border-l border-gray-200 pl-2.5">
                <span className="hidden max-w-32 truncate text-xs text-gray-500 lg:inline">
                  {nickname ?? user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  {signingOut ? '로그아웃 중…' : '로그아웃'}
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="ml-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                로그인
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-4">
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md">
              <div className="flex items-center gap-2.5">
                <BookMark />
                <span className="text-base font-bold tracking-tight">
                  <span className="text-brand-600">Libro</span>Space
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                AI·IT 분야의 도서와 실습 교재를 만들고 함께 보는 공간입니다. 목차를 세우고 본문을
                쓰면 그대로 읽기 좋은 전자책이 됩니다.
              </p>
            </div>
            <nav className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                바로가기
              </span>
              <Link to="/" className="text-gray-600 hover:text-brand-600">
                도서 둘러보기
              </Link>
              <Link to="/docs" className="text-gray-600 hover:text-brand-600">
                이용안내
              </Link>
              <Link to="/my" className="text-gray-600 hover:text-brand-600">
                내 서재
              </Link>
            </nav>
          </div>
          <p className="mt-8 border-t border-gray-100 pt-6 text-xs text-gray-400">
            © {new Date().getFullYear()} LibroSpace
          </p>
        </div>
      </footer>
    </div>
  )
}
