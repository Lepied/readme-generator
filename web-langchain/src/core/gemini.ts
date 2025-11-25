// ============================================
// Gemini API Wrapper
// ============================================

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { CONFIG } from '../config/constants.js';

let modelInstance: ChatGoogleGenerativeAI | null = null;

export function initializeModel(apiKey: string, model?: string): void {
    const selectedModel = model || CONFIG.DEFAULT_MODEL;
    console.log(`🔧 [Init] 모델 초기화: ${selectedModel}`);
    
    modelInstance = new ChatGoogleGenerativeAI({
        apiKey,
        model: selectedModel,
        temperature: CONFIG.DEFAULT_TEMPERATURE,
        maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
    });
}

export function getModel(): ChatGoogleGenerativeAI {
    if (!modelInstance) {
        throw new Error('모델이 초기화되지 않았습니다. initializeModel()을 먼저 호출하세요.');
    }
    return modelInstance;
}

export async function generateWithRetry(
    prompt: string,
    retries: number = CONFIG.MAX_RETRIES
): Promise<string> {
    const model = getModel();
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await model.invoke(prompt);
            return response.content.toString();
        } catch (error: any) {
            console.error(`시도 ${i + 1}/${retries} 실패:`, error);
            
            if (i === retries - 1) throw error;
            
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
        }
    }
    
    throw new Error('최대 재시도 횟수 초과');
}
