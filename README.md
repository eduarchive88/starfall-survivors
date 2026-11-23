# 별빛 생존자 (Starfall Survivors)

모바일 브라우저용 도트 그래픽 생존 액션 게임. 빌드 과정 없는 순수 HTML5 Canvas + JS.

- `data.js` 스프라이트(문자열 도트), 캐릭터/무기/패시브/적/웨이브 데이터
- `engine.js` 게임 루프, 전투, 스폰, 렌더링
- `ui.js` 메뉴·레벨업·보물상자·상점 화면, 입력

로컬 실행: `python3 -m http.server` 후 브라우저로 접속.
밸런스 시뮬레이션: `?sim=1&chars=knight,mage&god=0&vac=1` (결과는 `#simout`에 JSON).

폰트: Galmuri (SIL OFL 1.1) — `fonts/OFL.md`
