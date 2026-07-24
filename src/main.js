import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import './style.css'
import sv from './locales/sv.json'
import en from './locales/en.json'

const savedLocale = localStorage.getItem('konform-locale')
const browserLocale = navigator.language.startsWith('sv') ? 'sv' : 'en'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale || browserLocale,
  fallbackLocale: 'en',
  messages: { sv, en },
})

createApp(App).use(i18n).mount('#app')
