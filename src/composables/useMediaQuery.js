import { ref, onUnmounted } from 'vue'

// Reactive CSS media query. Used to switch the control panel between the
// mobile stack and the desktop scroll-plus-sheet layout, which needs real
// state rather than CSS because the tabs decide what is mounted.
export function useMediaQuery(query) {
  const mq = window.matchMedia(query)
  const matches = ref(mq.matches)
  const onChange = e => { matches.value = e.matches }
  mq.addEventListener('change', onChange)
  onUnmounted(() => mq.removeEventListener('change', onChange))
  return matches
}
