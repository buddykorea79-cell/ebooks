import { supabase } from '../lib/supabase'
import type { AiUsageSummary, Profile } from '../types/database'

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

/** AI 작성 도우미 사용 허용/차단 — 권한 검사는 DB 함수(set_user_ai_enabled) 안에서 이뤄진다 */
export async function setUserAiEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_user_ai_enabled', {
    target_id: userId,
    enabled,
  })
  if (error) throw error
}

/**
 * 회원별 AI 사용량 요약 → { userId: summary } 맵.
 * ai-assist.sql 실행 전이면 뷰가 없으므로 빈 맵으로 넘어간다(fail-soft).
 */
export async function fetchAiUsageSummary(): Promise<Record<string, AiUsageSummary>> {
  const { data, error } = await supabase.from('ai_usage_summary').select('*')
  if (error) return {}
  const map: Record<string, AiUsageSummary> = {}
  for (const row of (data ?? []) as AiUsageSummary[]) {
    map[row.user_id] = { ...row, total_cost: Number(row.total_cost) || 0 }
  }
  return map
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
