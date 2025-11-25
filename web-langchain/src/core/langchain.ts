// web-langchain/src/core/langchain.ts

import { generateWithRetry } from './gemini.js';

export class PromptTemplate {
    template: string;
    inputVariables: string[];

    constructor({ template, inputVariables }: { template: string, inputVariables: string[] }) {
        this.template = template;
        this.inputVariables = inputVariables;
    }

    async format(values: Record<string, string>): Promise<string> {
        let formatted = this.template;
        for (const key of this.inputVariables) {
            // 변수 치환
            const regex = new RegExp(`{${key}}`, 'g');
            // 값이 없으면 빈 문자열로 대체하여 {key}가 그대로 남는 것 방지
            formatted = formatted.replace(regex, values[key] || '');
        }
        return formatted;
    }
}

export class LLMChain {
    llm: any;
    prompt: PromptTemplate;

    constructor({ llm, prompt }: { llm?: any, prompt: PromptTemplate }) {
        this.llm = llm;
        this.prompt = prompt;
    }

    async call(values: Record<string, string>): Promise<string> {
        const formattedPrompt = await this.prompt.format(values);
        // 사용자에게 보일 필요 없는 로그 제거
        // console.log('🔗 [Chain] 프롬프트 준비됨'); 
        
        return await generateWithRetry(formattedPrompt);
    }
}

export async function createChain(template: string, inputVariables: string[]): Promise<LLMChain> {
    const prompt = new PromptTemplate({ template, inputVariables });
    return new LLMChain({ prompt });
}

export async function runChain(chain: LLMChain, inputs: Record<string, string>): Promise<string> {
    return await chain.call(inputs);
}