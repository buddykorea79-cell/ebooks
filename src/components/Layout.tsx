import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authErrorMessage, signOut } from '../api/auth'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'
}

/** 헤더 검색창 (sm 이상에서 표시, 모바일은 🔍 링크로 검색 페이지 이동) */
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
    <form onSubmit={handleSubmit} className="hidden min-w-0 flex-1 justify-end sm:flex">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="검색 🔍"
        aria-label="도서 검색"
        className="w-full max-w-48 rounded-full border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="shrink-0 text-lg font-bold tracking-tight">
            📚 <span className="text-blue-600">Libro</span>
            <span className="text-gray-900">Space</span>
          </Link>
          <HeaderSearch />
          <nav className="flex shrink-0 items-center gap-4 pl-4 text-sm">
            <NavLink
              to="/search"
              aria-label="검색"
              className={(p) => `sm:hidden ${navClass(p)}`}
            >
              🔍
            </NavLink>
            <NavLink to="/" className={navClass} end>
              홈
            </NavLink>
            <NavLink to="/docs" className={navClass}>
              Docs
            </NavLink>
            <NavLink to="/my" className={navClass}>
              내 서재
            </NavLink>
            {isAdmin === true && (
              <NavLink to="/admin" className={navClass}>
                관리자
              </NavLink>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-40 truncate text-xs text-gray-500 sm:inline">
                  {nickname ?? user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  {signingOut ? '로그아웃 중…' : '로그아웃'}
                </button>
              </div>
            ) : (
              <NavLink to="/login" className={navClass}>
                로그인
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      {error && (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
