import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { enteredViaRecoveryLink, supabase } from '../lib/supabase'
import { fetchProfile } from '../api/profiles'

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** 내 닉네임. 메타데이터 → profiles 순으로 조회하며, 없으면 null (이메일로 대체 표시) */
  nickname: string | null
  /** 초기 세션 복원이 끝나기 전까지 true. 라우트 가드는 이 값이 false일 때만 판정한다. */
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [nickname, setNickname] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 닉네임 결정: 가입 시 메타데이터에 있으면 그걸, 없으면(기존 가입자) profiles에서
  useEffect(() => {
    const user = session?.user
    if (!user) {
      setNickname(null)
      return
    }
    const meta = user.user_metadata as Record<string, unknown> | undefined
    const metaNickname = typeof meta?.nickname === 'string' ? meta.nickname.trim() : ''
    if (metaNickname) {
      setNickname(metaNickname)
      return
    }
    let cancelled = false
    fetchProfile(user.id)
      .then((profile) => {
        if (!cancelled && profile) setNickname(profile.nickname)
      })
      .catch(() => {
        // profiles 테이블이 아직 없어도 앱은 동작해야 함 (이메일로 대체 표시)
      })
    return () => {
      cancelled = true
    }
  }, [session])

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
    <AuthContext.Provider value={{ session, user: session?.user ?? null, nickname, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
