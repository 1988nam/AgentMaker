/**
 * 에이전트 메이커 (Agent Maker) - CLI 대화형 실행 진입점
 */

import readline from "readline";
import { agentGraph } from "./graph.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log("==================================================");
  console.log("🤖 구글 스크립트 기반 AI 에이전트 생성기 '에이전트 메이커'");
  console.log("==================================================");
  console.log("만들고 싶으신 에이전트의 대략적인 기능이나 목표를 말해 주세요.");
  console.log("예: 구글 드라이브 사진을 읽고 일기를 작성하는 다이어리 에이전트\n");

  const initialGoal = await askQuestion("👤 [사용자] 목표 입력: ");
  if (!initialGoal.trim()) {
    console.log("⚠️ 목표를 입력해 주세요. 프로그램을 종료합니다.");
    rl.close();
    return;
  }

  // 초기 상태 설정
  let requirements = `[목표]\n${initialGoal.trim()}`;
  let status = "interviewing";
  let turns = 0;
  let spec = {};
  let code = "";
  let plan = "";
  let errors = "";

  // 인터랙티브 기획 루프 시작
  while (status === "interviewing") {
    // LangGraph 구동
    const resultState = await agentGraph.invoke({
      requirements,
      status,
      turns,
      spec,
      code,
      plan,
      errors
    });

    // 상태 갱신
    status = resultState.status;
    turns = resultState.turns;
    spec = resultState.spec || spec;
    code = resultState.code || code;
    plan = resultState.plan || plan;
    errors = resultState.errors || errors;

    if (status === "spec_completed") {
      console.log("\n🎉 [기획 에이전트] 스펙 설계가 완료되었습니다!");
      console.log("--------------------------------------------------");
      console.log(JSON.stringify(spec, null, 2));
      console.log("--------------------------------------------------");
      break;
    }

    if (resultState.nextQuestion) {
      console.log(`\n🤖 [기획 에이전트] ${resultState.nextQuestion}`);
      const answer = await askQuestion("\n👤 [사용자] 답변: ");
      
      // 요구사항 이력 누적
      requirements += `\n질문: ${resultState.nextQuestion}\n답변: ${answer.trim()}`;
    } else {
      // 혹시 질문이 누락된 경우 루프 방어 처리
      console.log("\n🤖 [기획 에이전트] 추가적인 질문이 요구되지 않습니다.");
      break;
    }
  }

  // 인터뷰 완료 후 설계 ➡️ 코딩 ➡️ 검증 그래프의 남은 파트 자율 실행
  console.log("\n🚀 에이전트 설계 및 자동 코드 생성을 시작합니다...");
  
  try {
    const finalResult = await agentGraph.invoke({
      requirements,
      status: "spec_completed",
      turns,
      spec,
      code: "",
      plan: "",
      errors: ""
    });

    console.log("\n==================================================");
    console.log("🎉 에이전트 생성이 완료되었습니다!");
    console.log("==================================================");
    console.log("결과 상태:", finalResult.status);
    console.log("산출 폴더: agent_maker/generated/ 디렉토리를 확인하세요.");
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ 에이전트 생성 중 오류 발생:", err);
  }

  rl.close();
}

main().catch(console.error);
