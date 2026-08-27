import { defineStore } from 'pinia'
export const useHistoryStore = defineStore('history', {
  state: () => ({
    records: JSON.parse(localStorage.getItem('devbox-history') || '{}')
  }),
  actions: {
    addRecord(toolKey, content) {
      if (!this.records[toolKey]) this.records[toolKey] = []
      const list = this.records[toolKey]
      list.unshift(content)
      if (list.length > 20) list.pop()
      this.save()
    },
    clearRecord(toolKey) {
      this.records[toolKey] = []
      this.save()
    },
    save() {
      localStorage.setItem('devbox-history', JSON.stringify(this.records))
    }
  }
})
