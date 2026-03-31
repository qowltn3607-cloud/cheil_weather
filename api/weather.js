// api/weather.js — Vercel 서버리스 함수
// 기상청 API 키는 Vercel 환경변수 KMA_API_KEY 에 저장

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 현재 시각 기준으로 base_date, base_time 계산
  const now = new Date();
  // 한국 시간(KST = UTC+9)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const yyyy = kst.getUTCFullYear();
  const mm   = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(kst.getUTCDate()).padStart(2, '0');
  const baseDate = `${yyyy}${mm}${dd}`;

  // 초단기실황: 매시 40분 발표 → 현재 분이 40분 미만이면 한 시간 전
  let h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  if (min < 40) h = h === 0 ? 23 : h - 1;
  const baseTime = `${String(h).padStart(2, '0')}00`;

  // 이태원로 222 격자 좌표
  const NX = 60, NY = 126;

  const apiUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst`
    + `?pageNo=1&numOfRows=1000&dataType=JSON`
    + `&base_date=${baseDate}&base_time=${baseTime}`
    + `&nx=${NX}&ny=${NY}&authKey=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    const items = data?.response?.body?.items?.item;
    if (!items) {
      return res.status(502).json({ error: '기상청 데이터를 받아오지 못했습니다.' });
    }

    // 필요한 값만 추출
    const parsed = {};
    items.forEach(item => {
      parsed[item.category] = item.obsrValue;
    });

    return res.status(200).json({
      temp:     parsed['T1H'] ?? null,   // 기온 (°C)
      humidity: parsed['REH'] ?? null,   // 습도 (%)
      wind:     parsed['WSD'] ?? null,   // 풍속 (m/s)
      rainfall: parsed['RN1'] ?? '0',    // 1시간 강수량 (mm)
      pty:      parsed['PTY'] ?? '0',    // 강수형태 0:없음 1:비 2:비/눈 3:눈 4:소나기
      baseDate,
      baseTime,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
