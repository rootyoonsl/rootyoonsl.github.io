# YOONSL

글과 책, 음악, 사진을 모아두는 윤슬의 개인 블로그입니다.

## 로컬에서 열기

Node.js 22 이상이 설치된 상태에서 아래 명령을 실행합니다.

```bash
npm install
npm run dev
```

화면에 표시되는 `Local` 주소를 브라우저에서 열면 됩니다.

## 새 글 추가하기

`content/posts` 아래에 Markdown 파일을 추가합니다. 현재 글과 같은
방식으로 파일 맨 위에 날짜, 시간, 제목을 적습니다.

```md
---
Data: "2026-03-08"
Time: "14:30"
Title: "새 글의 제목"
---

여기부터 글을 작성합니다.
```

- `Data` 형식은 `YYYY-MM-DD`, `Time` 형식은 `HH:MM`입니다.
- 같은 날짜의 글은 `Time`이 늦은 글부터 정렬됩니다.
- `260308.md`처럼 날짜를 파일명으로 사용하면 해당 숫자가 게시글의
  고정 주소가 되어 GitHub Pages에서도 안정적으로 열립니다.
- `Title`은 선택 사항입니다. 제목이 없으면 1단계
  제목을 사용하고, 1단계 제목도 없으면 Markdown 파일명을 제목으로
  사용합니다.
- 이미지는 `content/posts/imgs`에 넣고
  `![설명](imgs/파일명.jpg)`처럼 연결합니다.
- 본문에서 `$...$`는 인라인 수식, `$$...$$`는 별도 줄 수식으로
  표시됩니다.
- 내용이 전혀 없는 Markdown 파일은 작성 중인 초안으로 보고 목록에서
  제외합니다.

글을 추가한 뒤 로컬 화면을 다시 시작하면 날짜순으로 자동 정렬됩니다.

## 책·음악·사진 수정하기

- 책: `content/books/Booklists.md`
- 음악: `content/musics/musics.md`
- 가사: `content/musics/가사/가사.md`
- 사진: `content/gallery`

책은 교보문고 링크로, 음악은 아티스트명 아래에 YouTube 링크와 곡명을
차례로 적습니다. 사진은 원본 파일을 폴더에 추가하면 촬영일 순으로
정리되고 화면용 이미지가 자동으로 만들어집니다.

## 확인 명령

```bash
npm run build
npm test
```

## 자동 배포

`main` 브랜치에 변경 사항이 올라오면 GitHub Actions가 글·책·음악·사진을
다시 생성하고 검증한 뒤 `https://rootyoonsl.github.io`에 자동으로
배포합니다. Actions 화면의 `Deploy Root Yoonsl` 작업은 필요할 때 직접
실행할 수도 있습니다.
