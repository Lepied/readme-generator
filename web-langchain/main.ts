// web-langchain/main.ts

// ============================================
// Main Application Entry Point
// ============================================

import { initializeModel, generateWithRetry } from './src/core/gemini.js';
import { createChain, runChain } from './src/core/langchain.js';
import { showAlert, showStatus, updateChainProgress } from './src/utils/domUtils.js';
import { buildTreeStructure, filterFiles, selectImportantFiles } from './src/utils/fileUtils.js';
import { createProjectSummary } from './src/utils/projectUtils.js';
import { README_GENERATION_PROMPT, CHAIN_STEP_PROMPTS, FEATURE_EXTRACTION_PROMPT, PURPOSE_ANALYSIS_PROMPT } from './src/prompts/readmePrompts.js';
import { PROJECT_CATEGORY_PROMPT } from './src/prompts/analysisPrompts.js';
import { PROJECT_TYPE_HINTS } from './src/config/projectTypes.js';
import type { ProjectData } from './src/types/index.js';

// ============================================
// State Management
// ============================================

let currentApiKey: string | null = null;

// 초기 상태 (타입은 src/types/index.ts에서 가져옴)
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

apiKeyInput?.addEventListener('change', saveApiKey);

// ============================================
// GitHub Analysis
// ============================================

async function analyzeGitHub(): Promise<void> {
    console.log('🚀 [GitHub] 분석 시작');
    const repoUrl = githubUrlInput?.value.trim();
    
    if (!repoUrl) {
        showAlert('GitHub URL을 입력하세요', 'error');
        return;
    }
    
    if (!currentApiKey) {
        showAlert('먼저 API 키를 저장하세요', 'error');
        return;
    }
    
    try {
        if (analyzeGithubBtn) {
            analyzeGithubBtn.disabled = true;
            analyzeGithubBtn.textContent = 'GitHub 분석 중...';
        }
        
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) {
            showAlert('올바른 GitHub URL을 입력하세요', 'error');
            return;
        }
        
        const [, owner, repo] = match;
        showStatus(`📥 GitHub 저장소 분석 중: ${owner}/${repo}`);
        
        // 메인 브랜치 트리 가져오기
        const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
        
        if (!treeResponse.ok) {
            if (treeResponse.status === 403) throw new Error('GitHub API 요청 제한 초과');
            
            console.warn('⚠️ [GitHub] main 브랜치 없음, master 시도');
            const masterResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
            
            if (!masterResponse.ok) throw new Error('GitHub API 호출 실패 (main/master 없음)');
            
            const data = await masterResponse.json();
            await processGitHubRepo(owner, repo, data.tree);
        } else {
            const data = await treeResponse.json();
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
    console.log('🔄 [Process] 시작');
    
    // 1. 파일 목록 필터링
    const files = tree.filter((item: any) => item.type === 'file' || item.type === 'blob').map((item: any) => item.path);
    const filteredFiles = filterFiles(files); // fileUtils 사용
    
    showStatus(`📊 ${filteredFiles.length}개 파일 발견. 분석 중...`);
    
    // 2. AI 프로젝트 분석 (우선 수행)
    let analyzedLanguage = detectLanguage(files);
    
    if (currentApiKey) {
        try {
            showStatus('🤖 AI로 프로젝트 카테고리 분석 중...');
            
            // LangChain Abstraction 사용 (일관성 유지)
            const categoryChain = await createChain(PROJECT_CATEGORY_PROMPT, ['name', 'language', 'files']);
            const categoryResult = await runChain(categoryChain, {
                name: repo,
                language: analyzedLanguage,
                files: files.slice(0, 50).join('\n')
            });
            
            const langMatch = categoryResult.match(/언어[:\s]*([^\n]+)/i);
            if (langMatch) analyzedLanguage = langMatch[1].trim();
            
        } catch (error) {
            console.warn('⚠️ AI 분석 실패, 기본값 사용');
        }
    }
    
    // 3. 주요 파일 선택 (fileUtils의 개선된 로직 사용)
    const importantFiles = selectImportantFiles(filteredFiles, analyzedLanguage);
    
    // 4. 주요 파일 내용 가져오기 (5개 제한)
    const mainFiles: Record<string, string> = {};
    const MAX_FILES = 5;
    let fetchedCount = 0;

    showStatus(`📥 핵심 파일 ${Math.min(MAX_FILES, importantFiles.length)}개 내용 가져오는 중...`);

    for (const filePath of importantFiles.slice(0, MAX_FILES)) {
        try {
            showStatus(`📄 다운로드: ${filePath} (${++fetchedCount}/${Math.min(MAX_FILES, importantFiles.length)})`);
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.content && data.encoding === 'base64') {
                    const binaryString = atob(data.content.replace(/\n/g, ''));
                    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                    const content = new TextDecoder('utf-8').decode(bytes);
                    if (content.length <= 150000) mainFiles[filePath] = content;
                }
            }
        } catch (e) {
            console.error(`❌ ${filePath} 로드 실패`);
        }
    }
    
    // 5. 프로젝트 데이터 저장
    projectData = {
        name: repo,
        language: analyzedLanguage,
        structure: buildTreeStructure(files), // fileUtils 사용
        files: filteredFiles,
        mainFiles: mainFiles
    };
    
    // UI 업데이트
    if (projectInfoCard) projectInfoCard.style.display = 'block';
    if (detectedName) detectedName.textContent = projectData.name;
    if (detectedLanguage) detectedLanguage.textContent = projectData.language;
    
    const detectedFilesDiv = document.getElementById('detectedFiles');
    if (detectedFilesDiv) {
        detectedFilesDiv.innerHTML = `
            <p><strong>전체 파일:</strong> ${projectData.files.length}개</p>
            <p><strong>핵심 분석:</strong> ${Object.keys(mainFiles).length}개</p>
            <details>
                <summary>분석된 파일 목록</summary>
                <ul>${Object.keys(mainFiles).map(f => `<li>${f}</li>`).join('')}</ul>
            </details>
        `;
    }
}

// ============================================
// ZIP File Upload (기존 유지)
// ============================================
zipUploadArea?.addEventListener('click', () => zipFile?.click());
zipUploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); zipUploadArea.style.borderColor = '#4CAF50'; });
zipUploadArea?.addEventListener('dragleave', () => { if(zipUploadArea) zipUploadArea.style.borderColor = '#ddd'; });
zipUploadArea?.addEventListener('drop', async (e) => {
    e.preventDefault();
    if(zipUploadArea) zipUploadArea.style.borderColor = '#ddd';
    if(e.dataTransfer?.files[0]) await handleZipFile(e.dataTransfer.files[0]);
});
zipFile?.addEventListener('change', async (e) => { if((e.target as HTMLInputElement)?.files?.[0]) await handleZipFile((e.target as HTMLInputElement).files![0]); });

async function handleZipFile(file: File): Promise<void> {
    if (!file.name.endsWith('.zip')) { showAlert('ZIP 파일만 업로드 가능합니다', 'error'); return; }
    showAlert('ZIP 파일 분석 기능은 구현 중입니다', 'info');
}

// ============================================
// README Generation (리팩토링됨)
// ============================================

async function generateReadme(): Promise<void> {
    if (!currentApiKey || !projectData.name) {
        showAlert('API 키 저장 및 프로젝트 분석이 필요합니다', 'error');
        return;
    }
    
    try {
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'README 생성 중...';
        }
        
        initializeModel(currentApiKey);
        
        const selectedMode = (document.querySelector('input[name="generationMode"]:checked') as HTMLInputElement)?.value;
        const useOptimized = selectedMode === 'optimized';
        
        let result: string;
        
        if (useOptimized) {
            // ==========================================
            // ⚡ 빠른 모드
            // ==========================================
            console.log('⚡ [Generate] 빠른 모드 시작');
            showStatus('⚡ 빠른 모드로 생성 중...');

            const projectType = detectLanguage(projectData.files);
            const typeHints = PROJECT_TYPE_HINTS[projectType] || PROJECT_TYPE_HINTS['default'];
            
            // 코드 및 목적 분석 (문자열로 저장)
            if (Object.keys(projectData.mainFiles).length > 0) {
                const codeFilesText = Object.entries(projectData.mainFiles)
                    .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
                    .join('\n\n');
                    
                // 1. 코드 분석 요청 (LangChain 사용)
                const featureChain = await createChain(FEATURE_EXTRACTION_PROMPT, ['name', 'language', 'codeFiles']);
                projectData.rawCodeAnalysis = await runChain(featureChain, {
                    name: projectData.name,
                    language: projectData.language,
                    codeFiles: codeFilesText
                });

                // 2. 목적 분석 요청 (LangChain 사용)
                const purposeChain = await createChain(PURPOSE_ANALYSIS_PROMPT, ['name', 'language', 'structure']);
                projectData.rawPurposeAnalysis = await runChain(purposeChain, {
                    name: projectData.name,
                    language: projectData.language,
                    structure: projectData.structure.slice(0, 1000)
                });
            }

            // 3. 프로젝트 요약 생성 (projectUtils 활용)
            const projectSummary = createProjectSummary(projectData, false); 
            
            // 4. README 생성 요청 (LangChain 사용)
            const readmeChain = await createChain(README_GENERATION_PROMPT, ['projectType', 'typeHints', 'projectSummary']);
            result = await runChain(readmeChain, {
                projectType,
                typeHints,
                projectSummary
            });

        } else {
            // ==========================================
            // 🔗 체인 모드
            // ==========================================
            console.log('🔗 [Generate] 체인 모드 시작');
            showStatus('🔗 체인 모드로 정밀 생성 중...');
            
            const loadingSection = document.getElementById('loadingSection');
            if (loadingSection) loadingSection.style.display = 'block';
            
            // Context 구성
            const context = {
                projectInfo: `프로젝트: ${projectData.name}, 언어: ${projectData.language}`,
                name: projectData.name,
                language: projectData.language,
                projectType: detectLanguage(projectData.files),
                structure: projectData.structure.slice(0, 1500),
                features: '' 
            };

            // Step 1: Feature Extraction
            updateChainProgress(0); // domUtils 사용
            const featureChain = await createChain(CHAIN_STEP_PROMPTS.features, ['projectInfo']);
            const features = await runChain(featureChain, { projectInfo: context.projectInfo });
            context.features = features;

            // Step 2: Installation
            updateChainProgress(1); // domUtils 사용
            const installChain = await createChain(CHAIN_STEP_PROMPTS.installation, ['name', 'language', 'projectType']);
            const installation = await runChain(installChain, context);

            // Step 3: Usage
            updateChainProgress(2); // domUtils 사용
            const usageChain = await createChain(CHAIN_STEP_PROMPTS.usage, ['projectInfo', 'features']);
            const usage = await runChain(usageChain, { projectInfo: context.projectInfo, features: context.features });

            // Step 4: Structure
            updateChainProgress(3); // domUtils 사용
            const structureChain = await createChain(CHAIN_STEP_PROMPTS.structure, ['structure']);
            const structureDesc = await runChain(structureChain, { structure: context.structure });

            // Final Assembly
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

// ============================================
// Copy & Download
// ============================================

copyBtn?.addEventListener('click', async () => {
    if (resultMarkdown?.value) {
        await navigator.clipboard.writeText(resultMarkdown.value);
        showAlert('복사 완료!', 'success');
    }
});

downloadBtn?.addEventListener('click', () => {
    if (resultMarkdown?.value) {
        const blob = new Blob([resultMarkdown.value], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'README.md';
        a.click();
        URL.revokeObjectURL(url);
    }
});

// ============================================
// Utility Functions (Local)
// ============================================

function detectLanguage(files: string[]): string {
    const extCount: Record<string, number> = {};
    files.forEach(f => {
        const ext = f.split('.').pop()?.toLowerCase();
        if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
    });
    
    if (extCount['py'] > 5) return 'Python';
    if (extCount['ts'] || extCount['tsx']) return 'TypeScript';
    if (extCount['js'] || extCount['jsx']) return 'JavaScript';
    if (extCount['java']) return 'Java';
    if (extCount['cpp'] || extCount['h']) return 'C++';
    if (extCount['cs']) return 'C#';
    
    return 'JavaScript';
}

function setupTabs(): void {
    const sourceTabs = document.querySelectorAll('.source-tabs .tab-btn');
    sourceTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            sourceTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${btn.getAttribute('data-tab')}-tab`)?.classList.add('active');
        });
    });
    
    const resultTabs = document.querySelectorAll('#resultSection .tab-btn');
    resultTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            resultTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const sec = document.getElementById('resultSection');
            sec?.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            sec?.querySelector(`#${btn.getAttribute('data-tab')}-tab`)?.classList.add('active');
        });
    });
}

// ============================================
// Initialize
// ============================================

modelSelect?.addEventListener('change', () => {
    if (currentApiKey) {
        const model = (modelSelect as HTMLSelectElement).value;
        initializeModel(currentApiKey, model);
        localStorage.setItem('selected_model', model);
        showAlert(`모델 변경: ${model}`, 'success');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    setupTabs();
    console.log('✅ README Generator 초기화 완료 (LangChain Mode Enabled)');
});