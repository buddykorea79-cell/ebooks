import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createProjectPost,
  deleteProjectPost,
  fetchLinkPreview,
  fetchProject,
  fetchProjectPostFiles,
  fetchProjectPosts,
  type LinkPreview,
} from '../api/projects'
import { fetchNicknames } from '../api/profiles'
import { fetchSiteSettings } from '../api/settings'
import { formatBytes } from '../api/r2'
import { DEFAULT_UPLOAD_MAX_MB, resolveUploadMaxMb } from '../types/database'
import type { Project, ProjectPost, ProjectPostFile } from '../types/database'
import ErrorAlert from '../components/ErrorAlert'

const inputClass =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

function PostThumbnail({ post }: { post: ProjectPost }) {
  if (post.image_url) {
    return (
      <img
        src={post.image_url}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover"
      />
    )
  }
  if (post.video_url) {
    return (
      <video src={post.video_url} muted className="aspect-video w-full bg-black object-cover" />
    )
  }
  if (post.link_image) {
    return (
      <img
        src={post.link_image}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover"
      />
    )
  }
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-gray-100 text-3xl">
      📎
    </div>
  )
}

function CreatePostForm({
  project,
  onCreated,
  onCancel,
}: {
  project: Project
  onCreated: () => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [video, setVideo] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [maxMb, setMaxMb] = useState(DEFAULT_UPLOAD_MAX_MB)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [progressPercent, setProgressPercent] = useState(0)

  useEffect(() => {
    fetchSiteSettings()
      .then((s) => setMaxMb(resolveUploadMaxMb(s)))
      .catch(() => {})
  }, [])

  async function handleFetchPreview() {
    const url = linkUrl.trim()
    if (!url) return
    setLinkLoading(true)
    setLinkError(null)
    try {
      const preview = await fetchLinkPreview(url)
      setLinkPreview(preview)
    } catch (err) {
      setLinkPreview(null)
      setLinkError(err instanceof Error ? err.message : String(err))
    } finally {
      setLinkLoading(false)
    }
  }

  function checkSize(file: File): boolean {
    if (file.size > maxMb * 1024 * 1024) {
      setError(
        `파일이 너무 큽니다 (${formatBytes(file.size)}). 최대 ${maxMb}MB까지 올릴 수 있습니다.`,
      )
      return false
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await createProjectPost({
        projectId: project.id,
        authorId: user.id,
        title: title.trim(),
        content: content.trim() || undefined,
        image: image ?? undefined,
        video: video ?? undefined,
        link: linkPreview ?? undefined,
        files: files.length > 0 ? files : undefined,
        onProgress: (label, percent) => {
          setProgressLabel(label)
          setProgressPercent(percent)
        },
      })
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`제출에 실패했습니다: ${msg}`)
    } finally {
      setSubmitting(false)
      setProgressLabel(null)
      setProgressPercent(0)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">제출하기</h2>

      <div className="mt-3">
        <label htmlFor="post-title" className="block text-sm font-medium text-gray-700">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-3">
        <label htmlFor="post-content" className="block text-sm font-medium text-gray-700">
          내용
        </label>
        <textarea
          id="post-content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && checkSize(f)) setImage(f)
          }}
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          {image ? `이미지: ${image.name}` : '이미지 올리기'}
        </button>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && checkSize(f)) setVideo(f)
          }}
        />
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          {video ? `동영상: ${video.name}` : '동영상 올리기'}
        </button>

        <input
          ref={filesInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? [])
            const ok = list.filter(checkSize)
            if (ok.length > 0) setFiles((prev) => [...prev, ...ok])
          }}
        />
        <button
          type="button"
          onClick={() => filesInputRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          파일 첨부 ({files.length})
        </button>
      </div>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-gray-500">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {f.name} ({formatBytes(f.size)})
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-red-500 hover:underline"
              >
                제거
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <label htmlFor="post-link" className="block text-sm font-medium text-gray-700">
          URL
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="post-link"
            type="url"
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value)
              setLinkPreview(null)
              setLinkError(null)
            }}
            placeholder="https://…"
            className={`${inputClass} mt-0 flex-1`}
          />
          <button
            type="button"
            onClick={handleFetchPreview}
            disabled={linkLoading || !linkUrl.trim()}
            className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {linkLoading ? '불러오는 중…' : '미리보기'}
          </button>
        </div>
        {linkError && <p className="mt-1 text-xs text-red-600">{linkError}</p>}
        {linkPreview && (
          <div className="mt-2 flex gap-3 rounded border border-gray-200 p-2.5">
            {linkPreview.image && (
              <img
                src={linkPreview.image}
                alt=""
                className="h-16 w-16 shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {linkPreview.title ?? linkPreview.url}
              </p>
              {linkPreview.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                  {linkPreview.description}
                </p>
              )}
              <p className="mt-0.5 truncate text-xs text-brand-600">{linkPreview.url}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}

      {submitting && progressLabel && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {progressLabel} 전송 중 {progressPercent}%
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? '제출 중…' : '제출하기'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          취소
        </button>
      </div>
    </form>
  )
}

function PostDetailModal({
  post,
  authorName,
  canDelete,
  onClose,
  onDeleted,
}: {
  post: ProjectPost
  authorName: string
  canDelete: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const [files, setFiles] = useState<ProjectPostFile[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjectPostFiles(post.id)
      .then(setFiles)
      .catch(() => setFiles([]))
  }, [post.id])

  async function handleDelete() {
    if (!window.confirm(`'${post.title}' 제출물을 삭제할까요?`)) return
    setDeleting(true)
    setError(null)
    try {
      await deleteProjectPost(post.id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{post.title}</h2>
            <p className="text-xs text-gray-400">
              {authorName} · {post.created_at.slice(0, 10)}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        {post.content && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{post.content}</p>
        )}

        {post.image_url && (
          <img src={post.image_url} alt="" className="mt-3 w-full rounded object-contain" />
        )}
        {post.video_url && (
          <video src={post.video_url} controls className="mt-3 w-full rounded bg-black" />
        )}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex gap-3 rounded border border-gray-200 p-2.5 hover:bg-gray-50"
          >
            {post.link_image && (
              <img src={post.link_image} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {post.link_title ?? post.link_url}
              </p>
              {post.link_description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                  {post.link_description}
                </p>
              )}
              <p className="mt-0.5 truncate text-xs text-brand-600">{post.link_url} ↗</p>
            </div>
          </a>
        )}

        {files === null ? (
          <p className="mt-3 text-xs text-gray-400">첨부 파일 확인 중…</p>
        ) : files.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {files.map((f) => (
              <li key={f.id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  📄 <span className="truncate">{f.name}</span>
                  {f.size != null && (
                    <span className="ml-auto shrink-0 text-xs text-gray-400">
                      {formatBytes(f.size)}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {error && (
          <div className="mt-3">
            <ErrorAlert message={error} />
          </div>
        )}

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-4 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user, isAdmin, isGroupLeader } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [posts, setPosts] = useState<ProjectPost[] | null>(null)
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedPost, setSelectedPost] = useState<ProjectPost | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    try {
      setError(null)
      const [p, list] = await Promise.all([fetchProject(projectId), fetchProjectPosts(projectId)])
      setProject(p)
      setPosts(list)
      setNicknames(await fetchNicknames(list.map((post) => post.author_id)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`불러오지 못했습니다: ${msg}`)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  if (!projectId) return null

  return (
    <div>
      <Link to="/projects" className="text-sm text-brand-600 hover:underline">
        ← 프로젝트 목록
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.title ?? '불러오는 중…'}</h1>
          {project?.description && <p className="mt-1 text-sm text-gray-500">{project.description}</p>}
        </div>
        {project && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + 제출하기
          </button>
        )}
      </div>

      {showCreate && project && (
        <CreatePostForm
          project={project}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {posts === null && !error && <p className="mt-6 text-gray-500">불러오는 중…</p>}

      {posts !== null && posts.length === 0 && !showCreate && (
        <p className="mt-6 text-gray-500">아직 제출된 게시글이 없습니다.</p>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
            >
              <PostThumbnail post={post} />
              <div className="flex flex-1 flex-col p-3">
                <h3 className="text-sm leading-snug font-semibold break-keep text-gray-900 group-hover:text-brand-700">
                  {post.title}
                </h3>
                <p className="mt-1 truncate text-xs text-gray-400">
                  {nicknames[post.author_id] ?? '알 수 없음'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          authorName={nicknames[selectedPost.author_id] ?? '알 수 없음'}
          canDelete={selectedPost.author_id === user?.id || isGroupLeader || isAdmin === true}
          onClose={() => setSelectedPost(null)}
          onDeleted={() => {
            setSelectedPost(null)
            load()
          }}
        />
      )}
    </div>
  )
}
