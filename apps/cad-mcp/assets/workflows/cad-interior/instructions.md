# CAD Interior Design Workflow

<workflow>

<critical>사용자 응답을 기다리세요. 혼자 답하지 마세요.</critical>
<critical>LLM의 디자인 지식을 활용하세요. 여기에 디자인 이론은 적지 않습니다.</critical>
<critical>CAD 특화 정보만 제공합니다.</critical>

<checkpoint-handlers>
  <on-complete>mama_save로 결정 기록</on-complete>
  <on-visual-change>bash capture로 결과 보여주기</on-visual-change>
</checkpoint-handlers>

<!-- ============================================================ -->
<!-- STEP 1: DISCOVERY -->
<!-- ============================================================ -->

<step n="1" goal="무엇을 만들지 파악">

<action>사용자에게 어떤 공간을 만들고 싶은지 물어보세요</action>

<action>레퍼런스 이미지가 있다면 분석하세요</action>

<action>스타일 방향을 함께 탐색하세요</action>

<checkpoint title="Vision Confirmed">
공간 유형과 스타일 방향이 명확해지면:
mama_save({ type: 'decision', topic: 'interior:vision', decision: '요약' })

[c] Continue to Planning
</checkpoint>

</step>

<!-- ============================================================ -->
<!-- STEP 2: PLANNING -->
<!-- ============================================================ -->

<step n="2" goal="색상과 재료 결정">

<action>스타일에 맞는 색상 팔레트를 함께 결정하세요</action>

<action>재료와 질감을 선택하세요</action>

<cad-note>
isometric 3면 색상: top/left/right 밝기 변형 필요
예: 나무톤 → top: #D4A574, left: #B8956A, right: #C49A6C
</cad-note>

<checkpoint title="Palette Confirmed">
mama_save({ type: 'decision', topic: 'interior:palette', decision: '색상/재료' })

[c] Continue to Architecture
</checkpoint>

</step>

<!-- ============================================================ -->
<!-- STEP 3: ARCHITECTURE -->
<!-- ============================================================ -->

<step n="3" goal="공간 구조 계획">

<action>공간 크기와 영역을 결정하세요</action>

<action>배치와 동선을 계획하세요</action>

<cad-note>
크기 기준 (픽셀):
- 소형: 200x200 (~4평 느낌)
- 중형: 300x300 (~9평 느낌)
- 대형: 400x400 (~16평 느낌)

z-order: 뒤쪽 벽 → 바닥 → 뒤쪽 가구 → 앞쪽 가구
</cad-note>

<checkpoint title="Architecture Confirmed">
mama_save({ type: 'decision', topic: 'interior:architecture', decision: '구조' })

[c] Continue to Creation
</checkpoint>

</step>

<!-- ============================================================ -->
<!-- STEP 4: CREATION -->
<!-- ============================================================ -->

<step n="4" goal="CAD로 제작">

<action>계획에 따라 코드를 작성하세요</action>

<action>각 단계마다 캡처로 확인하고 피드백 받으세요</action>

<build-order critical="true">
1. 바닥 (rect3d)
2. 벽 (rect3d/box3d)
3. 구조물 (복층, 계단)
4. 대형 가구
5. 중형 가구
6. 소품
</build-order>

<tools>
write/edit → 자동 실행됨 → bash capture로 결과 확인
- write({ file: 'main', code: '...' }): 전체 작성 (자동 실행)
- edit({ file, old_code, new_code }): 부분 수정 (자동 실행)
- bash({ command: 'capture' }): 코드 실행 후 결과 캡처
- bash({ command: 'tree' }): 구조 확인
</tools>

<iterate>
코드 작성 → 자동 실행 → 캡처 → 피드백 → 수정
</iterate>

<checkpoint title="Creation Complete">
[m] 모듈로 저장 (write로 별도 파일)
[e] 내보내기 (bash svg, bash json)
[d] Done
</checkpoint>

</step>

</workflow>
