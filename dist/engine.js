import { LEVELS } from './levels.js';
export const SAVE_KEY = 'taiwan-wanderings-v1';
export const freshState = () => ({ version: 1, current: 0, completed: [], clues: LEVELS.map(() => []), chats: LEVELS.map(() => []), friendships: [], sound: false });
export function sanitizeState(raw) {
  const clean = freshState();
  if (!raw || raw.version !== 1) return clean;
  // Only accept a contiguous chain of completed chapters.
  for (let i = 0; i < LEVELS.length && raw.completed?.includes(i); i++) clean.completed.push(i);
  clean.current = Number.isInteger(raw.current) ? Math.max(0, Math.min(raw.current, clean.completed.length, 4)) : 0;
  clean.clues = LEVELS.map((_, i) => Array.isArray(raw.clues?.[i]) ? [...new Set(raw.clues[i].filter(v => Number.isInteger(v) && v >= 0 && v < 3))] : []);
  clean.chats = LEVELS.map((_, i) => Array.isArray(raw.chats?.[i]) ? raw.chats[i].filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string').slice(-20).map(m => ({ role: m.role, content: m.content.slice(0, 1500), source: ['AI', '劇情', '離線'].includes(m.source) ? m.source : '劇情' })) : []);
  clean.friendships = Array.isArray(raw.friendships) ? [...new Set(raw.friendships.filter(v => Number.isInteger(v) && v >= 0 && v < 5))] : [];
  clean.sound = raw.sound === true;
  return clean;
}
export function canVisit(state, index) { return Number.isInteger(index) && index >= 0 && index < LEVELS.length && index <= state.completed.length; }
export function discover(state, index) {
  if (!Number.isInteger(index) || index < 0 || index > 2) return false;
  if (state.clues[state.current].includes(index)) return false;
  state.clues[state.current].push(index); return true;
}
export function checkSolution(levelIndex, attempt) {
  const answer = LEVELS[levelIndex]?.puzzle.answer;
  return !!answer && Array.isArray(attempt) && attempt.length === answer.length && answer.every((v, i) => attempt[i] === v);
}
export function completeLevel(state, attempt) {
  if (!canVisit(state, state.current) || state.clues[state.current].length !== 3 || !checkSolution(state.current, attempt)) return false;
  if (!state.completed.includes(state.current)) state.completed.push(state.current);
  return true;
}
export function offlineReply(state, message) {
  const level = LEVELS[state.current], n = state.clues[state.current].length;
  if (/提示|線索|怎麼|如何|卡住|help|hint|解謎|答案/i.test(message)) return n < 3 ? `先把場景裡的三個探索點都找過一遍吧！目前找到 ${n}/3 條線索。點亮的標記會變成勾勾，旅人手帳也會記下內容。` : `我把線索整理好了：${level.puzzle.hint} 你可以按「開始解謎」試試。`;
  if (/你好|嗨|hello|hi\b/i.test(message)) return `嗨，旅伴！我是小嵐，現在我們在${level.place}。${level.subtitle} 想聊聊這裡，還是需要任務提示？`;
  if (/謝謝|喜歡|開心|朋友|一起/.test(message)) return '能和你一起走這段路，我也很開心。慢慢來，旅途中願意停下來看一眼的人，常常會發現最好的風景。';
  if (/你是誰|名字|小嵐/.test(message)) return '我叫小嵐，是喜歡收集明信片的旅人。這本漫遊錄就是我們一起寫的故事。五個地方、五段回憶，還有一個願意同行的你。';
  if (/故事|任務|目標|做什麼/.test(message)) return `這一章叫「${level.title}」。我們要${level.mission}，完成後就能獲得「${level.souvenir}」印章。`;
  if (/難過|累|傷心/.test(message)) return '那我們就在這裡歇一下吧。旅途不用趕進度，你隨時可以停下來，回來時我還會在這一頁等你。';
  if (/哪|景點|介紹|這裡|風景/.test(message)) return `${level.place}這一章的故事是「${level.title}」。${level.intro} 我們的任務人物和解謎線索都是虛構的旅行故事喔。`;
  return `我現在使用預寫的離線劇情，還不能理解每一種自由提問。不過我可以聊「這裡的故事」、「你是誰」，或給你「任務提示」。${n < 3 ? '一起看看還沒探索的標記吧！' : '線索已經齊了，要試試解謎嗎？'}`;
}
