import { Link } from 'react-router-dom'

function Code({ children }: { children: string }) {
  return <code className="rounded bg-gray-100 px-1 py-0.5 text-[13px] text-gray-800">{children}</code>
}

const SECTIONS = [
  { id: 'start', emoji: '🔑', label: '시작하기' },
  { id: 'create', emoji: '📚', label: '도서 만들기' },
  { id: 'menu', emoji: '🗂️', label: '목차 구성' },
  { id: 'content', emoji: '✍️', label: '콘텐츠 등록' },
  { id: 'ai', emoji: '✨', label: 'AI 작성' },
  { id: 'design', emoji: '🎨', label: '디자인' },
  { id: 'share', emoji: '🌐', label: '공개와 공유' },
  { id: 'groups', emoji: '👥', label: '그룹과 역할' },
  { id: 'projects', emoji: '📋', label: '프로젝트 게시판' },
]

function SectionHeading({
  id,
  emoji,
  title,
}: {
  id: string
  emoji: string
  title: string
}) {
  return (
    <h2 id={id} className="flex scroll-mt-20 items-center gap-2.5 border-b border-gray-200 pb-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-base">
        {emoji}
      </span>
      <span className="text-xl font-bold text-gray-900">{title}</span>
    </h2>
  )
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700">
        📖 이용 안내
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        <span className="text-brand-600">Libro</span>Space 사용 방법
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
        LibroSpace는 지식이 모이는 공간입니다. 도서·가이드·매뉴얼을 만들고, 계층형 메뉴로
        정리하고, HTML 콘텐츠를 담아 <strong className="text-gray-800">전체 공개</strong> 또는{' '}
        <strong className="text-gray-800">그룹공개</strong>로 나눠 볼 수 있습니다. 그룹 단위로는{' '}
        <strong className="text-gray-800">프로젝트 게시판</strong>에서 과제 결과물을 함께 모을 수도
        있어요. 아래 순서대로 따라 하면 첫 도서를 공개하기까지 5분이면 충분합니다. 🚀
      </p>

      {/* 빠른 이동 */}
      <nav className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            <span aria-hidden="true">{s.emoji}</span>
            {s.label}
          </a>
        ))}
      </nav>

      <section className="mt-10">
        <SectionHeading id="start" emoji="🔑" title="1. 시작하기" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            오른쪽 위 <strong>로그인 → 회원가입</strong>에서 닉네임, 이메일, 비밀번호(6자
            이상)로 가입합니다. 닉네임은 화면 상단과 공개 도서의 작성자 이름으로 표시됩니다.
            인증 메일이 오면 링크를 눌러 인증을 완료하세요.
          </li>
          <li>
            속하고 싶은 그룹이 있다면 가입 화면에서 <strong>그룹명 검색</strong>으로 찾아 최대{' '}
            <strong>3개</strong>까지 함께 선택할 수 있습니다 (선택 사항). 나중에{' '}
            <strong>내 정보</strong>에서 언제든 바꿀 수 있어요. 자세한 내용은{' '}
            <a href="#groups" className="text-brand-600 hover:underline">
              8. 그룹과 역할
            </a>
            을 참고하세요.
          </li>
          <li>
            비밀번호를 잊었다면 로그인 화면의{' '}
            <Link to="/forgot-password" className="text-brand-600 hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
            에서 재설정 메일을 받을 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading id="create" emoji="📚" title="2. 도서 만들기" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>내 서재 → + 새 도서 만들기</strong>에서 제목을 입력하고 유형을 고릅니다 —{' '}
            <strong>도서</strong>(읽을거리), <strong>가이드</strong>(따라 하기),{' '}
            <strong>매뉴얼</strong>(참고 문서) 중 성격에 맞는 것을 선택하면 홈에서 유형별로
            필터링됩니다.
          </li>
          <li>분류를 정하면 홈 목록에서 해당 분류 섹션에 묶여 보입니다.</li>
          <li>
            공개 범위는{' '}
            <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              비공개
            </span>{' '}
            ·{' '}
            <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
              공개
            </span>{' '}
            ·{' '}
            <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              그룹공개
            </span>{' '}
            중에서 고를 수 있습니다. 콘텐츠를 다 채운 뒤에 정해도 됩니다 — 자세한 차이는{' '}
            <a href="#share" className="text-brand-600 hover:underline">
              7. 공개와 공유
            </a>
            에서 설명합니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading id="menu" emoji="🗂️" title="3. 메뉴(목차) 구성" />
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
          도서 편집 화면의 <strong>목차 관리</strong> 탭에서 책의 목차를 만듭니다. 메뉴는 몇
          단계든 중첩할 수 있습니다. 이 탭은 <strong>목차 구성만</strong> 다루고, 본문은 다음
          장의 <strong>콘텐츠 작성</strong> 탭에서 씁니다. 목차가 길어져도 편집기가 아래로 밀리지
          않도록 화면을 나눠 두었습니다.
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
            메뉴 이름 앞의 점으로 본문 작성 여부를 알 수 있습니다. <strong>초록색</strong>이면
            본문이 있고, <strong>회색</strong>이면 아직 비어 있습니다.
          </li>
          <li>
            <strong>삭제</strong> 시 하위 메뉴가 있으면 함께 삭제됩니다 (경고 창에서 확인 후
            진행)
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading id="content" emoji="✍️" title="4. 콘텐츠 등록" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            기본정보 탭의 <strong>구성 방식</strong>에서 셋 중 하나를 고릅니다 —{' '}
            <strong>메뉴 구성</strong>(목차를 직접 만들고 메뉴별로 작성),{' '}
            <strong>단일 파일 업로드</strong>(완성된 HTML/MD 파일 하나),{' '}
            <strong>PDF</strong>(PDF 한 개를 원본 그대로). 단일 파일 모드에서 HTML 파일은 메뉴
            없이 전체 화면으로 표시되고, 마크다운 파일은 제목(H1·H2) 기준으로 목차가 자동
            생성됩니다. HTML·MD·PDF 모두 같은 크기 한도(관리자 설정, 기본 50MB)를 따릅니다.
          </li>
          <li>
            <strong>PDF</strong>를 고르면 <strong>PDF 파일</strong> 탭이 나옵니다. 파일을 올리면
            그대로 도서가 되며, 뷰어에서 원본 레이아웃 그대로 보이고{' '}
            <strong>내려받기 ↓</strong> 버튼과 <strong>공유하기</strong> 버튼이 함께 생깁니다.
            다만 목차·본문 편집과 본문 검색은 되지 않습니다.
          </li>
          <li>
            메뉴 구성 모드에서는 기본정보 탭의 <strong>본문 형식</strong>에서 콘텐츠를{' '}
            <strong>HTML</strong>로 쓸지 <strong>마크다운(MD)</strong>으로 쓸지 선택할 수
            있습니다. 마크다운을 선택하면 편집기가 마크다운 문법을 강조하고, 뷰어가 자동으로
            보기 좋은 문서로 변환해 줍니다.
          </li>
          <li>
            <strong>콘텐츠 작성</strong> 탭을 열면 왼쪽에 목차, 오른쪽에 편집기가 나옵니다.
            왼쪽에서 쓸 꼭지를 고르면 오른쪽 편집기가 그 내용으로 바뀝니다. 목차가 길어져도
            왼쪽 목록만 스크롤되므로 편집기는 늘 같은 자리에 있습니다.
          </li>
          <li>
            내용을 입력하고 <strong>저장</strong>(또는 <Code>Ctrl+S</Code>)을 누르면 반영됩니다.
            저장하지 않은 내용이 있으면 제목 아래에 <strong>저장되지 않음</strong>이 표시되고,
            그 상태로 창을 닫으려 하면 브라우저가 한 번 더 물어봅니다.
          </li>
          <li>
            <strong>미리보기 ↗</strong> 버튼을 누르면 <strong>새 창</strong>이 열려 지금 쓰고
            있는 내용을 그대로 보여줍니다. 저장 전이라도 확인할 수 있고, 편집기는 화면 전체를
            쓸 수 있습니다.
          </li>
          <li>
            <strong>이미지</strong>는 세 가지 방법으로 넣습니다 — <strong>🖼 이미지</strong> 버튼,
            편집기에 <strong>붙여넣기(Ctrl+V)</strong>, 편집기로{' '}
            <strong>끌어다 놓기</strong>. 어느 쪽이든 파일이 업로드되고{' '}
            <strong>커서 위치에</strong> 태그가 들어갑니다. PNG·JPG·GIF·WebP·AVIF를 장당 10MB까지
            올릴 수 있고, 여러 장을 한 번에 골라도 됩니다. 같은 이름의 파일을 여러 번 올려도
            서로 덮어쓰지 않습니다.
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
        <SectionHeading id="ai" emoji="✨" title="5. AI로 내용 작성하기" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>콘텐츠 작성</strong> 탭에서 꼭지를 고르면 편집기 위에{' '}
            <strong>AI 작성 도우미</strong> 패널이 나타납니다.{' '}
            <strong>관리자가 사용을 허용한 회원에게만</strong> 보이며, 보이지 않으면 관리자에게
            요청하세요.
          </li>
          <li>
            <strong>새로 작성</strong>(빈 꼭지를 처음부터), <strong>이어서 쓰기</strong>,{' '}
            <strong>다듬기</strong>, <strong>자세히</strong>, <strong>요약</strong>,{' '}
            <strong>직접 지시</strong> 중에서 고르고 지시문을 적은 뒤 <strong>생성</strong>을
            누릅니다.
          </li>
          <li>
            결과는 <strong>원본</strong>과 <strong>미리보기</strong>로 확인할 수 있습니다. 도서의
            본문 형식(HTML·마크다운)에 맞춰 생성되므로 그대로 쓸 수 있습니다.
          </li>
          <li>
            마음에 들면 <strong>반영 (본문 교체)</strong> 또는{' '}
            <strong>본문 끝에 이어붙이기</strong>를 누릅니다. 이때 내용은{' '}
            <strong>편집기에만 들어가고 아직 저장되지 않습니다.</strong> 직접 손질한 뒤{' '}
            <strong>저장</strong>을 눌러야 최종 반영됩니다 — 저장 전이라면 언제든 되돌릴 수
            있습니다.
          </li>
          <li>
            결과가 길어서 끝이 잘렸다는 안내가 뜨면, 반영한 다음{' '}
            <strong>이어서 쓰기</strong>로 나머지를 채우면 됩니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading id="design" emoji="🎨" title="6. 디자인 (CSS)" />
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
        <SectionHeading id="share" emoji="🌐" title="7. 공개와 공유" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>기본정보</strong> 탭에서 공개 범위를 고르고 저장합니다.{' '}
            <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
              공개
            </span>
            는 홈 목록에 노출되고 로그인 없이 누구나 볼 수 있습니다.{' '}
            <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              그룹공개
            </span>
            는 지정한 그룹의 회원(그룹리더 포함)에게만 홈 목록에 함께 보이고, 다른 회원에게는
            보이지 않습니다.{' '}
            <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              비공개
            </span>
            는 나에게만 보입니다.
          </li>
          <li>
            뷰어 화면 상단(또는 사이드바)의 <strong>공유하기</strong> 버튼을 누르면 모바일 등
            공유 기능을 지원하는 기기에서는 공유 시트가 바로 뜨고, 그렇지 않은 브라우저에서는
            지금 보고 있는 도서 주소가 자동으로 클립보드에 복사됩니다 (📋 링크를
            복사했습니다). 특정 메뉴를 보고 있을 때 눌렀다면{' '}
            <strong>그 메뉴가 바로 열리는 링크</strong>가 공유됩니다.
          </li>
          <li>
            공유된 링크를 열었을 때 실제로 보이는지는 그 도서의 공개 범위를 따릅니다 — 그룹공개
            도서 링크를 그룹 밖의 회원이 열면 보이지 않습니다.
          </li>
          <li>공개를 해제하면 즉시 목록에서 사라지고 다시 나에게만 보입니다.</li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading id="groups" emoji="👥" title="8. 그룹과 역할" />
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700">
          그룹은 같은 강의·부서·스터디처럼 묶여 도서와 프로젝트를 함께 보는 회원들의 모임입니다.
          역할은 세 가지입니다.
        </p>
        <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-gray-700">
          <li className="flex items-center gap-2">
            <span className="inline-block rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
              관리자
            </span>
            사이트 전체를 관리하고, 회원을 관리자·그룹리더로 지정하고, 그룹도 직접 만들 수
            있습니다.
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
              그룹리더
            </span>
            자신의 그룹을 만들고 그룹원을 관리하며, 그룹의 프로젝트 게시판을 만들 수 있습니다.
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              회원
            </span>
            그룹에 소속되어 그룹공개 도서를 보고 프로젝트에 제출물을 올릴 수 있습니다.
          </li>
        </ul>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            <strong>내 정보</strong> 화면 위쪽에서 내 역할 배지를 바로 확인할 수 있고, 소속
            그룹은 <strong>그룹명 검색</strong>으로 찾아 최대 <strong>3개</strong>까지 고를 수
            있습니다.
          </li>
          <li>
            그룹리더이거나 관리자면 <strong>내 정보</strong> 화면 아래쪽에{' '}
            <strong>그룹 관리</strong> 카드가 나타납니다. 여기서{' '}
            <strong>+ 새 그룹</strong>으로 그룹을 만들 때 이름과 함께 최대 100자의{' '}
            <strong>설명</strong>도 남길 수 있고, 만든 그룹의 멤버 목록·탈퇴 처리도 이 화면에서
            합니다.
          </li>
          <li>회원가입 화면에서도 그룹명을 검색해 가입과 동시에 그룹을 선택할 수 있습니다.</li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading id="projects" emoji="📋" title="9. 프로젝트 게시판" />
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-gray-700">
          <li>
            로그인하면 홈 화면 상단의 <strong>프로젝트 관리</strong> 버튼(또는 헤더의 같은 이름
            링크)으로 들어갈 수 있습니다. 내가 속한 모든 그룹의 프로젝트가 그룹별로 묶여
            보입니다.
          </li>
          <li>
            <strong>그룹리더</strong>는 <strong>+ 새 프로젝트</strong>로 그룹별 게시판(제목 +
            설명)을 만듭니다. 프로젝트는 과제·실습처럼 결과물을 모으는 단위입니다.
          </li>
          <li>
            프로젝트 안에서는 <strong>그룹원과 그룹리더 모두</strong> <strong>+ 제출하기</strong>
            로 글을 올릴 수 있습니다 — 제목·내용에 더해 <strong>이미지</strong>,{' '}
            <strong>동영상</strong>, <strong>URL</strong>(입력하면 미리보기 카드가 자동으로
            붙습니다), <strong>파일 여러 개</strong>까지 함께 담을 수 있습니다.
          </li>
          <li>
            제출물은 카드형 바둑판으로 표시되고, 클릭하면 상세 내용을 볼 수 있습니다.{' '}
            <strong>작성자 본인, 그룹리더, 관리자</strong>만 삭제할 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mt-10 mb-4 rounded-lg border border-brand-200 bg-brand-50 p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-brand-900">
          <span aria-hidden="true">💬</span> 자주 묻는 질문
        </h2>
        <dl className="mt-3 space-y-3 text-sm leading-relaxed text-brand-900/90">
          <div>
            <dt className="font-semibold">Q. 저장한 콘텐츠가 뷰어에 안 보여요.</dt>
            <dd className="mt-0.5">
              도서가 비공개면 다른 사람에게는 보이지 않습니다. 또 메뉴에 HTML을 저장했는지(메뉴
              관리 탭에서 메뉴 이름 클릭 → 저장) 확인하세요.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Q. 그룹공개로 설정했는데 다른 회원에게 안 보여요.</dt>
            <dd className="mt-0.5">
              정상입니다. 그룹공개 도서는 지정한 그룹 소속 회원(그룹리더 포함)과 관리자에게만
              보입니다. 다른 그룹이나 그룹이 없는 회원에게는 나타나지 않습니다.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Q. 공유하기 버튼을 눌렀는데 반응이 안 보여요.</dt>
            <dd className="mt-0.5">
              공유 시트가 없는 브라우저에서는 화면에 뜨는 팝업 대신 주소가 조용히 클립보드에
              복사됩니다. 아무 입력창에나 붙여넣기(Ctrl+V)해서 복사됐는지 확인해 보세요.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Q. 그룹을 만들고 싶어요.</dt>
            <dd className="mt-0.5">
              그룹리더 또는 관리자만 만들 수 있습니다. 그룹리더 권한이 필요하면 관리자에게
              요청하세요. 권한이 있다면 <strong>내 정보 → 그룹 관리</strong>에서 만들 수
              있습니다.
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
