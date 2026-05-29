import { openDB } from 'idb'

const DB_NAME = 'idea-notebook'
const DB_VERSION = 1

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('ideas')) {
          const ideaStore = db.createObjectStore('ideas', { keyPath: 'id' })
          ideaStore.createIndex('date', 'date', { unique: false })
        }
        if (!db.objectStoreNames.contains('dailyNotes')) {
          db.createObjectStore('dailyNotes', { keyPath: 'date' })
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
    voiceDuration
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
  return all.sort((a, b) => b.timestamp - a.timestamp)
}

export async function getTodayIdeas() {
  return getIdeasByDate(todayStr())
}

export async function getAllIdeas() {
  const db = await getDB()
  const all = await db.getAll('ideas')
  return all.sort((a, b) => b.timestamp - a.timestamp)
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
  const dates = [...new Set(all.map(i => i.date))]
  return dates.sort().reverse()
}
