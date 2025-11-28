import { useEffect, useState } from 'react'

import type { Preset } from '../types'

function App () {
  const [css, setCss] = useState('')
  const [presets, setPresets] = useState<Preset[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetUrls, setNewPresetUrls] = useState<string[]>([''])

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

  // Auto-load preset for current URL
  useEffect(() => {
    if (!currentUrl) return

    const matchingPreset = presets.find((preset) =>
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

    if (matchingPreset) {
      setCss(matchingPreset.css)
      setEditingPreset(matchingPreset)
      setNewPresetName(matchingPreset.name)
      setNewPresetUrls([...matchingPreset.urlPatterns])
    } else {
      setCss('')
      setEditingPreset(null)
      setNewPresetName('')
      setNewPresetUrls([''])
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

  // Apply CSS to current page
  const applyCSS = () => {
    chrome.runtime.sendMessage({
      type: 'APPLY_CSS',
      css,
    })
  }

  // Clear CSS from current page
  const clearCSS = () => {
    setCss('')
    chrome.runtime.sendMessage({
      type: 'APPLY_CSS',
      css: '',
    })
  }

  // Save current CSS as a new preset
  const saveAsPreset = async () => {
    if (!newPresetName.trim()) {
      alert('プリセット名を入力してください')
      return
    }

    const filteredUrls = newPresetUrls.filter((url) => url.trim() !== '')
    if (filteredUrls.length === 0) {
      alert('少なくとも1つのURLパターンを入力してください')
      return
    }

    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName,
      css,
      urlPatterns: filteredUrls,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const updatedPresets = [...presets, newPreset]
    await chrome.storage.local.set({ presets: updatedPresets })
    setPresets(updatedPresets)
    setNewPresetName('')
    setNewPresetUrls([''])
    alert('プリセットを保存しました')
  }

  // Load a preset
  const loadPreset = (preset: Preset) => {
    setCss(preset.css)
    applyCSS()
  }

  // Delete a preset
  const deletePreset = async (presetId: string) => {
    if (!confirm('このプリセットを削除しますか?')) {
      return
    }

    const updatedPresets = presets.filter((p) => p.id !== presetId)
    await chrome.storage.local.set({ presets: updatedPresets })
    setPresets(updatedPresets)
  }

  // Edit a preset
  const startEditPreset = (preset: Preset) => {
    setEditingPreset(preset)
    setNewPresetName(preset.name)
    setNewPresetUrls([...preset.urlPatterns])
  }

  // Update a preset
  const updatePreset = async () => {
    if (!editingPreset) return

    if (!newPresetName.trim()) {
      alert('プリセット名を入力してください')
      return
    }

    const filteredUrls = newPresetUrls.filter((url) => url.trim() !== '')
    if (filteredUrls.length === 0) {
      alert('少なくとも1つのURLパターンを入力してください')
      return
    }

    const updatedPreset: Preset = {
      ...editingPreset,
      name: newPresetName,
      urlPatterns: filteredUrls,
      updatedAt: Date.now(),
    }

    const updatedPresets = presets.map((p) =>
      p.id === editingPreset.id ? updatedPreset : p
    )
    await chrome.storage.local.set({ presets: updatedPresets })
    setPresets(updatedPresets)
    setEditingPreset(null)
    setNewPresetName('')
    setNewPresetUrls([''])
    alert('プリセットを更新しました')
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingPreset(null)
    setNewPresetName('')
    setNewPresetUrls([''])
  }

  // Add URL pattern field
  const addUrlPattern = () => {
    setNewPresetUrls([...newPresetUrls, ''])
  }

  // Update URL pattern
  const updateUrlPattern = (index: number, value: string) => {
    const updated = [...newPresetUrls]
    updated[index] = value
    setNewPresetUrls(updated)
  }

  // Remove URL pattern
  const removeUrlPattern = (index: number) => {
    const updated = newPresetUrls.filter((_, i) => i !== index)
    setNewPresetUrls(updated.length > 0 ? updated : [''])
  }

  return (
    <div className='min-h-screen bg-slate-50 p-4 text-slate-800'>
      <div className='mb-6 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white shadow-lg'>
        <h1 className='mb-1 text-2xl font-bold'>X-Layer</h1>
        <p className='text-sm text-indigo-100'>
          WEBサイトにカスタムスタイルを注入
        </p>
      </div>

      <div className='mb-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200'>
        <h2 className='mb-3 text-lg font-semibold text-slate-900'>
          CSS エディター
        </h2>
        <textarea
          className='min-h-[200px] w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
          value={css}
          onChange={(e) => setCss(e.target.value)}
          placeholder='/* CSSを入力してください */&#10;body {&#10;  background-color: #f0f0f0;&#10;}'
        />
        <div className='mt-4 flex gap-3'>
          <button
            className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
            onClick={applyCSS}
          >
            適用
          </button>
          <button
            className='rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2'
            onClick={clearCSS}
          >
            クリア
          </button>
        </div>
      </div>

      <div className='mb-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200'>
        <h2 className='mb-3 text-lg font-semibold text-slate-900'>
          プリセットとして保存
        </h2>
        <input
          className='mb-3 w-full rounded-md border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
          type='text'
          placeholder='プリセット名'
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
        />
        <div className='mt-3'>
          <p className='mb-2 text-xs text-slate-500'>
            適用するURLパターン (* でワイルドカード)
          </p>
          {newPresetUrls.map((url, index) => (
            <div key={index} className='mb-2 flex gap-2'>
              <input
                className='flex-1 rounded-md border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
                type='text'
                placeholder='例: https://example.com/*'
                value={url}
                onChange={(e) => updateUrlPattern(index, e.target.value)}
              />
              {newPresetUrls.length > 1 && (
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
            className='mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800'
            onClick={addUrlPattern}
          >
            + URLパターンを追加
          </button>
        </div>
        <div className='mt-4 flex gap-3'>
          {editingPreset
            ? (
              <>
                <button
                  className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  onClick={updatePreset}
                >
                  更新
                </button>
                <button
                  className='rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2'
                  onClick={cancelEdit}
                >
                  キャンセル
                </button>
              </>
              )
            : (
              <button
                className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                onClick={saveAsPreset}
              >
                保存
              </button>
              )}
        </div>
      </div>

      <div className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200'>
        <h2 className='mb-3 text-lg font-semibold text-slate-900'>
          保存済みプリセット
        </h2>
        {presets.length === 0
          ? (
            <div className='py-8 text-center'>
              <div className='mb-3 text-4xl opacity-30'>📝</div>
              <p className='text-sm text-slate-500'>
                まだプリセットがありません
              </p>
            </div>
            )
          : (
            <ul className='space-y-3'>
              {presets.map((preset) => (
                <li
                  key={preset.id}
                  className='group rounded-lg border border-slate-200 p-3 transition-all hover:border-indigo-300 hover:shadow-sm'
                >
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='font-medium text-slate-800'>
                      {preset.name}
                    </span>
                    <div className='flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100'>
                      <button
                        className='rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100'
                        onClick={() => loadPreset(preset)}
                      >
                        読込
                      </button>
                      <button
                        className='rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
                        onClick={() => startEditPreset(preset)}
                      >
                        編集
                      </button>
                      <button
                        className='rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100'
                        onClick={() => deletePreset(preset.id)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-1'>
                    <span className='text-xs font-medium text-slate-500'>
                      URL:
                    </span>
                    <span className='text-xs text-slate-500'>
                      {preset.urlPatterns.join(', ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            )}
      </div>

      {currentUrl && (
        <div className='mt-6 text-center'>
          <p className='truncate text-xs text-slate-400'>
            {currentUrl}
          </p>
        </div>
      )}
    </div>
  )
}

export default App
