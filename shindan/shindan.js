import { copy } from './copy.js';

const byId = id => document.getElementById(id);
const form = byId('scan-form');
const input = byId('scan-url');
const endpoint = byId('main').dataset.endpoint;
const robotsNotice = byId('robots-notice');
const robotsMeasuredMessage = robotsNotice.textContent;
const badges = {
  ok: { mark: '◯', label: 'OK' },
  review: { mark: '△', label: '要確認' },
  fail: { mark: '×', label: '要改善' },
  unknown: { mark: '—', label: '未確認' },
};
const topics = [
  { label: 'スマホ', path: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h2' },
  { label: '表示速度', path: 'M4 18a9 9 0 1 1 16 0M12 13l4-4M8 18h8' },
  { label: '安全性', path: 'M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Zm-3 9 2 2 4-4' },
  { label: '電話・予約', path: 'M7 3 4 4v3c0 6 7 13 13 13h3l1-4-5-2-2 2a16 16 0 0 1-6-6l2-2-2-5H7Z' },
  { label: '営業時間・場所', path: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-7-2v3l2 1' },
  { label: '検索結果', path: 'M15 15l5 5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z' },
  { label: 'LINEなどで共有', path: 'M4 5h16v11h-9l-5 4v-4H4V5Zm4 4h8m-8 3h5' },
  { label: '情報の新しさ', path: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 10h18m-13 5h3m3 0h2' },
];
const praises = { 1: 'スマホでの見やすさ', 2: '表示の速さ', 3: '安全なつなぎ方', 4: '電話・予約への案内',
  5: '営業時間と場所の案内', 6: '検索結果での見え方', 7: 'LINE などで送ったときの見え方', 8: '情報の新しさ' };
const reasons = { robots: 'このホームページは、自動での読み取りを断る設定になっています。', mobile_audit: '文字の大きさや押す場所を十分に確かめられませんでした。',
  connection: '安全なつなぎ方に移るかを確かめられませんでした。',
  speed_audit: '表示の速さの測定結果が返りませんでした。', psi: copy.errors.psi };
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

function topicIcon(index) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('class', 'topic-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', topics[index - 1].path);
  svg.append(path);
  return svg;
}

function paragraphs(container, text, className) {
  for (const sentence of text.match(/[^。]+。?|。/gu) || []) {
    if (sentence.trim()) container.append(node('p', sentence.trim(), className));
  }
}

function resultType(status) {
  return ({ ok: 'ok', fail: 'fail', unknown: 'unknown' })[status] || 'review';
}

function renderTiles(items) {
  const tiles = topics.map(({ label }, offset) => {
    const index = offset + 1;
    const type = resultType(items[index].status);
    const tile = node('li');
    const link = node('a', undefined, 'result-tile');
    link.href = '#result-item-' + index;
    link.dataset.status = type;
    link.setAttribute('aria-label', label + '、' + badges[type].label);
    link.append(topicIcon(index), node('span', label), node('strong', badges[type].mark, 'result-tile-mark'));
    link.addEventListener('click', event => {
      event.preventDefault();
      const item = byId('result-item-' + index);
      item.focus({ preventScroll: true });
      item.scrollIntoView({ block: 'start' });
    });
    tile.append(link);
    return tile;
  });
  byId('result-tiles').replaceChildren(...tiles);
}

function screen(current) {
  for (const id of ['entry', 'progress', 'result']) byId(id).hidden = id !== current;
}

function focusResult(heading) {
  screen('result');
  heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
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

function showGuidance(route, reviewCount = 0, unknownCount = 0) {
  const box = byId('guidance');
  box.replaceChildren();
  box.hidden = !route;
  if (!route) return;
  const text = copy.routes[route];
  const actions = node('div', undefined, 'scan-links');
  let headingText = text.見出し;
  let message = text.本文;
  if (route === 'social' && (reviewCount || unknownCount)) {
    headingText = reviewCount ? '気になる項目から見直しましょう' : '確認できた項目の結果です';
    const tip = 'お店のホームページを自分で直すコツは、X と Instagram で発信しています。';
    message = reviewCount ? '上の「見直したい項目」に、理由と自分でできる直し方をまとめました。' + tip : tip;
  }
  const heading = node('h2', headingText);
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
  box.append(heading);
  paragraphs(box, message, 'guidance-line');
  box.append(actions);
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
  const type = resultType(item.status);
  entry.dataset.status = type;
  entry.id = 'result-item-' + index;
  entry.tabIndex = -1;
  const { mark, label } = badges[type];
  const heading = node('h3');
  for (const part of description.titleParts || [description.title]) {
    if (heading.childNodes.length) heading.append(node('wbr'));
    heading.append(node('span', part, 'result-phrase'));
  }
  const badge = node('span', mark + ' ' + label, 'result-mark');
  badge.dataset.status = type;
  const header = node('div', undefined, 'result-check-heading');
  const pictogram = node('span', undefined, 'result-pictogram');
  pictogram.append(topicIcon(index));
  header.append(pictogram, heading, badge);
  entry.append(header);
  const text = description.entries[item.status];
  if (item.status === 'unknown') {
    const reason = item.reason === 'no_date' ? text?.line : reasons[item.reason];
    if (reason && (index > 2 || item.reason !== 'psi')) entry.append(node('p', reason, 'result-line'));
  } else if (text) {
    entry.append(node('p', formatLine(text.line, item), 'result-line'));
    if (!text.なぜ損か && !text.自分で直すなら) return entry;
    const details = node('details', undefined, 'result-details');
    details.append(node('summary', '理由と直し方'));
    for (const label of ['なぜ損か', '自分で直すなら']) {
      if (!text[label]) continue;
      const advice = node('div', undefined, 'result-advice');
      advice.dataset.part = label === '自分で直すなら' ? 'action' : 'reason';
      advice.append(node('strong', label));
      paragraphs(advice, text[label], 'advice-line');
      details.append(advice);
    }
    entry.append(details);
  }
  return entry;
}

function renderGroup(key, title, entries) {
  const group = node('section', undefined, 'result-group');
  group.dataset.group = key;
  group.append(node('h2', title));
  const list = node('ul', undefined, 'result-checks');
  for (const { description, item, index } of entries) {
    list.append(renderCheck(description, item, index));
  }
  group.append(list);
  return group;
}

function showResult(report, address) {
  const groups = { review: [], ok: [], unknown: [] };
  copy.items.forEach((description, index) => {
    const item = report.items[index + 1];
    const key = item.status === 'ok' || item.status === 'unknown' ? item.status : 'review';
    groups[key].push({ description, item, index: index + 1 });
  });
  groups.review.sort((a, b) => Number(b.item.status === 'fail') - Number(a.item.status === 'fail'));
  const total = groups.ok.length + groups.review.length;
  const best = [4, 5, 1, 3, 6, 7, 2, 8].find(index => report.items[index].status === 'ok');
  byId('result-heading').hidden = false;
  renderTiles(report.items);
  byId('score-value').textContent = total ? `${groups.ok.length} / ${total}` : '—';
  byId('score-label').hidden = !total;
  byId('score-note').textContent = total ? '確かめられた項目のみ集計' : '判定できた項目はありませんでした。';
  byId('review-count').textContent = groups.review.length + '項目';
  byId('unknown-count').textContent = groups.unknown.length + '項目';
  byId('praise').hidden = !best;
  if (best) byId('praise').textContent = praises[best] + 'はよくできています。';
  byId('scan-meta').textContent = address + '　' + new Date(report.checkedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const groupTitles = { review: '見直したい項目', ok: 'できている項目', unknown: '確認できなかった項目' };
  const sections = Object.entries(groups).filter(([, entries]) => entries.length);
  byId('checks').replaceChildren(...sections.map(([key, entries]) => renderGroup(key, groupTitles[key], entries)));
  robotsNotice.hidden = !report.robots;
  robotsNotice.textContent = total === 0 ? reasons.robots : robotsMeasuredMessage;
  byId('psi-notice').hidden = !report.psiUnavailable;
  byId('psi-notice').textContent = copy.errors.psi;
  byId('free-note').hidden = !report.free;
  byId('free-note').textContent = copy.free;
  byId('print').hidden = false;
  byId('reset').hidden = false;
  showGuidance(report.route, groups.review.length, groups.unknown.length);
  focusResult(byId('summary'));
}

function showError(code) {
  if (code in copy.errors && code !== 'psi') {
    screen('entry');
    byId('scan-error').textContent = copy.errors[code];
    byId('scan-error').hidden = false;
    input.focus();
    return;
  }
  byId('result-heading').hidden = true;
  byId('checks').replaceChildren();
  for (const id of ['robots-notice', 'psi-notice', 'free-note', 'print', 'reset']) byId(id).hidden = true;
  showGuidance('unreachable');
  focusResult(byId('guidance').querySelector('h2'));
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: address }),
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    const data = await response.json();
    if (data.error || !response.ok) showError(data.error);
    else showResult(data, data.url || address);
  } catch {
    showError(controller.signal.aborted ? 'timeout' : 'unreachable');
  } finally {
    clearTimeout(timeout);
    timers.forEach(clearTimeout);
  }
});
let openedForPrint = null;
window.addEventListener('beforeprint', () => {
  if (openedForPrint) return;
  openedForPrint = [...byId('checks').querySelectorAll('details:not([open])')];
  for (const details of openedForPrint) details.open = true;
});
window.addEventListener('afterprint', () => {
  for (const details of openedForPrint || []) details.open = false;
  openedForPrint = null;
});
byId('print').addEventListener('click', () => window.print());
byId('reset').addEventListener('click', reset);
form.querySelector('button').disabled = false;
