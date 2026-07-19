import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** .env에 Supabase 값이 채워졌는지 여부. false면 App이 설정 안내 화면을 띄운다. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * 비밀번호 재설정 메일 링크로 진입했는지 여부.
 * supabase-js가 URL 해시의 토큰을 파싱·제거하기 전인 모듈 로드 시점에 기록해 둔다.
 * (PASSWORD_RECOVERY 이벤트가 React 구독 등록보다 먼저 발생해도 이동을 놓치지 않기 위함)
 */
export const enteredViaRecoveryLink =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

// 미설정 상태에서도 모듈 import가 죽지 않도록 placeholder로 생성한다.
// (미설정이면 App에서 안내 화면만 렌더링하므로 실제 요청은 발생하지 않음)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
