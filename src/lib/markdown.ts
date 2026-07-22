import { marked } from 'marked'

/**
 * 마크다운 → HTML 변환 (GFM: 표, 취소선 등 지원).
 * 결과는 HtmlViewer의 sandbox iframe 안에서만 렌더링되므로
 * 기존 HTML 콘텐츠와 동일한 격리 수준을 가진다.
 */
export function renderMarkdown(md: string): string {
  return marked.parse(md, { gfm: true, async: false })
}

/** 마크다운 결과물에 입히는 기본 문서 스타일 (iframe 안에서만 적용) */
export const MARKDOWN_BASE_CSS = `
body { font-family: -apple-system, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  line-height: 1.7; color: #1f2937; max-width: 48rem; margin: 0 auto; padding: 4px 2px; }
h1, h2, h3, h4 { line-height: 1.35; margin: 1.6em 0 0.6em; }
h1:first-child, h2:first-child, h3:first-child { margin-top: 0.2em; }
h1 { font-size: 1.7em; } h2 { font-size: 1.4em; } h3 { font-size: 1.15em; }
h1, h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
p { margin: 0.8em 0; }
ul, ol { margin: 0.8em 0; padding-left: 1.6em; }
li { margin: 0.25em 0; }
code { background: #f3f4f6; border-radius: 4px; padding: 0.15em 0.35em; font-size: 0.9em; }
pre { background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 12px 14px; overflow-x: auto; }
pre code { background: none; color: inherit; padding: 0; }
blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 0.8em 0; padding: 0.1em 1em; }
table { border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #d1d5db; padding: 6px 12px; }
th { background: #f9fafb; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.6em 0; }
a { color: #2563eb; }
`
