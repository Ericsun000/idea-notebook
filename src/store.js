import { defineStore } from 'pinia'
import { addIdea, deleteIdea, updateIdea, getTodayIdeas, getTodayNote, saveDailyNote, getAllIdeas, getAllDailyNotes, getIdeasByDate } from './db'
import { classify, extractTags, generateDailySummary } from './classifier'

export const useIdeaStore = defineStore('ideas', {
  state: () => ({
    todayIdeas: [],
    todayNote: null,
    allIdeas: [],
    allNotes: [],
    loading: false
  }),

  actions: {
    async loadToday() {
      this.loading = true
      this.todayIdeas = await getTodayIdeas()
      this.todayNote = await getTodayNote() || null
      this.loading = false
    },

    async loadAll() {
      this.allIdeas = await getAllIdeas()
    },

    async loadAllNotes() {
      this.allNotes = await getAllDailyNotes()
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

    async removeIdea(id) {
      await deleteIdea(id)
      this.todayIdeas = this.todayIdeas.filter(i => i.id !== id)
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
