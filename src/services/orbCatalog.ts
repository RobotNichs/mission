import type { OrbDefinition, OrbRarity } from '../types/gamification'

type Visual = OrbDefinition['visual']
const orb = (id: string, name: string, rarity: OrbRarity, colors: Visual['colors'],
  material: Visual['material'] = 'glass', pattern: Visual['pattern'] = 'none', ring = false): OrbDefinition => ({
  id, name, rarity, description: `${name}: ${material === 'glass' ? 'leuchtendes Glas' : material === 'pearl' ? 'schimmerndes Perlmutt' : material === 'metal' ? 'poliertes Metall' : material === 'crystal' ? 'facettierter Kristall' : 'kosmischer Nebel'}.`,
  visual: { colors, material, pattern, ring, animated: rarity === 'legendary' },
})

// Historical IDs remain stable so existing collections and equipment survive.
export const orbCollection: OrbDefinition[] = [
  orb('orb-common', 'Morgenlicht', 'common', ['#fff2b9', '#e8b854', '#714727']),
  orb('orb-common-coral', 'Koralle', 'common', ['#ffd8c6', '#f77f70', '#792637']),
  orb('orb-common-mint', 'Minze', 'common', ['#dcffeb', '#6ad7aa', '#215c55']),
  orb('orb-common-sky', 'Himmelblau', 'common', ['#d6f5ff', '#6cbce9', '#23486c']),
  orb('orb-common-lilac', 'Flieder', 'common', ['#f2deff', '#b590df', '#4e326c']),
  orb('orb-common-rose', 'Rosenquarz', 'common', ['#ffe5f1', '#e391bb', '#793959']),
  orb('orb-common-lime', 'Limette', 'common', ['#efffc5', '#bbd958', '#4e6427']),
  orb('orb-common-amber', 'Bernstein', 'common', ['#ffe6ab', '#e69538', '#713d22']),
  orb('orb-common-teal', 'Lagune', 'common', ['#c3fff8', '#3ac7bf', '#195765']),
  orb('orb-common-indigo', 'Indigo', 'common', ['#d5d8ff', '#747ae5', '#292867']),
  orb('orb-common-peach', 'Pfirsich', 'common', ['#fff0dd', '#efb286', '#805745']),
  orb('orb-common-ruby', 'Rubinrot', 'common', ['#ffd6dd', '#d34d70', '#661d39']),
  orb('orb-common-forest', 'Waldgrün', 'common', ['#d1f5c5', '#5eab69', '#244932']),
  orb('orb-common-ice', 'Eisblau', 'common', ['#f0ffff', '#a0d7e8', '#426b88']),
  orb('orb-common-plum', 'Pflaume', 'common', ['#eed2f3', '#a061ad', '#50274e']),
  orb('orb-common-sand', 'Dünensand', 'common', ['#fff4d4', '#c9b885', '#776649']),
  orb('orb-common-silver', 'Silberlicht', 'common', ['#f9fbff', '#bac9d9', '#536475']),
  orb('orb-common-copper', 'Kupfer', 'common', ['#ffdebf', '#bc7953', '#633c32']),
  orb('orb-common-ocean', 'Ozean', 'common', ['#c0e6ff', '#3786c4', '#193f64']),
  orb('orb-common-smoke', 'Rauchglas', 'common', ['#e2e8ee', '#7d8c9d', '#303c4d']),
  orb('orb-rare', 'Nordlicht', 'rare', ['#91ffe1', '#65b4ed', '#6639a0'], 'pearl', 'bands'),
  orb('orb-rare-opal', 'Opal', 'rare', ['#ffe7ac', '#e290dc', '#458fac'], 'pearl', 'facets'),
  orb('orb-rare-mercury', 'Quecksilber', 'rare', ['#f6fcff', '#99b6d3', '#56516d'], 'metal', 'bands'),
  orb('orb-rare-prism', 'Prismenglas', 'rare', ['#adfff4', '#b99afa', '#e867a0'], 'crystal', 'facets'),
  orb('orb-rare-malachite', 'Malachit', 'rare', ['#b2ffbd', '#2bb8a0', '#173f61'], 'metal', 'bands'),
  orb('orb-rare-sunset', 'Abendsonne', 'rare', ['#ffe99a', '#e88776', '#694bba'], 'glass', 'bands'),
  orb('orb-rare-pearl', 'Mondperle', 'rare', ['#fff5ef', '#c0a9da', '#627cab'], 'pearl', 'halo'),
  orb('orb-rare-obsidian', 'Obsidian', 'rare', ['#b6c7ff', '#546179', '#271d43'], 'metal', 'facets'),
  orb('orb-rare-aquamarine', 'Aquamarin', 'rare', ['#d0fffc', '#64d7d1', '#6568aa'], 'crystal', 'facets'),
  orb('orb-rare-bismuth', 'Wismut', 'rare', ['#ffc784', '#d579c1', '#51a5bb'], 'metal', 'bands'),
  orb('orb-epic', 'Nebelrose', 'epic', ['#ffb7e8', '#ae76eb', '#523275'], 'nebula', 'petals', true),
  orb('orb-epic-eclipse', 'Eklipse', 'epic', ['#ffcb7c', '#8e5cca', '#171f47'], 'metal', 'halo', true),
  orb('orb-epic-tidal', 'Gezeiten', 'epic', ['#92fff0', '#3487c5', '#613d9f'], 'glass', 'vortex'),
  orb('orb-epic-hex', 'Kristallmatrix', 'epic', ['#c6faff', '#7b91ed', '#4a3976'], 'crystal', 'facets', true),
  orb('orb-epic-comet', 'Kometenschweif', 'epic', ['#fff3a8', '#79d8e9', '#4d458a'], 'nebula', 'stars'),
  orb('orb-epic-solar', 'Sonnenkranz', 'epic', ['#fff8a1', '#f0a65d', '#b14c76'], 'glass', 'halo', true),
  orb('orb-epic-iris', 'Irisblüte', 'epic', ['#d5caff', '#ad6fd6', '#476ab8'], 'pearl', 'petals'),
  orb('orb-legendary', 'Sternenstaub', 'legendary', ['#fff4b7', '#e6ae68', '#7056ba'], 'nebula', 'stars', true),
  orb('orb-legendary-singularity', 'Singularität', 'legendary', ['#97ecff', '#966cee', '#201a46'], 'nebula', 'vortex', true),
  orb('orb-legendary-celestial', 'Himmelskrone', 'legendary', ['#fff9ec', '#9fe3de', '#ba85d9'], 'pearl', 'halo', true),
]

export const defaultOrb = orb('orb-default', 'Standard-Orb', 'common', ['#d8ffff', '#77c9d1', '#374576'])
export const rarityLabels: Record<OrbRarity, string> = {
  common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär',
}
