import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authErrorMessage, signUpWithEmail } from '../api/auth'

export default function SignupPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  if (!loading && session) {
    return <Navigate to="/my" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nickname.trim()) {
      setError('닉네임을 입력하세요.')
      return
    }
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
      const data = await signUpWithEmail(email, password, nickname.trim())
      // 이메일 인증이 켜져 있으면 기존 가입 이메일에 대해 identities가 빈 배열로 온다
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError('이미 가입된 이메일입니다.')
        return
      }
      if (data.session) {
        // 이메일 인증 비활성화 상태: 바로 로그인됨
        navigate('/my', { replace: true })
      } else {
        // 이메일 인증 활성화 상태: 인증 메일 안내
        setNeedsEmailConfirm(true)
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (needsEmailConfirm) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">가입 완료</h1>
        <div className="mt-6 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>{email}</strong> 주소로 인증 메일을 보냈습니다.
          <br />
          받은 편지함에서 인증 링크를 클릭한 뒤 로그인해 주세요.
        </div>
        <Link
          to="/login"
          className="mt-4 block w-full rounded bg-blue-600 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
        >
          로그인 화면으로
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">회원가입</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
            닉네임 <span className="text-red-500">*</span>
          </label>
          <input
            id="nickname"
            type="text"
            required
            maxLength={20}
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="화면에 표시될 이름 (최대 20자)"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            비밀번호 <span className="text-xs text-gray-400">(6자 이상)</span>
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
            비밀번호 확인
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
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '가입 중…' : '가입하기'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
