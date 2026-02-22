import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type AiProvider = 'anthropic' | 'openai' | 'google'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiCallParams {
  provider: AiProvider
  model: string
  system: string
  messages: AiMessage[]
  maxTokens: number
}

export interface AiStreamOptions {
  onChunk?: (chunk: string) => void
  signal?: AbortSignal
}

export interface AiCallResult {
  text: string
  inputTokens: number
  outputTokens: number
}

// Precios por millón de tokens (USD) — fuente: páginas oficiales de cada proveedor
export const MODEL_PRICING_USD_PER_M: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'o1-mini': { input: 1.1, output: 4.4 },
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash-lite': { input: 0.0375, output: 0.15 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_USD_PER_M[model]
  if (!pricing) return 0
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

export const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  google: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  google: 'Google Gemini',
}

export const PROVIDER_ENV_KEYS: Record<AiProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
}

export const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6': 'Opus 4.6 — Máxima capacidad',
  'claude-sonnet-4-6': 'Sonnet 4.6 — Balanceado',
  'claude-haiku-4-5-20251001': 'Haiku 4.5 — Rápido y económico',
  'gpt-4o': 'GPT-4o — Máxima capacidad',
  'gpt-4o-mini': 'GPT-4o mini — Rápido y económico',
  'o1-mini': 'o1-mini — Razonamiento avanzado',
  'gemini-2.0-flash': 'Gemini 2.0 Flash — Balanceado',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite — Económico',
  'gemini-1.5-pro': 'Gemini 1.5 Pro — Máxima capacidad',
  'gemini-1.5-flash': 'Gemini 1.5 Flash — Rápido',
}

export function getProviderApiKey(provider: AiProvider): string {
  const key = PROVIDER_ENV_KEYS[provider]
  return process.env[key]?.trim() ?? ''
}

export function isProviderAvailable(provider: AiProvider): boolean {
  return getProviderApiKey(provider).length > 0
}

export function isValidProviderModel(provider: AiProvider, model: string): boolean {
  return PROVIDER_MODELS[provider]?.includes(model) ?? false
}

// Non-streaming call — returns text + token usage
export async function callAi(params: AiCallParams): Promise<AiCallResult> {
  const { provider, model, system, messages, maxTokens } = params

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: getProviderApiKey('anthropic') })
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    const block = response.content.find((b) => b.type === 'text')
    return {
      text: block?.type === 'text' ? block.text : '',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey: getProviderApiKey('openai') })
    const response = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
    })
    return {
      text: response.choices[0]?.message?.content ?? '',
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    }
  }

  if (provider === 'google') {
    const genai = new GoogleGenerativeAI(getProviderApiKey('google'))
    const geminiModel = genai.getGenerativeModel({ model, systemInstruction: system })
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const result = await geminiModel.generateContent({ contents })
    return {
      text: result.response.text(),
      inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
    }
  }

  throw new Error(`Proveedor de IA no soportado: ${provider}`)
}

// Streaming call — calls onChunk per text delta, returns text + token usage
export async function streamAi(params: AiCallParams, options: AiStreamOptions = {}): Promise<AiCallResult> {
  const { provider, model, system, messages, maxTokens } = params
  const { onChunk, signal } = options

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: getProviderApiKey('anthropic') })
    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    if (signal) {
      signal.addEventListener('abort', () => stream.abort(), { once: true })
    }

    stream.on('text', (chunk) => {
      if (chunk) onChunk?.(chunk)
    })

    const finalMsg = await stream.finalMessage()
    const block = finalMsg.content.find((b) => b.type === 'text')
    return {
      text: block?.type === 'text' ? block.text : '',
      inputTokens: finalMsg.usage.input_tokens,
      outputTokens: finalMsg.usage.output_tokens,
    }
  }

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey: getProviderApiKey('openai') })
    const stream = await openai.chat.completions.create(
      {
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal }
    )

    let fullText = ''
    let inputTokens = 0
    let outputTokens = 0
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        fullText += delta
        onChunk?.(delta)
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0
        outputTokens = chunk.usage.completion_tokens ?? 0
      }
    }
    return { text: fullText, inputTokens, outputTokens }
  }

  if (provider === 'google') {
    const genai = new GoogleGenerativeAI(getProviderApiKey('google'))
    const geminiModel = genai.getGenerativeModel({ model, systemInstruction: system })
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const result = await geminiModel.generateContentStream({ contents })

    let fullText = ''
    for await (const chunk of result.stream) {
      if (signal?.aborted) break
      const delta = chunk.text()
      if (delta) {
        fullText += delta
        onChunk?.(delta)
      }
    }
    const finalResponse = await result.response
    return {
      text: fullText,
      inputTokens: finalResponse.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: finalResponse.usageMetadata?.candidatesTokenCount ?? 0,
    }
  }

  throw new Error(`Proveedor de IA no soportado: ${provider}`)
}
