import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** .env에 Supabase 값이 채워졌는지 여부. false면 App이 설정 안내 화면을 띄운다. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// 미설정 상태에서도 모듈 import가 죽지 않도록 placeholder로 생성한다.
// (미설정이면 App에서 안내 화면만 렌더링하므로 실제 요청은 발생하지 않음)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
