/**
 * Module Embedding Cache Tests
 *
 * Verify that module embeddings are cached in DB
 * and recommendation performance meets targets
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync } from 'fs'
import {
  recommendModules,
  syncModulesFromFiles
} from '../src/mama/module-recommender.js'
import {
  initDatabase,
  closeDatabase,
  upsertModule,
  getModuleEmbedding,
  updateModuleEmbedding,
  needsEmbeddingRefresh
} from '../src/mama/db.js'

// Mock config to use test database
const testDbPath = join(mkdtempSync(join(tmpdir(), 'mama-test-')), 'test.db')
vi.mock('../src/mama/config.js', () => ({
  DB_PATH: testDbPath,
  CAD_DATA_DIR: '/tmp/test-cad-data',
  ensureDataDirs: vi.fn(),
  getEmbeddingDim: () => 384,
  getModelName: () => 'test-model'
}))

describe('Module Embedding Cache', () => {
  beforeAll(() => {
    initDatabase()

    // Create test modules
    const testModules = [
      {
        name: 'chicken_lib',
        description: 'Draw a chicken character with animations',
        tags: ['character', 'animal', 'animation'],
        example: 'chicken_lib.draw({x: 0, y: 0})'
      },
      {
        name: 'house_lib',
        description: 'Build houses with customizable parameters',
        tags: ['building', 'architecture', 'structure'],
        example: 'house_lib.create({floors: 2})'
      },
      {
        name: 'tree_lib',
        description: 'Generate procedural trees and forests',
        tags: ['nature', 'procedural', 'environment'],
        example: 'tree_lib.generate({type: "oak"})'
      }
    ]

    testModules.forEach(module => {
      upsertModule(module)
    })
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('Embedding Storage', () => {
    it('should store module embeddings in DB', async () => {
      // Mock embedding
      const mockEmbedding = new Float32Array(384).fill(0.5)
      const metadataHash = 'test-hash-123'

      updateModuleEmbedding('chicken_lib', mockEmbedding, metadataHash)

      // Verify stored
      const retrieved = getModuleEmbedding('chicken_lib')
      expect(retrieved).toBeInstanceOf(Float32Array)
      expect(retrieved?.length).toBe(384)
    })

    it('should detect when embedding needs refresh', () => {
      const oldHash = 'old-hash'
      const newHash = 'new-hash'

      // Store with old hash
      const mockEmbedding = new Float32Array(384).fill(0.3)
      updateModuleEmbedding('house_lib', mockEmbedding, oldHash)

      // Check with new hash
      expect(needsEmbeddingRefresh('house_lib', newHash)).toBe(true)
      expect(needsEmbeddingRefresh('house_lib', oldHash)).toBe(false)
    })
  })

  describe('Performance', () => {
    it('should recommend modules in under 100ms with cache', async () => {
      // Pre-generate embeddings for all modules
      // In real usage, this happens during syncModulesFromFiles()

      const start = Date.now()

      // This should use cached embeddings
      const recommendations = await recommendModules('draw a chicken')

      const elapsed = Date.now() - start

      expect(recommendations.length).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(100)
    }, 10000) // 10 second timeout for safety

    it('should handle missing embeddings gracefully', async () => {
      // Module without embedding
      upsertModule({
        name: 'car_lib',
        description: 'Draw cars and vehicles',
        tags: ['vehicle', 'transport'],
        example: 'car_lib.draw()'
      })

      // Should still work, generating embedding on-the-fly
      const recommendations = await recommendModules('draw a car')
      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Bulk Operations', () => {
    it('should efficiently fetch multiple embeddings', () => {
      // Store some embeddings
      const modules = ['chicken_lib', 'house_lib', 'tree_lib']
      modules.forEach((name, i) => {
        const embedding = new Float32Array(384).fill(i * 0.1)
        updateModuleEmbedding(name, embedding, `hash-${i}`)
      })

      // Bulk fetch
      const { getModuleEmbeddings } = require('../src/mama/db.js')
      const embeddings = getModuleEmbeddings(modules)

      expect(embeddings.size).toBe(3)
      expect(embeddings.get('chicken_lib')).toBeInstanceOf(Float32Array)
    })
  })
})