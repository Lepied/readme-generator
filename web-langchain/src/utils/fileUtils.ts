// ============================================
// File Tree Building Utilities
// ============================================

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
        
        if (CONFIG.IGNORE_DIRS.some(dir => file.includes(dir))) return false;
        if (fileName.startsWith('.')) return false;
        if (['lock', 'log', 'cache', 'tmp'].includes(ext)) return false;
        
        return true;
    });
}

export function shouldAnalyzeFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    const ext = fileName.split('.').pop() || '';
    
    const codeExtensions = [
        'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 
        'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'dart'
    ];
    
    return codeExtensions.includes(ext) || CONFIG_FILES.includes(fileName);
}
