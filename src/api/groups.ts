import { supabase } from '../lib/supabase'
import type { Group, GroupMember } from '../types/database'

/** 전체 그룹 목록 (회원가입/정보 수정 화면에서 선택지로 씀) */
export async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('groups').select('*').order('name', { ascending: true })
  if (error) throw error
  return data as Group[]
}

/** 내가 리더인 그룹 목록 */
export async function fetchMyLedGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('leader_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Group[]
}

/** 내가 속한(그룹원 또는 리더) 그룹 목록 */
export async function fetchMyGroups(userId: string): Promise<Group[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
  if (memberError) throw memberError
  const memberGroupIds = (memberRows as { group_id: string }[]).map((r) => r.group_id)

  const { data: ledRows, error: ledError } = await supabase
    .from('groups')
    .select('*')
    .eq('leader_id', userId)
  if (ledError) throw ledError
  const led = ledRows as Group[]

  const remainingIds = memberGroupIds.filter((id) => !led.some((g) => g.id === id))
  let member: Group[] = []
  if (remainingIds.length > 0) {
    const { data, error } = await supabase.from('groups').select('*').in('id', remainingIds)
    if (error) throw error
    member = data as Group[]
  }

  return [...led, ...member]
}

export async function createGroup(name: string, leaderId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name, leader_id: leaderId })
    .select('*')
    .single()
  if (error) throw error
  return data as Group
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data as GroupMember[]
}

export async function removeGroupMember(memberRowId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberRowId)
  if (error) throw error
}
