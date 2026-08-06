import type { Book, ContentFormat } from '../types/database'
import { MARKDOWN_BASE_CSS, renderMarkdown } from './markdown'

/**
 * 콘텐츠에 주입할 CSS.
 * 마크다운 기본 스타일 + (도서에서 '콘텐츠에도 적용'을 켠 경우) 도서 전용 CSS.
 */
export function buildInjectedCss(book: Book, format: ContentFormat): string | null {
  return (
    [
      format === 'markdown' ? MARKDOWN_BASE_CSS : '',
      book.css_apply_to_content ? (book.custom_css ?? '') : '',
    ]
      .filter(Boolean)
      .join('\n') || null
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface PreviewOptions {
  /** 창 제목 줄에 표시할 이름 (메뉴 제목 등) */
  title: string
  /** 원문 (HTML 또는 마크다운) */
  content: string
  format: ContentFormat
  css: string | null
  /** 상단 바에 덧붙일 설명 */
  note?: string
}

/**
 * 새 창으로 콘텐츠를 미리본다. 실패하면 사용자에게 보여줄 사유를 돌려준다.
 *
 * ⚠️ 콘텐츠는 반드시 sandbox iframe 안에서만 렌더링한다.
 *    팝업 문서에 직접 쓰면 앱과 같은 출처라, 붙여넣은 HTML의 <script>가
 *    localStorage의 로그인 토큰에 접근할 수 있다.
 */
export function openContentPreview(options: PreviewOptions): string | null {
  const { title, content, format, css, note } = options

  const win = window.open('', '_blank', 'width=1024,height=860')
  if (!win) {
    return '팝업이 차단되어 미리보기 창을 열지 못했습니다. 브라우저 주소창의 팝업 차단을 해제해 주세요.'
  }

  const heading = escapeHtml(title || '미리보기')
  const subtitle = escapeHtml(note ?? '')

  win.document.open()
  win.document.write(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>미리보기 — ${heading}</title><style>` +
      `*{box-sizing:border-box}` +
      `html,body{margin:0;height:100%}` +
      `body{display:flex;flex-direction:column;background:#f9fafb;` +
      `font-family:system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif}` +
      `header{flex:none;display:flex;align-items:baseline;gap:10px;padding:10px 16px;` +
      `background:#fff;border-bottom:1px solid #e5e7eb}` +
      `h1{margin:0;font-size:14px;font-weight:600;color:#111827;` +
      `overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` +
      `p{margin:0;font-size:12px;color:#6b7280;flex:none}` +
      `iframe{flex:1;width:100%;border:0;background:#fff}` +
      `</style></head><body>` +
      `<header><h1>${heading}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</header>` +
      `<iframe id="preview" sandbox="allow-scripts"></iframe>` +
      `</body></html>`,
  )
  win.document.close()

  // srcdoc은 속성 이스케이프가 까다로워 DOM으로 직접 넣는다
  const frame = win.document.getElementById('preview') as HTMLIFrameElement | null
  if (frame) {
    const body = format === 'markdown' ? renderMarkdown(content) : content
    frame.srcdoc = css ? `<style>\n${css}\n</style>\n${body}` : body
  }

  win.focus()
  return null
}
