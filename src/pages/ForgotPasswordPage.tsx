import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authErrorMessage, requestPasswordReset } from '../api/auth'
import ErrorAlert from '../components/ErrorAlert'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">메일을 확인하세요</h1>
        <div className="mt-6 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>{email}</strong> 주소로 비밀번호 재설정 메일을 보냈습니다.
          <br />
          메일의 링크를 누르면 새 비밀번호를 설정하는 화면으로 이동합니다.
          <br />
          <span className="text-blue-600">
            메일이 보이지 않으면 스팸함을 확인해 주세요. (가입된 이메일에만 발송됩니다)
          </span>
        </div>
        <Link
          to="/login"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          ← 로그인 화면으로
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
      <p className="mt-2 text-sm text-gray-600">
        가입할 때 사용한 이메일을 입력하면 재설정 링크를 보내드립니다.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
        {error && <ErrorAlert message={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '전송 중…' : '재설정 메일 보내기'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        비밀번호가 기억나셨나요?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
