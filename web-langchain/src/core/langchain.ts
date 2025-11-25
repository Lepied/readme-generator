// ============================================
// LangChain-style Abstractions (Custom Implementation)
// ============================================

import { generateWithRetry } from './gemini.js';

export class PromptTemplate {
    constructor(private template: string, private inputVariables: string[]) {}
    
    format(values: Record<string, any>): string {
        let result = this.template;
        for (const [key, value] of Object.entries(values)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, value || '');
        }
        return result;
    }
}

export class LLMChain {
    constructor(private prompt: PromptTemplate) {}
    
    async call(inputs: Record<string, any>): Promise<{ text: string }> {
        const promptText = this.prompt.format(inputs);
        const output = await generateWithRetry(promptText);
        return { text: output };
    }
}

export async function createChain(template: string, inputVariables: string[]): Promise<LLMChain> {
    const prompt = new PromptTemplate(template, inputVariables);
    return new LLMChain(prompt);
}

export async function runChain(chain: LLMChain, inputs: Record<string, any>): Promise<string> {
    const result = await chain.call(inputs);
    return result.text;
}
