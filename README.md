# README Auto Generator

자동으로 프로젝트를 분석하여 README.md 파일을 생성하는 도구입니다.
Ollama와 LangChain을 활용하여 AI 기반 문서화를 제공합니다.

## 🚀 Quick Start

### 1. 필요한 도구 설치

- Python 3.8 이상
- [Ollama](https://ollama.com/download)

### 2-A. Google Gemini API 사용 (추천! 무료 🔥)

**Gemini 2.0 Flash - 2025년 최신 모델!**
- 🔥 Gemini 2.0 Flash - 가장 빠르고 강력 (멀티모달 지원)
- ⚡ 매우 빠름 (Ollama보다 5-10배)
- 🆓 완전 무료 (월 150만 토큰, 분당 1500회)
- 🚀 설치 불필요, 인터넷만 있으면 OK
- 🧠 강력한 성능 (GPT-4급)

```bash
# 1. API 키 무료 받기: https://aistudio.google.com/apikey
#    (Google 계정만 있으면 즉시 발급)

# 2. 환경변수 설정 (선택사항)
set GOOGLE_API_KEY=your_api_key

# 또는 .env 파일 생성
echo GOOGLE_API_KEY=your_api_key > .env
```

**무료 제한:**
- 분당 15회 → 분당 1500회 (충분함!)
- 월 150만 토큰 (README 약 3000개 생성 가능)

### 2-B. Ollama 모델 다운로드 (로컬 실행)

```bash
# 코드 문서화에 최적화된 모델 (추천!)
ollama pull qwen2.5-coder:7b

# 또는 다른 모델
ollama pull deepseek-r1:8b    # 추론 능력 뛰어남
ollama pull qwen2.5:7b         # 범용 최신
ollama pull gemma3:12b         # Google 최신
ollama pull llama3.1:8b        # Llama 최신
```

### 3. 패키지 설치

```bash
pip install -r requirements.txt
```

### 4. 실행

```bash
# 현재 디렉토리 분석
python main.py

# 특정 프로젝트 분석
python main.py C:\path\to\your\project

# 샘플 프로젝트로 테스트
python main.py examples/sample_project
```

## 📁 프로젝트 구조

```
readme-generator/
├── main.py              # 메인 실행 파일
├── generator.py         # README 생성 로직
├── file_analyzer.py     # 파일 분석 유틸
├── requirements.txt     # 의존성
└── examples/           # 테스트용 샘플
    └── sample_project/
```

## 🎯 주요 기능

- 프로젝트 구조 자동 분석
- 프로그래밍 언어 자동 감지
- AI 기반 프로젝트 설명 생성
- 설치 방법 및 사용법 자동 생성
- 여러 AI 모델 선택 가능

## 🛠️ 기술 스택

- Python 3.x
- LangChain
- Ollama (로컬 LLM)

## 📝 사용 예시

```bash
$ python main.py

============================================================
               📝 README Auto Generator
============================================================

📂 Enter the project path to analyze:
   (Press Enter to use current directory)

> examples/sample_project

✓ Project path: C:\Users\...\sample_project

🤖 Select AI Model:
   1. llama2      - General purpose (default)
   2. codellama   - Optimized for code
   3. mistral     - Faster, good quality
   4. llama3.2    - Latest Llama model

> Select (1-4, default=1): 2

✓ Using model: codellama

------------------------------------------------------------
🔍 Analyzing project...
📊 Detected languages: Python
📁 Found 1 important files
💻 Found 1 code files

🤖 Generating README with AI...
⏳ This may take a minute...

✅ README generated successfully!
📄 Location: C:\...\sample_project\README.md
```

## 📚 지원하는 언어/프레임워크

- Python (requirements.txt, setup.py, pyproject.toml)
- JavaScript/Node.js (package.json)
- Java (pom.xml)
- Go (go.mod)
- Rust (Cargo.toml)
- Ruby (Gemfile)
- PHP (composer.json)
- 그 외 다양한 언어

## ⚙️ 설정 옵션

### 사용 가능한 모델 (2025년 추천)

**🌟 Google Gemini (무료 API):**
- `gemini-2.0-flash` - 🔥 2025 최신! 가장 빠르고 강력 (추천!)
- `gemini-1.5-flash` - ⚡ 매우 빠름
- `gemini-1.5-pro` - 🧠 GPT-4 수준

**Ollama 로컬 모델:**

최신 추천:
- `qwen2.5-coder:7b` - 🔥 코드 특화 최고 성능 (8.2M pulls)
- `deepseek-r1:8b` - 🧠 추론 능력, OpenAI o1급 (70M pulls)
- `qwen2.5:7b` - ⚡ 범용 최신, 빠르고 정확 (16M pulls)
- `gemma3:12b` - 🎯 Google 최신, 단일 GPU 최적 (24M pulls)

코딩 특화:
- `qwen2.5-coder` - 코드 생성/분석 최고
- `deepseek-coder-v2` - GPT4-Turbo 수준
- `codellama` - Meta 코드 모델

한국어:
- `EEVE-Korean-10.8B` - 한국어 특화
- `Llama-3-KoEn-8B` - 한영 이중언어

### 분석 제외 디렉토리

기본적으로 다음 디렉토리는 분석에서 제외됩니다:
- `.git`, `node_modules`, `__pycache__`
- `venv`, `.venv`, `env`
- `dist`, `build`

## 🐛 문제 해결

### Ollama 연결 오류

```bash
# Ollama가 실행 중인지 확인
ollama list

# Ollama 서비스 시작
ollama serve
```

### 모델을 찾을 수 없음

```bash
# 사용하려는 모델 다운로드
ollama pull llama2
ollama pull codellama
```

### 한글 인코딩 오류

- 파일은 UTF-8로 자동 처리됩니다
- 문제가 지속되면 `errors='ignore'` 옵션이 적용됩니다

## 🔮 향후 계획

- [ ] 웹 UI 추가 (Streamlit/Gradio)
- [ ] GitHub Actions 통합
- [ ] 커스텀 템플릿 지원
- [ ] 다국어 README 생성
- [ ] 배지(Badges) 자동 생성 개선
- [ ] 스크린샷 자동 감지 및 삽입

## 📄 License

MIT License

## 🤝 Contributing

기여는 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch
3. Commit your Changes
4. Push to the Branch
5. Open a Pull Request

---

Made with ❤️ using Ollama and LangChain
