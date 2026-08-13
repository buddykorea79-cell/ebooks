/**
 * 브라우저가 PDF를 화면 안(iframe)에서 직접 보여줄 수 있는지 판정한다.
 *
 * 데스크톱 브라우저에는 내장 PDF 뷰어가 있어 iframe에 주소만 넣어도 잘 열린다.
 * 반면 모바일 브라우저(iOS Safari · Android Chrome)에는 내장 뷰어가 없어
 * 같은 iframe이 빈 화면이 되거나 곧바로 내려받기로 넘어간다.
 * 그런 환경에서는 pdf.js로 우리가 직접 그린다(components/PdfViewer.tsx).
 */
export function canRenderPdfInIframe(): boolean {
  if (typeof navigator === 'undefined') return true

  const ua = navigator.userAgent
  // iPadOS 13+는 UA를 Macintosh로 보낸다 — 터치 포인트로 갈라낸다
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (iPadOS || /Android|iPhone|iPad|iPod/.test(ua)) return false

  // 브라우저가 "내장 뷰어 없음"을 직접 알려주면 그 말을 따른다
  const nav = navigator as Navigator & { pdfViewerEnabled?: boolean }
  return nav.pdfViewerEnabled !== false
}
