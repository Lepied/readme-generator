// ============================================
// Code Analysis Prompts
// ============================================

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
