export const CODE_ANALYSIS_PROMPT = `다음 코드 파일들을 분석하여 각 파일의 역할과 주요 기능을 파악하세요:

{codeFiles}

각 파일에 대해 다음 정보를 추출하세요:
1. 파일의 역할 (Controller/Service/Model/View/Manager 등)
2. 주요 클래스 또는 함수명
3. 구현된 핵심 기능

JSON 형식으로 반환하되, 한글로 설명을 작성하세요.`;

export const FEATURE_IMPORTANCE_PROMPT = `다음 코드 분석 결과에서 중요도를 평가하세요:

{features}

각 기능의 중요도를 high/normal/low로 분류하고,
프로젝트에서 가장 핵심적인 기능 5개를 선정하세요.

한글로 결과를 반환하세요.`;

export const PROJECT_CATEGORY_PROMPT = `다음 프로젝트 정보를 바탕으로 카테고리를 분류하세요:

프로젝트명: {name}
언어: {language}
파일 목록:
{files}

다음 중 하나로 분류하세요:
- 웹 애플리케이션
- 모바일 앱 (Android/iOS)
- 게임 (Unity/Unreal)
- 데스크톱 앱
- 백엔드 API
- 라이브러리/패키지
- CLI 도구
- 기타

카테고리와 간단한 설명을 한글로 반환하세요.`;

export const FILE_SELECTION_PROMPT = `
당신은 시니어 소프트웨어 아키텍트입니다. 
아래 제공된 GitHub 저장소의 전체 파일 트리 구조를 분석하여, 이 프로젝트의 기술 스택, 아키텍처, 핵심 기능을 파악하기 위해 **반드시 읽어야 할 파일**을 선정해주세요.

[분석 대상 파일 트리]
{fileTree}

[요청 사항]
1. 프로젝트의 성격을 결정짓는 **시그니처 파일** (예: next.config.js, manage.py, pom.xml, .uproject)이 있다면 1순위로 포함하세요.
2. 프로젝트의 진입점(Entry Point), 설정 파일(Config), 핵심 비즈니스 로직이 담긴 파일을 우선적으로 선택하세요.
3. **최대 5개**의 파일 경로를 선정하세요.
4. **[중요] 제외 대상:** - 단순 UI 리소스, 아이콘, 테스트 코드
   - **외부 라이브러리, 플러그인, 에셋 스토어 다운로드 파일** (예: \`Assets/Plugins/\`, \`Assets/External/\`, \`ThirdParty/\` 등)
   - 자동 생성된 파일 (예: \`LoginGen.cs\`, \`404Gen.cs\` 등)
5. Unity/Unreal 프로젝트의 경우, 외부 에셋이 아닌 **사용자가 직접 작성한 스크립트(Scripts 폴더 등)**를 최우선으로 선택하세요.
6. **결과는 오직 파일 경로 문자열의 JSON 배열 형식으로만 반환하세요.** (마크다운 태그나 설명 금지)

예시 반환값:
["package.json", "src/index.ts", "Assets/Scripts/GameManager.cs", "README.md"]
`;