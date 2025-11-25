import { CONFIG, CONFIG_FILES } from '../config/constants.js';

// ============================================
// Tree Structure Builder
// ============================================

export function buildTreeStructure(files: string[]): string {
    if (!files || files.length === 0) return '';

    const tree: Record<string, any> = {};
    
    files.forEach(file => {
        const parts = file.split('/').filter(p => p);
        let current = tree;
        
        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                current[part] = null;
            } else {
                if (!current[part]) current[part] = {};
                current = current[part];
            }
        });
    });

    return formatTree(tree, '', true);
}

function formatTree(node: Record<string, any>, prefix: string, isRoot: boolean): string {
    const entries = Object.entries(node);
    
    // [변경점] 한 폴더에 파일이 너무 많으면(20개 초과) 잘라서 보여줌 (토큰 절약)
    const MAX_ENTRIES_PER_FOLDER = 20;
    const isTruncated = entries.length > MAX_ENTRIES_PER_FOLDER;
    const displayEntries = isTruncated ? entries.slice(0, MAX_ENTRIES_PER_FOLDER) : entries;

    let result = '';

    displayEntries.forEach(([key, value], index) => {
        // 잘린 경우 마지막 연결선 처리를 위해 조건 확인
        const isLast = (index === displayEntries.length - 1) && !isTruncated;
        const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
        const extension = isRoot ? '' : (isLast ? '    ' : '│   ');
        
        result += `${prefix}${connector}${key}${value === null ? '' : '/'}\n`;
        
        if (value !== null) {
            result += formatTree(value, prefix + extension, false);
        }
    });

    // 잘린 파일 표시
    if (isTruncated) {
        const extension = isRoot ? '' : '│   ';
        result += `${prefix}${extension}└── ... (외 ${entries.length - MAX_ENTRIES_PER_FOLDER}개 파일 생략)\n`;
    }

    return result;
}

// ============================================
// File Filtering & Selection
// ============================================

export function filterFiles(files: string[]): string[] {
    return files.filter(file => {
        const fileName = file.split('/').pop() || '';
        const ext = fileName.split('.').pop() || '';
        
        // 1. 중요 설정 파일은 무조건 통과 (루트 레벨 우선)
        // 단, 외부 에셋 내부의 package.json은 제외해야 함
        const isRootConfig = CONFIG_FILES.includes(fileName) && !file.includes('/');
        if (isRootConfig) return true;

        // 2. [변경점] 노이즈 폴더 강력 필터링 (사용자 로그 기반 ModelsAssets 추가됨)
        // 이 폴더들은 AI에게 보여주지도 않고, 선택 대상에서도 제외됩니다.
        const ignoredFolders = [
            // Unity / Game Dev Noise
            '/Plugins/', 
            '/ModelsAssets/',    // 사용자님이 겪은 문제의 원인 폴더
            '/StreamingAssets/', 
            '/Materials/', 
            '/Textures/', 
            '/Prefabs/',
            '/Animations/',
            '/Audio/',
            '/Fonts/',
            '/Editor/',          // 에디터 확장은 보통 리드미의 핵심 기능이 아님
            '/ThirdParty/',
            '/External/',
            '/Library/',
            '/PackageCache/',
            '/Logs/',
            '/UserSettings/',
            
            // Unreal Noise
            '/Content/',         // 블루프린트 바이너리나 에셋은 텍스트 분석 불가
            '/Intermediate/',
            '/Binaries/',
            '/Saved/',
            '/Build/',
            '/DerivedDataCache/',

            // Web / General Noise
            'node_modules/',
            '.git/',
            'dist/',
            'build/',
            'coverage/'
        ];

        if (ignoredFolders.some(dir => file.includes(dir))) return false;

        // 3. 시스템 파일 및 불필요한 확장자 제거
        if (CONFIG.IGNORE_DIRS.some(dir => file.includes(dir))) return false;
        
        // 중요 설정 파일(.gitignore 등)은 허용하되, 나머지 .으로 시작하는 파일 제외
        if (fileName.startsWith('.') && !['.gitignore', '.env.example', '.editorconfig'].includes(fileName)) return false;
        
        // 바이너리 및 에셋 확장자 제외
        if (['meta', 'mat', 'prefab', 'unity', 'asset', 'png', 'jpg', 'jpeg', 'gif', 'ogg', 'wav', 'mp3', 'mp4', 'shader', 'tga', 'psd', 'fbx', 'obj', 'blend', 'pdf', 'zip', 'exe', 'dll'].includes(ext)) return false;
        
        return true;
    });
}

// [변경점] 내부 로직 우선순위 강화 (AI 실패 시 Fallback)
export function selectImportantFiles(files: string[], language: string): string[] {
    console.log('🎯 [Select] 내부 로직으로 중요 파일 선정 중 (언어:', language, ')');

    const patterns: Record<string, RegExp[]> = {
        'Python': [
            /requirements\.txt$/, /pyproject\.toml$/,
            /main\.py$/, /app\.py$/, /__init__\.py$/, /views\.py$/, /models\.py$/, /routes\.py$/, /api\.py$/, /\.py$/
        ],
        'JavaScript': [
            /package\.json$/, /next\.config\.js$/, /vite\.config\.js$/, /webpack\.config\.js$/,
            /index\.(js|ts)$/, /app\.(js|ts)$/, /main\.(js|ts)$/, /server\.(js|ts)$/, /App\.(jsx|tsx)$/, /\.(js|ts|jsx|tsx)$/
        ],
        'TypeScript': [
            /package\.json$/, /tsconfig\.json$/, /next\.config\.js$/,
            /index\.(ts|tsx)$/, /app\.(ts|tsx)$/, /main\.(ts|tsx)$/, /\.(ts|tsx)$/
        ],
        'Java': [
            /pom\.xml$/, /build\.gradle$/,
            /Main\.java$/, /Application\.java$/, /Controller\.java$/, /Service\.java$/, /\.java$/
        ],
        'C#': [ // Unity & .NET
            /ProjectVersion\.txt$/, /manifest\.json$/, /\.asmdef$/,
            /Program\.cs$/, /Startup\.cs$/, /GameManager\.cs$/i, /Controller\.cs$/i, /\.cs$/
        ],
        'C++': [ // Unreal & Native
            /\.uproject$/, /DefaultEngine\.ini$/, /\.Build\.cs$/,
            /main\.(cpp|cc)$/, /GameMode\.(h|cpp)$/i, /\.(cpp|cc|h|hpp)$/
        ],
        'Go': [/go\.mod$/, /main\.go$/, /\.go$/],
        'Rust': [/Cargo\.toml$/, /main\.rs$/, /lib\.rs$/, /\.rs$/],
        'Dart': [/pubspec\.yaml$/, /main\.dart$/, /\.dart$/],
        'Kotlin': [/build\.gradle\.kts$/, /MainActivity\.kt$/, /\.kt$/]
    };

    // 언어별 패턴 선택
    let filePatterns = patterns[language] || [/\.(py|js|ts|jsx|tsx|java|cpp|go|rs|dart|cs|kt)$/];
    
    // 글로벌 설정 파일 패턴
    const globalConfigPatterns = CONFIG_FILES.map(f => new RegExp(`${f.replace('.', '\\.')}$`, 'i'));

    return files
        .filter(f => {
            // 1. 기본 필터링 (테스트 코드 등)
            if (f.includes('test') || f.includes('spec') || f.includes('.min.')) return false;

            // 2. [안전장치] filterFiles에서 걸러졌어야 하지만 혹시 모르니 한 번 더 체크
            if (f.includes('/Plugins/') || f.includes('/ModelsAssets/') || f.includes('/ThirdParty/')) return false;

            const isLanguageFile = filePatterns.some(pattern => pattern.test(f));
            const isGlobalConfigFile = globalConfigPatterns.some(pattern => pattern.test(f));
            
            return isLanguageFile || isGlobalConfigFile;
        })
        .sort((a, b) => {
            const getPriority = (file: string) => {
                const lower = file.toLowerCase();
                
                // 0순위: 프로젝트 루트 설정 파일 (가장 중요)
                // 경로에 '/'가 없거나, 루트에 가까운 설정 파일
                if (lower.endsWith('package.json') || lower.endsWith('projectversion.txt') || lower.endsWith('.uproject') || lower.endsWith('manifest.json') || lower.endsWith('pom.xml') || lower.endsWith('build.gradle')) {
                    return 0;
                }
                
                // 1순위: Unity/Unreal의 핵심 로직 폴더 (Scripts, Source)
                if (language === 'Unity' || language === 'C#') {
                    if (lower.includes('/scripts/') || lower.includes('/runtime/')) return 1;
                }
                if (language === 'Unreal Engine' || language === 'C++') {
                    if (lower.includes('/source/')) return 1;
                }

                // 2순위: 진입점 및 주요 매니저급 파일 (파일명 기반)
                if (lower.match(/main\.|app\.|index\.|gamemanager|controller|service|handler/)) return 2;
                
                // 3순위: 일반 소스 코드
                if (lower.endsWith('.cs') || lower.endsWith('.ts') || lower.endsWith('.py') || lower.endsWith('.java') || lower.endsWith('.cpp')) return 3;

                // 4순위: 기타
                return 4;
            };
            
            // 우선순위 숫자가 낮은 게 먼저 옴
            return getPriority(a) - getPriority(b);
        });
}