import { useEffect, useState } from 'react'
import type { Preset } from '../types'

function App() {
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
    <div className="container">
      <div className="header">
        <h1>X-Layer</h1>
        <p>WEBサイトにカスタムスタイルを注入</p>
      </div>

      <div className="section">
        <h2>CSS エディター</h2>
        <textarea
          className="editor"
          value={css}
          onChange={(e) => setCss(e.target.value)}
          placeholder="/* CSSを入力してください */&#10;body {&#10;  background-color: #f0f0f0;&#10;}"
        />
        <div className="button-group">
          <button className="btn btn-primary" onClick={applyCSS}>
            適用
          </button>
          <button className="btn btn-secondary" onClick={clearCSS}>
            クリア
          </button>
        </div>
      </div>

      <div className="section">
        <h2>プリセットとして保存</h2>
        <input
          className="input"
          type="text"
          placeholder="プリセット名"
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
        />
        <div className="url-patterns">
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            適用するURLパターン (* でワイルドカード)
          </p>
          {newPresetUrls.map((url, index) => (
            <div key={index} className="url-pattern-item">
              <input
                className="input"
                type="text"
                placeholder="例: https://example.com/* または https://*.example.com/*"
                value={url}
                onChange={(e) => updateUrlPattern(index, e.target.value)}
              />
              {newPresetUrls.length > 1 && (
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => removeUrlPattern(index)}
                >
                  削除
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-secondary btn-small"
            onClick={addUrlPattern}
          >
            + URLパターンを追加
          </button>
        </div>
        <div className="button-group">
          {editingPreset ? (
            <>
              <button className="btn btn-primary" onClick={updatePreset}>
                更新
              </button>
              <button className="btn btn-secondary" onClick={cancelEdit}>
                キャンセル
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={saveAsPreset}>
              保存
            </button>
          )}
        </div>
      </div>

      <div className="section">
        <h2>保存済みプリセット</h2>
        {presets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-text">
              まだプリセットがありません
            </div>
          </div>
        ) : (
          <ul className="preset-list">
            {presets.map((preset) => (
              <li key={preset.id} className="preset-item">
                <div className="preset-header">
                  <span className="preset-name">{preset.name}</span>
                  <div className="preset-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => loadPreset(preset)}
                    >
                      読込
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => startEditPreset(preset)}
                    >
                      編集
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => deletePreset(preset.id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div className="preset-urls">
                  <span className="preset-urls-label">URL:</span>
                  {preset.urlPatterns.join(', ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {currentUrl && (
        <div className="section">
          <h2>現在のURL</h2>
          <p style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-all' }}>
            {currentUrl}
          </p>
        </div>
      )}
    </div>
  )
}

export default App