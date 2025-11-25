import type { ProjectData } from '../types/index.js';
import { filterFiles } from './fileUtils.js';

export function createProjectSummary(
    projectData: ProjectData,
    includeCode: boolean = false
): string {
    const parts: string[] = [];
    
    parts.push(`# Project: ${projectData.name}`);
    parts.push(`\n## Language: ${projectData.language}`);
    parts.push(`\n## Structure:\n\`\`\`\n${projectData.structure}\n\`\`\``);
    
    // 파일 목록 추가
    if (projectData.files && projectData.files.length > 0) {
        const filtered = filterFiles(projectData.files);
        parts.push(`\n## Files (${filtered.length}):\n${filtered.slice(0, 50).join('\n')}`);
    }
    
    // 코드 내용 포함 (선택사항)
    if (includeCode && projectData.mainFiles) {
        parts.push('\n## Main Files Content:');
        Object.entries(projectData.mainFiles).forEach(([path, content]) => {
            parts.push(`\n### ${path}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\``);
        });
    }
    
    // 분석 결과 추가 (빠른 모드: 문자열 / 체인 모드: 객체)
    parts.push('\n## Analysis Results:');
    
    if (projectData.rawPurposeAnalysis) {
        parts.push(`\n### Purpose Analysis:\n${projectData.rawPurposeAnalysis}`);
    } else if (projectData.codeAnalysis?.purposeSummary) {
        parts.push(`\n### Purpose Analysis:\n${projectData.codeAnalysis.purposeSummary}`);
    }

    if (projectData.rawCodeAnalysis) {
        parts.push(`\n### Code Analysis:\n${projectData.rawCodeAnalysis}`);
    } else if (projectData.codeAnalysis?.summary) {
        parts.push(`\n### Code Analysis:\n${projectData.codeAnalysis.summary}`);
        if (projectData.codeAnalysis.features.length > 0) {
            parts.push('\n#### Detected Features:');
            projectData.codeAnalysis.features.forEach(f => {
                parts.push(`- **${f.file}** (${f.role}): ${f.keyFeatures.join(', ')}`);
            });
        }
    }
    
    return parts.join('\n');
}