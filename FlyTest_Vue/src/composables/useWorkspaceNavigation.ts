import { computed, nextTick, ref, watch } from 'vue'
import { useEventListener, useMediaQuery, useStorage } from '@vueuse/core'

/** Keep desktop preferences separate from the temporary mobile drawer. */
export function useWorkspaceNavigation() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isCompact = useMediaQuery('(max-width: 1199px)')
  const desktopCollapsed = useStorage('feice-navigation-collapsed', false)
  const compactExpanded = ref(false)
  const mobileNavOpen = ref(false)
  const navigationRef = ref<HTMLElement | null>(null)
  let previousFocus: HTMLElement | null = null

  const collapsed = computed({
    get: () => !isMobile.value && (isCompact.value ? !compactExpanded.value : desktopCollapsed.value),
    set: (value: boolean) => {
      if (isCompact.value) compactExpanded.value = !value
      else desktopCollapsed.value = value
    },
  })

  const closeNavigation = () => { mobileNavOpen.value = false }
  const toggleNavigation = () => {
    if (isMobile.value) mobileNavOpen.value = !mobileNavOpen.value
    else collapsed.value = !collapsed.value
  }

  watch(isMobile, closeNavigation)
  watch(mobileNavOpen, async (open) => {
    if (open) previousFocus = document.activeElement as HTMLElement | null
    await nextTick()
    // Wait until the CSS drawer is visible before moving focus into it.
    if (open) requestAnimationFrame(() => requestAnimationFrame(() => {
      if (mobileNavOpen.value) navigationRef.value?.querySelector<HTMLElement>('button')?.focus()
    }))
    else if (previousFocus?.isConnected) previousFocus.focus()
  })

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (!mobileNavOpen.value) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeNavigation()
    }
    if (event.key !== 'Tab') return
    const targets = navigationRef.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
    )
    const focusable = Array.from(targets || []).filter(el => el.getClientRects().length > 0)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })

  return { collapsed, isMobile, mobileNavOpen, navigationRef, toggleNavigation, closeNavigation }
}
