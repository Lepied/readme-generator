import { CONFIG, CONFIG_FILES } from '../config/constants.js';

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
    let result = '';

    entries.forEach(([key, value], index) => {
        const isLast = index === entries.length - 1;
        const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
        const extension = isRoot ? '' : (isLast ? '    ' : '│   ');
        
        result += `${prefix}${connector}${key}${value === null ? '' : '/'}\n`;
        
        if (value !== null) {
            result += formatTree(value, prefix + extension, false);
        }
    });

    return result;
}

export function filterFiles(files: string[]): string[] {
    return files.filter(file => {
        const fileName = file.split('/').pop() || '';
        const ext = fileName.split('.').pop() || '';
        
        // 1. 중요 설정 파일은 무조건 허용 (Dotfile이라도)
        if (CONFIG_FILES.includes(fileName) || 
            ['.gitignore', '.env.example', '.gitattributes', '.editorconfig'].includes(fileName)) {
            return true;
        }

        // 2. 무시할 디렉토리 및 불필요한 파일 필터링
        if (CONFIG.IGNORE_DIRS.some(dir => file.includes(dir))) return false;
        if (fileName.startsWith('.')) return false; // 그 외 Dotfile 제외
        if (['lock', 'log', 'cache', 'tmp', 'map', 'ico', 'png', 'jpg'].includes(ext)) return false;
        
        return true;
    });
}

// main.ts에서 이동됨 + 개선됨
export function selectImportantFiles(files: string[], language: string): string[] {
    console.log('🎯 [Select] 언어:', language, '파일 수:', files.length);

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
        'C#': [
            /ProjectVersion\.txt$/, /manifest\.json$/, /\.asmdef$/,
            /Program\.cs$/, /Startup\.cs$/, /GameManager\.cs$/i, /Controller\.cs$/i, /\.cs$/
        ],
        'C++': [
            /\.uproject$/, /DefaultEngine\.ini$/, /\.Build\.cs$/,
            /main\.(cpp|cc)$/, /GameMode\.(h|cpp)$/i, /\.(cpp|cc|h|hpp)$/
        ],
        'Go': [/go\.mod$/, /main\.go$/, /\.go$/],
        'Rust': [/Cargo\.toml$/, /main\.rs$/, /lib\.rs$/, /\.rs$/],
        'Dart': [/pubspec\.yaml$/, /main\.dart$/, /\.dart$/],
        'Kotlin': [/build\.gradle\.kts$/, /MainActivity\.kt$/, /\.kt$/]
    };

    // 언어별 패턴 선택 (기본값: JS/TS/Py 등 일반적인 소스)
    let filePatterns = patterns[language] || [/\.(py|js|ts|jsx|tsx|java|cpp|go|rs|dart|cs|kt)$/];

    // CONFIG_FILES 상수를 활용한 글로벌 패턴 생성
    // 문자열로 된 CONFIG_FILES를 RegExp로 변환하여 매칭
    const globalConfigPatterns = CONFIG_FILES.map(f => new RegExp(`${f.replace('.', '\\.')}$`, 'i'));

    return files
        .filter(f => {
            if (f.includes('test') || f.includes('spec') || f.includes('.min.')) return false;

            const isLanguageFile = filePatterns.some(pattern => pattern.test(f));
            const isGlobalConfigFile = globalConfigPatterns.some(pattern => pattern.test(f));
            
            return isLanguageFile || isGlobalConfigFile;
        })
        .sort((a, b) => {
            const getPriority = (file: string) => {
                const lower = file.toLowerCase();
                // 설정 파일 최우선
                if (CONFIG_FILES.some(cf => lower.endsWith(cf.toLowerCase()))) return 0;
                // 진입점 차순위
                if (lower.match(/main\.|app\.|index\.|server\./)) return 1;
                // 주요 로직
                if (lower.match(/controller|manager|service|api|model/)) return 2;
                return 3;
            };
            return getPriority(a) - getPriority(b);
        });
}