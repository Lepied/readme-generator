// ============================================
// Main Application Entry Point
// ============================================

import { initializeModel, generateWithRetry } from './src/core/gemini.js';
import { showAlert, showStatus } from './src/utils/domUtils.js';
import { buildTreeStructure, filterFiles } from './src/utils/fileUtils.js';
import { README_GENERATION_PROMPT, CHAIN_STEP_PROMPTS, FEATURE_EXTRACTION_PROMPT, PURPOSE_ANALYSIS_PROMPT } from './src/prompts/readmePrompts.js';
import { PROJECT_CATEGORY_PROMPT } from './src/prompts/analysisPrompts.js';
import { PROJECT_TYPE_HINTS } from './src/config/projectTypes.js';

// ============================================
// State Management
// ============================================

let currentApiKey: string | null = null;

interface ProjectData {
    name: string;
    language: string;
    structure: string;
    files: string[];
    mainFiles: Record<string, string>;
}

let projectData: ProjectData = {
    name: '',
    language: '',
    structure: '',
    files: [],
    mainFiles: {}
};

// ============================================
// DOM Elements
// ============================================

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const toggleKeyBtn = document.getElementById('toggleKey') as HTMLButtonElement;
const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
const githubUrlInput = document.getElementById('githubUrl') as HTMLInputElement;
const analyzeGithubBtn = document.getElementById('analyzeGithubBtn') as HTMLButtonElement;
const zipFile = document.getElementById('zipFile') as HTMLInputElement;
const zipUploadArea = document.getElementById('zipUploadArea') as HTMLDivElement;
const zipInfo = document.getElementById('zipInfo') as HTMLDivElement;
const projectInfoCard = document.getElementById('projectInfoCard') as HTMLDivElement;
const detectedName = document.getElementById('detectedName') as HTMLSpanElement;
const detectedLanguage = document.getElementById('detectedLanguage') as HTMLSpanElement;
const detectedFiles = document.getElementById('detectedFiles') as HTMLSpanElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const resultSection = document.getElementById('resultSection') as HTMLDivElement;
const resultPreview = document.getElementById('resultPreview') as HTMLDivElement;
const resultMarkdown = document.getElementById('resultMarkdown') as HTMLTextAreaElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;

// ============================================
// API Key Management
// ============================================

function loadApiKey(): void {
    const savedKey = localStorage.getItem('gemini_api_key');
    const savedModel = localStorage.getItem('selected_model') || 'gemini-2.5-flash';
    
    if (savedKey) {
        currentApiKey = savedKey;
        if (apiKeyInput) {
            apiKeyInput.value = savedKey;
            apiKeyInput.type = 'password';
        }
        if (toggleKeyBtn) toggleKeyBtn.textContent = '보기';
        
        // 저장된 API 키와 모델로 즉시 초기화
        try {
            initializeModel(savedKey, savedModel);
            console.log('✅ [Init] 저장된 설정으로 모델 초기화:', savedModel);
        } catch (error: any) {
            console.error('❌ [Init] 모델 초기화 실패:', error);
        }
        
        showAlert('저장된 API 키를 불러왔습니다', 'success');
    }
    
    if (modelSelect) {
        (modelSelect as HTMLSelectElement).value = savedModel;
    }
}

function saveApiKey(): void {
    const apiKey = apiKeyInput?.value.trim();
    if (!apiKey) {
        showAlert('API 키를 입력하세요', 'error');
        return;
    }
    
    try {
        const selectedModel = (modelSelect as HTMLSelectElement)?.value || 'gemini-2.5-flash';
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('selected_model', selectedModel);
        currentApiKey = apiKey;
        initializeModel(apiKey, selectedModel);
        showAlert(`API 키가 저장되었습니다 (모델: ${selectedModel})`, 'success');
    } catch (error: any) {
        showAlert('API 키 저장 실패: ' + error.message, 'error');
    }
}

toggleKeyBtn?.addEventListener('click', () => {
    if (!apiKeyInput) return;
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        if (toggleKeyBtn) toggleKeyBtn.textContent = '숨기기';
    } else {
        apiKeyInput.type = 'password';
        if (toggleKeyBtn) toggleKeyBtn.textContent = '보기';
    }
});

// API 키 입력 시 자동 저장
apiKeyInput?.addEventListener('change', saveApiKey);

// ============================================
// GitHub Analysis
// ============================================

async function analyzeGitHub(): Promise<void> {
    console.log('🚀 [GitHub] 분석 시작');
    const repoUrl = githubUrlInput?.value.trim();
    console.log('📝 [GitHub] 입력된 URL:', repoUrl);
    
    if (!repoUrl) {
        console.error('❌ [GitHub] URL 없음');
        showAlert('GitHub URL을 입력하세요', 'error');
        return;
    }
    
    if (!currentApiKey) {
        console.error('❌ [GitHub] API 키 없음');
        showAlert('먼저 API 키를 저장하세요', 'error');
        return;
    }
    console.log('✅ [GitHub] API 키 확인됨');
    
    try {
        if (analyzeGithubBtn) {
            analyzeGithubBtn.disabled = true;
            analyzeGithubBtn.textContent = 'GitHub 분석 중...';
        }
        
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) {
            console.error('❌ [GitHub] 잘못된 URL 형식');
            showAlert('올바른 GitHub URL을 입력하세요', 'error');
            return;
        }
        
        const [, owner, repo] = match;
        console.log(`🔍 [GitHub] 저장소: ${owner}/${repo}`);
        showStatus(`📥 GitHub 저장소 분석 중: ${owner}/${repo}`);
        
        // GitHub API를 통해 파일 목록 가져오기
        console.log('📡 [GitHub] API 호출: /git/trees/main');
        const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
        console.log('📡 [GitHub] API 응답 상태:', treeResponse.status);
        console.log('📊 [GitHub] Rate Limit:', treeResponse.headers.get('X-RateLimit-Remaining'), '/', treeResponse.headers.get('X-RateLimit-Limit'));
        
        if (!treeResponse.ok) {
            if (treeResponse.status === 403) {
                const rateLimitReset = treeResponse.headers.get('X-RateLimit-Reset');
                const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : '알 수 없음';
                throw new Error(`GitHub API 요청 제한 초과. 재설정 시간: ${resetTime}`);
            }
            
            console.warn('⚠️ [GitHub] main 브랜치 없음, master 시도');
            // main 브랜치가 없으면 master 시도
            const masterResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
            console.log('📡 [GitHub] master 브랜치 응답:', masterResponse.status);
            
            if (!masterResponse.ok) {
                if (masterResponse.status === 403) {
                    const rateLimitReset = masterResponse.headers.get('X-RateLimit-Reset');
                    const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : '알 수 없음';
                    throw new Error(`GitHub API 요청 제한 초과. 재설정 시간: ${resetTime}`);
                }
                console.error('❌ [GitHub] API 호출 실패 (main/master 모두 없음)');
                throw new Error(`GitHub API 호출 실패: ${masterResponse.status} ${masterResponse.statusText}`);
            }
            const data = await masterResponse.json();
            console.log('📦 [GitHub] 받은 tree 항목 수:', data.tree?.length);
            await processGitHubRepo(owner, repo, data.tree);
        } else {
            const data = await treeResponse.json();
            console.log('📦 [GitHub] 받은 tree 항목 수:', data.tree?.length);
            await processGitHubRepo(owner, repo, data.tree);
        }
        
        showAlert('GitHub 분석 완료!', 'success');
    } catch (error: any) {
        showAlert('분석 실패: ' + error.message, 'error');
    } finally {
        if (analyzeGithubBtn) {
            analyzeGithubBtn.disabled = false;
            analyzeGithubBtn.textContent = 'GitHub 분석';
        }
    }
}

async function processGitHubRepo(owner: string, repo: string, tree: any[]): Promise<void> {
    console.log('🔄 [Process] processGitHubRepo 시작');
    console.log('📋 [Process] tree 길이:', tree.length);
    console.log('🔍 [Process] tree 첫 항목 샘플:', tree.slice(0, 3));
    
    const files = tree.filter((item: any) => {
        const isFile = item.type === 'file' || item.type === 'blob';
        if (!isFile && tree.length < 10) {
            console.log('🚫 [Process] 필터링됨:', item.type, item.path);
        }
        return isFile;
    }).map((item: any) => item.path);
    console.log('📁 [Process] 전체 파일 수:', files.length);
    console.log('📝 [Process] 파일 샘플:', files.slice(0, 5));
    
    const filteredFiles = filterFiles(files);
    console.log('🔍 [Process] 필터링 후 파일 수:', filteredFiles.length);
    
    showStatus(`📊 ${filteredFiles.length}개 파일 발견. 주요 파일 분석 중...`);
    
    // 주요 파일 선택 (최대 20개)
    const detectedLang = detectLanguage(files);
    console.log('🌐 [Process] 감지된 언어:', detectedLang);
    
    const importantFiles = selectImportantFiles(filteredFiles, detectedLang);
    console.log('⭐ [Process] 선택된 중요 파일 수:', importantFiles.length);
    console.log('📝 [Process] 중요 파일 목록:', importantFiles.slice(0, 5));
    
    // 주요 파일 내용 가져오기
    const mainFiles: Record<string, string> = {};
    let fetchedCount = 0;
    
    for (const filePath of importantFiles.slice(0, 20)) {
        try {
            showStatus(`📄 분석 중: ${filePath} (${++fetchedCount}/${Math.min(20, importantFiles.length)})`);
            
            // GitHub API를 통해 파일 내용 가져오기 (CORS 우회)
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
            const response = await fetch(apiUrl);
            
            if (response.ok) {
                const data = await response.json();
                // base64 디코딩
                if (data.content && data.encoding === 'base64') {
                    try {
                        const content = atob(data.content.replace(/\n/g, ''));
                        if (content.length <= 150000) { // 150KB 제한
                            mainFiles[filePath] = content;
                            console.log(`✅ ${filePath} 로드 성공 (${content.length} bytes)`);
                        } else {
                            console.log(`⚠️ ${filePath} 크기 초과 (${content.length} bytes)`);
                        }
                    } catch (decodeError) {
                        console.error(`❌ ${filePath} 디코딩 실패:`, decodeError);
                    }
                }
            } else {
                if (response.status === 403) {
                    console.error('❌ [GitHub] API 요청 제한 초과');
                    showAlert('GitHub API 요청 제한 초과. 잠시 후 다시 시도하세요.', 'error');
                    break; // 더 이상 요청하지 않음
                }
                console.warn(`❌ ${filePath} 로드 실패: ${response.status}`);
            }
        } catch (e: any) {
            console.error(`❌ ${filePath} 로드 실패:`, e.message);
        }
    }
    
    showStatus(`✅ ${Object.keys(mainFiles).length}개 파일 분석 완료`);
    console.log('✅ [Process] 최종 분석된 파일 수:', Object.keys(mainFiles).length);
    console.log('📄 [Process] 분석된 파일 목록:', Object.keys(mainFiles));
    
    // AI를 통한 정확한 프로젝트 카테고리 및 언어 분석
    let analyzedLanguage = detectLanguage(files);
    let projectCategory = '';
    
    if (Object.keys(mainFiles).length > 0 && currentApiKey) {
        try {
            showStatus('🤖 AI로 프로젝트 카테고리 분석 중...');
            console.log('🤖 [AI] 프로젝트 카테고리 분석 시작');
            
            const categoryPrompt = PROJECT_CATEGORY_PROMPT
                .replace('{name}', repo)
                .replace('{language}', analyzedLanguage)
                .replace('{files}', files.slice(0, 50).join('\n'));
            
            const categoryResult = await generateWithRetry(categoryPrompt);
            console.log('✅ [AI] 카테고리 분석 완료:', categoryResult);
            
            // 결과에서 언어 추출 시도
            const langMatch = categoryResult.match(/언어[:\s]*([^\n]+)/i);
            if (langMatch) {
                const aiLanguage = langMatch[1].trim();
                console.log('🔄 [AI] 언어 업데이트:', analyzedLanguage, '→', aiLanguage);
                analyzedLanguage = aiLanguage;
            }
            
            projectCategory = categoryResult;
        } catch (error) {
            console.warn('⚠️ [AI] 카테고리 분석 실패, 기본값 사용:', error);
        }
    }
    
    // 프로젝트 데이터 저장
    projectData = {
        name: repo,
        language: analyzedLanguage,
        structure: buildTreeStructure(files),
        files: filteredFiles,
        mainFiles: mainFiles
    };
    console.log('💾 [Process] projectData 저장 완료');
    console.log('📊 [Process] projectData.mainFiles 키 개수:', Object.keys(projectData.mainFiles).length);
    console.log('🏷️ [Process] 최종 언어:', analyzedLanguage);
    
    // UI 업데이트
    if (projectInfoCard) projectInfoCard.style.display = 'block';
    if (detectedName) detectedName.textContent = projectData.name;
    if (detectedLanguage) detectedLanguage.textContent = projectData.language;
    if (detectedFiles) detectedFiles.textContent = `${projectData.files.length}개 (주요 ${Object.keys(mainFiles).length}개 분석됨)`;
    
    const detectedFilesDiv = document.getElementById('detectedFiles');
    if (detectedFilesDiv) {
        detectedFilesDiv.innerHTML = `
            <p><strong>전체:</strong> ${projectData.files.length}개</p>
            <p><strong>분석됨:</strong> ${Object.keys(mainFiles).length}개</p>
            <details>
                <summary>분석된 파일 목록</summary>
                <ul>
                    ${Object.keys(mainFiles).map(f => `<li>${f}</li>`).join('')}
                </ul>
            </details>
        `;
    }
}

function selectImportantFiles(files: string[], language: string): string[] {
    console.log('🎯 [Select] 언어:', language, '파일 수:', files.length);
    
    const patterns: Record<string, RegExp[]> = {
        'Python': [
            /main\.py$/,
            /app\.py$/,
            /__init__\.py$/,
            /views\.py$/,
            /models\.py$/,
            /routes\.py$/,
            /api\.py$/,
            /\.py$/
        ],
        'JavaScript': [
            /index\.(js|ts)$/,
            /app\.(js|ts)$/,
            /main\.(js|ts)$/,
            /server\.(js|ts)$/,
            /App\.(jsx|tsx)$/,
            /\.(js|ts|jsx|tsx)$/
        ],
        'TypeScript': [
            /index\.(ts|tsx)$/,
            /app\.(ts|tsx)$/,
            /main\.(ts|tsx)$/,
            /server\.ts$/,
            /App\.tsx$/,
            /\.(ts|tsx)$/
        ],
        'Java': [
            /Main\.java$/,
            /Application\.java$/,
            /Controller\.java$/,
            /Service\.java$/,
            /\.java$/
        ],
        'C++': [
            /main\.(cpp|cc)$/,
            /\.(cpp|cc|h|hpp)$/
        ],
        'Go': [
            /main\.go$/,
            /\.go$/
        ],
        'Rust': [
            /main\.rs$/,
            /lib\.rs$/,
            /\.rs$/
        ],
        'Dart': [
            /main\.dart$/,
            /app\.dart$/,
            /\.dart$/
        ],
        'C#': [
            /Program\.cs$/,
            /Startup\.cs$/,
            /\.cs$/
        ],
        'Kotlin': [
            /MainActivity\.kt$/,
            /\.kt$/
        ]
    };
    
    // JavaScript/TypeScript도 JavaScript 패턴 사용
    let filePatterns = patterns[language] || patterns['JavaScript'] || [/\.(py|js|ts|jsx|tsx|java|cpp|go|rs|dart|cs|kt)$/];
    console.log('🔍 [Select] 사용할 패턴:', language, '패턴 수:', filePatterns.length);
    
    return files
        .filter(f => filePatterns.some(pattern => pattern.test(f)))
        .filter(f => !f.includes('test') && !f.includes('spec') && !f.includes('.test.') && !f.includes('.spec.'))
        .sort((a, b) => {
            const getPriority = (file: string) => {
                const lower = file.toLowerCase();
                if (lower.includes('main') || lower === 'app.js' || lower === 'index.js') return 1;
                if (lower.includes('controller') || lower.includes('manager')) return 2;
                if (lower.includes('service') || lower.includes('api')) return 3;
                if (lower.includes('model') || lower.includes('entity')) return 4;
                if (lower.includes('view') || lower.includes('component')) return 5;
                return 6;
            };
            return getPriority(a) - getPriority(b);
        });
}

analyzeGithubBtn?.addEventListener('click', analyzeGitHub);

// ============================================
// ZIP File Upload
// ============================================

zipUploadArea?.addEventListener('click', () => zipFile?.click());

zipUploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    zipUploadArea.style.borderColor = '#4CAF50';
});

zipUploadArea?.addEventListener('dragleave', () => {
    if (zipUploadArea) zipUploadArea.style.borderColor = '#ddd';
});

zipUploadArea?.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (zipUploadArea) zipUploadArea.style.borderColor = '#ddd';
    
    const file = e.dataTransfer?.files[0];
    if (file) {
        await handleZipFile(file);
    }
});

zipFile?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement)?.files?.[0];
    if (file) {
        await handleZipFile(file);
    }
});

async function handleZipFile(file: File): Promise<void> {
    if (!file.name.endsWith('.zip')) {
        showAlert('ZIP 파일만 업로드 가능합니다', 'error');
        return;
    }
    
    showAlert('ZIP 파일 분석 기능은 구현 중입니다', 'info');
}

// ============================================
// README Generation
// ============================================

async function generateReadme(): Promise<void> {
    if (!currentApiKey) {
        showAlert('먼저 API 키를 저장하세요', 'error');
        return;
    }
    
    if (!projectData.name) {
        showAlert('먼저 프로젝트를 분석하세요', 'error');
        return;
    }
    
    try {
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'README 생성 중...';
        }
        
        // 사용자가 선택한 모델 가져오기
        const selectedModel = modelSelect?.value || 'gemini-2.0-flash-exp';
        console.log(`📊 선택된 모델: ${selectedModel}`);
        
        // 사용자가 선택한 생성 모드 가져오기
        const selectedMode = (document.querySelector('input[name="generationMode"]:checked') as HTMLInputElement)?.value;
        const useOptimized = selectedMode === 'optimized';
        
        console.log(`🎯 선택된 모드: ${useOptimized ? '⚡ 빠른 모드 (1회 호출)' : '🔗 체인 모드 (4회 호출)'}`);
        
        // 선택된 모델로 다시 초기화
        initializeModel(currentApiKey);
        
        let result: string;
        
        if (useOptimized) {
            console.log('⚡ [Generate] 빠른 모드 시작');
            // 빠른 모드 - 1회 API 호출 (프롬프트 파일 사용)
            const projectType = detectLanguage(projectData.files);
            console.log('🏷️ [Generate] 프로젝트 타입:', projectType);
            
            const typeHints = PROJECT_TYPE_HINTS[projectType] || PROJECT_TYPE_HINTS['default'];
            console.log('💡 [Generate] 타입 힌트 길이:', typeHints.length);
            
            // 코드 분석이 있으면 활용
            let codeAnalysis = '';
            let purposeAnalysis = '';
            
            console.log('🔍 [Generate] mainFiles 개수:', Object.keys(projectData.mainFiles).length);
            if (Object.keys(projectData.mainFiles).length > 0) {
                console.log('🔬 [Generate] 코드 분석 시작');
                showStatus('🔍 코드 분석 중...');
                
                // 주요 파일 코드 분석
                const codeFilesText = Object.entries(projectData.mainFiles)
                    .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
                    .join('\n\n');
                
                const featurePrompt = FEATURE_EXTRACTION_PROMPT
                    .replace('{name}', projectData.name)
                    .replace('{language}', projectData.language)
                    .replace('{codeFiles}', codeFilesText);
                
                console.log('📤 [API] FEATURE_EXTRACTION_PROMPT 전송 중...');
                console.log('📊 [API] 프롬프트 길이:', featurePrompt.length);
                codeAnalysis = await generateWithRetry(featurePrompt);
                console.log('✅ [API] 코드 분석 완료, 길이:', codeAnalysis.length);
                
                // 프로젝트 목적 분석
                const purposePrompt = PURPOSE_ANALYSIS_PROMPT
                    .replace('{name}', projectData.name)
                    .replace('{language}', projectData.language)
                    .replace('{structure}', projectData.structure.slice(0, 1000));
                
                console.log('📤 [API] PURPOSE_ANALYSIS_PROMPT 전송 중...');
                purposeAnalysis = await generateWithRetry(purposePrompt);
                console.log('✅ [API] 목적 분석 완료, 길이:', purposeAnalysis.length);
                
                showStatus('✅ 코드 분석 완료');
            }
            
            const projectSummary = `
프로젝트명: ${projectData.name}
언어: ${projectData.language}
파일 수: ${projectData.files.length}
분석된 파일: ${Object.keys(projectData.mainFiles).length}개

${purposeAnalysis ? `\n목적 분석:\n${purposeAnalysis}\n` : ''}

프로젝트 구조:
${projectData.structure}

주요 파일:
${projectData.files.slice(0, 20).join('\n')}

${codeAnalysis ? `\n코드 분석 결과:\n${codeAnalysis}` : ''}`;
            
            showStatus('📝 README 생성 중...');
            
            console.log('📄 [Generate] projectSummary 길이:', projectSummary.length);
            
            // 프롬프트 템플릿에 변수 치환
            const prompt = README_GENERATION_PROMPT
                .replace('{projectType}', projectType)
                .replace('{typeHints}', typeHints)
                .replace('{projectSummary}', projectSummary);
            
            console.log('📤 [API] README_GENERATION_PROMPT 전송 중...');
            console.log('📊 [API] 최종 프롬프트 길이:', prompt.length);
            result = await generateWithRetry(prompt);
            console.log('✅ [API] README 생성 완료, 길이:', result.length);
        } else {
            // 체인 모드 - 4회 API 호출 (프롬프트 파일 사용)
            const loadingSection = document.getElementById('loadingSection');
            if (loadingSection) loadingSection.style.display = 'block';
            
            updateChainStep(0);
            
            const projectInfo = `프로젝트명: ${projectData.name}
언어: ${projectData.language}
파일: ${projectData.files.slice(0, 20).join(', ')}
구조: ${projectData.structure.slice(0, 500)}`;
            
            // Step 1: 주요 기능 추출
            const featuresPrompt = CHAIN_STEP_PROMPTS.features
                .replace('{projectInfo}', projectInfo);
            const features = await generateWithRetry(featuresPrompt);
            
            updateChainStep(1);
            
            // Step 2: 설치 방법
            const installPrompt = CHAIN_STEP_PROMPTS.installation
                .replace('{name}', projectData.name)
                .replace('{language}', projectData.language)
                .replace('{projectType}', detectLanguage(projectData.files));
            const installation = await generateWithRetry(installPrompt);
            
            updateChainStep(2);
            
            // Step 3: 사용 방법
            const usagePrompt = CHAIN_STEP_PROMPTS.usage
                .replace('{projectInfo}', projectInfo)
                .replace('{features}', features);
            const usage = await generateWithRetry(usagePrompt);
            
            updateChainStep(3);
            
            // Step 4: 프로젝트 구조 설명
            const structurePrompt = CHAIN_STEP_PROMPTS.structure
                .replace('{structure}', projectData.structure);
            const structureDesc = await generateWithRetry(structurePrompt);
            
            // 최종 README 조합
            result = `# ${projectData.name}

## 📖 프로젝트 소개
${projectData.language} 기반의 프로젝트입니다.

## ✨ 주요 기능
${features}

## 🚀 설치 및 실행 방법
${installation}

## 💻 사용 방법
${usage}

## 📁 프로젝트 구조
${structureDesc}
`;
            
            if (loadingSection) loadingSection.style.display = 'none';
        }
        
        if (resultMarkdown) resultMarkdown.value = result;
        if (resultPreview) resultPreview.innerHTML = result;
        if (resultSection) resultSection.style.display = 'block';
        
        showAlert('README가 생성되었습니다!', 'success');
    } catch (error: any) {
        showAlert('생성 실패: ' + error.message, 'error');
        const loadingSection = document.getElementById('loadingSection');
        if (loadingSection) loadingSection.style.display = 'none';
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'README 생성';
        }
    }
}

function updateChainStep(step: number): void {
    const steps = document.querySelectorAll('#chainProgress li');
    steps.forEach((el, index) => {
        if (index < step) {
            el.classList.add('completed');
        } else if (index === step) {
            el.classList.add('active');
        }
    });
}

generateBtn?.addEventListener('click', generateReadme);

// ============================================
// Copy & Download
// ============================================

copyBtn?.addEventListener('click', async () => {
    const content = resultMarkdown?.value;
    if (!content) {
        showAlert('복사할 내용이 없습니다', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(content);
        showAlert('클립보드에 복사되었습니다!', 'success');
    } catch (error) {
        showAlert('복사 실패', 'error');
    }
});

downloadBtn?.addEventListener('click', () => {
    const content = resultMarkdown?.value;
    if (!content) {
        showAlert('다운로드할 내용이 없습니다', 'error');
        return;
    }
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
    showAlert('README.md 다운로드 완료!', 'success');
});

// ============================================
// Utility Functions
// ============================================

function detectLanguage(files: string[]): string {
    const extensions = files.map(f => f.split('.').pop()?.toLowerCase()).filter(Boolean);
    console.log('🔍 [Detect] 확장자 샘플:', extensions.slice(0, 20));
    
    // 확장자 개수 세기
    const extCount: Record<string, number> = {};
    extensions.forEach(ext => {
        if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
    });
    console.log('📊 [Detect] 확장자 통계:', extCount);
    
    if (extCount['py'] && extCount['py'] > 5) return 'Python';
    if (extCount['dart'] && extCount['dart'] > 5) return 'Dart';
    if (extCount['java'] && extCount['java'] > 5) return 'Java';
    if (extCount['cpp'] || extCount['cc'] || extCount['c']) return 'C++';
    if (extCount['go'] && extCount['go'] > 3) return 'Go';
    if (extCount['rs'] && extCount['rs'] > 3) return 'Rust';
    if (extCount['cs'] && extCount['cs'] > 5) return 'C#';
    if (extCount['swift'] && extCount['swift'] > 3) return 'Swift';
    if (extCount['kt'] || extCount['kts']) return 'Kotlin';
    
    // TypeScript 우선 체크
    if (extCount['ts'] || extCount['tsx']) {
        if ((extCount['ts'] || 0) + (extCount['tsx'] || 0) > 5) return 'TypeScript';
    }
    
    // JavaScript
    if (extCount['js'] || extCount['jsx']) return 'JavaScript';
    
    console.warn('⚠️ [Detect] 언어 감지 실패, 기본값 사용');
    return 'JavaScript'; // Unknown 대신 JavaScript 기본값
}

// ============================================
// Tab Navigation
// ============================================

function setupTabs(): void {
    // Source tabs (GitHub/ZIP/Manual)
    const sourceTabs = document.querySelectorAll('.source-tabs .tab-btn');
    sourceTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            
            sourceTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) targetTab.classList.add('active');
        });
    });
    
    // Result tabs (Preview/Markdown)
    const resultTabs = document.querySelectorAll('#resultSection .tab-btn');
    resultTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            
            resultTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const resultSection = document.getElementById('resultSection');
            if (resultSection) {
                resultSection.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                const targetTab = resultSection.querySelector(`#${tabName}-tab`);
                if (targetTab) targetTab.classList.add('active');
            }
        });
    });
}

// ============================================
// Initialize
// ============================================

// 모델 선택 변경 이벤트
modelSelect?.addEventListener('change', () => {
    if (currentApiKey) {
        const selectedModel = (modelSelect as HTMLSelectElement).value;
        console.log('🔄 [Model] 모델 변경:', selectedModel);
        try {
            initializeModel(currentApiKey, selectedModel);
            localStorage.setItem('selected_model', selectedModel);
            showAlert(`모델이 ${selectedModel}로 변경되었습니다`, 'success');
        } catch (error: any) {
            showAlert('모델 변경 실패: ' + error.message, 'error');
        }
    } else {
        showAlert('먼저 API 키를 입력하세요', 'info');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    setupTabs();
    console.log('✅ README Generator 초기화 완료');
});
