// api/weather.js — Vercel 서버리스 함수
// 기상청 API 키: KMA_API_KEY
// 에어코리아 API 키: AIR_API_KEY (공공데이터포털 - 한국환경공단 에어코리아)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kmaKey = process.env.KMA_API_KEY;
  const airKey = process.env.AIR_API_KEY;

  if (!kmaKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  // 한국 시간(KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm   = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(kst.getUTCDate()).padStart(2, '0');
  const baseDate = `${yyyy}${mm}${dd}`;
  let h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  if (min < 40) h = h === 0 ? 23 : h - 1;
  const baseTime = `${String(h).padStart(2, '0')}00`;

  const NX = 60, NY = 126;

  // ① 기상청 초단기실황
  const kmaUrl = `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst`
    + `?pageNo=1&numOfRows=1000&dataType=JSON`
    + `&base_date=${baseDate}&base_time=${baseTime}`
    + `&nx=${NX}&ny=${NY}&authKey=${kmaKey}`;

  // ② 에어코리아 PM2.5 — 용산구 측정소 (이태원동)
  const airUrl = airKey
    ? `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty`
      + `?stationName=${encodeURIComponent('이태원동')}&dataTerm=DAILY&pageNo=1&numOfRows=1`
      + `&returnType=json&serviceKey=${airKey}&ver=1.0`
    : null;

  try {
    const kmaRes = await fetch(kmaUrl);
    const kmaData = await kmaRes.json();
    const items = kmaData?.response?.body?.items?.item;
    if (!items) return res.status(502).json({ error: '기상청 데이터를 받아오지 못했습니다.' });

    const parsed = {};
    items.forEach(item => { parsed[item.category] = item.obsrValue; });

    // 미세먼지 파싱 — 실패시 인근 측정소로 순차 시도
    let dust = null;
    const dustDebug = [];
    if (airKey) {
      const stations = ['이태원동', '한강대로', '중구'];
      for (const station of stations) {
        try {
          const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty`
            + `?stationName=${encodeURIComponent(station)}&dataTerm=DAILY&pageNo=1&numOfRows=1`
            + `&returnType=json&serviceKey=${airKey}&ver=1.0`;
          const r = await fetch(url);
          const d = await r.json();
          const item = d?.response?.body?.items?.[0];
          const resultCode = d?.response?.header?.resultCode;
          dustDebug.push({ station, resultCode, pm25: item?.pm25Value ?? 'no item' });
          if (item?.pm25Value && item.pm25Value !== '-') {
            dust = parseFloat(item.pm25Value);
            break;
          }
        } catch (e) {
          dustDebug.push({ station, error: e.message });
        }
      }
    } else {
      dustDebug.push({ error: 'AIR_API_KEY 환경변수 없음' });
    }

    return res.status(200).json({
      temp:     parsed['T1H'] ?? null,
      humidity: parsed['REH'] ?? null,
      wind:     parsed['WSD'] ?? null,
      rainfall: parsed['RN1'] ?? '0',
      pty:      parsed['PTY'] ?? '0',
      dust,
      dustDebug,
      baseDate,
      baseTime,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
