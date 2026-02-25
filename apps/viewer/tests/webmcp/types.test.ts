import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ok, err, validateInput } from '@/webmcp/types'

describe('webmcp/types', () => {
  describe('ok helper', () => {
    it('should create success result', () => {
      const result = ok({ foo: 'bar' })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ foo: 'bar' })
    })

    it('should handle primitive values', () => {
      expect(ok(42).data).toBe(42)
      expect(ok('hello').data).toBe('hello')
      expect(ok(null).data).toBe(null)
    })

    it('should handle arrays', () => {
      const result = ok([1, 2, 3])
      expect(result.data).toEqual([1, 2, 3])
    })
  })

  describe('err helper', () => {
    it('should create error result', () => {
      const result = err('Something went wrong')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Something went wrong')
    })

    it('should handle empty error message', () => {
      const result = err('')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('')
    })
  })

  describe('validateInput', () => {
    const schema = z.object({
      ids: z.array(z.string()),
      mode: z.enum(['replace', 'add']).default('replace'),
    })

    it('should return ok for valid input', () => {
      const payload = { input: { ids: ['a', 'b'], mode: 'add' } }
      const result = validateInput(schema, payload)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.ids).toEqual(['a', 'b'])
        expect(result.data.mode).toBe('add')
      }
    })

    it('should apply default values', () => {
      const payload = { input: { ids: ['a'] } }
      const result = validateInput(schema, payload)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.mode).toBe('replace')
      }
    })

    it('should return err for invalid input', () => {
      const payload = { input: { ids: 'not-an-array' } }
      const result = validateInput(schema, payload)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid input')
      }
    })

    it('should return err for missing required field', () => {
      const payload = { input: {} }
      const result = validateInput(schema, payload)

      expect(result.ok).toBe(false)
    })

    it('should return err for invalid enum value', () => {
      const payload = { input: { ids: ['a'], mode: 'invalid' } }
      const result = validateInput(schema, payload)

      expect(result.ok).toBe(false)
    })
  })
})
