import { Listbox } from '@headlessui/react'
import { validate } from 'csstree-validator'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import type { Preset } from '../types'
import { useToast } from './Toast'

// Validate URL pattern with wildcard support
const isValidUrlPattern = (pattern: string): boolean => {
  if (!pattern.trim()) return false

  // Replace wildcards with placeholder for URL validation
  const testUrl = pattern.replace(/\*/g, 'WILDCARD')

  try {
    const url = new URL(testUrl)
    // Must have http or https protocol
    if (!['http:', 'https:'].includes(url.protocol)) return false
    // Must have a hostname
    if (!url.hostname || url.hostname === 'WILDCARD') return false
    return true
  } catch {
    return false
  }
}

const presetSchema = z.object({
  name: z.string().min(1, 'プリセット名を入力してください'),
  urls: z.array(z.string()).refine(
    (urls) => urls.some((url) => url.trim() !== ''),
    'URLを入力してください'
  ),
})

// Validate individual URL patterns, returns array of error indices
const validateUrlPatterns = (urls: string[]): number[] => {
  const invalidIndices: number[] = []
  urls.forEach((url, index) => {
    if (url.trim() !== '' && !isValidUrlPattern(url)) {
      invalidIndices.push(index)
    }
  })
  return invalidIndices
}

interface CssError {
  line: number
  column: number
  message: string
}

interface FormErrors {
  name?: string
  urls?: string
  urlIndices?: number[]
  css?: string[]
}

function App () {
  const toast = useToast()
  const [presets, setPresets] = useState<Preset[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [currentTitle, setCurrentTitle] = useState('')
  const [matchingPresetIds, setMatchingPresetIds] = useState<string[]>([])
  const [editingPresetId, setEditingPresetId] = useState<string | 'new'>('new')
  const [editingCss, setEditingCss] = useState('')
  const [editingName, setEditingName] = useState('')
  const [editingUrls, setEditingUrls] = useState<string[]>([''])
  const [editingEnabled, setEditingEnabled] = useState(true)
  const [cssErrors, setCssErrors] = useState<CssError[]>([])
  const [touched, setTouched] = useState<{ name?: boolean; urls?: boolean }>({})

  // Validate CSS with debounce
  useEffect(() => {
    if (!editingCss.trim()) {
      setCssErrors([])
      return
    }

    const timer = setTimeout(() => {
      try {
        const errors = validate(editingCss)
        if (Array.isArray(errors)) {
          setCssErrors(errors.map((e) => ({
            line: e.line ?? 0,
            column: e.column ?? 0,
            message: e.message ?? 'Unknown error',
          })))
        } else {
          setCssErrors([])
        }
      } catch (err) {
        console.error('CSS validation error:', err)
        setCssErrors([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [editingCss])

  // Form validation with zod
  const zodResult = presetSchema.safeParse({
    name: editingName,
    urls: editingUrls,
  })

  // Validate individual URL patterns
  const invalidUrlIndices = validateUrlPatterns(editingUrls)

  // Build form errors
  const formErrors: FormErrors = {}
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      const path = issue.path[0] as string
      if (path === 'name' && touched.name) {
        formErrors.name = issue.message
      }
      if (path === 'urls' && touched.urls) {
        formErrors.urls = issue.message
      }
    }
  }
  if (invalidUrlIndices.length > 0) {
    formErrors.urlIndices = invalidUrlIndices
  }
  if (cssErrors.length > 0) {
    formErrors.css = cssErrors.map((e) => `${e.line}:${e.column} - ${e.message}`)
  }

  // Load presets and current URL on mount, and setup listeners
  useEffect(() => {
    loadPresets()
    getCurrentTab()

    // Listen for tab updates to refresh current URL
    const handleTabUpdate = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === 'complete' && tab.active) {
        getCurrentTab()
      }
    }

    const handleTabActivated = (_activeInfo: chrome.tabs.TabActiveInfo) => {
      getCurrentTab()
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    chrome.tabs.onActivated.addListener(handleTabActivated)

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
      chrome.tabs.onActivated.removeListener(handleTabActivated)
    }
  }, [])

  // Auto-load matching presets for current URL
  useEffect(() => {
    if (!currentUrl || presets.length === 0) return

    // Find all matching presets, sorted by specificity (most specific first)
    const matchingPresets = presets
      .filter((preset) =>
        preset.urlPatterns.some((pattern) => {
          try {
            const regexPattern = pattern
              .replace(/[.+?^${}()|[\\]/g, '\\$&')
              .replace(/\*/g, '.*')
            const regex = new RegExp(`^${regexPattern}$`)
            return regex.test(currentUrl)
          } catch {
            return false
          }
        })
      )
      .sort((a, b) => {
        // Sort by specificity: fewer wildcards = more specific
        const aWildcards = a.urlPatterns[0]?.split('*').length || 0
        const bWildcards = b.urlPatterns[0]?.split('*').length || 0
        return aWildcards - bWildcards
      })

    if (matchingPresets.length > 0) {
      const matchingIds = matchingPresets.map((p) => p.id)
      setMatchingPresetIds(matchingIds)

      // Apply combined CSS from all enabled matching presets
      const enabledMatchingPresets = matchingPresets.filter((p) => p.enabled)
      const combinedCss = enabledMatchingPresets.map((p) => p.css).join('\n\n')
      chrome.runtime.sendMessage({
        type: 'APPLY_CSS',
        css: combinedCss,
      })
    } else {
      setMatchingPresetIds([])
    }
  }, [currentUrl, presets])

  // Load presets from storage
  const loadPresets = async () => {
    const result = await chrome.storage.local.get('presets')
    setPresets(result.presets || [])
  }

  // Get current tab URL
  const getCurrentTab = () => {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, (response) => {
      if (response?.url) {
        setCurrentUrl(response.url)
      }
      if (response?.title) {
        setCurrentTitle(response.title)
      }
    })
  }

  // Toggle preset enabled state
  const togglePresetEnabled = async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return

    const updatedPreset = { ...preset, enabled: !preset.enabled }
    const updatedPresets = presets.map((p) =>
      p.id === presetId ? updatedPreset : p
    )

    await chrome.storage.local.set({ presets: updatedPresets })
    setPresets(updatedPresets)

    // Apply combined CSS from all enabled matching presets
    const matchingPresets = updatedPresets.filter((p) => matchingPresetIds.includes(p.id))
    const enabledMatchingPresets = matchingPresets.filter((p) => p.enabled)
    const combinedCss = enabledMatchingPresets.map((p) => p.css).join('\n\n')
    chrome.runtime.sendMessage({
      type: 'APPLY_CSS',
      css: combinedCss,
    })
  }

  // Save or update preset
  const savePreset = async () => {
    // Mark all fields as touched to show errors
    setTouched({ name: true, urls: true })

    // Check validity with zod
    const result = presetSchema.safeParse({
      name: editingName,
      urls: editingUrls,
    })
    const urlErrors = validateUrlPatterns(editingUrls)

    if (!result.success || urlErrors.length > 0 || cssErrors.length > 0) {
      return
    }

    const filteredUrls = editingUrls.filter((url) => url.trim() !== '')

    if (editingPresetId === 'new') {
      // Create new preset
      const newPreset: Preset = {
        id: Date.now().toString(),
        name: editingName,
        css: editingCss,
        urlPatterns: filteredUrls,
        enabled: editingEnabled,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const updatedPresets = [...presets, newPreset]
      await chrome.storage.local.set({ presets: updatedPresets })
      setPresets(updatedPresets)
      setEditingPresetId(newPreset.id)
      toast.success('プリセットを作成しました')
    } else {
      // Update existing preset
      const updatedPreset: Preset = {
        ...presets.find((p) => p.id === editingPresetId)!,
        name: editingName,
        css: editingCss,
        urlPatterns: filteredUrls,
        enabled: editingEnabled,
        updatedAt: Date.now(),
      }

      const updatedPresets = presets.map((p) =>
        p.id === editingPresetId ? updatedPreset : p
      )
      await chrome.storage.local.set({ presets: updatedPresets })
      setPresets(updatedPresets)
      toast.success('プリセットを保存しました')
    }
  }

  // Select preset for editing
  const selectPresetForEdit = (presetId: string | 'new') => {
    setEditingPresetId(presetId)
    setTouched({})
    if (presetId === 'new') {
      setEditingCss('')
      setEditingName('')
      setEditingUrls([''])
      setEditingEnabled(true)
    } else {
      const preset = presets.find((p) => p.id === presetId)
      if (preset) {
        setEditingCss(preset.css)
        setEditingName(preset.name)
        setEditingUrls([...preset.urlPatterns])
        setEditingEnabled(preset.enabled)
      }
    }
  }

  // Create new preset with current URL
  const createPresetForCurrentPage = () => {
    setEditingPresetId('new')
    setEditingCss('')
    setEditingName(currentTitle)
    setEditingUrls([currentUrl])
    setEditingEnabled(true)
    setTouched({})
  }

  // Cancel editing
  const cancelEdit = () => {
    if (editingPresetId === 'new') {
      selectPresetForEdit('new')
    } else {
      // Reset to original preset values
      selectPresetForEdit(editingPresetId)
    }
  }

  // Duplicate a preset (as unsaved new preset)
  const duplicatePreset = () => {
    if (editingPresetId === 'new') return

    setEditingPresetId('new')
    setEditingName(`${editingName} のコピー`)
    setEditingEnabled(false)
    // Keep current editingCss and editingUrls
    setTouched({})
  }

  // Delete a preset
  const deletePreset = async (presetId: string) => {
    const deletedPreset = presets.find((p) => p.id === presetId)
    if (!deletedPreset) return

    const updatedPresets = presets.filter((p) => p.id !== presetId)
    await chrome.storage.local.set({ presets: updatedPresets })
    setPresets(updatedPresets)

    // Switch to new if deleted preset was being edited
    if (editingPresetId === presetId) {
      selectPresetForEdit('new')
    }

    // Show toast with undo
    toast.withUndo('プリセットを削除しました', async () => {
      const restoredPresets = [...updatedPresets, deletedPreset]
      await chrome.storage.local.set({ presets: restoredPresets })
      setPresets(restoredPresets)
      selectPresetForEdit(deletedPreset.id)
    })
  }

  // Add URL pattern field
  const addUrlPattern = () => {
    setEditingUrls([...editingUrls, ''])
  }

  // Update URL pattern
  const updateUrlPattern = (index: number, value: string) => {
    const updated = [...editingUrls]
    updated[index] = value
    setEditingUrls(updated)
  }

  // Remove URL pattern
  const removeUrlPattern = (index: number) => {
    const updated = editingUrls.filter((_, i) => i !== index)
    setEditingUrls(updated.length > 0 ? updated : [''])
  }

  // Get matching presets
  const matchingPresets = presets.filter((p) => matchingPresetIds.includes(p.id))

  return (
    <div className='min-h-screen bg-slate-50 p-4 text-slate-800'>
      {/* Matching Presets Display */}
      <div className='mb-6'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-base font-semibold text-slate-800'>
            このページのプリセット
          </h2>
          <button
            type='button'
            onClick={createPresetForCurrentPage}
            className='flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            title='このページ用のプリセットを作成'
          >
            <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 5v14M5 12h14' />
            </svg>
          </button>
        </div>
        {matchingPresets.length > 0
          ? (
            <div className='flex flex-wrap gap-2'>
              {matchingPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    preset.enabled
                      ? 'bg-primary text-white hover:brightness-110'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-700'
                  }`}
                  onClick={() => togglePresetEnabled(preset.id)}
                  title={preset.enabled ? '無効にする' : '有効にする'}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            )
          : (
            <p className='text-sm text-slate-500'>
              このページに適用されているプリセットはありません
            </p>
            )}
      </div>

      {/* Divider */}
      <hr className='mb-6 border-slate-200' />

      {/* Preset Editor */}
      <div className='mb-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-base font-semibold text-slate-800'>
            プリセット編集
          </h2>
          <div className='flex gap-1'>
            {editingPresetId !== 'new' && (
              <button
                type='button'
                onClick={duplicatePreset}
                className='flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                title='複製'
              >
                <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
                  <rect x='9' y='9' width='13' height='13' rx='2' />
                  <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                </svg>
              </button>
            )}
            <button
              type='button'
              onClick={() => setEditingEnabled(!editingEnabled)}
              className='flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
              title={editingEnabled ? '無効にする' : '有効にする'}
            >
              {editingEnabled
                ? (
                  <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
                    <path d='M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z' />
                    <path d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                  </svg>
                  )
                : (
                  <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
                    <path d='M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' />
                  </svg>
                  )}
            </button>
          </div>
        </div>

        {/* Preset Selector Dropdown */}
        <div className='mb-4'>
          <label className='mb-2 block text-sm font-medium text-slate-700'>
            プリセット選択
          </label>
          <Listbox value={editingPresetId} onChange={selectPresetForEdit}>
            <div className='relative'>
              <Listbox.Button className='relative w-full cursor-pointer rounded-md border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-left text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'>
                <span className='block truncate'>
                  {editingPresetId === 'new'
                    ? '新規プリセット'
                    : presets.find((p) => p.id === editingPresetId)?.name || '選択してください'}
                </span>
                <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
                  <svg className='h-5 w-5 text-slate-400' viewBox='0 0 20 20' fill='currentColor'>
                    <path fillRule='evenodd' d='M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z' clipRule='evenodd' />
                  </svg>
                </span>
              </Listbox.Button>
              <Listbox.Options className='absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none'>
                <Listbox.Option
                  key='new'
                  value='new'
                  className={({ active }) =>
                  `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                    active ? 'bg-primary/10 text-primary' : 'text-slate-900'
                  }`}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        新規プリセット
                      </span>
                      {selected && (
                        <span className='absolute inset-y-0 right-0 flex items-center pr-3 text-primary'>
                          <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
                            <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                          </svg>
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
                {presets.map((preset) => (
                  <Listbox.Option
                    key={preset.id}
                    value={preset.id}
                    className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-primary/10 text-primary' : 'text-slate-900'
                    }`}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                          {preset.name}
                        </span>
                        {selected && (
                          <span className='absolute inset-y-0 right-0 flex items-center pr-3 text-primary'>
                            <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
                              <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                            </svg>
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Preset Name */}
        <div className='mb-4'>
          <label className='mb-2 block text-sm font-medium text-slate-700'>
            プリセット名
          </label>
          <input
            className={`w-full rounded-md border p-2.5 text-sm focus:outline-none focus:ring-1 ${
              touched.name && formErrors.name
                ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                : 'border-slate-300 focus:border-primary focus:ring-primary'
            }`}
            type='text'
            placeholder='例: ダークモード'
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
          />
          {touched.name && formErrors.name && (
            <p className='mt-1 text-xs text-red-600'>{formErrors.name}</p>
          )}
        </div>

        {/* URL Patterns */}
        <div className='mb-4'>
          <label className='mb-2 block text-sm font-medium text-slate-700'>
            適用するURL
          </label>
          <div className='space-y-2'>
            {editingUrls.map((url, index) => {
              const hasError = formErrors.urlIndices?.includes(index)
              return (
                <div key={index}>
                  <div className='flex items-center gap-2'>
                    <input
                      className={`flex-1 rounded-md border p-2.5 text-sm focus:outline-none focus:ring-1 ${
                        hasError || (touched.urls && formErrors.urls)
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                          : 'border-slate-300 focus:border-primary focus:ring-primary'
                      }`}
                      type='text'
                      placeholder='例: https://example.com/*'
                      value={url}
                      onChange={(e) => updateUrlPattern(index, e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, urls: true }))}
                    />
                    <button
                      type='button'
                      onClick={() => removeUrlPattern(index)}
                      disabled={editingUrls.length === 1}
                      className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-30 disabled:hover:bg-transparent'
                    >
                      <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <circle cx='12' cy='12' r='10' />
                        <path d='M8 12h8' />
                      </svg>
                    </button>
                  </div>
                  {hasError && (
                    <p className='mt-1 text-xs text-red-600'>無効なURLパターンです</p>
                  )}
                </div>
              )
            })}
          </div>
          {touched.urls && formErrors.urls && (
            <p className='mt-1 text-xs text-red-600'>{formErrors.urls}</p>
          )}
          <button
            type='button'
            onClick={addUrlPattern}
            className='mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-200 py-2 text-slate-600 transition-colors hover:bg-slate-300 hover:text-slate-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          >
            <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 5v14M5 12h14' />
            </svg>
            <span className='text-sm font-medium'>URLパターンを追加</span>
          </button>
        </div>

        {/* CSS Editor */}
        <div className='mb-4'>
          <label className='mb-2 block text-sm font-medium text-slate-700'>
            CSS
          </label>
          <div
            className={`max-h-96 overflow-y-auto rounded-md border ${
              formErrors.css
                ? 'border-red-400 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-400'
                : 'border-slate-300 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
            }`}
          >
            <div className='flex min-h-[200px]'>
              <div className='sticky left-0 select-none bg-slate-50 py-3 pl-2 pr-1 font-mono text-sm leading-relaxed text-slate-400'>
                {(editingCss || ' ').split('\n').map((_, i) => (
                  <div key={i} className='text-right'>{i + 1}</div>
                ))}
              </div>
              <textarea
                className='min-h-[200px] flex-1 resize-none bg-white p-3 pl-2 font-mono text-sm leading-relaxed text-slate-700 focus:outline-none'
                value={editingCss}
                onChange={(e) => setEditingCss(e.target.value)}
                placeholder={'/* CSSを入力してください */\nbody {\n  background: #f0f0f0;\n}'}
                spellCheck={false}
              />
            </div>
          </div>
          {formErrors.css && (
            <div className='mt-2 space-y-1'>
              {formErrors.css.map((error, index) => (
                <p key={index} className='text-xs text-red-600'>
                  {error}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className='flex gap-3'>
          <button
            className='flex-1 rounded-md bg-primary py-2 text-sm font-medium text-white transition-colors hover:brightness-110 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            onClick={savePreset}
          >
            {editingPresetId === 'new' ? '作成' : '保存'}
          </button>
          <button
            className='flex-1 rounded-md bg-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            onClick={cancelEdit}
          >
            キャンセル
          </button>
        </div>

        {editingPresetId !== 'new' && (
          <div className='mt-12 text-center'>
            <button
              className='rounded text-sm text-red-600 hover:text-red-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
              onClick={() => deletePreset(editingPresetId)}
            >
              このプリセットを削除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
