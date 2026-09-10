import { NextRequest, NextResponse } from "next/server";

type ApiProvider = "openai" | "anthropic" | "gemini";

const SYSTEM_PROMPT = `당신은 일본어 단어장 OCR 텍스트를 파싱하는 전문가입니다.

주어진 텍스트에서 일본어 단어와 읽기(히라가나)를 추출하세요.

규칙:
1. 한자 단어와 히라가나 읽기 쌍을 찾습니다
2. OCR 오류를 수정합니다 (예: "じ っ こう" → "じっこう")
3. 노이즈 문자(|, ー, 숫자 등)는 무시합니다
4. 중복을 제거합니다
5. 최소 2글자 이상의 읽기만 포함합니다

출력: JSON 배열만 반환 (다른 텍스트 없이)
형식: [{"word":"한자단어","reading":"히라가나읽기"}, ...]

예시 입력:
"47 実行 じ っ こう (する) | 48 実物 じつぶつ"

예시 출력:
[{"word":"実行","reading":"じっこう"},{"word":"実物","reading":"じつぶつ"}]`;

export async function POST(request: NextRequest) {
  try {
    const { text, apiKey, apiProvider } = await request.json() as {
      text: string;
      apiKey: string;
      apiProvider: ApiProvider;
    };

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: "텍스트와 API 키가 필요합니다." },
        { status: 400 }
      );
    }

    // Truncate if too long
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

    let response;

    if (apiProvider === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: truncatedText }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Claude API 요청 실패");
      }

      const data = await response.json();
      const content = data.content[0]?.text || "[]";
      const parsed = JSON.parse(content);
      return NextResponse.json({ result: parsed });

    } else if (apiProvider === "gemini") {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n입력:\n${truncatedText}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Gemini API 요청 실패");
      }

      const data = await response.json();
      let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) content = jsonMatch[1].trim();
      const parsed = JSON.parse(content);
      return NextResponse.json({ result: parsed });

    } else {
      // OpenAI
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: truncatedText },
          ],
          max_tokens: 4096,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OpenAI API 요청 실패");
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content || "[]";
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) content = jsonMatch[1].trim();
      const parsed = JSON.parse(content);
      return NextResponse.json({ result: parsed });
    }
  } catch (error) {
    console.error("Parse Words API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
