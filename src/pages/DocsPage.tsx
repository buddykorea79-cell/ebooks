import { Link } from 'react-router-dom'

function Code({ children }: { children: string }) {
  return <code className="rounded bg-gray-100 px-1 py-0.5 text-[13px] text-gray-800">{children}</code>
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="text-blue-600">Libro</span>Space 사용 방법
      </h1>
      <p className="mt-3 text-gray-600">
        LibroSpace는 지식이 모이는 공간입니다. 도서·가이드·매뉴얼을 만들고, 계층형 메뉴로
        정리하고, HTML 콘텐츠를 담아 공개할 수 있습니다. 아래 순서대로 따라 하면 첫 도서를
        공개하기까지 5분이면 충분합니다.
      </p>

      <section className="mt-10">
        <h2 className="border-b border-gray-200 pb-2 text-xl font-bold">1. 시작하기</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            오른쪽 위 <strong>로그인 → 회원가입</strong>에서 이메일과 비밀번호(6자 이상)로
            가입합니다. 인증 메일이 오면 링크를 눌러 인증을 완료하세요.
          </li>
          <li>
            비밀번호를 잊었다면 로그인 화면의{' '}
            <Link to="/forgot-password" className="text-blue-600 hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
            에서 재설정 메일을 받을 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-gray-200 pb-2 text-xl font-bold">2. 도서 만들기</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>내 서재 → + 새 도서 만들기</strong>에서 제목을 입력하고 유형을 고릅니다 —{' '}
            <strong>도서</strong>(읽을거리), <strong>가이드</strong>(따라 하기),{' '}
            <strong>매뉴얼</strong>(참고 문서) 중 성격에 맞는 것을 선택하면 홈에서 유형별로
            필터링됩니다.
          </li>
          <li>분류를 정하면 홈 목록에서 해당 분류 섹션에 묶여 보입니다.</li>
          <li>
            <strong>공개</strong> 체크는 나중에 콘텐츠를 다 채운 뒤에 켜도 됩니다. 비공개 상태의
            도서는 나에게만 보입니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-gray-200 pb-2 text-xl font-bold">3. 메뉴(목차) 구성</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
          도서 편집 화면의 <strong>메뉴 관리</strong> 탭에서 책의 목차를 만듭니다. 메뉴는 몇
          단계든 중첩할 수 있습니다.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>+ 새 메뉴</strong> = 최상위 메뉴 추가, 각 행의 <strong>+하위</strong> = 그
            메뉴의 하위 메뉴 추가
          </li>
          <li>
            <Code>↑</Code> <Code>↓</Code> 같은 단계 안에서 순서 이동, <Code>→</Code> 들여쓰기(위
            메뉴의 하위로), <Code>←</Code> 내어쓰기(한 단계 위로 — 하위 메뉴도 함께 이동)
          </li>
          <li>
            <strong>삭제</strong> 시 하위 메뉴가 있으면 함께 삭제됩니다 (경고 창에서 확인 후
            진행)
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-gray-200 pb-2 text-xl font-bold">4. 콘텐츠 등록</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            메뉴 관리 탭에서 <strong>메뉴 이름을 클릭</strong>하면 아래에 HTML 편집기가
            열립니다.
          </li>
          <li>
            왼쪽 편집기에 HTML을 붙여넣고 <strong>저장</strong>을 누르면 오른쪽 미리보기에 바로
            반영됩니다.
          </li>
          <li>
            Claude 등 AI가 만들어 준 <strong>아티팩트 HTML을 전체 문서 그대로</strong>(
            <Code>{'<!doctype html>'}</Code> 포함) 붙여넣어도 됩니다. 스크립트·스타일이 포함된
            인터랙티브 콘텐츠도 안전한 격리 환경(iframe)에서 그대로 동작합니다.
          </li>
          <li>콘텐츠 높이는 뷰어에서 자동으로 조절되므로 따로 신경 쓸 필요가 없습니다.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-gray-200 pb-2 text-xl font-bold">5. 디자인 (CSS)</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>CSS</strong> 탭에서 도서 전용 스타일을 입력하면 뷰어의 셸(사이드바·제목
            영역)에 적용됩니다. 예: <Code>{'aside { background: #f0f7ff; }'}</Code>
          </li>
          <li>
            <strong>콘텐츠에도 적용</strong>을 체크하면 같은 CSS가 각 메뉴의 HTML 콘텐츠
            안에도 주입됩니다. 모든 페이지의 글꼴·색을 통일하고 싶을 때 유용합니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-gray-200 pb-2 text-xl font-bold">6. 공개와 공유</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>기본정보</strong> 탭에서 <strong>공개</strong>를 체크하고 저장하면 홈 목록에
            노출되고 로그인 없이 누구나 볼 수 있습니다.
          </li>
          <li>
            뷰어 주소를 그대로 공유하면 됩니다. 특정 메뉴를 보고 있을 때의 주소를 복사하면{' '}
            <strong>그 메뉴가 바로 열리는 링크</strong>가 됩니다.
          </li>
          <li>공개를 해제하면 즉시 목록에서 사라지고 다시 나에게만 보입니다.</li>
        </ul>
      </section>

      <section className="mt-10 mb-4 rounded-lg border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-base font-bold text-blue-900">자주 묻는 질문</h2>
        <dl className="mt-3 space-y-3 text-sm leading-relaxed text-blue-900/90">
          <div>
            <dt className="font-semibold">Q. 저장한 콘텐츠가 뷰어에 안 보여요.</dt>
            <dd className="mt-0.5">
              도서가 비공개면 다른 사람에게는 보이지 않습니다. 또 메뉴에 HTML을 저장했는지(메뉴
              관리 탭에서 메뉴 이름 클릭 → 저장) 확인하세요.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Q. 비밀번호를 잊었어요.</dt>
            <dd className="mt-0.5">
              <Link to="/forgot-password" className="underline">
                비밀번호 재설정
              </Link>
              에서 가입 이메일을 입력하면 재설정 링크를 보내드립니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Q. 도서를 삭제하면 복구할 수 있나요?</dt>
            <dd className="mt-0.5">
              아니요. 도서를 삭제하면 메뉴와 콘텐츠가 모두 함께 삭제되며 되돌릴 수 없습니다.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
