export type CompanionSkinId = 'luna' | 'milo' | 'nova'

type CompanionSkin = {
  name: string
  coat: readonly [string, string, string]
  contour: string
  ear: string
  earOpacity: string
  mark: string
  eye: string
  eyeOutline?: string
  pupil: string
  glint: string
  closedEye: string
  nose: string
  mouth: string
  mouthFill: string
  halo: string
  successLight: string
  levelLight: readonly [string, string]
  hearts: readonly [string, string]
  surface?: { color: string; opacity: string; cx: string; cy: string; points: boolean }
}

/** Visual configuration only. IDs are independent of names, inventory and rewards. */
export const companionSkins: Record<CompanionSkinId, CompanionSkin> = {
  luna: {
    name: 'Luna', coat: ['#3D4B6B', '#2E3A56', '#1B2336'], contour: '#667397',
    ear: '#8A7BE0', earOpacity: '.32', mark: '#A99BEF', eye: '#F7E6D3',
    pupil: '#1B2336', glint: '#FFF8EF', closedEye: '#F7E6D3', nose: '#F5BEA4',
    mouth: '#C8BECD', mouthFill: '#F5BEA4', halo: '#8A7BE0', successLight: '#F5BEA4',
    levelLight: ['#F7E6D3', '#8A7BE0'], hearts: ['#F5BEA4', '#A99BEF'],
  },
  milo: {
    name: 'Milo', coat: ['#FFF0D5', '#F7DAB7', '#DFA685'], contour: '#B98475',
    ear: '#EF9C83', earOpacity: '.65', mark: '#9A85CF', eye: '#FFF4E3', eyeOutline: '#7D6270',
    pupil: '#29334E', glint: '#FFF8EF', closedEye: '#4A3A51', nose: '#514051',
    mouth: '#A96F65', mouthFill: '#ECA58C', halo: '#EDBA91', successLight: '#F0B38F',
    levelLight: ['#FFE8C8', '#B49AD8'], hearts: ['#C97873', '#9A85CF'],
    surface: { color: '#FFE5B9', opacity: '.3', cx: '38%', cy: '28%', points: false },
  },
  nova: {
    name: 'Nova', coat: ['#425194', '#30265B', '#171C37'], contour: '#9981D8',
    ear: '#A28BE5', earOpacity: '.52', mark: '#B6C7F5', eye: '#F7E6D3',
    pupil: '#171C37', glint: '#EAF5FF', closedEye: '#F7E6D3', nose: '#F5BEA4',
    mouth: '#D5C6E7', mouthFill: '#E8B1CE', halo: '#9673D8', successLight: '#C8B3EC',
    levelLight: ['#F7E6D3', '#9B82E4'], hearts: ['#F5BEA4', '#AC9EEB'],
    surface: { color: '#7DCBE8', opacity: '.22', cx: '25%', cy: '75%', points: true },
  },
}
