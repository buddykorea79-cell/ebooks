import { supabase } from '../lib/supabase'
import type { HomeLayout, SiteSettings } from '../types/database'

/** site_settings 테이블이 없거나 행이 없으면 null (fail-soft는 호출부에서) */
export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data as SiteSettings | null
}

export interface SiteSettingsPatch {
  recommend_enabled?: boolean
  home_layout?: HomeLayout
  home_featured_count?: number
}

export async function updateSiteSettings(patch: SiteSettingsPatch): Promise<void> {
  const { error } = await supabase.from('site_settings').update(patch).eq('id', 1)
  if (error) throw error
}
