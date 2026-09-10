import { NextRequest, NextResponse } from "next/server";

type ApiProvider = "openai" | "anthropic" | "gemini";

interface WordEntry {
  word: string;
  reading: string;
}

const SYSTEM_PROMPT = `당신은 일본어-한국어 번역 전문가입니다. 일본어 단어 목록이 주어지면 각 단어에 대해 다음 정보를 JSON 배열로 반환합니다:

1. word: 원본 단어 (그대로 유지)
2. reading: 원본 읽기 (그대로 유지)
3. meaning: 한국어 뜻 (간결하게, 1-3개 뜻)
4. pos: 품사 (명사, 동사, い형용사, な형용사, 부사, 접속사, 감탄사, 조사, 문법, 기타 중 하나)

응답은 반드시 유효한 JSON 배열만 반환하세요. 다른 텍스트 없이 JSON만 출력하세요.

예시 입력:
[{"word":"実行","reading":"じっこう"},{"word":"柔道","reading":"じゅうどう"}]

예시 출력:
[{"word":"実行","reading":"じっこう","meaning":"실행, 실시","pos":"명사"},{"word":"柔道","reading":"じゅうどう","meaning":"유도","pos":"명사"}]`;

export async function POST(request: NextRequest) {
  try {
    const { words, apiKey, apiProvider } = await request.json() as {
      words: WordEntry[];
      apiKey: string;
      apiProvider: ApiProvider;
    };

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: "단어 목록이 필요합니다." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API 키가 필요합니다." },
        { status: 400 }
      );
    }

    const userMessage = JSON.stringify(words);

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
      const content = data.content[0]?.text || "[]";
      const parsed = JSON.parse(content);
      return NextResponse.json({ result: parsed });

    } else if (apiProvider === "gemini") {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${SYSTEM_PROMPT}\n\n입력:\n${userMessage}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Gemini API 요청 실패");
      }

      const data = await response.json();
      let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

      // Extract JSON from markdown code block if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      }

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
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OpenAI API 요청 실패");
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content || "[]";

      // Extract JSON from markdown code block if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(content);
      return NextResponse.json({ result: parsed });
    }
  } catch (error) {
    console.error("Translate Words API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
