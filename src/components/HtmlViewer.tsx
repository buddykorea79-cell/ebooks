import { useEffect, useMemo, useRef, useState } from 'react'

interface HtmlViewerProps {
  /** 높이 메시지를 구분하는 키 (메뉴 id) */
  menuId: string
  html: string
  /** css_apply_to_content가 켜진 도서의 custom_css — <style>로 선두 주입 */
  injectedCss?: string | null
  minHeight?: number
}

const HEIGHT_MESSAGE_TYPE = 'ebook-content-height'

/**
 * srcDoc 조립: (custom_css <style>) + html_content + 높이 보고 스니펫.
 * 콘텐츠는 sandbox="allow-scripts" iframe에서만 렌더링된다.
 */
function buildSrcDoc(html: string, menuId: string, injectedCss?: string | null): string {
  const cssBlock = injectedCss ? `<style>\n${injectedCss}\n</style>\n` : ''
  const snippet = `
<script>
(function () {
  var menuId = ${JSON.stringify(menuId)};
  var lastHeight = 0;
  function report() {
    var doc = document.documentElement;
    var body = document.body;
    var h = Math.max(doc ? doc.scrollHeight : 0, body ? body.scrollHeight : 0);
    if (h > 0 && h !== lastHeight) {
      lastHeight = h;
      parent.postMessage(
        { type: ${JSON.stringify(HEIGHT_MESSAGE_TYPE)}, menuId: menuId, height: h },
        '*'
      );
    }
  }
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(report);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
  }
  window.addEventListener('load', report);
  setTimeout(report, 0);
})();
</${'script'}>`
  return cssBlock + html + snippet
}

export default function HtmlViewer({ menuId, html, injectedCss, minHeight = 160 }: HtmlViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(minHeight)

  const srcDoc = useMemo(() => buildSrcDoc(html, menuId, injectedCss), [html, menuId, injectedCss])

  // 다른 메뉴로 바뀌면 이전 콘텐츠 높이가 남지 않도록 초기화
  useEffect(() => {
    setHeight(minHeight)
  }, [menuId, minHeight])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; menuId?: string; height?: number } | null
      if (!data || data.type !== HEIGHT_MESSAGE_TYPE || data.menuId !== menuId) return
      if (e.source !== iframeRef.current?.contentWindow) return
      if (typeof data.height === 'number' && Number.isFinite(data.height)) {
        setHeight(Math.max(minHeight, Math.ceil(data.height)))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [menuId, minHeight])

  return (
    <iframe
      ref={iframeRef}
      title={`content-${menuId}`}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="block w-full border-0"
      style={{ height }}
    />
  )
}
