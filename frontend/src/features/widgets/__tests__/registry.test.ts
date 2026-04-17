import { describe, it, expect } from 'vitest'
import { WIDGET_REGISTRY, getWidgetDef, WIDGET_TYPES } from '@/features/widgets/registry'

const EXPECTED_TYPES = [
  'gauge',
  'number_display',
  'line_chart',
  'status_indicator',
  'toggle_switch',
  'button',
  'stat_card',
  'progress_bar',
  'map',
] as const

describe('Widget Registry', () => {
  it('has all 9 widget types registered', () => {
    const keys = Object.keys(WIDGET_REGISTRY)
    expect(keys).toHaveLength(9)
  })

  it('contains every expected widget type', () => {
    for (const type of EXPECTED_TYPES) {
      expect(WIDGET_REGISTRY).toHaveProperty(type)
    }
  })

  it('WIDGET_TYPES array matches registry keys', () => {
    const registryKeys = Object.keys(WIDGET_REGISTRY).sort()
    const typesFromArray = WIDGET_TYPES.map((d) => d.type).sort()
    expect(typesFromArray).toEqual(registryKeys)
  })

  describe('getWidgetDef', () => {
    it('returns correct definition for each registered type', () => {
      for (const type of EXPECTED_TYPES) {
        const def = getWidgetDef(type)
        expect(def).toBeDefined()
        expect(def?.type).toBe(type)
      }
    })

    it('returns undefined for an unknown type', () => {
      expect(getWidgetDef('unknown_widget')).toBeUndefined()
      expect(getWidgetDef('')).toBeUndefined()
      expect(getWidgetDef('GAUGE')).toBeUndefined() // case-sensitive
    })
  })

  describe('each definition has required fields', () => {
    it.each(EXPECTED_TYPES)('%s has all required fields', (type) => {
      const def = getWidgetDef(type)!

      expect(def.type).toBe(type)
      expect(typeof def.label).toBe('string')
      expect(def.label.length).toBeGreaterThan(0)

      expect(def.defaultSize).toBeDefined()
      expect(typeof def.defaultSize.w).toBe('number')
      expect(typeof def.defaultSize.h).toBe('number')
      expect(def.defaultSize.w).toBeGreaterThan(0)
      expect(def.defaultSize.h).toBeGreaterThan(0)

      expect(def.component).toBeDefined()
      expect(typeof def.component).toBe('function')

      expect(def.configFields).toBeDefined()
      expect(typeof def.configFields).toBe('function')

      expect(def.defaultConfig).toBeDefined()
      expect(typeof def.defaultConfig).toBe('object')
    })
  })

  describe('icon field', () => {
    it.each(EXPECTED_TYPES)('%s has a non-empty icon name', (type) => {
      const def = getWidgetDef(type)!
      expect(typeof def.icon).toBe('string')
      expect(def.icon.length).toBeGreaterThan(0)
    })
  })
})
