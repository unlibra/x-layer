// Type definitions for X-Layer

export interface Preset {
  id: string
  name: string
  css: string
  urlPatterns: string[]
  createdAt: number
  updatedAt: number
}

export interface StorageData {
  presets: Preset[]
  currentCss?: string
}
