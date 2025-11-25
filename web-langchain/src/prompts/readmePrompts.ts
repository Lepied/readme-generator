// ============================================
// README Generation Prompts
// ============================================

export const README_GENERATION_PROMPT = `CRITICAL INSTRUCTION: You MUST write ALL content in Korean language (한국어) ONLY. Every word, sentence, and section MUST be in Korean. Do NOT use English except for code examples and technical terms that have no Korean translation.

당신은 전문적인 README.md 생성기입니다. 이 프로젝트를 위한 README를 **반드시 한글로만** 작성해주세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 프로젝트 타입: {projectType}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 중요: 아래 가이드라인을 **반드시 따라야** 합니다.
일반적인 "git clone", "npm install" 같은 내용이 아닌,
이 프로젝트 타입에 **특화된 내용**만 작성하세요.

{typeHints}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

프로젝트 정보:
{projectSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 절대 규칙 ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. "예상됩니다", "것으로 보입니다" 같은 추측 표현 금지
2. 위 프로젝트 정보에서 확인된 **실제 코드와 파일**에서 확인된 사실만 작성
3. **"Purpose", "Detected Features", "Main Components"** 정보를 **반드시 그대로 활용**하여 프로젝트를 정확히 설명
4. "Implemented Features (from code analysis)" 섹션을 **반드시 참고**하여 실제 구현된 클래스/함수/컴포넌트 기반으로 작성
5. 위 가이드라인에 명시된 프로젝트 타입별 내용만 작성
6. 일반적인 "git clone", "npm install" 같은 내용 절대 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음 형식으로 작성하세요:

## 📖 프로젝트 소개
**"Purpose"** 정보를 **그대로** 사용하여 프로젝트를 설명.
"Detected Features"에 나열된 기능들을 자연스럽게 언급.
예: "이 프로젝트는 [Purpose 그대로]. [Detected Features 중 주요 기능] 기능을 제공합니다."

## ✨ 주요 기능
4-5개의 기능을 "~을 제공합니다" 형식으로 나열.
**반드시** "Implemented Features" 섹션의 클래스/함수명을 참고하여 실제 구현된 기능만 작성.
❌ 금지: 설치 방법, 사용 방법 언급, 추측성 기능
✅ 필수: 코드에서 확인된 실제 기능만

## 🚀 설치 및 실행 방법
위 가이드라인에 명시된 프로젝트 타입별 명령어만 작성.
❌ 금지: 기능 설명, 사용 예제
✅ 필수: 설치/실행 명령어만

## 💻 사용 방법
실제 구현된 기능을 기반으로 어떻게 사용하는지 **간단히 설명**만 작성.
❌ 금지: 설치 명령어, 코드 예제, 기능 나열 반복
✅ 필수: "[기능명]을 통해 [동작]할 수 있습니다" 형식으로 2-3문장

## 📁 프로젝트 구조
**아키텍처 구조**를 설명 (폴더 트리 금지).
"Main Components"와 "Detected Features"를 참고하여
시스템이 어떻게 구성되어 있는지 3-4문장으로 설명.

전문적이고 구체적으로 작성하세요. 마크다운 형식을 올바르게 사용하세요.`;

export const FEATURE_EXTRACTION_PROMPT = `다음 프로젝트에서 구현된 주요 기능을 분석하세요:

프로젝트: {name}
언어: {language}

코드 파일:
{codeFiles}

각 파일의 역할과 주요 기능을 분석하여 다음 형식으로 반환하세요:
- 파일명: [파일명]
- 역할: [Controller/Service/View/Model 등]
- 주요 클래스: [클래스명 목록]
- 주요 기능: [기능 설명]

한글로 작성하세요.`;

export const PURPOSE_ANALYSIS_PROMPT = `다음 프로젝트의 목적과 카테고리를 분석하세요:

프로젝트: {name}
언어: {language}
파일 구조:
{structure}

다음 형식으로 반환하세요:
카테고리: [웹앱/모바일앱/게임/라이브러리/도구 등]
목적: [한 문장으로 프로젝트 목적 설명]
주요 특징: [3-5개의 핵심 특징]

한글로 작성하세요.`;

export const CHAIN_STEP_PROMPTS = {
    features: `프로젝트의 주요 기능 목록을 작성하세요:
{projectInfo}

한글로 5-7개의 주요 기능을 나열하세요.`,

    installation: `프로젝트의 설치 방법을 작성하세요:
프로젝트: {name}
언어: {language}
타입: {projectType}

프로젝트 타입에 맞는 설치 명령어를 한글로 작성하세요.`,

    usage: `프로젝트의 사용 방법을 작성하세요:
{projectInfo}
주요 기능: {features}

한글로 사용 방법을 단계별로 설명하세요.`,

    structure: `프로젝트 구조를 설명하세요:
{structure}

한글로 프로젝트 아키텍처를 설명하세요. 폴더 트리가 아닌 구조적 설명을 작성하세요.`
};
