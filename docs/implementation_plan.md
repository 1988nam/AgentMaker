# 투챙이(Toochangi) 투자 분석 에이전트 구축 및 대시보드 통합 계획

투챙이 투자 분석 에이전트를 개발하고, 기존 가챙이 대시보드와 통합하여 단일 자산 관리 플랫폼으로 사용할 수 있도록 합니다.

## User Review Required

> [!IMPORTANT]
> 투챙이 에이전트를 완성하고 가동하기 위해서는 아래 **Open Questions**에 대한 사용자 정보가 필요합니다. 편하신 방법으로 답변해 주시면 이를 바탕으로 설계를 확정하겠습니다.

## Open Questions

투챙이 에이전트의 구체적 명세 작성을 위해 아래 질문에 대해 답변해 주세요.

1. **구글 스프레드시트 설정:**
   * 기존 가챙이 가계부 시트([Spreadsheet](https://docs.google.com/spreadsheets/d/1RahTa8uculzZR_nv9lmKnSOYJiqBQ6eco2NYaUh18qo/edit))에 새로운 탭(**"투자 기록"**)을 추가하여 통합 관리하시겠습니까? 아니면 별도의 새로운 스프레드시트를 사용하시겠습니까?
2. **구글 드라이브 폴더 설정:**
   * 투자 보고서/기사 파일을 업로드할 **수집 폴더(Source Folder ID)**와 분석 완료 후 파일을 보관할 **보관 폴더(Archive Folder ID)**를 새로 만드셨나요? 만들어진 폴더 ID를 알려주세요.
   * *(아직 만드시지 않았다면 임시 폴더 ID로 세팅해 두고 나중에 수정할 수 있습니다.)*
3. **투자 분석 커스텀 규칙 (Custom Rules):**
   * Gemini가 분석할 때 특별히 적용하고 싶은 규칙이 있으신가요?
   * *예: "해외 미국 주식 리포트만 집중 분석해줘", "특정 종목(예: 삼성전자, 테슬라)이 감지되면 요약에 강조해줘", "매수 의견일 때만 시트에 기록해줘" 등*

---

## Proposed Changes

### [AgentMaker] (구글 앱스 스크립트 에이전트 생성기)

#### [NEW] [toochangi_agent.js](file:///c:/Users/1988n/AgentMaker/generated/toochangi_agent.js)
* 사용자 답변을 토대로 `toochangi_template.js`를 변환하여 최종 Apps Script 소스코드를 생성합니다.

---

### [Gachangi Dashboard] (프론트엔드 대시보드 통합)

#### [MODIFY] [index.html](file:///c:/Users/1988n/.gemini/antigravity-ide/scratch/gachangi-dashboard/index.html)
* 사이드바 메뉴에 **"📈 투자 분석(투챙이)"** 탭을 새롭게 추가합니다.
* 투자 분석 데이터를 표(Table) 형태로 렌더링하고, 에이전트를 수동 실행할 수 있는 관제 콘솔 UI 영역을 정의합니다.

#### [MODIFY] [style.css](file:///c:/Users/1988n/.gemini/antigravity-ide/scratch/gachangi-dashboard/style.css)
* 투자 분석 탭 내 테이블 및 의견(매수/매도/관망) 배지에 맞는 색상 스타일(예: 매수는 Green, 매도는 Red 등)을 가독성 있게 반영합니다.

#### [NEW] [toochangi_controller.js](file:///c:/Users/1988n/.gemini/antigravity-ide/scratch/gachangi-dashboard/js/toochangi_controller.js)
* 브라우저에서 직접 동작하는 투챙이 에이전트 관제 로직을 구현합니다.
* 수집 드라이브 폴더 감시, 텍스트 다운로드, Gemini API 분석 실행 및 시트 기록 단계를 가계부 에이전트(`agent_controller.js`)와 동일한 흐름으로 설계합니다.

#### [MODIFY] [main.js](file:///c:/Users/1988n/.gemini/antigravity-ide/scratch/gachangi-dashboard/js/main.js)
* 탭 전환 핸들러에 투챙이 탭(`toochangi`) 및 관련 데이터 로딩 초기화 이벤트를 바인딩합니다.

#### [MODIFY] [sheets.js](file:///c:/Users/1988n/.gemini/antigravity-ide/scratch/gachangi-dashboard/js/sheets.js)
* 구글 스프레드시트의 `"투자 기록"` 탭에서 데이터를 읽고 행을 추가할 수 있는 API 연동 헬퍼 함수를 추가합니다.

---

## Verification Plan

### Automated Tests
* 없음 (구글 API 및 브라우저 환경에서 동작하는 정적 앱)

### Manual Verification
* **기능 검증**: 대시보드 통합 완료 후, 개발 서버(`npm start`)를 띄워 모바일 및 PC 뷰포트에서 투챙이 탭이 올바르게 로드되는지 확인합니다.
* **에이전트 검증**: 임시 투자 메모/기사 파일을 수집 폴더에 넣고 대시보드에서 `즉시 동기화`를 실행하여 Gemini 분석 및 구글 시트 `"투자 기록"`에 정상 적재되는지 검증합니다.
