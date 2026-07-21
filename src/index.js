/*
 * 네이버 쇼핑 검색 API 프록시 — Cloudflare Worker (정적 자산 + API 통합)
 * ------------------------------------------------------------------
 * 기존 server.js 의 두 책임을 하나의 Worker 로 통합했습니다.
 *   1) 정적 페이지(public/index.html) 서빙  → env.ASSETS 바인딩에 위임
 *   2) '/api/search' 프록시               → 아래 handleSearch()
 *
 * 네이버 오픈 API는 브라우저 직접 호출(CORS)을 막으므로 프록시가 필요합니다.
 * Node 서버(server.js)의 https.request 대신 Workers 런타임 fetch() 를 사용하며,
 * 프록시 로직(파라미터 기본값·키 헤더 검사·상태코드 전달·오류 처리)은 동일합니다.
 *
 * 라우팅: [assets] 설정 덕분에 정적 파일과 일치하는 경로(/, /index.html 등)는
 * Worker 를 거치지 않고 바로 서빙되고, 일치하는 자산이 없는 경로만 이 Worker 로 옵니다.
 * 따라서 /api/search 는 이 Worker 가 처리하고, 그 외는 env.ASSETS 로 넘깁니다.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) API 프록시 라우트 (server.js 의 '/api/search' 이식)
    if (url.pathname === '/api/search') {
      return handleSearch(request);
    }

    // 2) 그 외 요청은 정적 자산으로 (public/ 하위 파일)
    return env.ASSETS.fetch(request);
  },
};

async function handleSearch(request) {
  const url = new URL(request.url);

  const query = url.searchParams.get('query') || '';
  const display = url.searchParams.get('display') || '10';
  const start = url.searchParams.get('start') || '1';
  const sort = url.searchParams.get('sort') || 'sim';

  const clientId = request.headers.get('x-naver-client-id');
  const clientSecret = request.headers.get('x-naver-client-secret');

  // server.js 와 동일: 키 헤더가 없으면 400
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ errorCode: 'PROXY_400', errorMessage: 'Client ID/Secret 헤더가 없습니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const apiUrl = 'https://openapi.naver.com/v1/search/shop.json'
    + '?query=' + encodeURIComponent(query)
    + '&display=' + encodeURIComponent(display)
    + '&start=' + encodeURIComponent(start)
    + '&sort=' + encodeURIComponent(sort);

  try {
    const apiRes = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    const body = await apiRes.text();

    // 로컬 서버의 콘솔 로그 의도 보존 (wrangler dev / tail 에서 확인)
    console.log(`"${query}" (sort=${sort}) → HTTP ${apiRes.status}`);

    // 네이버 응답 상태코드를 그대로 전달 (401/429 등 클라이언트가 구분 가능)
    return new Response(body, {
      status: apiRes.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    // server.js 의 PROXY_502 대응
    return new Response(
      JSON.stringify({ errorCode: 'PROXY_502', errorMessage: e.message }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
