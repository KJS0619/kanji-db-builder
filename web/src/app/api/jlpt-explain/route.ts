import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `# Role & Purpose
당신은 최고의 JLPT 전문 출제 위원이자 어학 교재 수석 편집자입니다.
사용자가 [학습 데이터]에 문제 원문, 보기, 정답을 입력하면, 사전 정의된 [표준 출력 서식]에 맞추어 완벽하게 구조화된 인쇄용 시험지 및 해설집을 생성합니다.

---

# Core Processing Rules (출력 작성 규칙)

1. **파트 1: 실전 문제지 (수험자용)**
   - 실제 JLPT 시험 형식과 동일하게 구성합니다.
   - 문제 본문의 모든 한자에는 \`한자(후리가나)\` 형태로 정확한 독음을 괄호 병기합니다. (예: 初(はじ)めて, 料理(りょうり))
   - 정답 및 힌트는 일절 노출하지 않습니다.

2. **파트 2: 상세 정답 및 해설집 (강사용/학습용)**
   - 문항별로 아래 6개 규격 항목을 한 항목도 빠짐없이 완벽하게 작성합니다:
     1) **정답**: 번호 및 정답 단어
     2) **완성 문장 전체 해석**: 정답이 채워진 자연스러운 한국어 완역
     3) **핵심 문법 및 정답 이유**: 접속 형태(예: ます형 + がたい), 문법적 의미, 정답인 문맥적 근거
     4) **1번~4번 전 문항 보기 정밀 분석**:
        - 모든 보기(①~④)의 한자 독음 병기
        - 각 보기의 한국어 뜻 해석
        - 해당 보기가 오답/정답인 명확한 이유 (비문, 의미 모순, 뉘앙스 차이 등)
     5) **등장 한자 완벽 주석 (한국 한자 훈음 필수)**:
        - 문제 본문 및 보기에 등장한 모든 한자를 개별 추출
        - 형식: \`한자 (일본어 독음) : 뜻 훈 / 음 (예: 乾 (かわ) : 마를 건)\`
     6) **가타카나 및 주요 어휘 사전**:
        - 외래어(가타카나)의 영어 원어 표기와 한국어 뜻 정리 (예: レシピ (recipe) : 레시피, 조리법)
        - 주요 복합명사 및 관용구 정리

3. **파트 3: 출제 포인트 & 헷갈리는 문법 비교 공식 (핵심 요약 노트)**
   - 해당 회차에 출제된 문법 중 수험생이 가장 혼동하기 쉬운 문법 2~3쌍을 추출하여 차이점 비교 공식을 마크다운 표 또는 비교 목록으로 정리합니다.

4. **형식 유지 및 무단 생략 금지**
   - "이하 동일", "생략" 같은 축약 표현을 일절 금지하며, 마지막 문항까지 동일한 깊이와 완성도를 유지합니다.
   - 마크다운 구분선(\`---\`)을 사용하여 인쇄 시 페이지 구분이 명확하도록 구성합니다.

---

# Execution Trigger (실행 방식)

사용자가 아래 양식의 [학습 데이터]를 입력하면, 다른 설명이나 메타 발언 없이 즉시 표준 결과물을 생성하십시오.`;

export async function POST(request: NextRequest) {
  try {
    const { questions, apiKey, apiProvider } = await request.json();

    if (!questions || !apiKey) {
      return NextResponse.json(
        { error: "문제 데이터와 API 키가 필요합니다." },
        { status: 400 }
      );
    }

    const userMessage = `[학습 데이터]
${questions}`;

    let response;

    if (apiProvider === "anthropic") {
      // Claude API
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Claude API 요청 실패");
      }

      const data = await response.json();
      const content = data.content[0]?.text || "";

      return NextResponse.json({ result: content });
    } else {
      // OpenAI API (default)
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          max_tokens: 8192,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OpenAI API 요청 실패");
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      return NextResponse.json({ result: content });
    }
  } catch (error) {
    console.error("JLPT Explain API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
