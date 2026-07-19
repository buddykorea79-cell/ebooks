import { supabase } from '../lib/supabase'

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
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
  if (msg.toLowerCase().includes('rate limit'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return '서버에 연결할 수 없습니다. 네트워크 상태와 .env의 Supabase 설정을 확인하세요.'
  return `오류가 발생했습니다: ${msg}`
}
