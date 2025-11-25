// ============================================
// Main Application Entry Point
// ============================================

import { initializeModel, generateWithRetry } from './src/core/gemini.js';
import { showAlert, showStatus } from './src/utils/domUtils.js';
import { buildTreeStructure, filterFiles } from './src/utils/fileUtils.js';

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
    if (savedKey) {
        currentApiKey = savedKey;
        if (apiKeyInput) {
            apiKeyInput.value = savedKey;
            apiKeyInput.type = 'password';
        }
        if (toggleKeyBtn) toggleKeyBtn.textContent = '보기';
        showAlert('저장된 API 키를 불러왔습니다', 'success');
    }
}

function saveApiKey(): void {
    const apiKey = apiKeyInput?.value.trim();
    if (!apiKey) {
        showAlert('API 키를 입력하세요', 'error');
        return;
    }
    
    try {
        localStorage.setItem('gemini_api_key', apiKey);
        currentApiKey = apiKey;
        initializeModel(apiKey);
        showAlert('API 키가 저장되었습니다', 'success');
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
        showStatus(`GitHub 저장소 분석 중: ${owner}/${repo}`);
        
        // GitHub API를 통해 파일 목록 가져오기
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
        if (!response.ok) {
            throw new Error('GitHub API 호출 실패');
        }
        
        const data = await response.json();
        const files = data.tree.filter((item: any) => item.type === 'file').map((item: any) => item.path);
        
        // 프로젝트 데이터 저장
        projectData = {
            name: repo,
            language: detectLanguage(files),
            structure: buildTreeStructure(files),
            files: filterFiles(files),
            mainFiles: {}
        };
        
        // UI 업데이트
        if (projectInfoCard) projectInfoCard.style.display = 'block';
        if (detectedName) detectedName.textContent = projectData.name;
        if (detectedLanguage) detectedLanguage.textContent = projectData.language;
        if (detectedFiles) detectedFiles.textContent = projectData.files.length.toString();
        
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
        
        const prompt = `다음 프로젝트에 대한 README.md를 생성해주세요:

프로젝트명: ${projectData.name}
언어: ${projectData.language}
파일 수: ${projectData.files.length}

프로젝트 구조:
${projectData.structure}

주요 파일:
${projectData.files.slice(0, 20).join('\n')}

전문적이고 명확한 README를 작성해주세요.`;
        
        const result = await generateWithRetry(prompt);
        
        if (resultMarkdown) resultMarkdown.value = result;
        if (resultPreview) resultPreview.innerHTML = result;
        if (resultSection) resultSection.style.display = 'block';
        
        showAlert('README가 생성되었습니다!', 'success');
    } catch (error: any) {
        showAlert('생성 실패: ' + error.message, 'error');
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'README 생성';
        }
    }
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
    const extensions = files.map(f => f.split('.').pop()?.toLowerCase());
    
    if (extensions.includes('py')) return 'Python';
    if (extensions.includes('js') || extensions.includes('ts')) return 'JavaScript/TypeScript';
    if (extensions.includes('java')) return 'Java';
    if (extensions.includes('cpp') || extensions.includes('c')) return 'C/C++';
    if (extensions.includes('go')) return 'Go';
    if (extensions.includes('rs')) return 'Rust';
    if (extensions.includes('dart')) return 'Dart';
    
    return 'Unknown';
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    console.log('✅ README Generator 초기화 완료');
});
