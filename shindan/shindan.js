import { copy } from './copy.js';

const byId = id => document.getElementById(id);
const form = byId('scan-form');
const input = byId('scan-url');
const endpoint = byId('main').dataset.endpoint;
const marks = { ok: '◯', warn: '△', missingFirst: '△', missingSecond: '△', fail: '×', unknown: '—' };
const praises = { 1: 'スマホでの見やすさ', 2: '表示の速さ', 3: '安全なつなぎ方', 4: '電話・予約への案内',
  5: '営業時間と場所の案内', 6: '検索結果での見え方', 7: 'LINE などで送ったときの見え方', 8: '情報の新しさ' };
const reasons = { robots: 'このホームページは、自動での読み取りを断る設定になっています。', mobile_audit: '文字の大きさや押す場所を十分に確かめられませんでした。',
  connection: '安全なつなぎ方に移るかを確かめられませんでした。', psi: copy.errors.psi };
const links = {
  social: [['x', 'X を見る', 'https://x.com/arpeda_ofc'], ['instagram', 'Instagram を見る', 'https://www.instagram.com/arpeda_ofc/']],
  point: [['point', 'ワンポイント診断を見る', '/services/#first-step']],
  site: [['price', '料金を見る', '/services/hp/'], ['contact', '相談する', '/contact/']],
  unreachable: [['retry', 'もう一度試す'], ['onepage', 'お店の1枚ページを見る', '/services/#first-step']],
};

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function screen(current) {
  for (const id of ['entry', 'progress', 'result']) byId(id).hidden = id !== current;
}

function reset() {
  screen('entry');
  byId('scan-error').hidden = true;
  byId('checks').replaceChildren();
  byId('scan-meta').textContent = '';
  input.focus();
}

function count(event) {
  void fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }),
    keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer',
  }).catch(() => {});
}

function showGuidance(route) {
  const box = byId('guidance');
  box.replaceChildren();
  box.hidden = !route;
  if (!route) return;
  const text = copy.routes[route];
  const actions = node('div', undefined, 'scan-links');
  const heading = node('h2', text.見出し);
  heading.tabIndex = -1;
  for (const [event, label, href] of links[route]) {
    const button = node(href ? 'a' : 'button', label, 'btn btn-primary');
    if (href) button.href = href;
    else button.type = 'button';
    button.addEventListener('click', () => {
      count(event);
      if (!href) reset();
    });
    actions.append(button);
  }
  box.append(heading, node('p', text.本文), actions);
  if (text.その下に小さく) box.append(node('p', text.その下に小さく, 'scan-muted'));
}

function formatLine(line, result) {
  const date = result.month ? `${result.year}年${result.month}月` : `${result.year}年`;
  return line
    .replace('◯秒', `${result.seconds}秒`)
    .replace('◯年◯月', date)
    .replace('◯年', `${result.year}年`)
    .replace('◯◯', () => result.title || '');
}

function renderCheck(description, item, index) {
  const entry = node('li', undefined, 'result-check');
  const badge = node('span', marks[item.status], 'result-mark');
  badge.dataset.status = item.status;
  const heading = node('h2');
  const title = node('span', undefined, 'result-title');
  for (const part of description.titleParts || [description.title]) {
    if (title.childNodes.length) title.append(node('wbr'));
    title.append(node('span', part, 'result-phrase'));
  }
  heading.append(badge, title);
  entry.append(heading);
  const text = description.entries[item.status];
  if (item.status === 'unknown') {
    entry.append(node('p', '確かめられませんでした', 'result-line'));
    const reason = item.reason === 'no_date' ? text.line : reasons[item.reason];
    if (reason && (index > 2 || item.reason !== 'psi')) entry.append(node('p', reason, 'scan-muted'));
  } else if (text) {
    entry.append(node('p', formatLine(text.line, item), 'result-line'));
    for (const label of ['なぜ損か', '自分で直すなら']) {
      if (!text[label]) continue;
      const advice = node('p', undefined, 'result-advice');
      advice.append(node('strong', label), document.createTextNode(text[label]));
      entry.append(advice);
    }
  }
  return entry;
}

function showResult(report, address) {
  const ids = Object.keys(report.items);
  const ok = ids.filter(id => report.items[id].status === 'ok');
  const total = ids.filter(id => report.items[id].status !== 'unknown').length;
  const best = [4, 5, 1, 3, 6, 7, 2, 8].find(id => ok.includes(String(id)));
  byId('summary').replaceChildren(
    node('span', `${total}つのうち ${ok.length}つ が`, 'result-phrase'),
    document.createTextNode(' '),
    node('span', 'OK でした', 'result-phrase'),
  );
  byId('praise').hidden = !best;
  if (best) byId('praise').textContent = praises[best] + 'はよくできています。';
  byId('scan-meta').textContent = new Date(report.checkedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + '　' + address;
  byId('checks').replaceChildren(...copy.items.map((description, index) => renderCheck(description, report.items[index + 1], index + 1)));
  byId('robots-notice').hidden = !report.robots;
  byId('psi-notice').hidden = !report.psiUnavailable;
  byId('psi-notice').textContent = copy.errors.psi;
  byId('free-note').hidden = !report.free;
  byId('free-note').textContent = copy.free;
  byId('print').hidden = false;
  byId('reset').hidden = false;
  showGuidance(report.route);
  screen('result');
  byId('summary').focus();
}

function showError(code) {
  if (code in copy.errors && code !== 'psi') {
    screen('entry');
    byId('scan-error').textContent = copy.errors[code];
    byId('scan-error').hidden = false;
    input.focus();
    return;
  }
  for (const id of ['summary', 'praise', 'scan-meta']) byId(id).textContent = '';
  byId('checks').replaceChildren();
  for (const id of ['robots-notice', 'psi-notice', 'free-note', 'print', 'reset']) byId(id).hidden = true;
  showGuidance('unreachable');
  screen('result');
  byId('guidance').querySelector('h2').focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const address = input.value.trim();
  byId('scan-error').hidden = true;
  if (!/^https?:\/\/[^\s]+$/i.test(address)) return showError('invalid');
  screen('progress');
  byId('progress-text').textContent = copy.progress[0];
  const timers = [2200, 4400, 19400, 21600].map((delay, step) => setTimeout(() => {
    byId('progress-text').textContent = copy.progress[step + 1];
  }, delay));
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: address }),
      signal: AbortSignal.timeout(75000), credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    const data = await response.json();
    if (data.error || !response.ok) showError(data.error);
    else showResult(data, data.url || address);
  } catch (error) {
    showError(error.name === 'TimeoutError' ? 'timeout' : 'unreachable');
  } finally {
    timers.forEach(clearTimeout);
  }
});
byId('print').addEventListener('click', () => window.print());
byId('reset').addEventListener('click', reset);
form.querySelector('button').disabled = false;
