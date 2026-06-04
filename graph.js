import { StateGraph, Annotation } from "@langchain/langgraph";
import { ChatGoogleGenAI } from "@langchain/google-genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PROMPTS } from "./prompts.js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, ".env") });

// 1. 상태(State) 정의
const AgentState = Annotation.Root({
  requirements: Annotation.String,
  spec: Annotation.Object,
  code: Annotation.String,
  plan: Annotation.String,
  errors: Annotation.String,
  status: Annotation.String,
  nextQuestion: Annotation.String,
  turns: Annotation.Number,
});

// Gemini 모델 초기화
const model = new ChatGoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-2.5-flash",
  temperature: 0.2,
});

// 2. 노드(Node) 구현

// 인터뷰어 노드: 사용자의 요구사항을 묻고 JSON 스펙 또는 다음 질문 도출
async function interviewerNode(state) {
  console.log("\n💬 [기획 에이전트] 사양 검토 중...");
  
  const response = await model.invoke([
    { role: "system", content: PROMPTS.INTERVIEWER },
    { role: "user", content: `현재 누적 요구사항:\n${state.requirements}\n\n이전 질문 및 에이전트 상태 정보:\n턴 수: ${state.turns || 0}` }
  ]);

  const contentText = response.content.toString().trim();
  
  // JSON 완성이 되었는지 확인
  if (contentText.includes("spec_completed")) {
    try {
      // JSON 파싱 (마크다운 백틱 등 정제)
      const cleanJsonStr = contentText.replace(/```json|```/g, "").trim();
      const parsedSpec = JSON.parse(cleanJsonStr);
      
      return {
        spec: parsedSpec,
        status: "spec_completed",
        nextQuestion: "",
        turns: (state.turns || 0) + 1
      };
    } catch (e) {
      console.warn("⚠️ JSON 파싱 오류 발생, 다시 질문으로 유도합니다.", e);
    }
  }

  // 아직 사양이 불충분하여 사용자에게 다음 질문을 던져야 함
  return {
    nextQuestion: contentText,
    status: "interviewing",
    turns: (state.turns || 0) + 1
  };
}

// 아키텍트/플래너 노드: 구현 계획 설계
async function plannerNode(state) {
  console.log("\n📐 [아키텍트 에이전트] 구현 계획 수립 중...");
  
  const specJsonStr = JSON.stringify(state.spec, null, 2);
  const response = await model.invoke([
    { role: "system", content: PROMPTS.PLANNER },
    { role: "user", content: `확정된 요구사항 스펙:\n${specJsonStr}` }
  ]);

  return {
    plan: response.content.toString().trim(),
    status: "planning"
  };
}

// 코더 노드: 스펙과 계획을 바탕으로 구글 앱스 스크립트 코드 생성
async function coderNode(state) {
  console.log("\n💻 [개발 엔지니어 에이전트] 구글 앱스 스크립트 코딩 중...");
  
  // 템플릿 로드
  const agentType = state.spec.agent_type || "custom";
  let templateCode = "";
  try {
    const templatePath = path.join(__dirname, "templates", `${agentType}_template.js`);
    if (fs.existsSync(templatePath)) {
      templateCode = fs.readFileSync(templatePath, "utf8");
    } else {
      // 템플릿이 없는 경우 기본 custom 뼈대 생성
      templateCode = `function runAgent() {\n  Logger.log("커스텀 에이전트 구동 시작");\n  // TODO: 구현 필요\n}`;
    }
  } catch (e) {
    console.error("템플릿 로드 에러:", e);
    templateCode = `function runAgent() {}`;
  }

  const specJsonStr = JSON.stringify(state.spec, null, 2);
  
  let promptContent = `[기본 템플릿 코드]\n${templateCode}\n\n[치환 변수들 및 명세]\n${specJsonStr}\n\n[구현 계획]\n${state.plan}`;
  
  // 만약 이전에 코드 에러(errors)가 있었던 경우 자가 치유(Self-Correction) 프롬프트 작동
  let systemPrompt = PROMPTS.CODER;
  if (state.errors) {
    console.log("🩹 [자가 치유] 문법 에러 발견됨. 코드 수정 작업을 진행합니다...");
    systemPrompt = PROMPTS.REFLECTOR;
    promptContent = `[이전 생성 코드]\n${state.code}\n\n[발생한 문법 에러 로그]\n${state.errors}`;
  }

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: promptContent }
  ]);

  let codeText = response.content.toString().trim();
  // 마크다운 백틱 및 언어 표기 제거
  codeText = codeText.replace(/```javascript|```js|```/g, "").trim();

  return {
    code: codeText,
    errors: "", // 에러 클리어
    status: "coding"
  };
}

// 검토/테스터 노드: 코드의 Syntax를 검증
async function verifyNode(state) {
  console.log("🔍 [품질 검토 에이전트] 코드 구문 오류 분석 및 검토 중...");
  
  const code = state.code;
  let syntaxError = "";

  try {
    // Node.js의 new Function() 생성자 실행을 통해 기본적인 Syntax 오류(괄호 불일치, 구문 오류 등) 감지
    // 구글 앱스 스크립트 특성(UrlFetchApp, DriveApp 등 내장 전역 객체)을 모방하기 위해 더미 전역 객체 선언 주입
    const testFunction = new Function(
      "Logger", "UrlFetchApp", "DriveApp", "SpreadsheetApp", "Utilities",
      `return (function() { ${code} })()`
    );
  } catch (err) {
    syntaxError = err.toString();
    console.log(`❌ 문법 에러 감지: ${syntaxError}`);
  }

  if (syntaxError) {
    return {
      errors: syntaxError,
      status: "verifying"
    };
  }

  // 성공 시 generated 폴더에 파일 생성
  const genDir = path.join(__dirname, "generated");
  if (!fs.existsSync(genDir)) {
    fs.mkdirSync(genDir);
  }

  const agentType = state.spec.agent_type || "custom";
  const outputPath = path.join(genDir, `${agentType}_agent.js`);
  fs.writeFileSync(outputPath, code, "utf8");

  console.log(`✨ 검증 통과! 에이전트 파일이 정상 저장되었습니다:\n📁 ${outputPath}`);

  return {
    status: "done",
    errors: ""
  };
}

// 3. 상태 천이 라우팅(Conditional Routing) 함수 정의
function shouldContinue(state) {
  if (state.status === "spec_completed") {
    return "plan";
  }
  if (state.status === "done") {
    return "end";
  }
  if (state.errors) {
    return "coder"; // 자가 치유를 위해 다시 코딩 단계로 환류
  }
  if (state.status === "coding") {
    return "verify";
  }
  if (state.status === "planning") {
    return "coder";
  }
  return "end";
}

// 4. LangGraph 그래프 생성 및 컴파일
const workflow = new StateGraph(AgentState)
  .addNode("interviewer", interviewerNode)
  .addNode("plan", plannerNode)
  .addNode("coder", coderNode)
  .addNode("verify", verifyNode);

// 그래프 시작점 및 엣지 바인딩
workflow.addEdge("__start__", "interviewer");

// 조건부 엣지 정의
workflow.addConditionalEdges("interviewer", shouldContinue, {
  plan: "plan",
  end: "__end__",
});

workflow.addEdge("plan", "coder");

workflow.addEdge("coder", "verify");

workflow.addConditionalEdges("verify", shouldContinue, {
  coder: "coder", // 자가 치유 환류 루프
  end: "__end__",
});

export const agentGraph = workflow.compile();
