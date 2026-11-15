# 길위의 프랑크푸르트

프랑크푸르트 시내 대중교통 경로를 비교하는 React + Vite 앱입니다. 경로 검색은 서버의 `/api/plan`을 거쳐 Transitous MOTIS v6 API에 연결합니다.

## 로컬 실행

Node.js 20.19 이상 또는 22.12 이상이 필요합니다.

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

`http://127.0.0.1:5173/`을 열면 됩니다. Windows에서는 의존성을 설치한 뒤 `start-local.cmd`를 실행할 수도 있습니다.

## 배포

```powershell
npm.cmd run build
npm.cmd run preview
```

배포 서버는 `dist/` 정적 파일과 `/api/plan` API를 함께 제공합니다. 플랫폼에서 `npm run build` 후 `npm run preview`를 실행하고 `PORT` 및 `HOST`를 환경 변수로 지정하세요. 외부 접근이 필요한 환경에서는 `HOST=0.0.0.0`으로 설정합니다. 정적 파일만 호스팅하면 `/api/plan`이 동작하지 않으므로 서버 또는 동일한 경로의 서버리스 함수를 함께 배포해야 합니다.

## 환경 변수와 키

`.env.example`을 복사해 `.env`를 만들 수 있습니다. `.env`는 Git에서 제외됩니다. 실제 배포에서는 호스팅 플랫폼의 비밀 환경 변수 기능을 사용하세요.

| 변수 | 용도 |
|---|---|
| `UPSTREAM_API_URL` | 서버가 호출할 고정 경로 API URL. 기본값은 Transitous v6 |
| `UPSTREAM_API_KEY` | 추후 제공처가 키를 요구할 때 서버에서만 전송하는 키. 현재 Transitous 연결에는 비워 둠 |
| `UPSTREAM_API_KEY_HEADER` | 키를 보낼 HTTP 헤더 이름. 기본값 `x-api-key` |
| `HOST`, `PORT` | 배포 서버의 바인딩 주소와 포트 |

`VITE_` 접두사가 붙은 변수는 브라우저 빌드에 포함되므로 비밀키에 사용하면 안 됩니다. 이 앱은 키를 클라이언트 코드나 브라우저 저장소에 넣지 않습니다. 제공처 변경 시 응답 형식에 맞춰 `src/api/routes.js`의 변환 로직을 수정해야 합니다.

## 구조

- `src/App.jsx`: 검색 폼, 결과, 지도 컴포넌트와 UI 상태
- `src/api/routes.js`: 경로 요청 및 Transitous 응답 변환
- `src/data/stops.js`: 현재 지원하는 정류장 목록
- `server/plan.js`: 서버에서 고정된 외부 API로 요청 중계 및 선택적 키 전달
- `server/index.js`: 배포용 정적 파일 및 API 서버

정류장 후보는 현재 프랑크푸르트 주요 지점의 고정 목록입니다. 임의 주소 검색과 요금 표시는 지원하지 않습니다. 지도 타일은 OpenStreetMap을 사용합니다.
