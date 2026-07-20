import { supabase } from '../lib/supabase'

export async function signUpWithEmail(email: string, password: string, nickname: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // DB 트리거(handle_new_user)가 이 메타데이터로 profiles 행을 만든다
    options: { data: { nickname } },
  })
  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * 비밀번호 재설정 메일 발송.
 * 메일 링크를 누르면 이 사이트로 돌아오고, Supabase가 임시 로그인 처리한 뒤
 * AuthContext가 PASSWORD_RECOVERY 이벤트를 받아 새 비밀번호 설정 화면으로 보낸다.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = window.location.origin + import.meta.env.BASE_URL
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

/** 현재 로그인된(또는 재설정 링크로 들어온) 사용자의 비밀번호 변경 */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/** Supabase 인증 에러(영문)를 사용자에게 보여줄 한국어 메시지로 변환 */
export function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (msg.includes('User already registered')) return '이미 가입된 이메일입니다.'
  if (msg.includes('Password should be at least'))
    return '비밀번호가 너무 짧습니다. 6자 이상 입력하세요.'
  if (msg.includes('Email not confirmed'))
    return '이메일 인증이 완료되지 않았습니다. 받은 편지함에서 인증 메일을 확인하세요.'
  if (msg.includes('Unable to validate email address') || msg.includes('invalid format'))
    return '이메일 형식이 올바르지 않습니다.'
  if (msg.includes('New password should be different'))
    return '기존 비밀번호와 다른 비밀번호를 입력하세요.'
  if (msg.includes('Auth session missing'))
    return '세션이 만료되었습니다. 재설정 메일을 다시 요청하세요.'
  if (msg.toLowerCase().includes('rate limit'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return '서버에 연결할 수 없습니다. 네트워크 상태와 .env의 Supabase 설정을 확인하세요.'
  return `오류가 발생했습니다: ${msg}`
}
