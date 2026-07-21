# 네이버 쇼핑 검색 API 테스트 — Cloudflare Worker 배포판

원본 테스트 페이지(`naver-shop-test.html`) + 로컬 프록시 서버(`server.js`)의
**로직을 그대로 보존**하면서 Cloudflare Workers(정적 자산 + API)에 올릴 수 있도록
구조만 재구성한 배포판입니다. (원본 두 파일은 이 저장소에는 포함하지 않았습니다.)

## 구조

```
cloudflare/
├── src/
│   └── index.js            # Worker 엔트리: /api/search 프록시 + 그 외 정적 자산 위임
├── public/
│   └── index.html          # 원본 HTML 그대로 (검색 UI · 렌더링 · 키 저장 로직 동일)
├── wrangler.toml           # Worker 설정 (main + [assets] = public)
└── package.json            # dev / deploy 스크립트
```

### 원본 → Cloudflare 매핑

| 원본(server.js) | Cloudflare Worker |
| --- | --- |
| HTML 서빙 (`/`) | `[assets]` 정적 자산 서빙 (public/index.html) |
| `/api/search` 프록시 | `src/index.js` 의 `handleSearch()` |
| `https.request` | Workers 런타임 `fetch()` |

`[assets]` 설정 덕분에 정적 파일과 일치하는 경로(`/`, `/index.html`)는 Worker 를 거치지 않고
바로 서빙되고, 일치하는 자산이 없는 `/api/search` 만 Worker 가 처리합니다.
HTML의 `fetch('/api/search?...')` 는 **동일 출처 호출**이라 코드 수정 없이 그대로 동작합니다.

## 로컬 실행 (기존 `node server.js` 대체)

```bash
cd cloudflare
npm install
npm run dev          # = wrangler dev
```

출력된 `http://localhost:8787` 로 접속 → 브라우저에서 Client ID/Secret 입력 후 검색.

## 배포 방법

### A) Git 연동 (현재 구성 · 권장)

Cloudflare 대시보드에서 이 저장소를 Worker 로 연결해 두면, `main` 브랜치에 push 할 때마다
빌드가 `npx wrangler deploy` 를 실행해 자동 재배포됩니다. 별도 명령이 필요 없습니다.

> ⚠️ `wrangler.toml` 의 `name` 값(`naver-price-serach`)이 대시보드의 **Worker 이름과 일치**해야
> 같은 Worker 에 배포됩니다. 다르면 `name` 을 대시보드 이름으로 바꿔 주세요.

### B) CLI 로 직접 배포

```bash
cd cloudflare
npm install
npx wrangler login   # 최초 1회 Cloudflare 계정 인증
npm run deploy       # = wrangler deploy
```

## API 키 처리 (원본과 동일)

Client ID/Secret 은 **사용자 브라우저에서 입력**되어 요청 헤더
(`X-Naver-Client-Id` / `X-Naver-Client-Secret`)로 전달되고, 브라우저 `localStorage` 에만 저장됩니다.
서버(Worker)에는 키를 저장하지 않으며, 유효한 키가 없으면 프록시는 `400 PROXY_400` 을 반환합니다.

> 참고: 키를 서버 측 환경변수(Cloudflare Secret)로 고정하고 싶다면 별도 개편이 필요합니다.
> 현재 버전은 원본 로직 보존을 위해 **헤더 전달 방식**을 유지했습니다.
