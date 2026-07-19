import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authErrorMessage, updatePassword } from '../api/auth'
import ErrorAlert from '../components/ErrorAlert'

/**
 * 새 비밀번호 설정 페이지.
 * - 재설정 메일 링크로 들어오면 Supabase가 임시 로그인 처리한 뒤 이 페이지로 이동된다.
 * - 이미 로그인한 사용자가 비밀번호를 바꾸는 용도로도 쓸 수 있다.
 */
export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }
    setSubmitting(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500">세션 확인 중…</p>
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">링크가 유효하지 않습니다</h1>
        <div className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          재설정 링크가 만료되었거나 잘못되었습니다. 재설정 메일을 다시 요청해 주세요.
          <br />
          (메일의 링크는 보안을 위해 한 번만, 일정 시간 동안만 사용할 수 있습니다)
        </div>
        <Link
          to="/forgot-password"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          재설정 메일 다시 받기
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">변경 완료</h1>
        <div className="mt-6 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.
        </div>
        <Link
          to="/my"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          내 서재로 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">새 비밀번호 설정</h1>
      <p className="mt-2 text-sm text-gray-600">
        <strong>{session.user.email}</strong> 계정의 새 비밀번호를 입력하세요.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            새 비밀번호 <span className="text-xs text-gray-400">(6자 이상)</span>
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700">
            새 비밀번호 확인
          </label>
          <input
            id="passwordConfirm"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        {error && <ErrorAlert message={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}
