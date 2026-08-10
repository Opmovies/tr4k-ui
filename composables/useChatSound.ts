// Petit son de notification synthétisé (WebAudio) — pas de fichier audio à charger.
let ctx: AudioContext | null = null

export function playChatSound(volume = 0.4) {
  if (!import.meta.client) return
  try {
    ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    // deux notes brèves, façon « pop » discret
    for (const [freq, at] of [[660, 0], [880, 0.09]] as [number, number][]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + at)
      gain.gain.linearRampToValueAtTime(volume, now + at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.2)
    }
  } catch {}
}
