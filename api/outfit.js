// api/outfit.js — 옷차림 추천 (Claude API 사용)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { temp, humid, wind, pty, dust, weatherType } = req.body;

  const ptyLabel = {
    0: '없음', 1: '비', 2: '비 또는 눈', 3: '눈', 4: '소나기'
  }[parseInt(pty)] ?? '없음';

  const dustLabel =
    dust < 0   ? '정보없음' :
    dust <= 15 ? '좋음' :
    dust <= 35 ? '보통' :
    dust <= 75 ? '나쁨' : '매우나쁨';

  const prompt = `지금 서울 이태원의 날씨 정보야:
- 기온: ${temp}°C
- 습도: ${humid}%
- 풍속: ${wind} m/s
- 강수형태: ${ptyLabel}
- 미세먼지: ${dustLabel}

이 날씨를 바탕으로 출근하는 직장인을 위한 옷차림 추천을 2~3문장으로 짧고 친근하게 한국어로 써줘. 구체적인 옷 종류를 언급해줘. 이모지 1~2개 포함해도 좋아.`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await anthropicRes.json();
    const outfit = data?.content?.[0]?.text ?? '추천을 불러올 수 없어요.';

    return res.status(200).json({ outfit });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
