import { describe, it, expect } from 'vitest'
import { bbcodeToHtml, markdownToHtml, sanitizeHtml, parseTechXml } from '~/composables/useRichText'

describe('bbcodeToHtml', () => {
  it('gère vide/null', () => {
    expect(bbcodeToHtml('')).toBe('')
    expect(bbcodeToHtml(null)).toBe('')
  })
  it('échappe le HTML source (anti-XSS)', () => {
    expect(bbcodeToHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(bbcodeToHtml('a & b')).toBe('a &amp; b')
  })
  it('rend les balises de base', () => {
    expect(bbcodeToHtml('[b]gras[/b]')).toBe('<b>gras</b>')
    expect(bbcodeToHtml('[i]it[/i] [u]sou[/u] [s]barré[/s]')).toBe('<i>it</i> <u>sou</u> <s>barré</s>')
    expect(bbcodeToHtml('[quote]cité[/quote]')).toBe('<blockquote>cité</blockquote>')
    expect(bbcodeToHtml('[spoiler]fin[/spoiler]')).toContain('<details class="spoiler">')
  })
  it('rend les balises imbriquées (plusieurs passes)', () => {
    expect(bbcodeToHtml('[center][b][color=red]titre[/color][/b][/center]'))
      .toBe('<div style="text-align:center"><b><span style="color:red">titre</span></b></div>')
  })
  it('filtre les couleurs dangereuses', () => {
    expect(bbcodeToHtml('[color=red;background:url(x)]t[/color]')).toBe('t')
    expect(bbcodeToHtml('[color=#ff0000]t[/color]')).toBe('<span style="color:#ff0000">t</span>')
  })
  it('borne les tailles de police entre 9 et 32', () => {
    expect(bbcodeToHtml('[size=200]t[/size]')).toBe('<span style="font-size:32px">t</span>')
    expect(bbcodeToHtml('[size=2]t[/size]')).toBe('<span style="font-size:9px">t</span>')
  })
  it('rend liens et images http(s) uniquement', () => {
    expect(bbcodeToHtml('[img]https://a.tld/x.png[/img]')).toBe('<img src="https://a.tld/x.png" loading="lazy" alt="">')
    expect(bbcodeToHtml('[url=https://a.tld]lien[/url]')).toBe('<a href="https://a.tld" target="_blank" rel="noreferrer">lien</a>')
    // pas de src javascript: — le motif exige https?:
    expect(bbcodeToHtml('[img]javascript:alert(1)[/img]')).not.toContain('<img')
  })
  it('rend les listes', () => {
    expect(bbcodeToHtml('[list][*]un\n[*]deux[/list]')).toContain('<ul><li>un</li><br><li>deux</li></ul>')
  })
  it('supprime les balises orphelines', () => {
    expect(bbcodeToHtml('[b]non fermé')).toBe('non fermé')
  })
  it('échappe les guillemets (anti-cassure d’attribut)', () => {
    // une URL avec " ne doit pas pouvoir sortir de l'attribut src pour greffer onerror=
    const out = bbcodeToHtml('[img]https://x/a"onerror="alert(1)[/img]')
    // le " est neutralisé (&quot;) → pas de cassure d'attribut, le handler reste du texte inerte
    expect(out).not.toContain('"onerror')
    expect(out).toContain('&quot;onerror')
  })
  it('rejette les schémas d’URL non http(s) dans [url]', () => {
    expect(bbcodeToHtml('[url=javascript:alert(1)]clic[/url]')).toBe('clic')
    expect(bbcodeToHtml('[url=https://a.tld]clic[/url]')).toBe('<a href="https://a.tld" target="_blank" rel="noreferrer">clic</a>')
  })
  it('convertit les sauts de ligne', () => {
    expect(bbcodeToHtml('a\nb')).toBe('a<br>b')
  })
})

describe('markdownToHtml', () => {
  it('échappe le HTML source', () => {
    expect(markdownToHtml('<img onerror=x>')).toBe('&lt;img onerror=x&gt;')
  })
  it('rend titres, gras, italique, code', () => {
    expect(markdownToHtml('# Titre')).toBe('<h4>Titre</h4>')
    expect(markdownToHtml('**gras**')).toBe('<b>gras</b>')
    expect(markdownToHtml('mot *it*')).toBe('mot <i>it</i>')
    expect(markdownToHtml('`code`')).toBe('<code>code</code>')
  })
  it('rend liens et images http(s)', () => {
    expect(markdownToHtml('[t](https://a.tld)')).toBe('<a href="https://a.tld" target="_blank" rel="noreferrer">t</a>')
    expect(markdownToHtml('![alt](https://a.tld/i.png)')).toBe('<img src="https://a.tld/i.png" loading="lazy" alt="">')
    expect(markdownToHtml('[t](javascript:alert(1))')).not.toContain('<a')
  })
  it('rend les listes', () => {
    expect(markdownToHtml('- a')).toBe('<ul><li>a</li></ul>')
  })
})

describe('sanitizeHtml', () => {
  it('retire les éléments dangereux', () => {
    const out = sanitizeHtml('<div>ok<script>alert(1)</script><iframe src="x"></iframe><form></form></div>')
    expect(out).toBe('<div>ok</div>')
  })
  it('retire les handlers on* et les liens javascript:', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)" onclick="x()">l</a><img src="https://a.tld/i.png" onerror="p0wn()">')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('<img src="https://a.tld/i.png">')
  })
  it('conserve la mise en forme inline', () => {
    expect(sanitizeHtml('<b style="color:red">t</b>')).toBe('<b style="color:red">t</b>')
  })
  it('gère vide/null', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
  })
})

describe('parseTechXml', () => {
  it('retourne [] sur XML invalide ou vide', () => {
    expect(parseTechXml('')).toEqual([])
    expect(parseTechXml('pas du xml <<<')).toEqual([])
  })
  it('aplatit les sections et les paires clé/valeur', () => {
    const xml = `<TechnicalInfo><General><Duration>2h</Duration><FileSize>4 Go</FileSize></General><VideoTrack><Codec>x265</Codec></VideoTrack></TechnicalInfo>`
    const out = parseTechXml(xml)
    expect(out).toEqual([
      { section: 'General', rows: [['Duration', '2h'], ['File Size', '4 Go']] },
      { section: 'Video Track', rows: [['Codec', 'x265']] },
    ])
  })
})
