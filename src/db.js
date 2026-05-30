import { openDB } from 'idb'

const DB_NAME = 'idea-notebook'
const DB_VERSION = 5

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('ideas')) {
            const ideaStore = db.createObjectStore('ideas', { keyPath: 'id' })
            ideaStore.createIndex('date', 'date', { unique: false })
          }
          if (!db.objectStoreNames.contains('dailyNotes')) {
            db.createObjectStore('dailyNotes', { keyPath: 'date' })
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' })
          }
        }
        if (oldVersion < 3) {
          const ideaStore = transaction.objectStore('ideas')
          if (ideaStore && ideaStore.indexNames.contains('deleted')) {
            ideaStore.deleteIndex('deleted')
          }
        }
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains('projects')) {
            db.createObjectStore('projects', { keyPath: 'id' })
          }
          const ideaStore = transaction.objectStore('ideas')
          if (ideaStore && !ideaStore.indexNames.contains('projectId')) {
            ideaStore.createIndex('projectId', 'projectId', { unique: false })
          }
        }
        if (oldVersion < 4) {
          // Migrate old single llm_config to new llm_configs array
          const settingsStore = transaction.objectStore('settings')
          if (settingsStore) {
            settingsStore.get('llm_config').then(oldVal => {
              if (oldVal?.value) {
                const old = oldVal.value
                const newConfig = {
                  baseUrl: old.baseUrl,
                  apiKey: old.apiKey,
                  model: old.model,
                  noV1: old.noV1,
                  noApiKey: old.noApiKey,
                  label: old.label || old.model || old.baseUrl || '未命名',
                  id: old.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
                  createdAt: old.createdAt || Date.now()
                }
                settingsStore.put({ key: 'llm_configs', value: [newConfig], updatedAt: Date.now() })
                settingsStore.delete('llm_config')
              }
            }).catch(() => {})
          }
        }
      }
    })
  }
  return dbPromise
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function addIdea({ content, category, tags, source = 'text', voiceDuration = 0, projectId = null }) {
  const db = await getDB()
  const idea = {
    id: generateId(),
    content,
    date: todayStr(),
    timestamp: Date.now(),
    category,
    tags,
    source,
    voiceDuration,
    completed: false,
    deleted: false,
    deletedAt: null,
    discussion: [],
    projectId
  }
  await db.add('ideas', idea)
  return idea
}

export async function deleteIdea(id) {
  const db = await getDB()
  await db.delete('ideas', id)
}

export async function updateIdea(id, changes) {
  const db = await getDB()
  const idea = await db.get('ideas', id)
  if (!idea) return
  Object.assign(idea, changes)
  await db.put('ideas', idea)
  return idea
}

export async function getIdeasByDate(date) {
  const db = await getDB()
  const all = await db.getAllFromIndex('ideas', 'date', date)
  return all.filter(i => !i.deleted).sort((a, b) => b.timestamp - a.timestamp)
}

export async function getTodayIdeas() {
  return getIdeasByDate(todayStr())
}

export async function getAllIdeas() {
  const db = await getDB()
  const all = await db.getAll('ideas')
  return all.filter(i => !i.deleted).sort((a, b) => b.timestamp - a.timestamp)
}

export async function getDailyNote(date) {
  const db = await getDB()
  return db.get('dailyNotes', date)
}

export async function getTodayNote() {
  return getDailyNote(todayStr())
}

export async function saveDailyNote(dailyNote) {
  const db = await getDB()
  await db.put('dailyNotes', dailyNote)
  return dailyNote
}

export async function getAllDailyNotes() {
  const db = await getDB()
  const all = await db.getAll('dailyNotes')
  return all.sort((a, b) => b.date.localeCompare ? b.date.localeCompare(a.date) : 0)
}

export async function getDistinctDates() {
  const db = await getDB()
  const all = await db.getAll('ideas')
  const dates = [...new Set(all.filter(i => !i.deleted).map(i => i.date))]
  return dates.sort().reverse()
}

export async function softDeleteIdea(id) {
  const db = await getDB()
  const idea = await db.get('ideas', id)
  if (!idea) return
  idea.deleted = true
  idea.deletedAt = Date.now()
  await db.put('ideas', idea)
  return idea
}

export async function restoreIdea(id) {
  const db = await getDB()
  const idea = await db.get('ideas', id)
  if (!idea) return
  idea.deleted = false
  idea.deletedAt = null
  await db.put('ideas', idea)
  return idea
}

export async function getTrashIdeas() {
  const db = await getDB()
  const all = await db.getAll('ideas')
  return all.filter(i => i.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
}

export async function purgeOldTrash(maxAge = 3 * 24 * 60 * 60 * 1000) {
  const db = await getDB()
  const all = await db.getAll('ideas')
  const cutoff = Date.now() - maxAge
  const toPurge = all.filter(i => i.deleted && i.deletedAt && i.deletedAt < cutoff)
  if (toPurge.length === 0) return 0
  const tx = db.transaction('ideas', 'readwrite')
  await Promise.all(toPurge.map(i => tx.store.delete(i.id)))
  await tx.done
  return toPurge.length
}

export async function permanentlyDeleteIdea(id) {
  const db = await getDB()
  await db.delete('ideas', id)
}

// ========== Projects CRUD ==========

export async function addProject({ name, description = '', background = '', context = '', status = 'active' }) {
  const db = await getDB()
  const project = {
    id: generateId(),
    name,
    description,
    background,
    context,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  await db.add('projects', project)
  return project
}

export async function updateProject(id, changes) {
  const db = await getDB()
  const project = await db.get('projects', id)
  if (!project) return
  Object.assign(project, changes, { updatedAt: Date.now() })
  await db.put('projects', project)
  return project
}

export async function deleteProject(id) {
  const db = await getDB()
  // Unlink all ideas from this project
  const linked = await db.getAllFromIndex('ideas', 'projectId', id)
  for (const idea of linked) {
    idea.projectId = null
    await db.put('ideas', idea)
  }
  await db.delete('projects', id)
}

export async function getAllProjects() {
  const db = await getDB()
  const all = await db.getAll('projects')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getProject(id) {
  const db = await getDB()
  return db.get('projects', id) || null
}

export async function getIdeasByProject(projectId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('ideas', 'projectId', projectId)
  return all.filter(i => !i.deleted).sort((a, b) => b.timestamp - a.timestamp)
}
