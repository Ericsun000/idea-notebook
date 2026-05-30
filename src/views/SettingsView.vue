<template>
  <div class="settings-view">
    <header class="view-header">
      <button class="back-btn" @click="$router.push('/')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="view-title">设置</h1>
    </header>

    <div class="content-area">
      <section class="section">
        <h2 class="section-title">数据管理</h2>

        <div class="auto-backup-row">
          <div class="auto-backup-info">
            <span class="auto-backup-icon">🔄</span>
            <div class="auto-backup-body">
              <span class="auto-backup-label">每月自动备份</span>
              <span class="auto-backup-desc" v-if="backup.isSupported && backup.enabled.value">
                备份至 {{ backup.directoryName.value }} · 下次 {{ backup.daysUntilNextBackup() }} 天后
              </span>
              <span class="auto-backup-desc" v-else-if="backup.isSupported">
                开启后将每月自动保存到选定文件夹
              </span>
              <span class="auto-backup-desc unsupported" v-else>
                当前浏览器不支持，请使用 Chrome 或 Edge
              </span>
            </div>
          </div>
          <label class="toggle-switch" v-if="backup.isSupported">
            <input type="checkbox" :checked="backup.enabled.value" @change="onToggleAutoBackup" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="auto-backup-row" v-if="backup.enabled.value && backup.lastBackupDate.value">
          <span class="auto-backup-meta">上次自动备份: {{ formatBackupDate(backup.lastBackupDate.value) }}</span>
          <button class="btn-link" @click="onRevokeBackup">取消自动备份</button>
        </div>

        <div class="action-card" @click="doExport">
          <span class="action-icon">📤</span>
          <div class="action-body">
            <h3 class="action-name">导出数据</h3>
            <p class="action-desc">备份所有想法、笔记和设置到本地文件</p>
          </div>
        </div>

        <div class="action-card" @click="openFilePicker">
          <span class="action-icon">📥</span>
          <div class="action-body">
            <h3 class="action-name">导入数据</h3>
            <p class="action-desc">从之前的备份文件恢复数据</p>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="file-input"
          @change="onFileSelected"
        />

        <transition name="expand">
          <div v-if="preview" class="preview-card">
            <div class="preview-header">备份预览</div>
            <div class="preview-stats">
              <div class="preview-stat"><span>{{ preview.stats.ideas }}</span> 条想法</div>
              <div class="preview-stat"><span>{{ preview.stats.dailyNotes }}</span> 条笔记</div>
              <div class="preview-stat"><span>{{ preview.stats.settings }}</span> 条设置</div>
            </div>
            <div class="preview-warning">
              ⚠️ 该备份包含 API Key 等敏感信息，请确保文件来源可信
            </div>
            <div class="preview-actions">
              <button class="btn-primary" @click="doImport('merge')">合并导入</button>
              <button class="btn-secondary" @click="doImport('replace')">覆盖导入</button>
              <button class="btn-text" @click="preview = null">取消</button>
            </div>
          </div>
        </transition>

        <p v-if="statusMsg" class="status-msg" :class="statusType">{{ statusMsg }}</p>
      </section>

      <section class="section">
        <h2 class="section-title section-danger">危险区域</h2>
        <div class="action-card danger" @click="confirmClear">
          <span class="action-icon">🗑</span>
          <div class="action-body">
            <h3 class="action-name">清空所有数据</h3>
            <p class="action-desc">永久删除所有想法、笔记和设置，不可恢复</p>
          </div>
        </div>
      </section>

      <section class="section about-section">
        <h2 class="section-title">关于</h2>
        <div class="about-item">
          <span>灵感笔记</span>
          <span class="about-ver">v1.0</span>
        </div>
        <div class="about-item">
          <span>数据存储</span>
          <span class="about-val">本机 IndexedDB</span>
        </div>
        <div class="about-item">
          <span>数据迁移</span>
          <span class="about-val">导出 JSON → 导入恢复</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { exportAllData, shareBackup, readBackupFile, applyImport, clearAllData } from '../backup'
import { useIdeaStore } from '../store'
import { useAutoBackup } from '../composables/useAutoBackup.js'

const store = useIdeaStore()
const fileInput = ref(null)
const preview = ref(null)
const statusMsg = ref('')
const statusType = ref('')
const backup = useAutoBackup()

let pendingBackup = null

function formatBackupDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function onToggleAutoBackup(e) {
  if (e.target.checked) {
    await backup.requestDirectory()
  } else {
    await backup.revokeDirectory()
  }
}

async function onRevokeBackup() {
  await backup.revokeDirectory()
}

async function doExport() {
  try {
    statusMsg.value = '正在导出...'
    statusType.value = ''
    const backup = await exportAllData()
    await shareBackup(backup)
    statusMsg.value = '导出成功'
    statusType.value = 'success'
    setTimeout(() => { statusMsg.value = '' }, 3000)
  } catch (e) {
    statusMsg.value = '导出失败: ' + e.message
    statusType.value = 'error'
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  statusMsg.value = ''
  statusType.value = ''

  try {
    pendingBackup = await readBackupFile(file)
    preview.value = {
      stats: pendingBackup.stats,
      exportedAt: pendingBackup.exportedAt
    }
  } catch (e) {
    statusMsg.value = e.message
    statusType.value = 'error'
  }
}

async function doImport(mode) {
  if (!pendingBackup) return
  try {
    statusMsg.value = '正在导入...'
    statusType.value = ''
    const stats = await applyImport(pendingBackup, mode)
    preview.value = null
    statusMsg.value = `导入完成：${stats.ideas} 条想法、${stats.dailyNotes} 条笔记、${stats.settings} 条设置`
    statusType.value = 'success'
    await store.loadToday()
  } catch (e) {
    statusMsg.value = '导入失败: ' + e.message
    statusType.value = 'error'
  }
}

async function confirmClear() {
  if (!confirm('确定永久删除所有数据？此操作不可恢复！')) return
  if (!confirm('再次确认：所有想法、笔记和设置将被永久删除。')) return
  await clearAllData()
  await store.loadToday()
  statusMsg.value = '所有数据已清空'
  statusType.value = 'success'
}
</script>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg);
}

.view-header {
  padding: calc(16px + var(--safe-top)) 16px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-text);
  transition: background var(--duration-fast);
}

.back-btn:active { background: var(--color-surface-hover); }

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 24px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
  padding: 0 4px;
}

.section-danger {
  color: #DC2626;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform var(--duration-fast);
  box-shadow: var(--shadow-sm);
}

.action-card:active { transform: scale(0.98); }

.action-card.danger {
  border: 1.5px solid #FEE2E2;
}

.action-card.danger:active {
  background: #FEF2F2;
}

.action-icon { font-size: 1.25rem; flex-shrink: 0; }

.action-body { flex: 1; min-width: 0; }

.action-name {
  font-size: var(--text-base);
  font-weight: 600;
}

.action-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.auto-backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
}

.auto-backup-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.auto-backup-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.auto-backup-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.auto-backup-label {
  font-size: var(--text-base);
  font-weight: 600;
}

.auto-backup-desc {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.auto-backup-desc.unsupported {
  color: var(--color-text-tertiary);
}

.auto-backup-meta {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.btn-link {
  font-size: var(--text-xs);
  color: #DC2626;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}

.btn-link:active {
  background: #FEE2E2;
}

/* toggle switch */
.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
}

.toggle-switch input {
  width: 0;
  height: 0;
  opacity: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--color-border);
  border-radius: 28px;
  cursor: pointer;
  transition: background var(--duration-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform var(--duration-fast);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--color-accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.file-input { display: none; }

.preview-card {
  margin-top: 12px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-accent);
}

.preview-header {
  font-size: var(--text-base);
  font-weight: 600;
  margin-bottom: 10px;
}

.preview-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.preview-stat {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.preview-stat span {
  font-weight: 700;
  font-size: var(--text-lg);
  color: var(--color-accent);
}

.preview-warning {
  font-size: var(--text-xs);
  color: #B45309;
  background: #FEF3C7;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  line-height: 1.5;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.btn-primary,
.btn-secondary,
.btn-text {
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: all var(--duration-fast);
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
}

.btn-secondary {
  border: 1.5px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-text {
  color: var(--color-text-tertiary);
}

.btn-primary:active,
.btn-secondary:active,
.btn-text:active { transform: scale(0.96); }

.status-msg {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.status-msg.success { background: var(--color-green-soft); color: var(--color-green); }
.status-msg.error { background: #FEE2E2; color: #DC2626; }

.about-section {
  margin-top: 8px;
}

.about-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
  font-size: var(--text-sm);
}

.about-ver,
.about-val {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}

.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-fast) var(--ease-out);
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
