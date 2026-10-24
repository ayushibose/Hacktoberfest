import OpenAI from 'openai'
import type { Request, Response } from 'express'

export type ScreenRelevance = 'relevant' | 'unrelated' | 'uncertain'

export interface AnalyseScreenRequest {
  goal: string
  imageDataUrl: string
}

export interface AnalyseScreenResult {
  relevance: ScreenRelevance
  explanation: string
  suggestions: string[]
}

const MAX_IMAGE_LENGTH = 10_000_000
const imageDataUrlPattern = /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/
let requestSequence = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseModelResult(content: string): AnalyseScreenResult {
  const withoutFence = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const parsed: unknown = JSON.parse(withoutFence)

  if (!isRecord(parsed)) {
    throw new Error('Model response was not an object')
  }

  const relevance = parsed.relevance
  const explanation = parsed.explanation
  const suggestions = parsed.suggestions
  if (
    (relevance !== 'relevant' && relevance !== 'unrelated' && relevance !== 'uncertain') ||
    typeof explanation !== 'string' ||
    !Array.isArray(suggestions) ||
    suggestions.some((suggestion) => typeof suggestion !== 'string')
  ) {
    throw new Error('Model response did not match the analysis schema')
  }

  return {
    relevance,
    explanation: explanation.trim(),
    suggestions: suggestions.map((suggestion) => suggestion.trim()).filter(Boolean).slice(0, 3),
  }
}

function getClient(): OpenAI {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMMA_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_STUDIO_API_KEY is not configured')
  }

  return new OpenAI({
    apiKey,
    baseURL:
      process.env.GEMMA_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta/openai/',
  })
}

function isRetryableProviderError(error: unknown): boolean {
  if (!isRecord(error)) return false
  const status = error.status
  return status === 429 || (typeof status === 'number' && status >= 500)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function analyseScreen(req: Request, res: Response): Promise<void> {
  const requestId = ++requestSequence
  const startedAt = Date.now()
  const body: unknown = req.body
  if (!isRecord(body)) {
    console.warn(`[screen-analysis #${requestId}] rejected invalid request body`)
    res.status(400).json({ error: 'Request body must be an object' })
    return
  }

  const goal = body.goal
  const imageDataUrl = body.imageDataUrl
  if (
    typeof goal !== 'string' ||
    goal.trim().length < 1 ||
    goal.trim().length > 500 ||
    typeof imageDataUrl !== 'string' ||
    imageDataUrl.length > MAX_IMAGE_LENGTH ||
    !imageDataUrlPattern.test(imageDataUrl)
  ) {
    console.warn(`[screen-analysis #${requestId}] rejected invalid goal or image data`)
    res.status(400).json({
      error: 'Provide a study goal (1-500 characters) and a valid base64 image data URL.',
    })
    return
  }

  const model = process.env.GEMMA_MODEL || 'gemma-4'
  console.log(
    `[screen-analysis #${requestId}] started model=${model} imageChars=${imageDataUrl.length}`,
  )

  try {
    const client = getClient()
    let completion
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const attemptStartedAt = Date.now()
      console.log(`[screen-analysis #${requestId}] provider attempt=${attempt + 1}/3`)
      try {
        completion = await client.chat.completions.create({
          model,
          temperature: 0.2,
          max_tokens: 512,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'screen_relevance_analysis',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  relevance: {
                    type: 'string',
                    enum: ['relevant', 'unrelated', 'uncertain'],
                  },
                  explanation: { type: 'string' },
                  suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 3,
                  },
                },
                required: ['relevance', 'explanation', 'suggestions'],
              },
            },
          },
          messages: [
            {
              role: 'system',
              content:
                'You assess whether a screen image appears relevant to a stated study goal. Do not claim to know whether the person is productive. Return exactly one JSON object and no reasoning, markdown, or XML. Its fields must be relevance (exactly relevant, unrelated, or uncertain), explanation (brief string), and suggestions (array of at most 3 brief strings). Use uncertain when the image does not provide enough evidence.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Study goal: ${goal.trim()}` },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
        })
        console.log(
          `[screen-analysis #${requestId}] provider response attempt=${attempt + 1}/3 durationMs=${Date.now() - attemptStartedAt}`,
        )
        break
      } catch (error) {
        const retryable = isRetryableProviderError(error)
        console.warn(
          `[screen-analysis #${requestId}] provider failure attempt=${attempt + 1}/3 durationMs=${Date.now() - attemptStartedAt} retryable=${retryable}`,
        )
        if (!retryable || attempt === 2) throw error
        await wait(500 * 2 ** attempt)
      }
    }
    if (!completion) {
      throw new Error('Model request did not return a completion')
    }
    const content = completion.choices[0]?.message.content
    if (!content) {
      throw new Error('Model returned an empty response')
    }

    console.log(
      `[screen-analysis #${requestId}] response contentType=${typeof content} contentChars=${content.length}`,
    )
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[screen-analysis #${requestId}] response preview=${JSON.stringify(content.slice(0, 1000))}`,
      )
    }
    const result = parseModelResult(content)
    console.log(
      `[screen-analysis #${requestId}] completed relevance=${result.relevance} totalDurationMs=${Date.now() - startedAt}`,
    )
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error'
    console.error(
      `[screen-analysis #${requestId}] failed totalDurationMs=${Date.now() - startedAt}:`,
      message,
    )
    res.status(502).json({
      error: 'Screen analysis is temporarily unavailable.',
      detail:
        process.env.NODE_ENV === 'production'
          ? undefined
          : message,
    })
  }
}
