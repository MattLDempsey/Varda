import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'

export interface ThemeColors {
  charcoal: string
  charcoalLight: string
  black: string
  steel: string
  steelLight: string
  gold: string
  goldDark: string
  silver: string
  silverLight: string
  white: string
  green: string
  red: string
  blue: string
  purple: string
  cyan: string
}

const darkColors: ThemeColors = {
  charcoal: '#2B2E34',
  charcoalLight: '#33363D',
  black: '#1A1C20',
  steel: '#4B5057',
  steelLight: '#5A5F66',
  gold: '#C6A86A',
  goldDark: '#B0944F',
  silver: '#C9CDD2',
  silverLight: '#E0E2E5',
  white: '#F5F5F3',
  green: '#6ABF8A',
  red: '#D46A6A',
  blue: '#5B9BD5',
  purple: '#9B7ED8',
  cyan: '#5BBFD4',
}

const lightColors: ThemeColors = {
  charcoal: '#F7F7F5',
  charcoalLight: '#FFFFFF',
  black: '#EEEEEC',
  steel: '#B0B5BC',
  steelLight: '#9AA0A8',
  gold: '#9E8545',
  goldDark: '#7A6633',
  silver: '#5A5F66',
  silverLight: '#3A3F44',
  white: '#1A1C20',
  green: '#2D8A52',
  red: '#C04040',
  blue: '#3A7CC0',
  purple: '#6B4FB0',
  cyan: '#3A9AB0',
}

interface ThemeContextValue {
  mode: ThemeMode
  C: ThemeColors
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  C: darkColors,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('gh-theme')
    return (stored === 'light' || stored === 'dark') ? stored : 'dark'
  })

  const toggle = () => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('gh-theme', next)
      return next
    })
  }

  const C = mode === 'dark' ? darkColors : lightColors

  // Sync CSS variables for components that use them (AppShell, scrollbars, etc.)
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', mode)
    root.style.setProperty('--color-charcoal', C.charcoal)
    root.style.setProperty('--color-charcoal-light', C.charcoalLight)
    root.style.setProperty('--color-black', C.black)
    root.style.setProperty('--color-steel', C.steel)
    root.style.setProperty('--color-steel-light', C.steelLight)
    root.style.setProperty('--color-gold', C.gold)
    root.style.setProperty('--color-gold-dark', C.goldDark)
    root.style.setProperty('--color-silver', C.silver)
    root.style.setProperty('--color-silver-light', C.silverLight)
    root.style.setProperty('--color-white', C.white)
  }, [mode, C])

  return (
    <ThemeContext.Provider value={{ mode, C, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
