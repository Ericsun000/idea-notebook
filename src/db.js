import { openDB } from 'idb'

const DB_NAME = 'idea-notebook'
const DB_VERSION = 3

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

export async function addIdea({ content, category, tags, source = 'text', voiceDuration = 0 }) {
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
    discussion: []
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
