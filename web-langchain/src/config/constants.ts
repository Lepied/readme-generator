// ============================================
// Configuration Constants
// ============================================

import type { Config } from '../types/index.js';

export const CONFIG: Config = {
    // 코드 분석 설정
    MAX_FILES_TO_ANALYZE: 30,
    MAX_FILE_SIZE: 3000000, // 3MB
    MAX_FILES_TO_SEND: 100, // README 생성 시 전송할 최대 파일 수
    
    // API 설정
    DEFAULT_MODEL: 'gemini-2.5-flash',
    DEFAULT_TEMPERATURE: 0.7,
    MAX_OUTPUT_TOKENS: 8192,
    
    // 재시도 설정
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000, // 2초
    
    // 파일 업로드 제한
    MAX_ZIP_SIZE: 50 * 1024 * 1024, // 50MB
    
    // 무시할 디렉토리
    IGNORE_DIRS: ['.git/', 'node_modules/', '__pycache__/', 'venv/', 'dist/', 'build/']
};

// 프로젝트 설정 파일 목록
export const CONFIG_FILES = [
    // 웹/백엔드
    'package.json', 'requirements.txt', 'setup.py', 'pyproject.toml',
    'Cargo.toml', 'go.mod', 'pom.xml', 
    'build.gradle', 'build.gradle.kts',
    'android/build.gradle', 'android/app/build.gradle',
    'Gemfile', 'composer.json',
    
    // 프레임워크 설정
    'next.config.js', 'nuxt.config.js', 'angular.json', 'vite.config.js',
    'svelte.config.js', 'astro.config.mjs', 'remix.config.js',
    
    // 모바일
    'pubspec.yaml',
    'Podfile',
    'capacitor.config.json',
    'app.json',
    
    // 게임 엔진
    'ProjectSettings/ProjectSettings.asset',
    'Config/DefaultEngine.ini',
    'project.godot',
    
    // 기타
    'Dockerfile', 'docker-compose.yml',
    '.env.example', 'README.md'
];
