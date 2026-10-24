const showScare = () => {
  if (document.getElementById('pomoghost-tab-scare')) return
  const host = document.createElement('div')
  host.id = 'pomoghost-tab-scare'
  host.innerHTML = `<style>#pomoghost-tab-scare{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#18060ce8;color:#fff5e9;font-family:ui-monospace,monospace;animation:pg-in .18s ease-out both}#pomoghost-tab-scare .pg-card{width:min(620px,calc(100vw - 40px));padding:48px 32px;text-align:center;border:2px solid #b43745;border-radius:22px;background:radial-gradient(circle at 50% 0,#692334,#1c1118 65%);box-shadow:0 30px 90px #000}.pg-ghost{font-size:96px;line-height:1;filter:drop-shadow(0 0 20px #f33445);animation:pg-rush 1.3s ease-out both}.pg-card h1{font-size:clamp(28px,6vw,54px);margin:17px 0}.pg-card p{font-size:16px;color:#ead3d7}.pg-card button{margin-top:24px;padding:14px 30px;border:3px double #2a1218;border-radius:8px;background:#f8791c;color:#1c0b0b;font-weight:800;font-size:16px;cursor:pointer}@keyframes pg-in{from{opacity:0}to{opacity:1}}@keyframes pg-rush{0%{transform:scale(.3)}45%{transform:scale(1.3)}100%{transform:scale(1)}}</style><div class="pg-card" role="alertdialog" aria-modal="true"><div class="pg-ghost">👻</div><div>AUTHORIZED POMOGHOST ALERT</div><h1>BOO! Back to your task.</h1><p>Morrow spotted a distraction.</p><button>I'm back!</button></div>`
  host.querySelector('button').addEventListener('click', () => host.remove())
  document.documentElement.append(host)
  try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(105, c.currentTime); o.frequency.exponentialRampToValueAtTime(44, c.currentTime + .45); g.gain.setValueAtTime(.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(.18, c.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .5); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .52) } catch (_) {}
  setTimeout(() => host.remove(), 5000)
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showScare })
})
