/** .env에 Supabase 설정이 없을 때 표시되는 안내 화면 */
export default function ConfigRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-lg border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-900">Supabase 설정이 필요합니다</h1>
        <p className="mt-2 text-sm text-amber-800">
          프로젝트 루트의 <code className="rounded bg-amber-100 px-1">.env</code> 파일에 아래 두
          값을 입력한 뒤 dev 서버를 다시 시작하세요.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-amber-100 p-3 text-xs text-amber-900">
          {'VITE_SUPABASE_URL=https://<프로젝트>.supabase.co\nVITE_SUPABASE_ANON_KEY=<anon 공개 키>'}
        </pre>
        <p className="mt-3 text-sm text-amber-800">
          두 값은 Supabase 대시보드 → Project Settings → API 에서 확인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
