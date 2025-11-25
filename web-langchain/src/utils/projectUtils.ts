// ============================================
// Project Summary Utilities
// ============================================

import type { ProjectData } from '../types/index.js';
import { buildTreeStructure, filterFiles } from './fileUtils.js';

export function createProjectSummary(
    projectData: ProjectData,
    includeCode: boolean = false
): string {
    const parts: string[] = [];
    
    parts.push(`# Project: ${projectData.name}`);
    parts.push(`\n## Language: ${projectData.language}`);
    parts.push(`\n## Structure:\n\`\`\`\n${projectData.structure}\n\`\`\``);
    
    if (projectData.files && projectData.files.length > 0) {
        const filtered = filterFiles(projectData.files);
        parts.push(`\n## Files (${filtered.length}):\n${filtered.slice(0, 50).join('\n')}`);
    }
    
    if (includeCode && projectData.mainFiles) {
        parts.push('\n## Main Files:');
        Object.entries(projectData.mainFiles).forEach(([path, content]) => {
            parts.push(`\n### ${path}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\``);
        });
    }
    
    if (projectData.codeAnalysis) {
        parts.push('\n## Code Analysis:');
        parts.push(`\n${projectData.codeAnalysis.summary}`);
        
        if (projectData.codeAnalysis.features.length > 0) {
            parts.push('\n### Features:');
            projectData.codeAnalysis.features.forEach(f => {
                parts.push(`- **${f.file}** (${f.role}): ${f.keyFeatures.join(', ')}`);
            });
        }
    }
    
    return parts.join('\n');
}

export function summarizeProject(projectData: ProjectData): string {
    const summary: string[] = [];
    
    summary.push(`프로젝트: ${projectData.name}`);
    summary.push(`언어: ${projectData.language}`);
    summary.push(`파일 수: ${projectData.files.length}`);
    
    if (projectData.codeAnalysis?.purposeSummary) {
        summary.push(`목적: ${projectData.codeAnalysis.purposeSummary}`);
    }
    
    return summary.join(' | ');
}
