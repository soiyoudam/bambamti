export default async function handler(req, res) {
  // POST 요청만 허용한다.
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 필수 값이 없으면 400 상태 코드와 오류 메시지를 반환한다.
  const { studentAlias, gradeSummary, learningTraits, teacherConcern } = req.body;
  if (!studentAlias || !gradeSummary || !learningTraits || !teacherConcern) {
    return res.status(400).json({ success: false, error: '필수 데이터가 누락되었습니다.' });
  }

  // process.env.GEMINI_API_KEY가 없으면 500 상태 코드와 “GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.” 오류를 반환한다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.' });
  }

  /*
   * [보안 점검용 주석]
   * 1. 프론트엔드에 API 키를 넣으면 개발자 도구에서 노출될 수 있다.
   * 2. Gemini API 호출은 Vercel Serverless Function에서 처리한다.
   * 3. .env 파일은 GitHub에 올리지 않는다.
   * 4. Vercel 배포 시에는 Project Settings의 Environment Variables에 GEMINI_API_KEY를 등록해야 한다.
   * 5. Gemini로 전송하는 데이터는 이름, 학번, 사진 경로를 제외한 최소 정보로 제한한다.
   */

  const prompt = `
당신은 교사를 돕는 "AI 학생 상담 전략 도우미"입니다.
다음은 교사가 입력한 학생의 익명화된 데이터와 교사의 고민입니다.

[학생 정보]
- 익명: ${studentAlias}
- 성적 요약: ${gradeSummary}
- 학습 특성: ${learningTraits}

[교사의 상담 고민]
${teacherConcern}

[응답 작성 원칙]
1. 학생을 단정적으로 판단하거나 진단하지 마세요. (예: "의지가 부족하다", "주의력 문제가 있다", "심리적 문제가 있다" 등 단정적 표현 금지)
2. 교사가 학생을 이해하고 대화할 수 있도록 돕는 방향으로 응답하세요.
3. 응답은 반드시 다음 형식으로 작성하세요.
   - 현재 상황 요약: (내용)
   - 학생 데이터 기반 해석: (내용)
   - 상담 접근 전략: (내용)
   - 교사가 던질 수 있는 질문 3개: (1. ... 2. ... 3. ...)
   - 피해야 할 말 또는 주의점: (내용)
   - 다음 수업에서 해볼 수 있는 작은 지원: (내용)
`;

  try {
    // gemini-3.1-flash-lite 모델 사용, 내장 fetch를 통해 REST API 호출
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Gemini API 호출 실패');
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error('결과를 파싱할 수 없습니다.');
    }

    // 성공 시 반환
    return res.status(200).json({ success: true, result: resultText });
  } catch (error) {
    // 실패 시 반환
    return res.status(500).json({ success: false, error: error.message });
  }
}
