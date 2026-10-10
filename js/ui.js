// Utilitas UI bersama: escape HTML, format, toast, efek klik, suara/musik.
// Tidak bergantung pada Store supaya bisa dipakai juga di halaman login/daftar.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rupiah(n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
function dateOnly(v) { return String(v || '').slice(0, 10); }
function localISO(d) { return d.toLocaleDateString('sv-SE'); } // yyyy-mm-dd, zona waktu lokal
function fmtDate(v) {
  const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v);
  return isNaN(d) ? String(v || '') : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Toast ----------
function toast(msg, opts = {}) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast' + (opts.error ? ' err' : '');
  el.innerHTML = `<span>${esc(msg)}</span>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (opts.action) {
    const b = document.createElement('button');
    b.textContent = opts.action;
    b.onclick = () => { close(); opts.onAction && opts.onAction(); };
    el.appendChild(b);
  }
  box.appendChild(el);
  setTimeout(close, opts.ms || (opts.action ? 6000 : 3000));
}

function countUp(el, to, fmt = rupiah) {
  if (!el) return;
  if (reduceMotion() || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 700;
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

// ---------- Efek klik: percikan koin ----------
function burst(x, y) {
  if (reduceMotion()) return;
  const colors = ['#D4A72C', '#F6DF8B', '#B08B1A', '#2D6A4F'];
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('i');
    p.className = 'burst';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const a = (Math.PI * 2 * i) / 7 + Math.random() * .6, d = 22 + Math.random() * 22;
    p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
               { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - 8}px) scale(.2)`, opacity: 0 }],
              { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => p.remove();
  }
}
document.addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('button:not(:disabled), a.nav-link, .chip, .icon-btn, summary')) burst(e.clientX, e.clientY);
});

// ---------- Suara ----------
const Sound = {
  ctx: null,
  enabled() { return localStorage.getItem('ml_music') === 'on'; },
  _tone(freq, t0, dur, vol) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0 + dur);
  },
  coin() {   // "ting" dua nada saat menyimpan
    if (!this.enabled()) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = this.ctx.currentTime;
      this._tone(988, t, .12, .08); this._tone(1319, t + .09, .3, .08);
    } catch (e) { /* abaikan */ }
  },
  pop() {
    if (!this.enabled()) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      this._tone(330, this.ctx.currentTime, .12, .07);
    } catch (e) { /* abaikan */ }
  }
};

// ---------- Pemutar musik: assets/lagu.mpeg ----------
// Posisi lagu disimpan di sessionStorage supaya terus berlanjut saat pindah halaman.
const Music = {
  src: 'assets/lagu.mpeg',
  audio: null,
  get() {
    if (this.audio) return this.audio;
    const a = new Audio(this.src);
    a.loop = true; a.preload = 'auto';
    a.volume = Number(localStorage.getItem('ml_vol') || 0.5);
    const saved = Number(sessionStorage.getItem('ml_music_t') || 0);
    a.addEventListener('loadedmetadata', () => { if (saved && saved < a.duration) a.currentTime = saved; }, { once: true });
    setInterval(() => { if (!a.paused) sessionStorage.setItem('ml_music_t', a.currentTime); }, 1000);
    addEventListener('pagehide', () => sessionStorage.setItem('ml_music_t', a.currentTime));
    return (this.audio = a);
  },
  mount(host, floating) {
    const box = document.createElement('div');
    box.className = 'music' + (floating ? ' floating' : '');
    box.innerHTML = `
      <div class="row">
        <button type="button" aria-label="Putar atau jeda musik" title="Putar / jeda musik">▶</button>
        <span>Musik latar</span>
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
      <input type="range" min="0" max="1" step="0.05" aria-label="Volume" value="${Number(localStorage.getItem('ml_vol') || 0.5)}">
      <div class="hint" hidden></div>`;
    host.appendChild(box);
    const btn = box.querySelector('button'), vol = box.querySelector('input'), hint = box.querySelector('.hint');
    const a = this.get();
    const sync = () => { btn.textContent = a.paused ? '▶' : '❚❚'; box.classList.toggle('playing', !a.paused); };
    a.addEventListener('play', sync); a.addEventListener('pause', sync);
    a.addEventListener('error', () => {
      hint.hidden = false; hint.textContent = 'File assets/lagu.mpeg belum ditemukan.'; btn.disabled = true;
    });
    const start = () => a.play().then(() => localStorage.setItem('ml_music', 'on')).catch(() => {});
    btn.onclick = () => {
      if (a.paused) start(); else { a.pause(); localStorage.setItem('ml_music', 'off'); }
    };
    vol.oninput = () => { a.volume = Number(vol.value); localStorage.setItem('ml_vol', vol.value); };
    // Lanjutkan otomatis kalau tadi sudah menyala. Browser memblokir autoplay,
    // jadi kalau ditolak, mulai pada interaksi pertama.
    if (localStorage.getItem('ml_music') === 'on') {
      a.play().catch(() => {
        const once = () => { if (localStorage.getItem('ml_music') === 'on') a.play().catch(() => {}); };
        addEventListener('pointerdown', once, { once: true });
        addEventListener('keydown', once, { once: true });
      });
    }
    sync();
  }
};

// ---------- Tombol "Lihat" di semua input password ----------
function attachPasswordToggles() {
  document.querySelectorAll('input[type=password]').forEach(inp => {
    const wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Lihat';
    b.onclick = () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.textContent = show ? 'Sembunyi' : 'Lihat'; };
    wrap.appendChild(b);
  });
}

// ---------- Halaman auth: koin berjatuhan + musik + animasi gagal ----------
function initAuthPage() {
  document.body.dataset.page = 'auth';
  const screen = document.querySelector('.login-screen');
  if (screen) {
    const rain = document.createElement('div');
    rain.className = 'coin-rain';
    for (let i = 0; i < 9; i++) {
      const c = document.createElement('i');
      c.style.left = (5 + i * 11) + '%';
      c.style.animationDuration = (9 + (i * 7) % 8) + 's';
      c.style.animationDelay = '-' + ((i * 3) % 9) + 's';
      rain.appendChild(c);
    }
    screen.appendChild(rain);
  }
  Music.mount(document.body, true);
  attachPasswordToggles();
}
function shakeCard() {
  const c = document.querySelector('.login-card');
  if (!c) return;
  c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
}
