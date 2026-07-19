import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authErrorMessage, signOut } from '../api/auth'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'
}

export default function Layout() {
  const { user } = useAuth()
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
          <Link to="/" className="text-lg font-bold tracking-tight">
            📚 <span className="text-blue-600">libro</span>
            <span className="text-gray-900">space</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/" className={navClass} end>
              홈
            </NavLink>
            <NavLink to="/docs" className={navClass}>
              Docs
            </NavLink>
            <NavLink to="/my" className={navClass}>
              내 서재
            </NavLink>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-40 truncate text-xs text-gray-400 sm:inline">
                  {user.email}
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
