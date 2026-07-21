# 네이버 쇼핑 검색 API 테스트 — Cloudflare Pages 배포판

원본 테스트 페이지(`naver-shop-test.html`) + 로컬 프록시 서버(`server.js`)의
**로직을 그대로 보존**하면서 Cloudflare Workers & Pages 에 올릴 수 있도록
구조만 재구성한 배포판입니다. (원본 두 파일은 이 저장소에는 포함하지 않았습니다.)

## 구조

```
cloudflare/
├── public/
│   └── index.html          # 원본 HTML 그대로 (검색 UI · 렌더링 · 키 저장 로직 동일)
├── functions/
│   └── api/
│       └── search.js       # server.js 의 '/api/search' 프록시 로직 이식 (GET /api/search)
├── wrangler.toml           # Pages 설정 (자산 폴더 = public, functions 자동 인식)
└── package.json            # dev / deploy 스크립트
```

### 원본 → Cloudflare 매핑

| 원본(server.js) | Cloudflare |
| --- | --- |
| HTML 서빙 (`/`) | Pages 정적 호스팅 (`public/index.html` 자동 서빙) |
| `/api/search` 프록시 | Pages Function `functions/api/search.js` |
| `https.request` | Workers 런타임 `fetch()` |

HTML의 `fetch('/api/search?...')` 는 **동일 출처 호출**이라 코드 수정 없이 그대로 동작합니다.
(`file://` 경고 배너 로직도 원본 그대로 두었으며, https 배포 환경에서는 표시되지 않습니다.)

## 로컬 실행 (기존 `node server.js` 대체)

```bash
cd cloudflare
npm install
npm run dev          # = wrangler pages dev
```

출력된 `http://localhost:8788` 등으로 접속 → 브라우저에서 Client ID/Secret 입력 후 검색.

## 배포 방법 (택 1)

### A) Wrangler CLI 로 직접 배포

```bash
cd cloudflare
npm install
npx wrangler login   # 최초 1회 Cloudflare 계정 인증
npm run deploy       # = wrangler pages deploy
```

### B) 대시보드 + Git 연동

Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
- **Build output directory**: `public`
- **Root directory**: 이 `cloudflare` 폴더 (레포 하위에 둔 경우 해당 경로 지정)
- Functions(`functions/`)는 자동 인식됩니다.

## API 키 처리 (원본과 동일)

Client ID/Secret 은 **사용자 브라우저에서 입력**되어 요청 헤더
(`X-Naver-Client-Id` / `X-Naver-Client-Secret`)로 전달되고, 브라우저 `localStorage` 에만 저장됩니다.
서버(Function)에는 키를 저장하지 않으며, 유효한 키가 없으면 프록시는 `400 PROXY_400` 을 반환합니다.

> 참고: 키를 서버 측 환경변수(Cloudflare Secret)로 고정하고 싶다면 별도 개편이 필요합니다.
> 현재 버전은 원본 로직 보존을 위해 **헤더 전달 방식**을 유지했습니다.
