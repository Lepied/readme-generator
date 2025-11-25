// web-langchain/main.ts

import { initializeModel } from './src/core/gemini.js';
import { createChain, runChain } from './src/core/langchain.js';
import { showAlert, showStatus, updateChainProgress } from './src/utils/domUtils.js';
import { buildTreeStructure, filterFiles, selectImportantFiles } from './src/utils/fileUtils.js';
import { createProjectSummary } from './src/utils/projectUtils.js';
import { README_GENERATION_PROMPT, CHAIN_STEP_PROMPTS, FEATURE_EXTRACTION_PROMPT, PURPOSE_ANALYSIS_PROMPT } from './src/prompts/readmePrompts.js';
import { PROJECT_CATEGORY_PROMPT } from './src/prompts/analysisPrompts.js';
import { PROJECT_TYPE_HINTS } from './src/config/projectTypes.js';
import type { ProjectData } from './src/types/index.js';
import { marked } from 'marked';

// ============================================
// State Management
// ============================================

let currentApiKey: string | null = null;
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
const loadingSection = document.getElementById('loadingSection') as HTMLDivElement; // 로딩 섹션 추가

// ============================================
// API Key & Init
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
        initializeModel(savedKey, savedModel);
        showAlert('API 키가 로드되었습니다', 'success');
    }
    if (modelSelect) (modelSelect as HTMLSelectElement).value = savedModel;
}

function saveApiKey(): void {
    const apiKey = apiKeyInput?.value.trim();
    if (!apiKey) return showAlert('API 키를 입력하세요', 'error');
    
    const selectedModel = (modelSelect as HTMLSelectElement)?.value || 'gemini-2.5-flash';
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('selected_model', selectedModel);
    currentApiKey = apiKey;
    initializeModel(apiKey, selectedModel);
    showAlert(`저장 완료 (모델: ${selectedModel})`, 'success');
}

toggleKeyBtn?.addEventListener('click', () => {
    if (!apiKeyInput) return;
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    toggleKeyBtn.textContent = apiKeyInput.type === 'password' ? '보기' : '숨기기';
});

apiKeyInput?.addEventListener('change', saveApiKey);

// ============================================
// GitHub Analysis
// ============================================

async function analyzeGitHub(): Promise<void> {
    const repoUrl = githubUrlInput?.value.trim();
    if (!repoUrl) return showAlert('GitHub URL을 입력하세요', 'error');
    if (!currentApiKey) return showAlert('먼저 API 키를 저장하세요', 'error');
    
    try {
        if (analyzeGithubBtn) {
            analyzeGithubBtn.disabled = true;
            analyzeGithubBtn.textContent = '분석 중...';
        }
        
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) throw new Error('올바른 GitHub URL이 아닙니다.');
        
        const [, owner, repo] = match;
        showStatus(`📥 ${owner}/${repo} 메타데이터 가져오는 중...`);
        
        // 트리 가져오기
        let treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
        if (!treeResponse.ok) {
            treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
            if (!treeResponse.ok) throw new Error('저장소 정보를 가져올 수 없습니다. (접근 권한 또는 브랜치 확인)');
        }
        
        const data = await treeResponse.json();
        await processGitHubRepo(owner, repo, data.tree);
        showAlert('분석 완료!', 'success');
        
    } catch (error: any) {
        showAlert(error.message, 'error');
    } finally {
        if (analyzeGithubBtn) {
            analyzeGithubBtn.disabled = false;
            analyzeGithubBtn.textContent = 'GitHub 분석';
        }
    }
}

async function processGitHubRepo(owner: string, repo: string, tree: any[]): Promise<void> {
    // 1. 파일 목록 추출 및 필터링
    const files = tree.filter((item: any) => item.type === 'file' || item.type === 'blob').map((item: any) => item.path);
    const filteredFiles = filterFiles(files);
    
    // 2. 언어 및 카테고리 감지 (개선된 로직)
    let analyzedLanguage = detectLanguage(files);
    console.log(`🔍 [Detect] 초기 감지 언어: ${analyzedLanguage}`);

    // Unity/Unreal 등 특수 프로젝트는 AI 분석 전에도 확정 가능
    if (analyzedLanguage === 'Unity' || analyzedLanguage === 'Unreal Engine') {
        showStatus(`🎮 ${analyzedLanguage} 프로젝트 감지됨`);
    } else if (currentApiKey) {
        // 그 외의 경우 AI로 더 정확하게 분석 시도
        try {
            showStatus('🤖 AI로 프로젝트 성격 파악 중...');
            const categoryChain = await createChain(PROJECT_CATEGORY_PROMPT, ['name', 'language', 'files']);
            const categoryResult = await runChain(categoryChain, {
                name: repo,
                language: analyzedLanguage,
                files: files.slice(0, 50).join('\n')
            });
            const langMatch = categoryResult.match(/언어[:\s]*([^\n]+)/i);
            if (langMatch) analyzedLanguage = langMatch[1].trim();
        } catch (e) { console.warn('AI 분석 실패, 기본값 사용'); }
    }

    // 3. 핵심 파일 다운로드
    const importantFiles = selectImportantFiles(filteredFiles, analyzedLanguage);
    const mainFiles: Record<string, string> = {};
    const MAX_FILES = 5;
    let fetchedCount = 0;

    showStatus(`📥 핵심 파일 ${Math.min(MAX_FILES, importantFiles.length)}개 다운로드 중...`);

    for (const filePath of importantFiles.slice(0, MAX_FILES)) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`);
            if (res.ok) {
                const d = await res.json();
                if (d.content && d.encoding === 'base64') {
                    const content = new TextDecoder('utf-8').decode(Uint8Array.from(atob(d.content.replace(/\n/g, '')), c => c.charCodeAt(0)));
                    if (content.length <= 150000) {
                        mainFiles[filePath] = content;
                        fetchedCount++;
                    }
                }
            }
        } catch (e) { console.error(`${filePath} 로드 실패`); }
    }

    // 4. 데이터 저장
    projectData = {
        name: repo,
        language: analyzedLanguage,
        structure: buildTreeStructure(files), // 트리 구조 생성
        files: filteredFiles,
        mainFiles: mainFiles
    };

    // 5. UI 업데이트
    if (projectInfoCard) projectInfoCard.style.display = 'block';
    if (detectedName) detectedName.textContent = projectData.name;
    if (detectedLanguage) detectedLanguage.textContent = projectData.language;
    
    // 구조 보기 UI 업데이트 (수정됨: 상세 태그 내부에 pre 태그로 구조 삽입)
    if (detectedFiles) {
        detectedFiles.innerHTML = `
            <p><strong>전체 파일:</strong> ${projectData.files.length}개</p>
            <p><strong>핵심 분석 파일:</strong> ${Object.keys(mainFiles).length}개</p>
            <details>
                <summary>📂 프로젝트 전체 구조 보기 (클릭)</summary>
                <pre style="max-height: 300px; overflow: auto; background: #f5f5f5; padding: 10px; border-radius: 5px;">${projectData.structure}</pre>
            </details>
            <div class="file-badges">
                ${Object.keys(mainFiles).map(f => `<span class="badge badge-gray">${f}</span>`).join('')}
            </div>
        `;
    }
}

// ============================================
// README Generation (Fast Mode 로직 개선)
// ============================================

async function generateReadme(): Promise<void> {
    if (!currentApiKey || !projectData.name) return showAlert('프로젝트 분석을 먼저 진행해주세요.', 'error');

    // 1. 로딩 표시 (필수: 어떤 모드든 보여야 함)
    if (loadingSection) loadingSection.style.display = 'flex'; // block 대신 flex 추천 (중앙 정렬 위해)
    if (generateBtn) generateBtn.disabled = true;

    try {
        initializeModel(currentApiKey);
        const isOptimized = (document.querySelector('input[name="generationMode"]:checked') as HTMLInputElement)?.value === 'optimized';
        let result: string;

        if (isOptimized) {
            // ==========================================
            // ⚡ 빠른 모드: ONE SHOT (체인 없음)
            // ==========================================
            console.log('⚡ [Fast Mode] 단일 요청 실행');
            showStatus('⚡ 빠른 모드로 README 생성 중... (잠시만 기다려주세요)');

            const projectType = detectLanguage(projectData.files); // 재확인
            const typeHints = PROJECT_TYPE_HINTS[projectType] || PROJECT_TYPE_HINTS['default'];

            // 별도의 코드 분석 단계 없이, 파일 내용과 목록을 한 번에 프롬프트에 넣습니다.
            const projectSummaryRaw = `
프로젝트명: ${projectData.name}
언어: ${projectData.language}
프로젝트 구조(트리):
${projectData.structure.slice(0, 2000)}

핵심 파일 내용:
${Object.entries(projectData.mainFiles).map(([path, content]) => `### ${path}\n${content.slice(0, 1500)}`).join('\n\n')}
            `;

            // 한번에 생성 요청
            const readmeChain = await createChain(README_GENERATION_PROMPT, ['projectType', 'typeHints', 'projectSummary']);
            result = await runChain(readmeChain, {
                projectType,
                typeHints,
                projectSummary: projectSummaryRaw
            });

        } else {
            // ==========================================
            // 🔗 체인 모드: 단계별 실행
            // ==========================================
            console.log('🔗 [Chain Mode] 단계별 실행');
            showStatus('🔗 체인 모드로 정밀 분석 중...');
            
            // Step 1: Feature Extraction
            updateChainProgress(0);
            const featureChain = await createChain(FEATURE_EXTRACTION_PROMPT, ['name', 'language', 'codeFiles']);
            const codeFilesText = Object.entries(projectData.mainFiles)
                .map(([path, content]) => `### ${path}\n${content.slice(0, 1000)}`).join('\n\n');
            const features = await runChain(featureChain, {
                name: projectData.name,
                language: projectData.language,
                codeFiles: codeFilesText
            });

            // Step 2: Installation
            updateChainProgress(1);
            const installChain = await createChain(CHAIN_STEP_PROMPTS.installation, ['name', 'language', 'projectType']);
            const installation = await runChain(installChain, {
                name: projectData.name,
                language: projectData.language,
                projectType: projectData.language
            });

            // Step 3: Usage
            updateChainProgress(2);
            const usageChain = await createChain(CHAIN_STEP_PROMPTS.usage, ['projectInfo', 'features']);
            const usage = await runChain(usageChain, {
                projectInfo: `Project: ${projectData.name}, Lang: ${projectData.language}`,
                features
            });

            // Step 4: Structure & Finalize
            updateChainProgress(3);
            const structureChain = await createChain(CHAIN_STEP_PROMPTS.structure, ['structure']);
            const structureDesc = await runChain(structureChain, { structure: projectData.structure.slice(0, 1000) });

            result = `# ${projectData.name}\n\n## ✨ 주요 기능\n${features}\n\n## 🚀 설치 방법\n${installation}\n\n## 💻 사용법\n${usage}\n\n## 📁 구조\n${structureDesc}`;
        }

        if (resultMarkdown) resultMarkdown.value = result;
        if (resultPreview) resultPreview.innerHTML = await marked.parse(result); // marked 라이브러리가 있다면 사용, 없다면 innerHTML = result
        if (resultSection) resultSection.style.display = 'block';
        
        showAlert('README 생성 완료!', 'success');

    } catch (e: any) {
        showAlert('생성 실패: ' + e.message, 'error');
    } finally {
        // 로딩 종료 (성공이든 실패든 무조건 실행)
        if (loadingSection) loadingSection.style.display = 'none';
        if (generateBtn) generateBtn.disabled = false;
    }
}

// ============================================
// Helper: Language Detection (개선됨)
// ============================================

function detectLanguage(files: string[]): string {
    // 1. 강력한 시그니처 먼저 확인 (Unity, Unreal, Flutter 등)
    if (files.some(f => f.includes('Assets/') || f.includes('Library/') || f.endsWith('.unity'))) return 'Unity';
    if (files.some(f => f.endsWith('.uproject') || f.includes('Source/') && f.includes('Config/'))) return 'Unreal Engine';
    if (files.some(f => f.endsWith('pubspec.yaml'))) return 'Dart (Flutter)';
    
    // 2. 확장자 카운트
    const extCount: Record<string, number> = {};
    files.forEach(f => {
        const ext = f.split('.').pop()?.toLowerCase();
        if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
    });

    if (extCount['py'] > 0 && extCount['py'] > (extCount['js'] || 0)) return 'Python';
    if (extCount['cs'] > 0) return 'C#'; // Unity 체크 후에도 남아있다면 일반 C#
    if (extCount['java'] > 0) return 'Java';
    if (extCount['ts'] > 0 || extCount['tsx'] > 0) return 'TypeScript';
    if (extCount['js'] > 0 || extCount['jsx'] > 0) return 'JavaScript';
    
    return 'Unknown';
}

// ============================================
// Other Utils & Init
// ============================================

copyBtn?.addEventListener('click', () => {
    if (resultMarkdown.value) {
        navigator.clipboard.writeText(resultMarkdown.value);
        showAlert('복사됨!', 'success');
    }
});

downloadBtn?.addEventListener('click', () => {
    if (resultMarkdown.value) {
        const blob = new Blob([resultMarkdown.value], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'README.md'; a.click();
        URL.revokeObjectURL(url);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    // 탭 설정 로직 등이 있다면 여기에 포함
    
    // 버튼 이벤트 리스너 재확인
    if (analyzeGithubBtn) analyzeGithubBtn.addEventListener('click', analyzeGitHub);
    if (generateBtn) generateBtn.addEventListener('click', generateReadme);
    
    console.log('✅ App initialized');
});