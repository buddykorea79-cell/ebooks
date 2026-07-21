import { supabase } from '../lib/supabase'
import type { SiteSettings } from '../types/database'

/** site_settings 테이블이 없거나 행이 없으면 null (fail-soft는 호출부에서) */
export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data as SiteSettings | null
}

export async function updateRecommendEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .update({ recommend_enabled: enabled })
    .eq('id', 1)
  if (error) throw error
}
