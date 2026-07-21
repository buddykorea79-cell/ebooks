import { supabase } from '../lib/supabase'
import type { Category } from '../types/database'

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as Category[]
}

export async function createCategory(name: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('categories').insert({ name, sort_order: sortOrder })
  if (error) throw error
}

export async function updateCategory(
  id: string,
  patch: { name?: string; sort_order?: number },
): Promise<void> {
  const { error } = await supabase.from('categories').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
