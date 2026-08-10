// Rendu léger BBCode / Markdown → HTML (échappé). Balises observées sur TR4KER :
// [b][i][u][s][center][quote][spoiler][code][url=][/url][img][list][*][color=][size=]
function esc(s: string): string {
  // " et ' inclus : une valeur injectée dans un attribut (src/href/style) ne doit
  // jamais pouvoir refermer le guillemet et greffer un handler → XSS.
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
// n'autorise que les URL http(s) (le reste — javascript:, data:… — est rejeté)
function safeUrl(u: string): string | null {
  return /^https?:\/\//i.test(u.trim()) ? u.trim() : null
}
// valeur de couleur sûre (nom CSS ou hex) — évite l'injection via l'attribut style
function safeColor(v: string): string | null {
  const c = v.trim()
  return /^#[0-9a-f]{3,8}$/i.test(c) || /^[a-z]{3,20}$/i.test(c) ? c : null
}

export function bbcodeToHtml(src?: string | null): string {
  if (!src) return ''
  let s = esc(src)
  s = s.replace(/\[img\]\s*(https?:[^[\]]+?)\s*\[\/img\]/gi, (_, u) => `<img src="${u}" loading="lazy" alt="">`)
  s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_, u, t) => { const url = safeUrl(u); return url ? `<a href="${url}" target="_blank" rel="noreferrer">${t}</a>` : t })
  s = s.replace(/\[url\](https?:[^[\]]+?)\[\/url\]/gi, (_, u) => `<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`)
  // plusieurs passes pour absorber les balises imbriquées (color/b/center souvent emboîtées)
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<b>$1</b>')
    s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<i>$1</i>')
    s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
    s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
    s = s.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align:center">$1</div>')
    s = s.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_, c, t) => { const col = safeColor(c); return col ? `<span style="color:${col}">${t}</span>` : t })
    s = s.replace(/\[size=(\d{1,3})\]([\s\S]*?)\[\/size\]/gi, (_, n, t) => `<span style="font-size:${Math.min(32, Math.max(9, +n))}px">${t}</span>`)
    s = s.replace(/\[quote(?:=[^\]]+)?\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>')
    s = s.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, '<details class="spoiler"><summary>Spoiler</summary>$1</details>')
    s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre class="bbcode-code">$1</pre>')
  }
  s = s.replace(/\[\*\]\s?([^\n[]*)/gi, '<li>$1</li>')
  s = s.replace(/\[list(?:=[^\]]+)?\]([\s\S]*?)\[\/list\]/gi, '<ul>$1</ul>')
  // supprime les balises BBCode restantes (mal fermées) pour ne pas les afficher en clair
  s = s.replace(/\[\/?(?:b|i|u|s|center|color|size|quote|spoiler|code|list|url|img)(?:=[^\]]*)?\]/gi, '')
  s = s.replace(/\n/g, '<br>')
  return s
}

/**
 * Nettoie du HTML d'uploadeur avant rendu : retire scripts/iframes/handlers et liens javascript:
 * (protège d'un XSS) mais conserve la mise en forme inline (style, img, div…). Client uniquement.
 */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, form, input, button, link, meta, base').forEach((e) => e.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase()
      if (n.startsWith('on')) el.removeAttribute(attr.name)
      else if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  })
  return doc.body.innerHTML
}

export function markdownToHtml(src?: string | null): string {
  if (!src) return ''
  let s = esc(src)
  s = s.replace(/!\[[^\]]*\]\((https?:[^)]+)\)/g, (_, u) => `<img src="${u}" loading="lazy" alt="">`)
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noreferrer">${t}</a>`)
  s = s.replace(/^######?\s?(.+)$/gm, '<b>$1</b>')
  s = s.replace(/^#{1,3}\s?(.+)$/gm, '<h4>$1</h4>')
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
  s = s.replace(/(^|\s)\*([^*\n]+)\*/g, '$1<i>$2</i>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
  s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  s = s.replace(/\n/g, '<br>')
  return s
}

/** Convertit le tech_info_xml de TR4KER en sections lisibles [{section, rows:[[k,v]]}]. */
export function parseTechXml(xml?: string | null): { section: string; rows: [string, string][] }[] {
  if (!xml || typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.querySelector('parsererror')) return []
    const out: { section: string; rows: [string, string][] }[] = []
    const root = doc.documentElement
    const walk = (el: Element, label: string) => {
      const rows: [string, string][] = []
      const subs: Element[] = []
      for (const child of Array.from(el.children)) {
        const txt = (child.textContent || '').trim()
        if (child.children.length === 0) { if (txt) rows.push([tidy(child.tagName), txt]) }
        else subs.push(child)
      }
      if (rows.length) out.push({ section: label, rows })
      for (const sub of subs) walk(sub, tidy(sub.tagName))
    }
    // on part de la racine : gère aussi bien <TechnicalInfo> imbriqué que <EbookInfo>/<MusicInfo> à plat
    walk(root, tidy(root.tagName))
    return out
  } catch { return [] }
}
function tidy(tag: string): string {
  return tag.replace(/([a-z])([A-Z])/g, '$1 $2')
}
