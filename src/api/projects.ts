import { supabase } from '../lib/supabase'
import { uploadToR2 } from './r2'
import type { Project, ProjectPost, ProjectPostFile } from '../types/database'

export async function fetchProjectsForGroup(groupId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

/** 내가 속한(그룹원 또는 리더) 모든 그룹의 프로젝트. RLS가 볼 수 있는 것만 돌려준다 */
export async function fetchMyProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function createProject(input: {
  groupId: string
  title: string
  description?: string
  createdBy: string
}): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      group_id: input.groupId,
      title: input.title,
      description: input.description ?? null,
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Project
}

export async function fetchProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw error
  return data as Project | null
}

export async function fetchProjectPosts(projectId: string): Promise<ProjectPost[]> {
  const { data, error } = await supabase
    .from('project_posts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ProjectPost[]
}

export async function fetchProjectPostFiles(postId: string): Promise<ProjectPostFile[]> {
  const { data, error } = await supabase
    .from('project_post_files')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ProjectPostFile[]
}

export interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  url: string
}

/** 서버(api/og-preview.ts)를 거쳐 URL의 OG 메타태그를 가져온다 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.')

  const response = await fetch('/api/og-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  })
  const raw = await response.text()
  let payload: LinkPreview & { error?: string }
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`미리보기를 가져오지 못했습니다 (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(payload.error || `미리보기를 가져오지 못했습니다 (HTTP ${response.status}).`)
  }
  return payload
}

export interface CreateProjectPostInput {
  projectId: string
  authorId: string
  title: string
  content?: string
  image?: File
  video?: File
  link?: LinkPreview
  files?: File[]
  onProgress?: (label: string, percent: number) => void
}

/** 이미지/동영상/파일을 먼저 R2에 올린 뒤, 게시글을 만든다 */
export async function createProjectPost(input: CreateProjectPostInput): Promise<ProjectPost> {
  let imageUrl: string | null = null
  let videoUrl: string | null = null

  if (input.image) {
    const result = await uploadToR2('project', input.projectId, input.image, (p) =>
      input.onProgress?.('image', p),
    )
    imageUrl = result.url
  }
  if (input.video) {
    const result = await uploadToR2('project', input.projectId, input.video, (p) =>
      input.onProgress?.('video', p),
    )
    videoUrl = result.url
  }

  const { data, error } = await supabase
    .from('project_posts')
    .insert({
      project_id: input.projectId,
      author_id: input.authorId,
      title: input.title,
      content: input.content ?? null,
      image_url: imageUrl,
      video_url: videoUrl,
      link_url: input.link?.url ?? null,
      link_title: input.link?.title ?? null,
      link_description: input.link?.description ?? null,
      link_image: input.link?.image ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  const post = data as ProjectPost

  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      const result = await uploadToR2('project', input.projectId, file, (p) =>
        input.onProgress?.(file.name, p),
      )
      const { error: fileError } = await supabase.from('project_post_files').insert({
        post_id: post.id,
        url: result.url,
        name: result.name,
        size: result.size,
      })
      if (fileError) throw fileError
    }
  }

  return post
}

export async function deleteProjectPost(postId: string): Promise<void> {
  const { error } = await supabase.from('project_posts').delete().eq('id', postId)
  if (error) throw error
}
