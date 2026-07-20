import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

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
