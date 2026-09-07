import { LEVELS } from './levels.js';
import { SAVE_KEY, freshState, sanitizeState, canVisit, discover, completeLevel, offlineReply } from './engine.js';
const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
const button = (text, className, fn) => { const n = el('button', className, text); n.type = 'button'; n.addEventListener('click', fn); return n; };
let state = freshState(), storageOK = true, aiEnabled = false, busy = false, requestId = 0, activeController;
try { const saved = localStorage.getItem(SAVE_KEY); if (saved) state = sanitizeState(JSON.parse(saved)); } catch { storageOK = false; }
let speech = '', speechSource = '劇情', toastTimer, audioContext;
const chapterNames = ['第一章', '第二章', '第三章', '第四章', '終章'];
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); storageOK = true; } catch { storageOK = false; } $('save-status').textContent = storageOK ? '進度已自動保存在這台裝置' : '此瀏覽器無法儲存進度；離開後可能遺失'; }
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200); }
function tone(frequency = 660) { if (!state.sound) return; try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); const osc = audioContext.createOscillator(), gain = audioContext.createGain(); osc.connect(gain); gain.connect(audioContext.destination); osc.type = 'sine'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .25); osc.start(); osc.stop(audioContext.currentTime + .26); } catch { /* Audio is optional. */ } }
function cancelChat() { requestId++; activeController?.abort(); busy = false; updateBusy(); }
function updateBusy() { $('send-button').disabled = busy; $('chat-input').disabled = busy; $('hint-button').disabled = busy; $('bond-button').disabled = busy; $('send-button').textContent = busy ? '⋯' : '↗'; $('chat-form').setAttribute('aria-busy', String(busy)); }
function currentIntro() { const messages = state.chats[state.current]; const last = [...messages].reverse().find(m => m.role === 'assistant'); speech = last?.content || LEVELS[state.current].intro; speechSource = last?.source || '劇情'; }
function say(text, source = '劇情', save = true) { speech = text; speechSource = source; $('speech').textContent = text; $('dialogue-mode').textContent = source === 'AI' ? 'AI 對話' : source === '劇情' ? '旅途劇情' : '離線劇情'; if (save) { state.chats[state.current].push({ role: 'assistant', content: text, source }); state.chats[state.current] = state.chats[state.current].slice(-20); persist(); } }
function render() {
  const level = LEVELS[state.current], clues = state.clues[state.current];
  $('chapters').replaceChildren(...LEVELS.map((l, i) => {
    const b = button('', 'chapter-button' + (i === state.current ? ' active' : ''), () => visit(i));
    b.disabled = !canVisit(state, i); b.setAttribute('aria-label', `${chapterNames[i]} ${l.place}${b.disabled ? '，尚未解鎖' : state.completed.includes(i) ? '，已完成' : ''}`);
    if (i === state.current) b.setAttribute('aria-current', 'step');
    const copy = el('span', 'chapter-copy'); copy.append(el('strong', '', l.place), el('small', '', l.title));
    b.append(el('span', 'chapter-number', `0${i + 1}`), copy, el('span', 'chapter-state', state.completed.includes(i) ? '✓' : b.disabled ? '鎖' : '·'));
    return b;
  }));
  $('breadcrumb').textContent = `${chapterNames[state.current]} · ${level.place}`;
  $('scene-region').textContent = level.region; $('scene-title').textContent = level.title; $('scene-subtitle').textContent = level.subtitle;
  $('scene-art').className = `scene-art art-${state.current}`; $('scene-art').setAttribute('aria-label', `${level.place}動漫場景`);
  $('scene-time').textContent = level.time; $('quest-text').textContent = level.mission;
  $('clue-count').textContent = `${clues.length}/3`; $('clue-dots').replaceChildren(...[0, 1, 2].map(i => el('i', i < clues.length ? 'done' : '')));
  $('hotspots').replaceChildren(...level.spots.map((spot, i) => {
    const found = clues.includes(i), b = button('', 'hotspot' + (found ? ' found' : ''), () => inspect(i));
    b.style.left = `${spot.x}%`; b.style.top = `${spot.y}%`; b.dataset.index = i;
    b.setAttribute('aria-label', `${spot.name}${found ? '，已探索' : '，探索線索'}`);
    b.append(el('span', 'hotspot-mark', found ? '✓' : '+'), el('span', 'hotspot-label', spot.name)); return b;
  }));
  positionHotspots();
  const ready = clues.length === 3;
  $('puzzle-button').classList.toggle('ready', ready);
  $('puzzle-button').replaceChildren(document.createTextNode(state.completed.includes(state.current) ? '重玩本章謎題 ' : ready ? '開始解謎 ' : '查看任務線索 '), el('span', '', '↗'));
  $('stamp-count').textContent = state.completed.length; $('completion-label').textContent = `${state.completed.length} / 5`; $('journey-progress').value = state.completed.length;
  $('sound-button').textContent = state.sound ? '♪ 音效開啟' : '♪ 音效關閉'; $('sound-button').setAttribute('aria-pressed', String(state.sound));
  $('bond-button').textContent = state.friendships.includes(state.current) ? '聊聊這裡的故事' : '很高興和你一起旅行';
  say(speech || level.intro, speechSource, false); updateBusy();
}
function positionHotspots() {
  // Mobile markers stay between chapter heading and the bottom quest card.
  const mobile = matchMedia('(max-width: 760px)').matches;
  const compact = matchMedia('(max-width: 1150px)').matches;
  const points = mobile ? [[66, 35], [27, 53], [59, 61]] : [[70, 40], [25, 59], [48, 32]];
  document.querySelectorAll('.hotspot').forEach((b, i) => { const s = LEVELS[state.current].spots[i]; b.style.left = `${compact ? points[i][0] : s.x}%`; b.style.top = `${compact ? points[i][1] : s.y}%`; });
}
window.addEventListener('resize', positionHotspots);
function visit(index) {
  if (!canVisit(state, index)) return;
  cancelChat(); state.current = index; currentIntro(); render(); persist(); $('modal').close();
  $('scene-art').classList.remove('chapter-fade'); requestAnimationFrame(() => $('scene-art').classList.add('chapter-fade'));
  tone(440 + index * 70);
}
function modal(title, eyebrow = 'TRAVEL JOURNAL') { $('modal-eyebrow').textContent = eyebrow; const c = $('modal-content'); c.replaceChildren(el('h2', '', title)); if (!$('modal').open) $('modal').showModal(); return c; }
function actions(container, ...buttons) { const group = el('div', 'modal-actions'); group.append(...buttons); container.append(group); }
function inspect(index) {
  const s = LEVELS[state.current].spots[index], isNew = discover(state, index);
  render(); persist(); if (isNew) { tone(620 + index * 110); toast(`已收錄：${s.item}`); }
  const c = modal(s.item, isNew ? 'NEW MEMORY · 新線索' : 'MEMORY · 已收錄');
  c.append(el('p', '', s.text));
  actions(c, button('繼續探索', 'secondary-button', () => $('modal').close()));
  if (state.clues[state.current].length === 3) c.lastChild.append(button('線索齊了，開始解謎', 'primary-button', puzzle));
}
function showClues() {
  const level = LEVELS[state.current]; const c = modal('本章任務線索', 'CHAPTER QUEST');
  c.append(el('p', '', level.mission)); const list = el('ul', 'clue-list');
  level.spots.forEach((s, i) => { const row = el('li'); row.append(el('strong', '', state.clues[state.current].includes(i) ? `✓ ${s.item}` : `○ ${s.name}`), document.createTextNode(state.clues[state.current].includes(i) ? s.text : '回到場景，點擊這個探索標記。')); list.append(row); }); c.append(list);
  actions(c, button('回到場景', 'primary-button', () => $('modal').close()));
}
function puzzle() {
  if (state.clues[state.current].length !== 3) return showClues();
  const level = LEVELS[state.current], p = level.puzzle;
  let attempt = p.kind === 'rotate' ? [...p.initial] : [];
  const c = modal(p.title, `CHAPTER 0${state.current + 1} · 解謎`); c.append(el('p', '', p.instruction));
  const feedback = el('p', 'puzzle-feedback'); feedback.setAttribute('aria-live', 'polite');
  const line = el('div', 'attempt-line'); line.setAttribute('aria-live', 'polite');
  const submit = button('確認答案', 'primary-button', () => {
    if (completeLevel(state, attempt)) { persist(); render(); success(); tone(880); }
    else { feedback.textContent = '還差一點！重新看看線索，或請小嵐給你提示。'; tone(220); }
  });
  let board;
  const update = () => {
    if (p.kind === 'sequence') { line.textContent = attempt.length ? attempt.map(i => p.options[i]).join(' → ') : '你的選擇會出現在這裡'; submit.disabled = attempt.length !== p.answer.length; }
    else board.querySelectorAll('.photo-inner').forEach((tile, i) => { tile.style.transform = `rotate(${attempt[i] * 90}deg)`; tile.parentElement.setAttribute('aria-label', `第 ${i + 1} 格，目前旋轉 ${attempt[i] * 90} 度，點擊順時針旋轉`); });
  };
  if (p.kind === 'sequence') {
    board = el('div', 'puzzle-options');
    p.options.forEach((opt, i) => board.append(button(opt, '', () => { if (attempt.length >= p.answer.length) return; attempt.push(i); feedback.textContent = ''; tone([440, 554, 659][i]); update(); })));
    c.append(board, line);
  } else {
    board = el('div', 'rotate-board');
    [0, 1, 2, 3].forEach(i => { const b = button('', 'photo-tile', () => { attempt[i] = (attempt[i] + 1) % 4; tone(500); feedback.textContent = ''; update(); }); const photo = el('span', 'photo-inner'); photo.style.backgroundPosition = `${i % 2 === 0 ? 66.6667 : 100}% ${i < 2 ? 66.6667 : 100}%`; photo.append(el('span', '', '↑ 上')); b.append(photo); board.append(b); }); c.append(board);
  }
  c.append(feedback);
  actions(c, button('重新排列', 'secondary-button', () => { attempt = p.kind === 'rotate' ? [...p.initial] : []; feedback.textContent = ''; update(); }), button('小嵐的提示', 'secondary-button', () => { feedback.textContent = p.hint; }), submit); update();
}
function success() {
  const level = LEVELS[state.current];
  const c = modal(`獲得「${level.souvenir}」`, 'CHAPTER COMPLETE · 回憶已收藏'); c.append(el('div', 'stamp', level.icon), el('p', '', level.puzzle.success));
  say(level.puzzle.success);
  actions(c, button('翻開手帳', 'secondary-button', journal), button(state.current === 4 ? '閱讀旅途終章' : `下一站：${LEVELS[state.current + 1].place}`, 'primary-button', () => state.current === 4 ? ending() : visit(state.current + 1)));
}
function stampCollection() { const grid = el('div', 'stamp-grid'); LEVELS.forEach((l, i) => { const item = el('div', 'stamp-item' + (state.completed.includes(i) ? '' : ' locked')); item.append(el('div', 'stamp', l.icon), el('small', '', l.place)); grid.append(item); }); return grid; }
function journal() {
  const c = modal('旅人手帳'); c.append(el('p', '', `已收集 ${state.completed.length}/5 枚印章 · 與小嵐共享 ${state.friendships.length} 段心情`), stampCollection());
  LEVELS.forEach((l, i) => { if (!state.clues[i].length) return; const section = el('section', 'journal-chapter'); section.append(el('h3', '', `${chapterNames[i]} · ${l.place}`)); const list = el('ul', 'clue-list'); state.clues[i].forEach(j => { const li = el('li'); li.append(el('strong', '', l.spots[j].item), document.createTextNode(l.spots[j].text)); list.append(li); }); section.append(list); c.append(section); });
  if (!state.clues.some(a => a.length)) c.append(el('p', '', '手帳還是空白的。點擊場景裡的探索標記，寫下第一段回憶吧。'));
  actions(c, button('繼續旅程', 'primary-button', () => $('modal').close())); if (state.completed.length === 5) c.lastChild.append(button('重讀結局', 'secondary-button', ending));
}
function ending() {
  const c = modal('島嶼的五封信', 'THE JOURNEY CONTINUES'); c.append(stampCollection(), el('p', 'ending-quote', '「風景會遠去，一起走過的人會留下。」'), el('p', '', `從九份的燈火，到台北的來信；從日月潭的回聲，到台南的一碗暖意，最後抵達花蓮的海。你找回的不只是五枚印章，也是願意停下腳步的自己。${state.friendships.length >= 3 ? '小嵐在封底多寫了一句：「下一次旅行，也要一起喔。」' : '小嵐微笑著合上手帳：「下一頁，就留給明天吧。」'}`));
  actions(c, button('回看旅人手帳', 'primary-button', journal), button('留在海邊', 'secondary-button', () => $('modal').close()));
}
function history() {
  const c = modal(`${LEVELS[state.current].place} · 對話紀錄`, 'WITH XIAO LAN');
  const list = [{ role: 'assistant', content: LEVELS[state.current].intro, source: '劇情' }, ...state.chats[state.current]];
  list.forEach(m => { const n = el('div', `history-message ${m.role}`); n.append(el('small', '', m.role === 'user' ? '你' : `小嵐 · ${m.source || '劇情'}`), document.createTextNode(m.content)); c.append(n); });
}
async function sendChat(message) {
  message = message.trim().slice(0, 500); if (!message || busy) return;
  const index = state.current, id = ++requestId;
  const history = state.chats[index].slice(-8).map(({ role, content }) => ({ role, content }));
  state.chats[index].push({ role: 'user', content: message }); state.chats[index] = state.chats[index].slice(-20); persist();
  $('chat-input').value = ''; busy = true; updateBusy(); $('speech').textContent = '小嵐正在想一想…';
  let reply, source = '離線';
  try {
    if (!aiEnabled) reply = offlineReply(state, message);
    else {
      activeController = new AbortController();
      const timer = setTimeout(() => activeController?.abort(), 30000);
      try {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: index, clues: state.clues[index], completed: state.completed.includes(index), message, history }), signal: activeController.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`); const data = await r.json();
        if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Empty reply'); reply = data.reply.slice(0, 1500); source = 'AI';
      } finally { clearTimeout(timer); }
    }
  } catch { reply = offlineReply(state, message); if (id === requestId) toast('AI 暫時無法連線，已切換離線劇情'); }
  if (id !== requestId || index !== state.current) return;
  busy = false; activeController = undefined; say(reply, source); updateBusy();
}
function toggleSound() { state.sound = !state.sound; persist(); render(); if (state.sound) tone(); }
function settings() {
  const c = modal('旅行設定', 'MAKE YOURSELF AT HOME');
  const audioRow = el('div', 'settings-row'); audioRow.append(el('span', '', '探索與解謎音效'), button(state.sound ? '關閉音效' : '開啟音效', 'secondary-button', () => { toggleSound(); settings(); })); c.append(audioRow);
  const aiRow = el('div', 'settings-row'); aiRow.append(el('span', '', '角色對話模式'), el('span', '', aiEnabled ? 'AI 已連接 · 可自由對話' : '離線劇情 · 預寫回應')); c.append(aiRow);
  c.append(el('p', '', aiEnabled ? '自由對話會傳送給遊戲設定的 AI 服務。關卡進度由遊戲本身判定，不受 AI 回覆影響。' : '現在可以使用離線劇情與任務提示。遊戲管理者在伺服器設定 AI 服務後，自由對話會自動啟用。'));
  c.append(el('p', '', '操作：點擊場景標記尋找線索 → 完成謎題 → 收集印章並解鎖下一站。支援滑鼠、觸控與 Tab／Enter 鍵。Esc 可關閉視窗。進度保存在目前瀏覽器。'));
  c.append(el('p', '', '本作為原創虛構旅行故事；插畫為 AI 生成，不是實地導航或景點現況。'));
  actions(c, button('重新開始旅程', 'secondary-button', resetConfirm), button('回到遊戲', 'primary-button', () => $('modal').close()));
}
function resetConfirm() { const c = modal('要從第一頁重新開始嗎？', 'NEW JOURNEY'); c.append(el('p', '', '這會清除這台裝置的所有印章、線索及對話紀錄。'));
  actions(c, button('保留目前旅程', 'secondary-button', settings), button('清除並重新開始', 'primary-button', () => { cancelChat(); state = freshState(); currentIntro(); persist(); render(); $('modal').close(); toast('新的旅程，從九份開始'); })); }
$('modal-close').onclick = () => $('modal').close(); $('modal').addEventListener('click', e => { if (e.target === $('modal')) { const b = $('modal').getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) $('modal').close(); } });
$('journal-button').onclick = journal; $('settings-button').onclick = settings; $('puzzle-button').onclick = puzzle; $('history-button').onclick = history; $('hint-button').onclick = () => sendChat('給我一點任務提示');
$('bond-button').onclick = () => { if (!state.friendships.includes(state.current)) { state.friendships.push(state.current); persist(); render(); tone(740); toast('與小嵐的共同回憶 +1'); sendChat('很高興和你一起旅行'); } else sendChat('聊聊這裡的故事'); };
$('sound-button').onclick = toggleSound;
$('chat-form').addEventListener('submit', e => { e.preventDefault(); sendChat($('chat-input').value); });
currentIntro(); render(); persist();
if (location.protocol !== 'file:') fetch('/api/config', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).then(config => { aiEnabled = config?.aiEnabled === true; if (aiEnabled) toast('小嵐的 AI 自由對話已就緒'); }).catch(() => {});
// Gentle ambient motes, drawn with Canvas; no generated DOM scenery.
const canvas = $('particles'), context = canvas.getContext('2d');
if (context && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const motes = Array.from({ length: 18 }, () => ({ x: Math.random(), y: Math.random(), s: .5 + Math.random(), a: Math.random() })); let last = 0;
  function paint(time) { requestAnimationFrame(paint); if (document.hidden || time - last < 45) return; last = time; const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) { canvas.width = Math.round(rect.width); canvas.height = Math.round(rect.height); } context.clearRect(0, 0, canvas.width, canvas.height); for (const m of motes) { m.y -= .00045; if (m.y < 0) m.y = 1; context.fillStyle = `rgba(255,220,150,${.2 + Math.sin(time / 900 + m.a * 10) * .17})`; context.beginPath(); context.arc(m.x * canvas.width, m.y * canvas.height, m.s, 0, Math.PI * 2); context.fill(); } }
  requestAnimationFrame(paint);
}
