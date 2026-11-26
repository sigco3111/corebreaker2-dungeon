# 코어브레이커2 : 와장창 던전

던전 보물 테마의 복셀 파괴 슈터입니다. 1인칭 고정 시점에서 투사체를 쏴서 소품을 부수고, 수호 기사의 장비를 모두 부수면 드러나는 코어를 맞혀 몸 전체를 무너뜨립니다.

원작: [sigco3111/everyday-game 의 smash](https://github.com/sigco3111/everyday-game/tree/main/smash). 에셋은 모두 교체하고 시스템을 키운 새 게임입니다.

## 현재 상태 (M1)

구역 8개 중 **2번 구역 "보물방" 한 곳만** 구현되어 있습니다. 나머지 구역은 계획 단계입니다.

- 가로 화면 고정, 플레이어 완전 고정, 시점은 원근을 줄인 B안
- 화면을 눌러(터치) 발사. 부술 물체는 카메라 기준 약 4.8~9.2m 구간에만 배치
- 방문할 때마다 소품 종류와 위치가 바뀜 (같은 구역도 다른 배치)
- 수호 기사: 투구, 방패, 검을 모두 부수면 코어가 드러나고, 코어를 맞히면 몸 전체가 복셀로 무너짐. 장비를 모두 부수기 전에는 몸통이 깎이지 않음
- 코인, 결과 화면, 방문 횟수와 기록을 기기에 저장(localStorage)

![코어 노출](docs/core-exposed.png)
![붕괴 중](docs/collapse.png)

위 화면은 소프트웨어 렌더링 환경에서 스크립트로 진행해 캡처한 것입니다.

## 확인 상태

- 확인함: 헤드리스 브라우저에서 스크립트로 소품 12개 파괴, 장비 3개 파괴, 코어 노출, 붕괴, 결과 화면까지 진행
- 미확인: 사람 손 조작, 터치 조준감, 휴대폰 성능(fps), 움직이는 몸의 파괴(미구현), 효과음(미구현)

## 로드맵

M2 무기 3종과 강화, 도감 / M3 방문별 난이도, 영구 강화, 기록 대시보드 / M4 적 8종 / M5 구역 2~8과 보스 / M6 이펙트와 소리 / M7 마무리

## 에셋과 라이선스

| 에셋 | 출처 | 라이선스 |
| --- | --- | --- |
| KayKit Dungeon Remastered (소품, 벽, 바닥) | Kay Lousberg, https://kaylousberg.itch.io/kaykit-dungeon-remastered | CC0 |
| KayKit Character Pack Adventurers (Knight) | Kay Lousberg, https://kaylousberg.itch.io/kaykit-adventurers | CC0 |
| three.js | https://threejs.org | MIT |

3D 모델은 복셀로 변환해 `props.json`, `knight_demo.json` 으로 저장했습니다.

## 실행

정적 파일입니다. 로컬에서는 `python3 -m http.server` 후 `index.html` 을 엽니다.
