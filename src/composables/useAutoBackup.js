import { ref } from 'vue'
import { exportAllData, saveBackupToDirectory } from '../backup'

const AUTO_BACKUP_KEY = 'auto_backup_enabled'
const LAST_BACKUP_KEY = 'last_auto_backup_date'
const BACKUP_INTERVAL = 30 * 24 * 60 * 60 * 1000

export function isFileSystemAPISupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export function useAutoBackup() {
  const enabled = ref(isEnabled())
  const lastBackupDate = ref(getLastBackupDate())
  const directoryName = ref(getDirectoryName())

  function isEnabled() {
    return localStorage.getItem(AUTO_BACKUP_KEY) === 'true'
  }

  function getLastBackupDate() {
    return localStorage.getItem(LAST_BACKUP_KEY) || null
  }

  function getDirectoryName() {
    return localStorage.getItem('auto_backup_dir') || ''
  }

  async function requestDirectory() {
    if (!isFileSystemAPISupported()) return false
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      const jsonStr = JSON.stringify(handle)
      localStorage.setItem('auto_backup_dir_handle', jsonStr)
      localStorage.setItem('auto_backup_dir', handle.name)
      localStorage.setItem(AUTO_BACKUP_KEY, 'true')
      enabled.value = true
      directoryName.value = handle.name

      await performBackup(handle)
      return true
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('目录选择失败:', e)
      }
      return false
    }
  }

  async function performBackup(handle) {
    if (!handle) {
      handle = await loadDirectoryHandle()
    }
    if (!handle) return false

    try {
      const backup = await exportAllData()
      await saveBackupToDirectory(backup, handle)

      const now = new Date().toISOString()
      localStorage.setItem(LAST_BACKUP_KEY, now)
      lastBackupDate.value = now
      return true
    } catch {
      return false
    }
  }

  async function loadDirectoryHandle() {
    const jsonStr = localStorage.getItem('auto_backup_dir_handle')
    if (!jsonStr) return null
    try {
      const plain = JSON.parse(jsonStr)
      return deserializeHandle(plain)
    } catch {
      return null
    }
  }

  function deserializeHandle(plain) {
    if (!plain || !plain.kind) return null
    const map = { directory: FileSystemDirectoryHandle, file: FileSystemFileHandle }
    const Klass = map[plain.kind]
    if (!Klass) return null
    const handle = Object.create(Klass.prototype)
    Object.assign(handle, plain)
    return handle
  }

  async function checkAndBackup() {
    if (!isEnabled()) return false

    const last = getLastBackupDate()
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime()
      if (elapsed < BACKUP_INTERVAL) return false
    }

    const handle = await loadDirectoryHandle()
    if (!handle) return false

    const ok = await performBackup(handle)
    return ok
  }

  async function revokeDirectory() {
    localStorage.removeItem('auto_backup_dir_handle')
    localStorage.removeItem('auto_backup_dir')
    localStorage.removeItem(AUTO_BACKUP_KEY)
    enabled.value = false
    directoryName.value = ''
  }

  function daysUntilNextBackup() {
    const last = getLastBackupDate()
    if (!last) return 0
    const elapsed = Date.now() - new Date(last).getTime()
    const remaining = BACKUP_INTERVAL - elapsed
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
  }

  return {
    enabled,
    lastBackupDate,
    directoryName,
    isSupported: isFileSystemAPISupported(),
    requestDirectory,
    performBackup,
    checkAndBackup,
    revokeDirectory,
    daysUntilNextBackup
  }
}
