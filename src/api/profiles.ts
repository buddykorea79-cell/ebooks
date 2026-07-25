import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

/** 전체 회원 목록 (가입순). 닉네임·관리자 여부는 공개 정보 */
export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Profile[]
}

/** 관리자 지정/해제 — 권한 검사는 DB 함수(set_user_admin) 안에서 이뤄진다 */
export async function setUserAdmin(userId: string, makeAdmin: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_user_admin', {
    target_id: userId,
    make_admin: makeAdmin,
  })
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

/** 여러 사용자의 닉네임을 한 번에 조회 → { userId: nickname } 맵 */
export async function fetchNicknames(userIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname')
    .in('id', unique)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const row of data as { id: string; nickname: string }[]) {
    map[row.id] = row.nickname
  }
  return map
}
