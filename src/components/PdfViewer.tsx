import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

/**
 * 모바일용 PDF 뷰어 — 페이지를 <canvas>에 직접 그린다.
 *
 * 모바일 브라우저에는 내장 PDF 뷰어가 없어 <iframe src="...pdf">가 빈 화면이 되거나
 * 내려받기로 넘어간다. 그래서 여기서는 pdf.js가 페이지를 그림으로 바꿔 화면에 붙인다.
 * 데스크톱은 내장 뷰어(검색·인쇄·썸네일)가 더 좋으므로 그대로 iframe을 쓴다
 * — 갈림길은 lib/pdfInline.ts.
 *
 * legacy 번들을 쓰는 이유: 기본 번들은 최신 문법을 그대로 내보내 조금 오래된
 * 모바일 브라우저에서 통째로 죽는다. legacy는 같은 API에 폴리필이 들어 있다.
 */

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/** 부속 자원 위치 — vite.config.ts의 pdfjs-assets 플러그인이 여기에 놓아 준다 */
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`

/**
 * cMapUrl이 없으면 한글 PDF의 글자가 통째로 비거나 깨져 나온다
 * (글꼴을 심지 않고 CID 인코딩만 쓴 문서가 흔하다).
 */
const DOC_OPTIONS = {
  cMapUrl: `${ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
  wasmUrl: `${ASSET_BASE}wasm/`,
  iccUrl: `${ASSET_BASE}iccs/`,
}

/** 고해상도 화면에서 캔버스 메모리가 터지지 않도록 3배 이상은 올리지 않는다 */
const MAX_PIXEL_RATIO = 2
/** 화면에서 이만큼 떨어진 페이지까지만 그려 둔다 (그 밖은 캔버스를 비운다) */
const RENDER_MARGIN = '800px 0px'
/** 확대 단계 — 버튼을 누를 때마다 순환한다 */
const ZOOM_STEPS = [1, 1.5, 2, 3]
/**
 * 첫 화면은 관찰자를 기다리지 않고 바로 그린다.
 * IntersectionObserver는 브라우저가 화면을 실제로 그릴 때 콜백을 주므로,
 * 배경 탭처럼 그리기가 미뤄지는 상황에서는 첫 쪽이 빈 채로 남을 수 있다.
 */
const EAGER_PAGES = 2
/** 첫 페이지를 재기 전에 쓰는 가로세로비 (A4) */
const DEFAULT_ASPECT = 1.414

interface PdfViewerProps {
  url: string
}

export default function PdfViewer({ url }: PdfViewerProps) {
  // 스크롤 컨테이너는 IntersectionObserver의 root로도 쓰이므로 상태로 잡는다
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [availWidth, setAvailWidth] = useState(0)
  const [zoom, setZoom] = useState(1)

  // --- 문서 열기 ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setError(null)
    setPercent(0)

    const task = pdfjs.getDocument({ url, ...DOC_OPTIONS })
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (total > 0) setPercent(Math.min(100, Math.round((loaded / total) * 100)))
    }

    task.promise
      .then(async (pdf) => {
        // 첫 페이지 비율을 재 둔다 — 아직 안 그린 페이지의 자리를 잡는 데 쓴다
        const first = await pdf.getPage(1)
        const view = first.getViewport({ scale: 1 })
        if (cancelled) return
        setAspect(view.height / view.width)
        setDoc(pdf)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      })

    return () => {
      cancelled = true
      // 로딩 작업을 정리하면 문서도 함께 닫힌다
      void task.destroy()
    }
  }, [url])

  // --- 그릴 수 있는 가로 폭 재기 ------------------------------------------
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const measure = () => setAvailWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cycleZoom = useCallback(() => {
    setZoom((current) => {
      const index = ZOOM_STEPS.indexOf(current)
      return ZOOM_STEPS[(index + 1) % ZOOM_STEPS.length]
    })
  }, [])

  const pageWidth = Math.max(0, Math.floor(availWidth * zoom))

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={setScrollEl} className="h-full overflow-auto bg-gray-100 px-2 py-3">
        {/* 폭 재기 전용 — 확대해서 내용이 넘쳐도 이 값은 컨테이너 폭 그대로다 */}
        <div ref={measureRef} className="h-0 w-full" />

        {error && (
          <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800">
            <p className="font-semibold">PDF를 열지 못했습니다.</p>
            <p className="mt-1 break-all text-red-700">{error}</p>
            <p className="mt-2 text-red-700">
              파일이 지워졌거나, R2 버킷의 CORS 설정에 이 사이트 주소와 GET이 빠져 있을 수
              있습니다.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700"
            >
              파일 직접 열기 ↗
            </a>
          </div>
        )}

        {!error && !doc && (
          <p className="py-16 text-center text-sm text-gray-500">
            PDF를 불러오는 중{percent > 0 ? ` ${percent}%` : ''}…
          </p>
        )}

        {doc && pageWidth > 0 && (
          <div className="mx-auto flex w-max min-w-full flex-col items-center gap-3">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                doc={doc}
                pageNumber={i + 1}
                width={pageWidth}
                aspect={aspect}
                root={scrollEl}
              />
            ))}
          </div>
        )}
      </div>

      {doc && (
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2">
          <span className="rounded-full bg-gray-900/70 px-2.5 py-1 text-xs font-medium text-white">
            {doc.numPages}쪽
          </span>
          <button
            type="button"
            onClick={cycleZoom}
            className="pointer-events-auto rounded-full bg-gray-900/70 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {zoom === 1 ? '확대' : `${zoom}배 ↺`}
          </button>
        </div>
      )}
    </div>
  )
}

interface PdfPageProps {
  doc: PDFDocumentProxy
  pageNumber: number
  /** 그릴 가로 폭(CSS px) */
  width: number
  /** 아직 안 그린 페이지의 자리를 잡을 때 쓰는 세로/가로 비 */
  aspect: number
  /** IntersectionObserver root — 스크롤 컨테이너 */
  root: HTMLElement | null
}

/**
 * 한 페이지. 화면 근처에 왔을 때만 그리고, 멀어지면 캔버스를 비운다.
 * 수백 쪽짜리를 한꺼번에 들고 있으면 모바일에서 탭이 그대로 죽는다.
 */
function PdfPage({ doc, pageNumber, width, aspect, root }: PdfPageProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(pageNumber <= EAGER_PAGES)
  const [height, setHeight] = useState(() => Math.round(width * aspect))

  // 폭이 바뀌면(회전·확대) 자리부터 어림잡아 다시 잡는다 — 실제 값은 그린 뒤 들어온다
  useEffect(() => {
    setHeight(Math.round(width * aspect))
  }, [width, aspect])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => setActive(entries[entries.length - 1].isIntersecting),
      { root, rootMargin: RENDER_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [root])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 화면에서 멀어졌으면 비워서 메모리를 돌려준다
    if (!active || width <= 0) {
      canvas.width = 0
      canvas.height = 0
      return
    }

    let cancelled = false
    let task: RenderTask | null = null

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return

        const base = page.getViewport({ scale: 1 })
        const scale = width / base.width
        const view = page.getViewport({ scale })
        setHeight(Math.round(view.height))

        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
        // 캔버스 실제 픽셀은 화면 배율만큼 키우고, CSS 크기는 상자가 잡아 준다
        const render = page.getViewport({ scale: scale * ratio })
        canvas.width = Math.round(render.width)
        canvas.height = Math.round(render.height)

        task = page.render({ canvas, viewport: render })
        await task.promise
      } catch (err) {
        // 스크롤이 빨라 취소된 것은 오류가 아니다
        const name = err instanceof Error ? err.name : ''
        if (!cancelled && name !== 'RenderingCancelledException') {
          console.error(`PDF ${pageNumber}쪽을 그리지 못했습니다.`, err)
        }
      }
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, width, active])

  return (
    <div ref={boxRef} style={{ width, height }} className="shrink-0 bg-white shadow-sm">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
