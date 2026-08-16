/**
 * dsh-plugin-tiny-window
 *
 * A creative hello-world plugin for DeepSeek Harness. It gives the agent a
 * configurable "tiny window" and registers one model-facing tool,
 * `look_outside`, which paints the current time-of-day scene as ASCII/emoji art.
 *
 * This single file demonstrates the essential plugin anatomy:
 *   - `name` / `inject`
 *   - Schemastery `Config`
 *   - a system-prompt section
 *   - a raw JSON-Schema tool registration with a canonical output
 */

import Schema from '@deepseek-ai/schemastery'

export const name = 'tiny-window'
export const inject = ['tools', 'systemPrompt']

/** Plugin configuration, validated and defaulted by the dsh loader. */
export const Config = Schema.object({
  /** UTC offset for "local time" shown through the window. */
  timezoneOffset: Schema.number().min(-12).max(14).default(8),
  /** Rendering style for the scene. */
  style: Schema.union(['emoji', 'ascii']).default('emoji'),
  /** Friendly name used in the system prompt and tool output. */
  windowTitle: Schema.string().default('tiny window'),
})

const PERIODS = ['dawn', 'day', 'dusk', 'night']

const EMOJI_SCENES = {
  dawn: [
    '         🌤️',
    '      .-~~~-.',
    '    _/       \\_',
    '   (   hills   )',
    '    `-.___.-\'',
    '      ☕ a new day',
  ].join('\n'),
  day: [
    '      \\   |   /',
    '       .-☀️-.',
    '    _/   |   \\_',
    '   (   hills   )',
    '    `-.___.-\'',
    '      🌱 bright & busy',
  ].join('\n'),
  dusk: [
    '         🌇',
    '      .-~~~-.',
    '    _/       \\_',
    '   (   hills   )',
    '    `-.___.-\'',
    '      🍵 slow down',
  ].join('\n'),
  night: [
    '       ✦     ☾',
    '         🌙',
    '      .-~~~-.',
    '    _/       \\_',
    '   (   hills   )',
    '    `-.___.-\'',
    '      🌌 quiet hours',
  ].join('\n'),
}

const ASCII_SCENES = {
  dawn: [
    '       \\   |   /',
    '     ---( o )---',
    '       /   |   \\',
    '   ~~~~~ hills ~~~~~',
    '       [ dawn ]',
  ].join('\n'),
  day: [
    '       \\   |   /',
    '        .-(o)-.',
    '       /   |   \\',
    '   ~~~~~ hills ~~~~~',
    '       [ day ]',
  ].join('\n'),
  dusk: [
    '       \\   |   /',
    '     ---( o )---',
    '       /   |   \\',
    '   /\\/\\/ hills /\\/\\/\\',
    '       [ dusk ]',
  ].join('\n'),
  night: [
    '         .    *',
    '       *    .',
    '         ( o )',
    '   ~~~~~ hills ~~~~~',
    '       [ night ]',
  ].join('\n'),
}

/** Time-of-day bucket for one local hour. */
function periodForHour(hour) {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

/** Round to at most two decimals so half-hour timezone offsets stay readable. */
function readableHour(hour) {
  return Math.round(hour * 100) / 100
}

/**
 * Build the scene for one period/style pair.
 * @param period - one of {@link PERIODS}.
 * @param style - `emoji` or `ascii`.
 * @returns the scene text.
 */
export function buildScene(period, style) {
  const scenes = style === 'ascii' ? ASCII_SCENES : EMOJI_SCENES
  return scenes[period]
}

/**
 * Validate the one optional model argument. Raw JSON-Schema tools own their
 * argument validation, so this plugin checks its tiny surface by hand.
 * @param args - untrusted model-supplied arguments.
 * @param fallback - configured default style.
 * @returns a valid style.
 */
function resolveStyle(args, fallback) {
  const requested = args && typeof args === 'object' ? args.style : undefined
  if (requested !== undefined && requested !== 'emoji' && requested !== 'ascii') {
    throw new Error('style must be "emoji" or "ascii"')
  }
  return requested ?? fallback
}

/**
 * Register the `look_outside` tool and a small system-prompt section.
 * @param ctx - Cordis context provided by the dsh loader.
 * @param config - validated plugin config.
 */
export function apply(ctx, config) {
  ctx.systemPrompt.section({
    name: 'tiny-window:prompt',
    order: 110,
    text: `You have a ${config.windowTitle} in your workspace. `
      + 'When the user asks what you can see, what time of day it is, or asks for a tiny break, '
      + 'call the `look_outside` tool before answering.',
  })

  ctx.tools.register({
    name: 'look_outside',
    description:
      'Look out of the tiny window. Returns the current local time-of-day scene as small ASCII/emoji art, '
      + 'the period (dawn/day/dusk/night), and the local hour for the configured timezone offset.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        style: {
          type: 'string',
          enum: ['emoji', 'ascii'],
          description: 'Optional scene style. Defaults to the configured plugin style.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['scene', 'period', 'localHour', 'windowTitle'],
        properties: {
          scene: { type: 'string', description: 'The rendered scene.' },
          period: { type: 'string', enum: PERIODS, description: 'Time-of-day bucket.' },
          localHour: { type: 'number', description: 'Local hour using the configured timezone offset.' },
          windowTitle: { type: 'string', description: 'The configured window title.' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `${value.windowTitle}\n${value.scene}\n\nLocal hour: ${value.localHour} (${value.period})`,
      }],
    },
    async execute(args) {
      const style = resolveStyle(args, config.style)
      const now = new Date()
      const localHour = ((now.getUTCHours() + config.timezoneOffset) % 24 + 24) % 24
      const period = periodForHour(localHour)
      return {
        scene: buildScene(period, style),
        period,
        localHour: readableHour(localHour),
        windowTitle: config.windowTitle,
      }
    },
    presentCall: () => ({ card: 'generic', title: 'Looking outside', kind: 'other' }),
  })
}

export { periodForHour }
