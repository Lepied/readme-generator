declare module '@langchain/google-genai' {
  export class ChatGoogleGenerativeAI {
    constructor(config: any);
    invoke(prompt: string): Promise<{ content: any }>;
  }
}

declare module '@langchain/core/prompts' {
  export class PromptTemplate {
    constructor(config: { template: string; inputVariables: string[] });
  }
}

declare module 'langchain/chains' {
  export class LLMChain {
    constructor(config: { llm: any; prompt: any });
    call(inputs: Record<string, any>): Promise<{ text: string }>;
  }
}
