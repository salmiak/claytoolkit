import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import './style.css'
import sv from './locales/sv.json'
import en from './locales/en.json'
import { FALLBACK, readStoredLocale, detectLocale } from './locale.js'

const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale() || detectLocale(),
  fallbackLocale: FALLBACK,
  messages: { sv, en },
})

createApp(App).use(i18n).mount('#app')
