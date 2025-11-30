// web-langchain/main.ts

import { marked } from 'marked'; // [Fix] marked 라이브러리 import
import { initializeModel } from './src/core/gemini.js';
import { createChain, runChain } from './src/core/langchain.js';
import { showAlert, showStatus, updateChainProgress } from './src/utils/domUtils.js';
import { buildTreeStructure, filterFiles, selectImportantFiles } from './src/utils/fileUtils.js';
import { createProjectSummary } from './src/utils/projectUtils.js';
import { README_GENERATION_PROMPT, CHAIN_STEP_PROMPTS } from './src/prompts/readmePrompts.js';
import { PROJECT_CATEGORY_PROMPT, FILE_SELECTION_PROMPT } from './src/prompts/analysisPrompts.js'; // [New] FILE_SELECTION_PROMPT 추가
import { PROJECT_TYPE_HINTS } from './src/config/projectTypes.js';
import type { ProjectData } from './src/types/index.js';

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
const loadingSection = document.getElementById('loadingSection') as HTMLDivElement;

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
// GitHub Analysis (AI Driven)
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
    // 1. 파일 목록 추출 및 트리 생성
    const files = tree.filter((item: any) => item.type === 'file' || item.type === 'blob').map((item: any) => item.path);
    const filteredFiles = filterFiles(files);
    const treeStructure = buildTreeStructure(filteredFiles); // AI에게 보여줄 트리 구조

    // 2. 기본 언어 감지 (참고용)
    let detectedLang = detectProjectType(files);
    showStatus(`🔍 초기 감지 언어: ${detectedLang}`);

    // 3. [핵심] AI가 직접 중요 파일 선정
    let importantFiles: string[] = [];

    if (currentApiKey) {
        try {
            showStatus('🤖 AI가 프로젝트 구조를 분석하여 핵심 파일을 선정하는 중...');
            console.log('📤 [AI] 파일 선택 요청 전송...');

            const selectionChain = await createChain(FILE_SELECTION_PROMPT, ['fileTree']);
            // 트리 구조가 너무 길면 잘라서 보냄 (토큰 제한 방지)
            const selectionResult = await runChain(selectionChain, {
                fileTree: treeStructure.slice(0, 15000)
            });

            // JSON 파싱 (AI가 마크다운 코드블록을 넣었을 경우를 대비해 정제)
            const jsonStr = selectionResult.replace(/```json/g, '').replace(/```/g, '').trim();
            importantFiles = JSON.parse(jsonStr);

            console.log('✅ [AI] 선정된 핵심 파일:', importantFiles);
            showStatus(`🤖 AI가 ${importantFiles.length}개의 핵심 파일을 선정했습니다.`);

        } catch (e) {
            console.error('⚠️ AI 파일 선정 실패, 기본 로직(Regex) 사용:', e);
            // 실패 시 기존 Regex 방식 사용 (Fallback)
            importantFiles = selectImportantFiles(filteredFiles, detectedLang);
        }
    } else {
        importantFiles = selectImportantFiles(filteredFiles, detectedLang);
    }

    // 4. 선정된 파일 내용 다운로드
    const mainFiles: Record<string, string> = {};
    const MAX_FILES = 5; // AI가 많이 골랐어도 안전을 위해 5개만 Fetch
    let fetchedCount = 0;

    // AI가 고른 파일이 실제 목록에 있는지 검증하고 다운로드
    const validFiles = importantFiles.filter(f => files.includes(f));

    showStatus(`📥 핵심 파일 다운로드 중 (${Math.min(MAX_FILES, validFiles.length)}개)...`);

    for (const filePath of validFiles.slice(0, MAX_FILES)) {
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`);
            if (res.ok) {
                const d = await res.json();
                if (d.content && d.encoding === 'base64') {
                    const content = new TextDecoder('utf-8').decode(Uint8Array.from(atob(d.content.replace(/\n/g, '')), c => c.charCodeAt(0)));
                    // 파일이 너무 크면 앞부분만 자름
                    if (content.length <= 150000) {
                        mainFiles[filePath] = content;
                    } else {
                        mainFiles[filePath] = content.slice(0, 100000) + '\n... (File truncated)';
                    }
                    fetchedCount++;
                }
            }
        } catch (e) { console.error(`${filePath} 로드 실패`); }
    }

    // 5. 데이터 저장
    projectData = {
        name: repo,
        language: detectedLang, // 추후 AI 분석으로 업데이트 가능
        structure: treeStructure,
        files: filteredFiles,
        mainFiles: mainFiles
    };

    // 6. UI 업데이트
    if (projectInfoCard) projectInfoCard.style.display = 'block';
    if (detectedName) detectedName.textContent = projectData.name;
    if (detectedLanguage) detectedLanguage.textContent = projectData.language;

    if (detectedFiles) {
        detectedFiles.innerHTML = `
            <p><strong>전체 파일:</strong> ${projectData.files.length}개</p>
            <p><strong>중요 파일:</strong> ${Object.keys(mainFiles).length}개</p>
            <details>
                <summary>📂 프로젝트 전체 구조 보기 (클릭)</summary>
                <pre style="max-height: 300px; overflow: auto; background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.5; border: 1px solid #374151;">${projectData.structure}</pre>
            </details>
            
            <div class="file-badges" style="margin-top: 15px; display: flex; flex-wrap: wrap; gap: 8px;">
                ${Object.keys(mainFiles).map(f => `
                    <span style="background: #e5e7eb; color: #1f2937; padding: 4px 10px; border-radius: 6px; font-size: 0.9em; border: 1px solid #d1d5db; display: inline-block;">
                        📄 ${f}
                    </span>
                `).join('')}
            </div>
        `;
    }
}

// ============================================
// README Generation
// ============================================

async function generateReadme(): Promise<void> {
    if (!currentApiKey || !projectData.name) return showAlert('프로젝트 분석을 먼저 진행해주세요.', 'error');

    // 로딩 표시
    if (loadingSection) loadingSection.style.display = 'flex';
    if (generateBtn) generateBtn.disabled = true;

    try {
        initializeModel(currentApiKey);
        const isOptimized = (document.querySelector('input[name="generationMode"]:checked') as HTMLInputElement)?.value === 'optimized';
        let result: string;

        const projectType = projectData.language;
        const typeHints = PROJECT_TYPE_HINTS[projectType] || PROJECT_TYPE_HINTS['default'];

        if (isOptimized) {
            // ⚡ 빠른 모드: 단일 호출
            console.log('⚡ [Fast Mode] 단일 요청 실행');
            showStatus('⚡ AI가 README를 작성 중입니다...');



            const projectSummaryRaw = `
            프로젝트명: ${projectData.name}
            언어: ${projectData.language}
            프로젝트 구조:
            ${projectData.structure.slice(0, 3000)}

            핵심 파일 내용:
            ${Object.entries(projectData.mainFiles).map(([path, content]) => `### ${path}\n${content.slice(0, 2000)}`).join('\n\n')}
            `;

            const readmeChain = await createChain(README_GENERATION_PROMPT, ['projectType', 'typeHints', 'projectSummary']);
            result = await runChain(readmeChain, {
                projectType,
                typeHints,
                projectSummary: projectSummaryRaw
            });

        } else {
            // 🔗 체인 모드: 단계별 실행
            console.log('🔗 [Chain Mode] 단계별 실행');

            const codeFilesText = Object.entries(projectData.mainFiles).map(([path, content]) => `### ${path}\n${content.slice(0, 1000)}`).join('\n\n');
            const projectContext = `
            Project Name: ${projectData.name}
            Project Type: ${projectType}
            File Structure:
            ${projectData.structure.slice(0, 1000)}
            Key Files Content:
            ${codeFilesText}
            `;

            updateChainProgress(0);
            const introChain = await createChain(CHAIN_STEP_PROMPTS.intro, ['projectContext']);
            const introSection = await runChain(introChain, { projectContext });

            updateChainProgress(1);
            const featureChain = await createChain(CHAIN_STEP_PROMPTS.features, ['projectContext','typeHints']);
            const features = await runChain(featureChain, {
                projectContext,
                typeHints
            });

            updateChainProgress(2);
            const installChain = await createChain(CHAIN_STEP_PROMPTS.installation, ['projectContext','typeHints']);
            const installation = await runChain(installChain, {
                projectContext,
                typeHints
            });

            updateChainProgress(2);
            const usageChain = await createChain(CHAIN_STEP_PROMPTS.usage, ['projectContext', 'typeHints']);
            const usage = await runChain(usageChain, {
                projectContext,
                typeHints
            });

            updateChainProgress(3);
            const structureChain = await createChain(CHAIN_STEP_PROMPTS.structure, ['projectContext']);
            const structureDesc = await runChain(structureChain, { projectContext });

            result = `\n\n${introSection}\n\n\n## ✨ 주요 기능\n${features}\n\n\n## 🚀 설치 및 실행\n${installation}\n\n\n## 💻 사용법\n${usage}\n\n\n## 📁 구조\n${structureDesc}\n\n`;
        }

        if (resultMarkdown) resultMarkdown.value = result;
        if (resultPreview) resultPreview.innerHTML = await marked.parse(result);
        if (resultSection) resultSection.style.display = 'block';

        showAlert('README 생성 완료!', 'success');

    } catch (e: any) {
        showAlert('생성 실패: ' + e.message, 'error');
        console.error(e);
    } finally {
        if (loadingSection) loadingSection.style.display = 'none';
        if (generateBtn) generateBtn.disabled = false;
    }
}

// ============================================
// Helper: Language Detection
// ============================================

function detectProjectType(files: string[]): string {
    // 1. 게임 엔진 (기존 로직 유지 및 강화)
    if (files.some(f => f.includes('Assets/') && f.endsWith('.unity'))) return 'Unity Game';
    if (files.some(f => f.endsWith('.uproject'))) return 'Unreal Engine Game';

    // 2. 웹/앱 프레임워크 시그니처 (파일명으로 감지)
    if (files.some(f => f.endsWith('next.config.js') || f.endsWith('next.config.mjs'))) return 'Next.js App';
    if (files.some(f => f.endsWith('vite.config.js') || f.endsWith('vite.config.ts'))) return 'Vite Project';
    if (files.some(f => f.endsWith('angular.json'))) return 'Angular App';
    if (files.some(f => f.includes('manage.py'))) return 'Django Project';
    if (files.some(f => f.includes('pom.xml')) && files.some(f => f.includes('src/main/java'))) return 'Spring Boot';
    if (files.some(f => f.endsWith('pubspec.yaml'))) return 'Flutter/Dart';
    if (files.some(f => f.endsWith('cargo.toml'))) return 'Rust Crate';
    if (files.some(f => f.endsWith('go.mod'))) return 'Go Module';

    // 3. 확장자 카운트 (기존 로직 - Fallback)
    const extCount: Record<string, number> = {};
    files.forEach(f => {
        const ext = f.split('.').pop()?.toLowerCase();
        if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
    });

    if (extCount['py'] > 0 && extCount['py'] > (extCount['js'] || 0)) return 'Python Script';
    if (extCount['ts'] > 0 || extCount['tsx'] > 0) return 'TypeScript Project';
    if (extCount['js'] > 0) return 'JavaScript Project';
    if (extCount['cs'] > 0) return 'C# Project';
    if (extCount['java'] > 0) return 'Java Project';

    return 'Unknown Project';
}
// ============================================
// Other Utils & Init
// ============================================
function setupTabs(): void {
    //  메인 소스 탭 (GitHub / Manual)
    const sourceTabs = document.querySelectorAll('.source-tabs .tab-btn');
    sourceTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            // 모든 탭 비활성화
            sourceTabs.forEach(b => b.classList.remove('active'));
            // .tab-content를 모두 비활성화하는 로직 수정
            // tab-content 클래스를 가진 요소들 중 source-tabs 관련 요소만 찾아야 함
            // 여기서는 GitHub/Manual 탭에 대응하는 id를 가진 요소들을 직접 제어합니다.
            ['github-tab', 'manual-tab'].forEach(id => {
                document.getElementById(id)?.classList.remove('active');
            });

            // 선택된 탭 활성화
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(`${tabId}-tab`);
            if (targetContent) targetContent.classList.add('active');
        });
    });
    
    //결과 탭 (Preview / Markdown) 
    const resultTabsContainer = document.querySelector('#resultSection .tabs'); 
    if (resultTabsContainer) {
        const resultTabs = resultTabsContainer.querySelectorAll('.tab-btn');
        resultTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                // 결과 섹션 내의 모든 탭 버튼 비활성화
                resultTabs.forEach(b => b.classList.remove('active'));
                
                // 결과 섹션 내의 모든 탭 내용 비활성화 (preview-tab, markdown-tab)
                const previewTab = document.getElementById('preview-tab');
                const markdownTab = document.getElementById('markdown-tab');
                if (previewTab) previewTab.classList.remove('active');
                if (markdownTab) markdownTab.classList.remove('active');

                // 선택된 탭 활성화
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                const targetContent = document.getElementById(`${tabId}-tab`); // preview-tab 또는 markdown-tab
                if (targetContent) {
                    targetContent.classList.add('active');
                    console.log(`탭 전환: ${tabId}`); // 디버깅용 로그
                }
            });
        });
    }
}


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
    setupTabs();
    if (analyzeGithubBtn) analyzeGithubBtn.addEventListener('click', analyzeGitHub);
    if (generateBtn) generateBtn.addEventListener('click', generateReadme);
    console.log('✅ App initialized (AI Driven File Selection)');
});