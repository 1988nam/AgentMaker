/**
 * 다이어리 에이전트 - 구글 앱스 스크립트 템플릿
 * 구글 드라이브 폴더의 사진 파일을 Gemini AI로 전달하여 일기를 생성한 후 스프레드시트에 작성합니다.
 */

// ─── 설정 항목 (AI Agent가 이 값들을 치환하여 생성하게 됩니다) ───
const CONFIG = {
  SPREADSHEET_ID: "{{SPREADSHEET_ID}}",
  GEMINI_API_KEY: "{{GEMINI_API_KEY}}",
  SOURCE_FOLDER_ID: "{{SOURCE_FOLDER_ID}}",
  ARCHIVE_FOLDER_ID: "{{ARCHIVE_FOLDER_ID}}",
  SHEET_NAME: "사진 일기장"
};

/** 메인 실행 함수 */
function runAgent() {
  Logger.log("🚀 다이어리 에이전트 시작");
  
  const files = getSourceFiles();
  if (files.length === 0) {
    Logger.log("📭 분석할 새로운 사진 파일이 없습니다.");
    return;
  }
  
  files.forEach(file => {
    try {
      const mimeType = file.getMimeType();
      if (!mimeType.startsWith("image/")) {
        Logger.log(`⚠️ 이미지 파일이 아닙니다: ${file.getName()}`);
        return;
      }
      Logger.log(`📸 사진 분석 중: ${file.getName()}`);
      
      const diary = generateDiaryFromImage(file);
      saveToSheet(file.getName(), diary);
      
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

function generateDiaryFromImage(file) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  // 이미지를 Base64 문자열로 변환
  const bytes = file.getBlob().getBytes();
  const base64Data = Utilities.base64Encode(bytes);
  const mimeType = file.getMimeType();

  const prompt = `당신은 사진 한 장을 보고 따뜻하고 감성 넘치는 1인칭 일기를 써주는 '다이어리 에이전트'입니다.
첨부된 사진을 깊게 분석하여, 사진 속 상황, 등장 인물, 분위기를 파악해 아래 JSON 포맷으로 작성해 주세요.
출력 포맷 예시:
{
  "title": "일기 제목",
  "content": "생성된 감성 일기 본문 (약 3~4줄)",
  "tags": "#태그1, #태그2"
}`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ]
    }],
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

function saveToSheet(fileName, diary) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(["날짜", "파일명", "제목", "일기 내용", "태그"]);
  }
  sheet.appendRow([
    new Date(),
    fileName,
    diary.title,
    diary.content,
    diary.tags
  ]);
}

function archiveFile(file) {
  const archiveFolder = DriveApp.getFolderById(CONFIG.ARCHIVE_FOLDER_ID);
  file.moveTo(archiveFolder);
}
