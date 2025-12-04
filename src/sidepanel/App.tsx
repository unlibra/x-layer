import { useEffect, useState } from 'react'
import { Listbox, Switch } from '@headlessui/react'

import type { Preset } from '../types'

function App () {
  const [presets, setPresets] = useState<Preset[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [matchingPresetIds, setMatchingPresetIds] = useState<string[]>([])
  const [editingPresetId, setEditingPresetId] = useState<string | 'new'>('new')
  const [editingCss, setEditingCss] = useState('')
  const [editingName, setEditingName] = useState('')
  const [editingUrls, setEditingUrls] = useState<string[]>([''])
  const [editingEnabled, setEditingEnabled] = useState(true)

  // Load presets and current URL on mount, and setup listeners
  useEffect(() => {
    loadPresets()
    getCurrentUrl()

    // Listen for tab updates to refresh current URL
    const handleTabUpdate = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === 'complete' && tab.active) {
        getCurrentUrl()
      }
    }

    const handleTabActivated = (_activeInfo: chrome.tabs.TabActiveInfo) => {
      getCurrentUrl()
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
  const getCurrentUrl = () => {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_URL' }, (response) => {
      if (response?.url) {
        setCurrentUrl(response.url)
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

  // Clear CSS from current page
  const clearCSS = () => {
    chrome.runtime.sendMessage({
      type: 'APPLY_CSS',
      css: '',
    })
  }

  // Save or update preset
  const savePreset = async () => {
    if (!editingName.trim()) {
      alert('プリセット名を入力してください')
      return
    }

    const filteredUrls = editingUrls.filter((url) => url.trim() !== '')
    if (filteredUrls.length === 0) {
      alert('少なくとも1つのURLパターンを入力してください')
      return
    }

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
      alert('プリセットを保存しました')
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
      alert('プリセットを更新しました')
    }
  }

  // Select preset for editing
  const selectPresetForEdit = (presetId: string | 'new') => {
    setEditingPresetId(presetId)
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

  // Delete a preset
  const deletePreset = async (presetId: string) => {
    if (!confirm('このプリセットを削除しますか?')) {
      return
    }

    const updatedPresets = presets.filter((p) => p.id !== presetId)
    await chrome.storage.local.set({ presets: updatedPresets })
    setPresets(updatedPresets)

    // Switch to new if deleted preset was being edited
    if (editingPresetId === presetId) {
      selectPresetForEdit('new')
    }
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
        <h2 className='mb-3 text-sm font-medium text-slate-600'>
          このページのプリセット
        </h2>
        {matchingPresets.length > 0
          ? (
            <div className='flex flex-wrap gap-2'>
              {matchingPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`rounded-full px-4 py-2 text-sm font-medium shadow-md transition-colors ${
                    preset.enabled
                      ? 'bg-primary text-white hover:brightness-110'
                      : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => togglePresetEnabled(preset.id)}
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

      {/* Preset Editor */}
      <div className='mb-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-900'>
            プリセット編集
          </h2>
          {editingPresetId !== 'new' && (
            <button
              className='flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50'
              onClick={() => deletePreset(editingPresetId)}
              title='削除'
            >
              <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
                <path fillRule='evenodd' d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z' clipRule='evenodd' />
              </svg>
            </button>
          )}
        </div>

        {/* Preset Selector Dropdown */}
        <Listbox value={editingPresetId} onChange={selectPresetForEdit}>
          <div className='relative mb-4'>
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

        {/* Preset Name */}
        <input
          className='mb-3 w-full rounded-md border border-slate-300 p-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          type='text'
          placeholder='プリセット名'
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
        />

        {/* URL Patterns */}
        <div className='mb-4'>
          <p className='mb-2 text-xs text-slate-500'>
            適用するURLパターン (* でワイルドカード)
          </p>
          {editingUrls.map((url, index) => (
            <div key={index} className='mb-2 flex gap-2'>
              <input
                className='flex-1 rounded-md border border-slate-300 p-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                type='text'
                placeholder='例: https://example.com/*'
                value={url}
                onChange={(e) => updateUrlPattern(index, e.target.value)}
              />
              {editingUrls.length > 1 && (
                <button
                  className='rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100'
                  onClick={() => removeUrlPattern(index)}
                >
                  削除
                </button>
              )}
            </div>
          ))}
          <button
            className='mt-2 text-xs font-medium text-primary hover:brightness-110'
            onClick={addUrlPattern}
          >
            + URLパターンを追加
          </button>
        </div>

        {/* CSS Editor */}
        <div className='mb-4'>
          <label className='mb-2 block text-sm font-medium text-slate-700'>
            CSS
          </label>
          <textarea
            className='min-h-[200px] w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            value={editingCss}
            onChange={(e) => setEditingCss(e.target.value)}
            placeholder='/* CSSを入力してください */&#10;body {&#10;  background-color: #f0f0f0;&#10;}'
          />
        </div>

        {/* Enabled Toggle */}
        <Switch.Group>
          <div className='mb-4 flex items-center justify-between'>
            <Switch.Label className='text-sm text-slate-700'>有効</Switch.Label>
            <Switch
              checked={editingEnabled}
              onChange={setEditingEnabled}
              className={`${
                editingEnabled ? 'bg-primary' : 'bg-slate-300'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
            >
              <span
                className={`${
                  editingEnabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </Switch.Group>

        {/* Actions */}
        <div className='flex gap-3'>
          <button
            className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
            onClick={savePreset}
          >
            {editingPresetId === 'new' ? '保存' : '更新'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
