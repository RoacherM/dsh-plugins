import test from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from './index.js'

function loadPlugin(config) {
  const registrations = []
  const ctx = {
    systemPrompt: {
      section(section) {
        registrations.push({ kind: 'section', section })
        return () => {}
      },
    },
    tools: {
      register(tool) {
        registrations.push({ kind: 'tool', tool })
        return () => {}
      },
    },
  }
  plugin.apply(ctx, config)
  return { ctx, registrations }
}

test('exports the dsh plugin contract', () => {
  assert.equal(plugin.name, 'tiny-window')
  assert.deepEqual(plugin.inject, ['tools', 'systemPrompt'])
  assert.equal(typeof plugin.apply, 'function')
})

test('registers a system-prompt section and the look_outside tool', () => {
  const { registrations } = loadPlugin({ timezoneOffset: 8, style: 'emoji', windowTitle: 'test window' })
  const section = registrations.find(item => item.kind === 'section').section
  const tool = registrations.find(item => item.kind === 'tool').tool
  assert.match(section.text, /test window/)
  assert.equal(section.order, 110)
  assert.equal(tool.name, 'look_outside')
  assert.equal(tool.output.schema.required.includes('scene'), true)
})

test('maps hours to periods', () => {
  assert.equal(plugin.periodForHour(4), 'night')
  assert.equal(plugin.periodForHour(6), 'dawn')
  assert.equal(plugin.periodForHour(12), 'day')
  assert.equal(plugin.periodForHour(18), 'dusk')
  assert.equal(plugin.periodForHour(23), 'night')
})

test('renders both scene styles', () => {
  for (const style of ['emoji', 'ascii']) {
    assert.match(plugin.buildScene('night', style), /hills/)
  }
})
