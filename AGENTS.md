# Root Yoonsl 작업 규칙

이 저장소는 `https://rootyoonsl.github.io`에 자동 배포되는 개인 블로그다.

## 콘텐츠 원본

- 글: `content/posts/*.md`
- 글 이미지: `content/posts/imgs/`
- 책: `content/books/Booklists.md`
- 음악: `content/musics/musics.md`
- 가사: `content/musics/가사/가사.md`
- 사진: `content/gallery/`

생성된 파일보다 위 원본을 우선해서 수정한다. 글은 현재 사용 중인
`Data`, `Time`, `Title` 프런트매터 형식을 유지한다.

## 변경 후 확인

사이트 기능을 유지한 채 요청한 범위만 수정하고 다음 순서로 확인한다.

1. `npm run lint`
2. `npm test`

`npm test`는 콘텐츠 생성, 정적 사이트 빌드, 화면 구조 검증을 모두
수행한다. 실패한 검증을 무시한 채 배포하지 않는다.

## 자동 배포

사용자가 사이트 반영 또는 배포까지 요청하면 확인을 통과한 변경만
`main` 브랜치에 커밋하고 `origin`으로 푸시한다. 푸시 이후
`.github/workflows/deploy-pages.yml`이 GitHub Pages를 자동 갱신한다.

배포가 시작되면 GitHub Actions 결과를 확인하고, 성공한 경우 실제
`https://rootyoonsl.github.io` 주소가 열리는지 확인한다.
