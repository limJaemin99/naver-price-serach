/*
 * 네이버 쇼핑 검색 API 프록시 — Cloudflare Pages Function
 * ------------------------------------------------------
 * 기존 server.js 의 '/api/search' 라우트 로직을 그대로 이식했습니다.
 * 파일 경로가 곧 라우트입니다:  functions/api/search.js  →  GET /api/search
 *
 * 브라우저 → (이 Function) → 네이버 오픈 API 로 중계합니다.
 * 네이버 오픈 API는 브라우저 직접 호출(CORS)을 막기 때문에 프록시가 필요합니다.
 *
 * Node 서버(server.js)와 달리 Workers 런타임에서는 fetch() 를 사용합니다.
 * 로직(파라미터 기본값 · 헤더 검사 · 상태코드 전달 · 오류 처리)은 동일합니다.
 */
export async function onRequestGet(context) {
  const { request } = context;
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

    // 로컬 서버의 콘솔 로그 의도 보존 (wrangler pages dev / tail 에서 확인)
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
