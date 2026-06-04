/**
 * 투챙이 - 투자 전략 분석 구글 앱스 스크립트 템플릿
 * 구글 드라이브의 보고서/기사 파일을 읽어 Gemini AI로 투자 전략 분석 후 시트에 적재합니다.
 */

// ─── 설정 항목 (AI Agent가 이 값들을 치환하여 생성하게 됩니다) ───
const CONFIG = {
  SPREADSHEET_ID: "{{SPREADSHEET_ID}}",
  GEMINI_API_KEY: "{{GEMINI_API_KEY}}",
  SOURCE_FOLDER_ID: "{{SOURCE_FOLDER_ID}}",
  ARCHIVE_FOLDER_ID: "{{ARCHIVE_FOLDER_ID}}",
  SHEET_NAME: "투자 기록"
};

/** 메인 실행 함수 */
function runAgent() {
  Logger.log("🚀 투챙이 투자 분석 에이전트 시작");
  
  // 1. 구글 드라이브 감시 및 파일 목록 조회
  const files = getSourceFiles();
  if (files.length === 0) {
    Logger.log("📭 분석할 새로운 파일이 없습니다.");
    return;
  }
  
  // 2. 각 파일 분석 및 시트 적재
  files.forEach(file => {
    try {
      const content = file.getContentAsString();
      Logger.log(`📄 파일 분석 중: ${file.getName()}`);
      
      const analysis = analyzeWithGemini(content);
      saveToSheet(file.getName(), analysis);
      
      // 아카이브 폴더로 이동
      archiveFile(file);
      Logger.log(`✅ 분석 완료 및 아카이브 이동: ${file.getName()}`);
    } catch (e) {
      Logger.log(`❌ 에러 발생 (${file.getName()}): ${e.toString()}`);
    }
  });
}

function getSourceFiles() {
  const folder = DriveApp.getFolderById(CONFIG.SOURCE_FOLDER_ID);
  const files = folder.getFiles();
  const list = [];
  while (files.hasNext()) {
    list.push(files.next());
  }
  return list;
}

function analyzeWithGemini(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const prompt = `당신은 전문 투자 분석 에이전트 '투챙이'입니다. 아래 텍스트를 보고 핵심 요약, 관련 종목, 투자 의견(매수/매도/관망), 목표 기간을 JSON 형태로 도출해 주세요.
출력 포맷 예시:
{
  "summary": "핵심 내용 요약",
  "stocks": "관련 주식 종목명",
  "opinion": "매수",
  "duration": "단기"
}
텍스트 내용:
${text}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const resText = response.getContentText();
  const resJson = JSON.parse(resText);
  return JSON.parse(resJson.candidates[0].content.parts[0].text);
}

function saveToSheet(fileName, analysis) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(["날짜", "파일명", "투자 요약", "관련 종목", "투자 의견", "목표 기간"]);
  }
  sheet.appendRow([
    new Date(),
    fileName,
    analysis.summary,
    analysis.stocks,
    analysis.opinion,
    analysis.duration
  ]);
}

function archiveFile(file) {
  const archiveFolder = DriveApp.getFolderById(CONFIG.ARCHIVE_FOLDER_ID);
  file.moveTo(archiveFolder);
}
