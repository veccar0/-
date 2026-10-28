// 화면 공통 도우미: 글자 이스케이프, 금액 표시, 아이콘, 은행나무, 토스트, 은행잎 효과.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
export const comma = (n) => Math.round(n).toLocaleString('ko-KR');

const svg = (body, size = 24, extra = '') => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const leaf = (size = 16, fill = 'var(--leaf)', stroke = 'var(--leaf-deep)') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 22V14C6.5 14 2.5 9.5 3 4.5C6.5 2.5 10 4 12 7C14 4 17.5 2.5 21 4.5C21.5 9.5 17.5 14 12 14" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 14V9" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round"/></svg>`;

export const ICON = {
  home: svg('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>'),
  quiz: svg('<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>'),
  log: svg('<rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>'),
  shop: svg('<path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 22),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 22),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 22),
  send: svg('<path d="M5 12h13M13 6l6 6-6 6"/>', 22),
  erase: svg('<path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="m12 9 5 6M17 9l-5 6"/>', 26),
  coin: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10h5M9.5 14h5"/>', 22),
  jar: svg('<path d="M8 3.5h8M7 6h10l-.8 2.5c1.8 1.2 2.8 3 2.8 5.5 0 4-3.1 6.5-7 6.5S5 18 5 14c0-2.5 1-4.3 2.8-5.5z"/>', 24),
  flame: svg('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.3 3.6-8.3.3 1.9 1.4 3 2.5 3.4C11.3 6.6 13 4.3 15 3c-.2 3 2.6 4.8 3.3 8 .4 1.4.2 2.4.2 3.8 0 3.6-2.6 6.2-6.5 6.2z"/>', 14),
};

export const CATEGORIES = [
  { id: 'friends', name: '친구 약속', icon: svg('<circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.3c.6-.2 1.3-.3 2-.3 2.3 0 3.8 1.5 4.3 4"/>', 22) },
  { id: 'snack', name: '간식', icon: svg('<path d="M7 9h10l-1.3 10.2a1 1 0 0 1-1 .8H9.3a1 1 0 0 1-1-.8z"/><path d="M9 9c0-2.5 1.3-4.5 3-4.5S15 6.5 15 9"/>', 22) },
  { id: 'cafe', name: '카페·음료', icon: svg('<path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5"/>', 22) },
  { id: 'transport', name: '교통', icon: svg('<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 20l1.5-3M16 20l-1.5-3"/><circle cx="8.5" cy="14" r=".6" fill="currentColor"/><circle cx="15.5" cy="14" r=".6" fill="currentColor"/>', 22) },
  { id: 'shopping', name: '쇼핑', icon: svg('<path d="M6 7h12l1 13H5z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>', 22) },
  { id: 'etc', name: '기타', icon: svg('<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>', 22) },
];
export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[5];

export function toast(root, html, ms = 2600) {
  let box = root.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); root.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
}

// 버튼 위치에서 목표(대상) 쪽으로 은행잎이 날아가는 효과
export function leafBurst(root, fromEl, toEl, count = 7) {
  if (!fromEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r0 = root.getBoundingClientRect();
  const a = fromEl.getBoundingClientRect();
  const b = (toEl || fromEl).getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'fly';
    el.innerHTML = leaf(22);
    const x = a.left - r0.left + a.width / 2 + (Math.random() - .5) * a.width * .6;
    const y = a.top - r0.top + a.height / 2;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${b.left - r0.left + b.width / 2 - x + (Math.random() - .5) * 40}px`);
    el.style.setProperty('--dy', `${b.top - r0.top + b.height / 2 - y}px`);
    el.style.animationDelay = `${i * 60}ms`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 1400 + i * 60);
  }
}

export function leafFall(container, count = 8) {
  if (!container || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'fall';
    el.innerHTML = leaf(16);
    el.style.left = `${8 + Math.random() * 84}%`;
    el.style.animationDelay = `${Math.random() * 1.2}s`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4600);
  }
}

// 돈구리의 은행나무 4단계: 0 새싹 · 1 어린 나무 · 2 큰 나무 · 3 열매
const LEAF_D = 'M12 22V14C6.5 14 2.5 9.5 3 4.5C6.5 2.5 10 4 12 7C14 4 17.5 2.5 21 4.5C21.5 9.5 17.5 14 12 14';
const gl = (x, y, s, r) => `<path d="${LEAF_D}" transform="translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-12 -22)" fill="var(--leaf)" stroke="var(--leaf-deep)" stroke-width="${(1.3 / s).toFixed(2)}" stroke-linejoin="round"/>`;
const blob = (circles) => circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
const TREE = [
  () => `<path d="M60 104V84" stroke="#8A6A3B" stroke-width="3" stroke-linecap="round"/>${gl(60, 87, 1.1, -32)}${gl(60, 87, 1.1, 32)}`,
  () => `<path d="M57 104h6l-1-34h-4z" fill="#8A6A3B"/><g fill="#FBE29A">${blob([[60, 60, 22], [45, 70, 14], [75, 70, 14]])}</g>
    ${[[52, 58, -20], [66, 54, 15], [60, 70, 0], [46, 72, -35], [75, 71, 35]].map(([x, y, r]) => gl(x, y, 0.7, r)).join('')}`,
  () => `<path d="M55 104h10l-2-40h-6z" fill="#8A6A3B"/><path d="M60 78 44 66M60 72l15-11" stroke="#8A6A3B" stroke-width="4" stroke-linecap="round"/>
    <g fill="#FBE29A">${blob([[60, 44, 28], [37, 58, 19], [83, 58, 19], [60, 64, 20]])}</g>
    ${[[50, 38, -20], [68, 34, 18], [60, 52, 0], [38, 58, -35], [82, 57, 35], [48, 64, -10], [72, 64, 12], [60, 24, 0]].map(([x, y, r]) => gl(x, y, 0.75, r)).join('')}`,
];
TREE[3] = () => `${TREE[2]()}<g fill="#E9A23B" stroke="#B9741A" stroke-width="1">${blob([[45, 50, 3.8], [72, 46, 3.8], [58, 60, 3.8], [83, 63, 3.8], [36, 64, 3.8], [64, 34, 3.8]])}</g>`;
export const treeSvg = (stage, size = 120) =>
  `<svg viewBox="0 0 120 112" width="${size}" height="${Math.round(size * 112 / 120)}" aria-hidden="true"><ellipse cx="60" cy="105" rx="42" ry="6" fill="rgba(120,90,40,.13)"/>${TREE[Math.max(0, Math.min(3, stage))]()}</svg>`;
