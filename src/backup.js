import { getDB } from './db'

export async function exportAllData() {
  const db = await getDB()
  const [ideas, dailyNotes, settings] = await Promise.all([
    db.getAll('ideas'),
    db.getAll('dailyNotes'),
    db.getAll('settings')
  ])

  const safeSettings = settings.map(s => {
    if (s.key === 'llm_config' && s.value?.apiKey) {
      return { ...s, value: { ...s.value, apiKey: '***' } }
    }
    return s
  })

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'idea-notebook',
    stats: {
      ideas: ideas.length,
      dailyNotes: dailyNotes.length,
      settings: settings.length
    },
    data: { ideas, dailyNotes, settings: safeSettings }
  }

  return backup
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const date = new Date().toISOString().slice(0, 10)
  return { blob, filename: `idea-notebook-${date}.json` }
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareBackup(backup) {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const date = new Date().toISOString().slice(0, 10)
  const file = new File([blob], `idea-notebook-${date}.json`, { type: 'application/json' })

  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: '灵感笔记数据备份',
      text: '灵感笔记数据备份，可在新设备导入恢复',
      files: [file]
    })
  } else {
    triggerDownload(blob, `idea-notebook-${date}.json`)
  }
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.name.endsWith('.json')) {
      reject(new Error('请选择 .json 备份文件'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.app || data.app !== 'idea-notebook') {
          reject(new Error('无效的备份文件：不是灵感笔记的备份'))
          return
        }
        if (!data.data || !data.data.ideas) {
          reject(new Error('无效的备份文件：缺少数据'))
          return
        }
        resolve(data)
      } catch {
        reject(new Error('无法解析备份文件，文件可能已损坏'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file)
  })
}

function isValidIdea(obj) {
  return obj && typeof obj.id === 'string' && typeof obj.content === 'string'
}

function isValidDailyNote(obj) {
  return obj && typeof obj.date === 'string'
}

function isValidSetting(obj) {
  return obj && typeof obj.key === 'string'
}

const MAX_IMPORT_ROWS = 50000

export async function applyImport(backup, mode = 'merge') {
  const db = await getDB()

  if (mode === 'replace') {
    await db.clear('ideas')
    await db.clear('dailyNotes')
    await db.clear('settings')
  }

  const stats = { ideas: 0, dailyNotes: 0, settings: 0 }
  const tx = db.transaction(['ideas', 'dailyNotes', 'settings'], 'readwrite')

  for (const idea of backup.data.ideas || []) {
    if (!isValidIdea(idea)) continue
    if (stats.ideas >= MAX_IMPORT_ROWS) break
    if (mode === 'merge') {
      const existing = await db.get('ideas', idea.id)
      if (existing) continue
    }
    await tx.objectStore('ideas').put(idea)
    stats.ideas++
  }

  for (const note of backup.data.dailyNotes || []) {
    if (!isValidDailyNote(note)) continue
    if (stats.dailyNotes >= MAX_IMPORT_ROWS) break
    if (mode === 'merge') {
      const existing = await db.get('dailyNotes', note.date)
      if (existing) continue
    }
    await tx.objectStore('dailyNotes').put(note)
    stats.dailyNotes++
  }

  for (const setting of backup.data.settings || []) {
    if (!isValidSetting(setting)) continue
    if (mode === 'merge') {
      const existing = await db.get('settings', setting.key)
      if (existing) continue
    }
    await tx.objectStore('settings').put(setting)
    stats.settings++
  }

  await tx.done
  return stats
}

export async function saveBackupToDirectory(backup, dirHandle) {
  const json = JSON.stringify(backup, null, 2)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `idea-notebook-${date}.json`
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(json)
  await writable.close()
}

export async function clearAllData() {
  const db = await getDB()
  await db.clear('ideas')
  await db.clear('dailyNotes')
  await db.clear('settings')
}
