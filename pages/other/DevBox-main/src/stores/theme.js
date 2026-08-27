import { defineStore } from 'pinia'
export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: localStorage.getItem('devbox-dark') === 'true'
  }),
  actions: {
    toggleDark() {
      this.dark = !this.dark
      localStorage.setItem('devbox-dark', this.dark)
      document.documentElement.classList.toggle('dark', this.dark)
    },
    initTheme() {
      document.documentElement.classList.toggle('dark', this.dark)
    }
  }
})
