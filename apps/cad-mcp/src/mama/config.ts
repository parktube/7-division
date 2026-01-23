/**
 * CAD MAMA Configuration
 *
 * Story 11.1: MAMA Core 4 Tools MCP 통합
 * Manages embedding model and database configuration
 *
 * Reference: ~/MAMA/packages/claude-code-plugin/src/core/config-loader.js
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { logger } from '../logger.js'

// ============================================================
// Constants
// ============================================================

/** CAD data directory */
export const CAD_DATA_DIR = join(homedir(), '.ai-native-cad')

/** MAMA data subdirectory */
export const MAMA_DATA_DIR = join(CAD_DATA_DIR, 'data')

/** Database path */
export const DB_PATH = join(MAMA_DATA_DIR, 'mama.db')

/** Config file path */
export const CONFIG_PATH = join(CAD_DATA_DIR, 'mama-config.json')

/** Default user ID for single-user mode */
export const DEFAULT_USER_ID = 'default'

// ============================================================
// Default Configuration
// ============================================================

export interface MAMAConfig {
  /** Embedding model name (HuggingFace) */
  modelName: string
  /** Embedding dimension (must match model) */
  embeddingDim: number
  /** HuggingFace cache directory */
  cacheDir: string
  /** Context injection mode */
  contextInjection: 'none' | 'hint' | 'full'
}

const DEFAULT_CONFIG: MAMAConfig = {
  modelName: 'Xenova/multilingual-e5-small',
  embeddingDim: 384,
  cacheDir: join(homedir(), '.cache', 'huggingface', 'transformers'),
  contextInjection: 'full',
}

// ============================================================
// Cached Configuration
// ============================================================

let cachedConfig: MAMAConfig | null = null

// ============================================================
// Functions
// ============================================================

/**
 * Ensure data directories exist
 */
export function ensureDataDirs(): void {
  if (!existsSync(CAD_DATA_DIR)) {
    mkdirSync(CAD_DATA_DIR, { recursive: true })
    logger.info(`Created CAD data directory: ${CAD_DATA_DIR}`)
  }
  if (!existsSync(MAMA_DATA_DIR)) {
    mkdirSync(MAMA_DATA_DIR, { recursive: true })
    logger.info(`Created MAMA data directory: ${MAMA_DATA_DIR}`)
  }
}

/**
 * Load MAMA configuration
 *
 * @param reload - Force reload from disk
 * @returns Configuration object
 */
export function loadConfig(reload = false): MAMAConfig {
  if (cachedConfig && !reload) {
    return cachedConfig
  }

  try {
    ensureDataDirs()

    // Create default config if not exists
    if (!existsSync(CONFIG_PATH)) {
      writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
      logger.info(`Created default MAMA config: ${CONFIG_PATH}`)
    }

    // Read and parse config
    const configData = readFileSync(CONFIG_PATH, 'utf8')
    const userConfig = JSON.parse(configData) as Partial<MAMAConfig>

    // Merge with defaults
    const config: MAMAConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
    }

    // Validate
    if (!config.modelName || typeof config.modelName !== 'string') {
      logger.warn(`Invalid modelName, using default: ${DEFAULT_CONFIG.modelName}`)
      config.modelName = DEFAULT_CONFIG.modelName
    }

    if (!Number.isInteger(config.embeddingDim) || config.embeddingDim <= 0) {
      logger.warn(`Invalid embeddingDim, using default: ${DEFAULT_CONFIG.embeddingDim}`)
      config.embeddingDim = DEFAULT_CONFIG.embeddingDim
    }

    // Validate contextInjection
    const validModes = ['none', 'hint', 'full'] as const
    if (!validModes.includes(config.contextInjection as typeof validModes[number])) {
      logger.warn(`Invalid contextInjection "${config.contextInjection}", using default: ${DEFAULT_CONFIG.contextInjection}`)
      config.contextInjection = DEFAULT_CONFIG.contextInjection
    }

    cachedConfig = config
    return config
  } catch (error) {
    logger.error(`Failed to load MAMA config: ${error}`)
    cachedConfig = { ...DEFAULT_CONFIG }
    return cachedConfig
  }
}

/**
 * Get current model name
 */
export function getModelName(): string {
  return loadConfig().modelName
}

/**
 * Get current embedding dimension
 */
export function getEmbeddingDim(): number {
  return loadConfig().embeddingDim
}

/**
 * Get context injection mode
 */
export function getContextInjection(): 'none' | 'hint' | 'full' {
  return loadConfig().contextInjection
}

/**
 * Update configuration
 *
 * @param updates - Partial configuration updates
 * @returns true if update succeeded, false otherwise
 */
export function updateConfig(updates: Partial<MAMAConfig>): boolean {
  try {
    ensureDataDirs()
    const currentConfig = loadConfig()

    // Validate updates before applying
    const validatedUpdates: Partial<MAMAConfig> = {}

    if (updates.modelName !== undefined) {
      if (typeof updates.modelName === 'string' && updates.modelName.trim()) {
        validatedUpdates.modelName = updates.modelName
      } else {
        logger.warn('Invalid modelName in update, skipping')
      }
    }

    if (updates.embeddingDim !== undefined) {
      if (Number.isInteger(updates.embeddingDim) && updates.embeddingDim > 0) {
        validatedUpdates.embeddingDim = updates.embeddingDim
      } else {
        logger.warn('Invalid embeddingDim in update, skipping')
      }
    }

    if (updates.cacheDir !== undefined) {
      if (typeof updates.cacheDir === 'string' && updates.cacheDir.trim()) {
        validatedUpdates.cacheDir = updates.cacheDir
      } else {
        logger.warn('Invalid cacheDir in update, skipping')
      }
    }

    if (updates.contextInjection !== undefined) {
      const validModes = ['none', 'hint', 'full'] as const
      if (validModes.includes(updates.contextInjection as typeof validModes[number])) {
        validatedUpdates.contextInjection = updates.contextInjection
      } else {
        logger.warn(`Invalid contextInjection "${updates.contextInjection}" in update, skipping`)
      }
    }

    const newConfig: MAMAConfig = {
      ...currentConfig,
      ...validatedUpdates,
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8')
    cachedConfig = newConfig

    logger.info(`MAMA config updated: ${CONFIG_PATH}`)
    return true
  } catch (error) {
    logger.error(`Failed to update MAMA config: ${error}`)
    return false
  }
}
