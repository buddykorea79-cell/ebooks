import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { enteredViaRecoveryLink, supabase } from '../lib/supabase'
import { fetchProfile } from '../api/profiles'

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** 내 닉네임. 메타데이터 → profiles 순으로 조회하며, 없으면 null (이메일로 대체 표시) */
  nickname: string | null
  /** 관리자 여부. null이면 아직 판정 전(프로필 조회 중) */
  isAdmin: boolean | null
  /** AI 작성 도우미 사용 허용 여부 (관리자가 회원별로 지정) */
  aiEnabled: boolean
  /**
   * profiles를 다시 읽어 위 세 값을 갱신한다.
   * 세션이 바뀔 때만 조회하면 관리자가 화면에서 자기 권한을 바꿨을 때
   * 새로고침 전까지 반영되지 않으므로, 그런 경우 직접 호출한다.
   */
  refreshProfile: () => Promise<void>
  /** 초기 세션 복원이 끝나기 전까지 true. 라우트 가드는 이 값이 false일 때만 판정한다. */
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  const user = session?.user ?? null
  const userId = user?.id ?? null
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const metaNickname = typeof meta?.nickname === 'string' ? meta.nickname.trim() : ''

  // 닉네임(메타데이터 → profiles 순), 관리자 여부(profiles.is_admin),
  // AI 사용 허용 여부(profiles.ai_enabled) 판정
  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setNickname(null)
      setIsAdmin(false)
      setAiEnabled(false)
      return
    }
    if (metaNickname) setNickname(metaNickname)
    try {
      const profile = await fetchProfile(userId)
      if (profile && !metaNickname) setNickname(profile.nickname)
      setIsAdmin(profile?.is_admin === true)
      // ai-assist.sql 실행 전에는 컬럼이 없어 undefined → 미허용
      setAiEnabled(profile?.ai_enabled === true)
    } catch {
      // profiles 테이블이 아직 없어도 앱은 동작해야 함 (이메일로 대체 표시)
      setIsAdmin(false)
      setAiEnabled(false)
    }
  }, [userId, metaNickname])

  useEffect(() => {
    // 로그인 상태에서는 조회가 끝날 때까지 '판정 전'으로 둔다
    if (userId) setIsAdmin(null)
    refreshProfile()
  }, [userId, refreshProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      // 재설정 링크로 들어온 경우: 아래 PASSWORD_RECOVERY 이벤트를 타이밍상
      // 놓쳤더라도 세션 복원이 끝난 이 시점에 확실히 이동시킨다
      if (enteredViaRecoveryLink && data.session) {
        window.location.hash = '#/reset-password'
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      // 재설정 메일 링크로 돌아온 경우 → 새 비밀번호 설정 화면으로
      if (event === 'PASSWORD_RECOVERY') {
        window.location.hash = '#/reset-password'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, user, nickname, isAdmin, aiEnabled, refreshProfile, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
