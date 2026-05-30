import { defineStore } from 'pinia'
import {
  addIdea, softDeleteIdea, updateIdea, getTodayIdeas, getTodayNote,
  saveDailyNote, getAllIdeas, getAllDailyNotes, getIdeasByDate,
  getTrashIdeas, restoreIdea, permanentlyDeleteIdea, purgeOldTrash
} from './db'
import { classify, extractTags, generateDailySummary } from './classifier'

export const useIdeaStore = defineStore('ideas', {
  state: () => ({
    todayIdeas: [],
    todayNote: null,
    allIdeas: [],
    allNotes: [],
    trashIdeas: [],
    loading: false,
    viewFilter: 'all'
  }),

  getters: {
    filteredTodayIdeas: (state) => {
      if (state.viewFilter === 'all') return state.todayIdeas
      const completed = state.viewFilter === 'completed'
      return state.todayIdeas.filter(i => !!i.completed === completed)
    }
  },

  actions: {
    async loadToday() {
      this.loading = true
      this.todayIdeas = await getTodayIdeas()
      this.todayNote = await getTodayNote() || null
      await purgeOldTrash()
      this.loading = false
    },

    async loadAll() {
      this.allIdeas = await getAllIdeas()
    },

    async loadAllNotes() {
      this.allNotes = await getAllDailyNotes()
    },

    async loadTrash() {
      this.trashIdeas = await getTrashIdeas()
    },

    async toggleCompleted(id) {
      const idea = this.todayIdeas.find(i => i.id === id)
      if (idea) {
        const updated = await updateIdea(id, { completed: !idea.completed })
        if (updated) {
          const idx = this.todayIdeas.findIndex(i => i.id === id)
          if (idx !== -1) this.todayIdeas[idx] = updated
        }
      }
    },

    setFilter(filter) {
      this.viewFilter = filter
    },

    async createIdea(text) {
      const { category } = classify(text)
      const tags = extractTags(text)
      const idea = await addIdea({
        content: text,
        category,
        tags,
        source: 'text'
      })
      this.todayIdeas.unshift(idea)
      return idea
    },

    async createVoiceIdea(text, duration) {
      const { category } = classify(text)
      const tags = extractTags(text)
      const idea = await addIdea({
        content: text,
        category,
        tags,
        source: 'voice',
        voiceDuration: Math.round(duration)
      })
      this.todayIdeas.unshift(idea)
      return idea
    },

    async deleteIdea(id) {
      await softDeleteIdea(id)
      this.todayIdeas = this.todayIdeas.filter(i => i.id !== id)
      this.allIdeas = this.allIdeas.filter(i => i.id !== id)
    },

    async undoDelete(id) {
      await restoreIdea(id)
      const trashed = this.trashIdeas.find(i => i.id === id)
      if (trashed) {
        this.trashIdeas = this.trashIdeas.filter(i => i.id !== id)
        const today = new Date().toISOString().slice(0, 10)
        if (trashed.date === today) {
          this.todayIdeas.unshift(trashed)
        }
      }
    },

    async permanentlyDeleteIdea(id) {
      await permanentlyDeleteIdea(id)
      this.trashIdeas = this.trashIdeas.filter(i => i.id !== id)
    },

    async emptyTrash() {
      for (const idea of this.trashIdeas) {
        await permanentlyDeleteIdea(idea.id)
      }
      this.trashIdeas = []
    },

    async updateIdeaCat(id, category) {
      const updated = await updateIdea(id, { category })
      if (updated) {
        const idx = this.todayIdeas.findIndex(i => i.id === id)
        if (idx !== -1) this.todayIdeas[idx] = updated
      }
    },

    async generateNote() {
      const ideas = await getTodayIdeas()
      if (!ideas.length) return null

      const summary = generateDailySummary(ideas)
      const categoryStats = {}
      for (const idea of ideas) {
        categoryStats[idea.category] = (categoryStats[idea.category] || 0) + 1
      }

      const note = await saveDailyNote({
        date: new Date().toISOString().slice(0, 10),
        ideas: ideas.map(i => i.id),
        summary,
        categoryStats,
        totalCount: ideas.length,
        generatedAt: Date.now()
      })
      this.todayNote = note
      return note
    },

    async getIdeasForDate(date) {
      return getIdeasByDate(date)
    }
  }
})
