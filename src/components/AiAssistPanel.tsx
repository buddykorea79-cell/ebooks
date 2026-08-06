import { useState } from 'react'
import type { Book, ContentFormat } from '../types/database'
import { AI_ACTION_LIST, requestAiContent, type AiAction, type AiResponse } from '../api/ai'
import { renderMarkdown } from '../lib/markdown'
import { buildInjectedCss } from '../lib/preview'
import ErrorAlert from './ErrorAlert'
import HtmlViewer from './HtmlViewer'

interface AiAssistPanelProps {
  book: Book
  /** 지금 편집 중인 꼭지의 제목 (AI에게 주는 맥락) */
  sectionTitle: string
  format: ContentFormat
  /** 편집기의 현재 초안 */
  content: string
  /** '반영' — 편집기 본문을 결과로 교체한다 */
  onReplace: (text: string) => void
  /** '이어붙이기' — 편집기 본문 끝에 결과를 덧붙인다 */
  onAppend: (text: string) => void
  disabled?: boolean
}

const chipBase =
  'rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-40'

/** 원화 비용 표시 — 소수점이 나오므로 0.01원 단위까지 */
function formatCost(cost: number): string {
  if (!cost) return '₩0'
  return `₩${cost.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`
}

/**
 * AI 작성 도우미.
 * 결과는 곧바로 저장되지 않는다. '반영'을 누르면 편집기 초안에만 들어가고,
 * 최종 저장은 기존과 똑같이 '저장' 버튼이 담당한다.
 */
export default function AiAssistPanel({
  book,
  sectionTitle,
  format,
  content,
  onReplace,
  onAppend,
  disabled = false,
}: AiAssistPanelProps) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<AiAction>('draft')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiResponse | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [applied, setApplied] = useState<string | null>(null)

  const meta = AI_ACTION_LIST.find((a) => a.value === action) ?? AI_ACTION_LIST[0]
  const isMarkdown = format === 'markdown'
  const hasContent = content.trim().length > 0
  const trimmedInstruction = instruction.trim()

  const blockedReason = meta.requiresContent && !hasContent
    ? '편집기에 본문이 있어야 사용할 수 있는 작업입니다.'
    : meta.requiresInstruction && !trimmedInstruction
      ? '무엇을 써야 할지 지시문을 입력하세요.'
      : null

  async function handleGenerate() {
    if (blockedReason) return
    setBusy(true)
    setError(null)
    setApplied(null)
    try {
      const response = await requestAiContent({
        action,
        format,
        bookId: book.id,
        bookTitle: book.title,
        sectionTitle,
        instruction: trimmedInstruction,
        content,
      })
      setResult(response)
      setShowPreview(false)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function handleReplace() {
    if (!result) return
    if (
      hasContent &&
      !window.confirm('편집기의 현재 본문을 AI 결과로 교체할까요?\n(저장하기 전이라면 되돌릴 수 있습니다)')
    ) {
      return
    }
    onReplace(result.content)
    setApplied('반영했습니다. 확인 후 아래 ‘저장’을 눌러야 최종 반영됩니다.')
  }

  function handleAppend() {
    if (!result) return
    onAppend(result.content)
    setApplied('본문 끝에 이어 붙였습니다. 확인 후 아래 ‘저장’을 눌러야 최종 반영됩니다.')
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.content)
      setApplied('결과를 복사했습니다.')
    } catch {
      setError('복사에 실패했습니다. 결과를 직접 선택해 복사해 주세요.')
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-violet-200 bg-violet-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-sm font-semibold text-violet-900">AI 작성 도우미</span>
          <span className="hidden text-xs text-violet-700/70 sm:inline">
            초안을 만들거나 지금 본문을 다듬습니다
          </span>
        </span>
        <span className="text-xs text-violet-700">{open ? '접기 ▲' : '열기 ▼'}</span>
      </button>

      {open && (
        <div className="border-t border-violet-200 px-4 py-4">
          {/* 작업 선택 */}
          <div className="flex flex-wrap gap-1.5">
            {AI_ACTION_LIST.map((item) => {
              const selected = item.value === action
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setAction(item.value)}
                  disabled={busy || disabled}
                  title={item.hint}
                  className={`${chipBase} ${
                    selected
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-violet-300 bg-white text-violet-800 hover:bg-violet-100'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-gray-600">{meta.hint}</p>

          {/* 지시문 */}
          <label className="mt-3 block">
            <span className="text-xs font-medium text-gray-700">
              지시문{meta.requiresInstruction ? '' : ' (선택)'}
            </span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={busy || disabled}
              placeholder={meta.placeholder}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none disabled:bg-gray-100"
            />
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy || disabled || blockedReason !== null}
              className="rounded bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? '생성 중… (최대 1분)' : result ? '다시 생성' : '생성'}
            </button>
            {blockedReason && <span className="text-xs text-amber-700">{blockedReason}</span>}
            <span className="text-xs text-gray-500">
              {isMarkdown ? '마크다운' : 'HTML'} 형식으로 생성됩니다
            </span>
          </div>

          {error && (
            <div className="mt-3">
              <ErrorAlert message={error} />
            </div>
          )}

          {/* 결과 */}
          {result && (
            <div className="mt-4 rounded border border-gray-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">생성 결과</span>
                  <span className="text-xs text-gray-400">
                    {result.content.length.toLocaleString()}자
                    {result.usage.cost > 0 && ` · ${formatCost(result.usage.cost)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      showPreview ? 'text-gray-500 hover:bg-gray-100' : 'bg-gray-200 font-medium text-gray-800'
                    }`}
                  >
                    원본
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      showPreview ? 'bg-gray-200 font-medium text-gray-800' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    미리보기
                  </button>
                </div>
              </div>

              {result.truncated && (
                <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  출력 길이 제한에 걸려 끝부분이 잘렸습니다. 반영한 뒤 '이어서 쓰기'로 마저 채울 수
                  있습니다.
                </p>
              )}

              <div className="max-h-80 overflow-y-auto">
                {showPreview ? (
                  <HtmlViewer
                    menuId={`ai-preview-${book.id}`}
                    html={isMarkdown ? renderMarkdown(result.content) : result.content}
                    injectedCss={buildInjectedCss(book, format)}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap break-words px-3 py-2 text-xs leading-relaxed text-gray-800">
                    {result.content}
                  </pre>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-3 py-2">
                <button
                  type="button"
                  onClick={handleReplace}
                  disabled={disabled}
                  className={`rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                    action === 'continue'
                      ? 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  반영 (본문 교체)
                </button>
                <button
                  type="button"
                  onClick={handleAppend}
                  disabled={disabled}
                  className={`rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                    action === 'continue'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  본문 끝에 이어붙이기
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  복사
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setApplied(null)
                  }}
                  className="rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                >
                  결과 지우기
                </button>
                {applied && (
                  <span className="text-xs font-medium text-emerald-700">{applied}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
