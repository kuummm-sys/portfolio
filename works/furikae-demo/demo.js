// 欠席連絡・振替デモ。画面の中だけで動く見本で、メールは送らない。
const shop = 'こもれび習字教室';
const desk = 'desk@example.test';
const parent = { name: '見本 はな', email: 'hana@example.test' };
const me = 's1';
const capacity = 6;
const fee = 7000;
const monthlyLimit = 2;
const windowDays = 28;
const today = '2027-01-10';
const lastDay = '2027-02-14';

const classes = {
  tue: { day: 2, time: '16:00', label: '火曜 16:00' },
  thu: { day: 4, time: '17:00', label: '木曜 17:00' },
  sat1: { day: 6, time: '10:00', label: '土曜 10:00' },
  sat2: { day: 6, time: '13:00', label: '土曜 13:00' },
};

const students = [
  ['s1', '見本 はる', '小学3年', 'tue'], ['s2', '青木 そら', '小学2年', 'tue'], ['s3', '石田 りん', '小学4年', 'tue'],
  ['s4', '上野 みお', '小学3年', 'tue'], ['s5', '大川 ゆう', '小学5年', 'tue'],
  ['s6', '加藤 れん', '小学1年', 'thu'], ['s7', '木村 あおい', '小学6年', 'thu'], ['s8', '小林 さく', '中学生', 'thu'],
  ['s9', '佐藤 ひな', '小学2年', 'thu'],
  ['s10', '杉山 こう', '小学4年', 'sat1'], ['s11', '高田 めい', '小学1年', 'sat1'], ['s12', '田中 ゆい', '小学3年', 'sat1'],
  ['s13', '中村 たくみ', '小学5年', 'sat1'], ['s14', '西田 ことは', '小学2年', 'sat1'], ['s15', '野口 はると', '小学6年', 'sat1'],
  ['s16', '原 いろは', '中学生', 'sat2'], ['s17', '藤井 そうた', '小学4年', 'sat2'], ['s18', '前田 ゆな', '小学3年', 'sat2'],
  ['s19', '松本 けい', '高校生以上', 'sat2'], ['s20', '森 あかり', '小学5年', 'sat2'],
].map(([id, name, grade, cls]) => ({ id, name, grade, cls }));
const byId = Object.fromEntries(students.map(student => [student.id, student]));

const reasons = ['体調不良', '学校の行事', '家の用事', 'その他'];

// ---------------------------------------------------------------- 日付
const toDate = day => new Date(`${day}T12:00:00Z`);
const dayOf = date => date.toISOString().slice(0, 10);
const addDays = (day, count) => { const date = toDate(day); date.setUTCDate(date.getUTCDate() + count); return dayOf(date); };
function label(key) {
  const [day, time] = key.split('T');
  const [, month, date] = day.split('-').map(Number);
  return `${month}月${date}日（${'日月火水木金土'[toDate(day).getUTCDay()]}）${time}`;
}
const shortDay = day => { const [, month, date] = day.split('-').map(Number); return `${month}月${date}日`; };

// 1月11日（月）からの5週分のレッスン枠。
const slots = [];
for (let day = '2027-01-11'; day <= lastDay; day = addDays(day, 1)) {
  const weekday = toDate(day).getUTCDay();
  for (const [cls, info] of Object.entries(classes)) {
    if (info.day === weekday) slots.push({ key: `${day}T${info.time}`, cls, day });
  }
}
slots.sort((a, b) => a.key.localeCompare(b.key));
const slotByKey = Object.fromEntries(slots.map(slot => [slot.key, slot]));
const weeks = [0, 1, 2, 3, 4].map(index => addDays('2027-01-11', index * 7));

// ---------------------------------------------------------------- 状態
const initialFees = { s7: false, s13: false, s18: false };
const state = {
  absences: [{ student: 's14', key: '2027-01-16T10:00' }, { student: 's9', key: '2027-01-21T17:00' }],
  makeups: [{ student: 's14', key: '2027-01-21T17:00' }],
  requests: [],
  notices: [],
  noticeSeen: 0,
  paid: Object.fromEntries(students.map(student => [student.id, initialFees[student.id] ?? true])),
  reminder: false,
  parentView: null,
  absenceForm: null,
  teacherTab: 'attendance',
  week: 0,
  changed: [],
};
let role = 'parent';

const panel = document.querySelector('#panel');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const envelope = '<svg aria-hidden="true" viewBox="0 0 24 18" width="20" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="22" height="16" rx="2"/><path d="m2 3 10 7 10-7"/></svg>';
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const isAbsent = (student, key) => state.absences.some(item => item.student === student && item.key === key);
function members(key) {
  const slot = slotByKey[key];
  const regular = students.filter(student => student.cls === slot.cls)
    .map(student => ({ student, kind: isAbsent(student.id, key) ? 'absent' : 'regular' }));
  const extra = state.makeups.filter(item => item.key === key).map(item => ({ student: byId[item.student], kind: 'makeup' }));
  return [...regular, ...extra];
}
const seated = key => members(key).filter(member => member.kind !== 'absent').length;
const usedMakeups = (student, month) => state.makeups.filter(item => item.student === student && item.key.startsWith(month)).length;

function mySchedule() {
  const regular = slots.filter(slot => slot.cls === byId[me].cls && slot.day >= today && slot.day < '2027-02-01')
    .map(slot => ({ key: slot.key, kind: isAbsent(me, slot.key) ? 'absent' : 'regular' }));
  const extra = state.makeups.filter(item => item.student === me).map(item => ({ key: item.key, kind: 'makeup' }));
  return [...regular, ...extra].sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------- 部品
function mail(title, to, subject, body, { open = false, footer = '', notice = false, fresh = false } = {}) {
  return `<details class="mail${notice ? ' notice' : ''}"${open ? ' open' : ''}>
    <summary>${envelope}<span>${title}</span>${fresh ? '<span class="notice-new">新着</span>' : ''}</summary>
    <div class="mail-paper"><p class="hint">宛先　${escape(to)}</p>
      <p><strong>${escape(subject)}</strong></p><pre>${escape(body)}</pre>${footer}</div>
  </details>`;
}

function absenceMail(request) {
  const month = request.absent.slice(0, 7);
  const left = monthlyLimit - usedMakeups(me, month);
  const guide = request.candidates.length
    ? `振替できるレッスンを、下のボタンから選べます。\n（欠席した日から4週間以内で、空きのあるレッスンです。${Number(month.slice(5))}月の振替はあと${left}回）`
    : request.noneReason;
  return {
    subject: `欠席のご連絡を受け付けました（${request.id}）`,
    body: `${parent.name} 様\n\n${byId[me].name} さんの欠席を受け付けました。\n\n欠席：${label(request.absent)}\n理由：${request.reason || '（なし）'}\n\n${guide}\n\n番号：${request.id}\n${shop}`,
  };
}

function confirmMail(request) {
  return {
    subject: `振替が決まりました（${request.id}）`,
    body: `${parent.name} 様\n\n${byId[me].name} さんの振替が決まりました。\n\n欠席：${label(request.absent)}\n振替：${label(request.answer)}\n持ち物：いつもの道具\n\n変更は ${desk} までご連絡ください。\n${shop}`,
  };
}

function noticeMail(notice) {
  const request = state.requests.find(item => item.id === notice.request);
  const student = `${byId[me].name} さん（${classes[byId[me].cls].label}）`;
  if (notice.type === 'absent') {
    return {
      title: '欠席の知らせ', subject: `欠席の連絡（${request.id}）`,
      body: `${student}から欠席の連絡がありました。\n\n欠席：${label(request.absent)}\n理由：${request.reason || '（なし）'}\n\n${request.candidates.length ? `振替の案内（${request.candidates.length}枠）を自動で送りました。` : '振替できる枠がないため、案内は送っていません。'}`,
    };
  }
  return {
    title: '振替の知らせ', subject: `${request.answer ? '振替の確定' : '振替なしの回答'}（${request.id}）`,
    body: request.answer
      ? `${student}の振替が決まりました。\n\n欠席：${label(request.absent)}\n振替：${label(request.answer)}\n\n出席表に反映しました。`
      : `${student}から「今回は振替しない」と回答がありました。\n\n欠席：${label(request.absent)}`,
  };
}

// ---------------------------------------------------------------- 保護者の画面
function scheduleHtml() {
  const rows = mySchedule().map(({ key, kind }) => {
    const form = state.absenceForm === key && kind === 'regular';
    const tag = kind === 'absent' ? '<span class="status" data-state="absent">欠席</span>'
      : kind === 'makeup' ? '<span class="status" data-state="makeup">振替</span>'
      : '<span class="status" data-state="regular">出席予定</span>';
    const fresh = state.changed.includes(key) ? ' row-updated' : '';
    const action = kind === 'regular' && !form ? `<button data-absent="${key}">休む</button>` : '';
    const absenceForm = form ? `<form id="absence" class="absence-form" data-key="${key}" novalidate>
        <label>理由（任意）<select name="reason"><option value="">選ばない</option>${reasons.map(reason => `<option>${reason}</option>`).join('')}</select></label>
        <div class="actions"><button class="primary" type="submit">欠席を連絡する</button><button type="button" data-cancel-absence>やめる</button></div>
      </form>` : '';
    return `<li class="lesson-row${fresh}" data-kind="${kind}"><div class="lesson-main"><b>${label(key)}</b>${tag}</div>${action}${absenceForm}</li>`;
  }).join('');
  const left = monthlyLimit - usedMakeups(me, '2027-01');
  return `<h3 id="panel-title">${byId[me].name} さんの予定（1月）</h3>
    <p class="hint">保護者のスマホの画面です。今日は1月10日（日）の想定です。</p>
    <p class="quota">1月の振替　あと <strong>${left}</strong> 回</p>
    <ul class="lessons">${rows}</ul>`;
}

function sentHtml(request) {
  const { subject, body } = absenceMail(request);
  const buttons = request.candidates.map((key, index) => {
    const left = capacity - seated(key);
    return `<button class="primary" data-answer="${index}">${escape(label(key))}に振り替える<small>（残り${left}席）</small></button>`;
  }).join('');
  const footer = request.candidates.length
    ? `<div class="reply-choices">${buttons}<button data-answer="none">今回は振替しない</button></div>` : '';
  return `<div class="ticket"><h3 id="panel-title">欠席を受け付けました</h3><p>番号 <strong>${request.id}</strong></p></div>
    <p class="hint">保護者に届くメールの見本です。ボタンは押せます。</p>
    ${mail('欠席の受付と振替の案内', parent.email, subject, body, { open: true, footer })}
    <div class="actions"><button data-go-teacher>先生への知らせを見る</button><button data-back-schedule>予定に戻る</button></div>`;
}

function replyHtml(view) {
  const request = state.requests.find(item => item.id === view.request);
  if (view.view === 'confirm') {
    const key = view.pending === 'none' ? null : request.candidates[Number(view.pending)];
    const message = key ? `${label(key)}に振り替えます。` : '今回は振替しないことを教室にお知らせします。';
    return `<section class="reply-card" aria-labelledby="panel-title">
      <p class="hint">保護者の回答画面（メールのボタンを押した先）</p>
      <h3 id="panel-title">振替の回答</h3><p>${escape(message)}</p>
      <div class="actions"><button class="primary" data-reply-submit>この内容で回答する</button><button data-mail-again>メールに戻る</button></div>
    </section>`;
  }
  if (view.view === 'used') {
    return `<section class="reply-card" aria-labelledby="panel-title">
      <p class="hint">保護者の回答画面</p>
      <h3 id="panel-title">このリンクは使えません</h3>
      <p>すでに回答済みか、有効期限を過ぎています。教室に直接ご連絡ください。</p>
      <div class="actions"><button class="primary" data-back-schedule>予定に戻る</button><button data-mail-again>メールに戻る</button></div>
    </section>`;
  }
  if (view.view === 'full') {
    return `<section class="reply-card" aria-labelledby="panel-title">
      <p class="hint">保護者の回答画面</p>
      <h3 id="panel-title">この枠は埋まりました</h3>
      <p>ほかの方の振替で満席になりました。メールに戻って、ほかのレッスンを選んでください。</p>
      <div class="actions"><button class="primary" data-mail-again>メールに戻る</button></div>
    </section>`;
  }
  const confirmed = request.answer;
  const mailHtml = confirmed ? (() => { const { subject, body } = confirmMail(request); return mail('振替の確定メールの見本', parent.email, subject, body, { open: true }); })() : '';
  return `<section class="reply-card" aria-labelledby="panel-title">
      <p class="hint">保護者の回答画面</p>
      <h3 id="panel-title">${confirmed ? '振替が決まりました' : '回答を受け付けました'}</h3>
      <p>${confirmed ? `<strong>${escape(label(confirmed))}</strong>` : '今回は振替しません。回答は教室にも届きます。'}</p>
    </section>
    ${mailHtml}
    <div class="actions"><button class="primary" data-go-teacher>先生の出席表を見る</button><button data-back-schedule>予定に戻る</button><button data-mail-again>メールに戻る</button></div>`;
}

function parentHtml() {
  const view = state.parentView;
  if (!view) return scheduleHtml();
  const request = state.requests.find(item => item.id === view.request);
  return view.view === 'mail' ? sentHtml(request) : replyHtml(view);
}

// ---------------------------------------------------------------- 先生の画面
function slotHtml(slot, changed) {
  const list = members(slot.key);
  const count = seated(slot.key);
  const left = capacity - count;
  const names = list.map(({ student, kind }) => `<li data-kind="${kind}"${state.changed.includes(slot.key) && student.id === me ? ' class="name-updated"' : ''}>
      <span>${escape(student.name)}</span>${kind === 'absent' ? '<em>欠席</em>' : kind === 'makeup' ? '<em>振替</em>' : ''}</li>`).join('');
  return `<article class="slot${changed ? ' slot-updated' : ''}" aria-label="${escape(label(slot.key))}">
    <header><b>${escape(label(slot.key))}</b><span class="seats${left === 0 ? ' full' : ''}"><strong>${count}</strong>/${capacity}</span></header>
    <div class="seat-bar" aria-hidden="true"><i style="--fill:${count / capacity}"></i></div>
    <p class="seat-left">${left === 0 ? '満席' : `空き ${left}席`}</p>
    <ul class="names">${names}</ul>
  </article>`;
}

function attendanceHtml(motion) {
  const start = weeks[state.week];
  const end = addDays(start, 6);
  const weekSlots = slots.filter(slot => slot.day >= start && slot.day <= end);
  const latest = state.notices.at(-1);
  const fresh = latest && state.noticeSeen !== state.notices.length;
  const noticeHtml = latest ? (() => {
    const { title, subject, body } = noticeMail(latest);
    return mail(`${title}（先生あてのメール見本）`, desk, subject, body, { open: true, notice: true, fresh });
  })() : '<p class="hint empty-note">保護者の画面で「休む」を押すと、ここに知らせが届きます。</p>';
  state.noticeSeen = state.notices.length;
  const changedHere = motion === 'teacher';
  return `${noticeHtml}
    <section aria-labelledby="week-title" class="week">
      <div class="week-head">
        <button data-week="-1" aria-label="前の週"${state.week === 0 ? ' disabled' : ''}>←</button>
        <h4 id="week-title">${shortDay(start)}〜${end.slice(5, 7) === start.slice(5, 7) ? `${Number(end.slice(8))}日` : shortDay(end)}<span>の出席表</span></h4>
        <button data-week="1" aria-label="次の週"${state.week === weeks.length - 1 ? ' disabled' : ''}>→</button>
      </div>
      <div class="slots">${weekSlots.map(slot => slotHtml(slot, changedHere && state.changed.includes(slot.key))).join('')}</div>
      <p class="hint">定員は各${capacity}名。欠席で空いた席は、ほかの生徒の振替先として案内されます。</p>
    </section>`;
}

function feesHtml(motion) {
  const unpaid = students.filter(student => !state.paid[student.id]);
  const rows = students.map(student => {
    const paid = state.paid[student.id];
    const updated = motion === 'paid' && state.lastPaid === student.id ? ' status-updated' : '';
    return `<tr><th scope="row">${escape(student.name)}</th><td>${classes[student.cls].label}</td>
      <td><span class="status${updated}" data-state="${paid ? 'paid' : 'unpaid'}">${paid ? '入金済み' : '未入金'}</span></td>
      <td>${paid ? '' : `<button data-pay="${student.id}">入金を記録</button>`}</td></tr>`;
  }).join('');
  const reminder = state.reminder && unpaid.length
    ? mail(`お知らせメールの見本（${unpaid.length}名に送る想定）`, unpaid.map(student => `${student.name} さんの保護者`).join('、'),
      '1月分の月謝のご確認のお願い',
      `（保護者のお名前） 様\n\nいつもありがとうございます。\n1月分の月謝（${fee.toLocaleString()}円）のお振り込みが、まだ確認できていません。\n行き違いでしたら、ご容赦ください。\n\n${shop}`, { open: true })
    : '';
  return `<div class="fee-summary"><p>1月分の月謝　<strong>${fee.toLocaleString()}円</strong></p>
      <p>入金済み <strong>${students.length - unpaid.length}名</strong>　未入金 <strong class="${unpaid.length ? 'warn' : ''}">${unpaid.length}名</strong></p></div>
    ${unpaid.length ? '<div class="actions"><button class="primary" data-remind>未入金の方へのお知らせを作る</button></div>' : '<p class="all-paid">全員の入金を確認しました。</p>'}
    ${reminder}
    <div class="fee-table-wrap"><table class="fee-table"><caption class="hint">生徒ごとの1月分の状況（架空の名前です）</caption>
      <thead><tr><th scope="col">生徒</th><th scope="col">クラス</th><th scope="col">状況</th><th scope="col"><span class="visually-hidden">操作</span></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

function teacherHtml(motion) {
  const tabs = [['attendance', '出席表'], ['fees', '月謝']].map(([key, text]) =>
    `<button data-tab="${key}" aria-pressed="${state.teacherTab === key}">${text}</button>`).join('');
  return `<h3 id="panel-title">先生の画面</h3>
    <div class="switch tabs" role="group" aria-label="先生の画面の切り替え">${tabs}</div>
    <div class="tab-body">${state.teacherTab === 'attendance' ? attendanceHtml(motion) : feesHtml(motion)}</div>`;
}

// ---------------------------------------------------------------- 描画
function render(motion = '', direction = 1) {
  document.querySelector('#roles').innerHTML =
    `<button data-role="parent" aria-pressed="${role === 'parent'}">保護者</button><button data-role="teacher" aria-pressed="${role === 'teacher'}">先生</button>`;
  document.querySelector('#guide').textContent = role === 'parent'
    ? (state.parentView ? 'メールのボタンから、振替のレッスンを選べます。' : '「休む」から欠席を連絡すると、振替できるレッスンがメールで届きます。')
    : '知らせを確かめ、出席表と月謝の状況を見られます。';
  panel.dataset.motion = motion;
  panel.style.setProperty('--shift', `${18 * direction}px`);
  panel.innerHTML = `<div class="panel-content">${role === 'parent' ? parentHtml() : teacherHtml(motion)}</div>`;
}

function focusTitle(selector = '#panel-title') {
  const heading = panel.querySelector(selector);
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: false });
}

function switchRole(next, motion) {
  role = next;
  render(motion ?? 'switch', next === 'teacher' ? 1 : -1);
  focusTitle();
}

function weekOf(key) {
  const day = key.slice(0, 10);
  const index = weeks.findLastIndex(start => start <= day);
  return Math.max(0, index);
}

// ---------------------------------------------------------------- 動作
function submitAbsence(form) {
  const key = form.dataset.key;
  if (!key || isAbsent(me, key)) return;
  const reason = reasons.includes(form.elements.reason.value) ? form.elements.reason.value : '';
  state.absences.push({ student: me, key });
  const month = key.slice(0, 7);
  const left = monthlyLimit - usedMakeups(me, month);
  const until = addDays(key.slice(0, 10), windowDays);
  const candidates = left > 0 ? slots.filter(slot => slot.key > key && slot.day <= until && slot.cls !== byId[me].cls
    && seated(slot.key) < capacity && !state.makeups.some(item => item.student === me && item.key === slot.key))
    .slice(0, 4).map(slot => slot.key) : [];
  const noneReason = left > 0
    ? '4週間以内に空きのあるレッスンがないため、今回は振替のご案内ができません。'
    : `${Number(month.slice(5))}月の振替（月${monthlyLimit}回まで）を使い切っているため、今回は振替できません。`;
  const request = { id: `K-${String(state.requests.length + 1).padStart(3, '0')}`, absent: key, reason, candidates, noneReason, status: '未回答', answer: null };
  state.requests.push(request);
  state.notices.push({ type: 'absent', request: request.id });
  state.changed = [key];
  state.week = weekOf(key);
  state.absenceForm = null;
  state.parentView = { view: 'mail', request: request.id };
  render('receipt');
  focusTitle();
}

function answer(value) {
  const view = state.parentView;
  const request = state.requests.find(item => item.id === view?.request);
  if (!request || view.view !== 'mail') return;
  if (request.status !== '未回答') {
    state.parentView = { view: 'used', request: request.id };
  } else {
    state.parentView = { view: 'confirm', request: request.id, pending: value };
  }
  render('reply');
  focusTitle();
}

function submitReply() {
  const view = state.parentView;
  const request = state.requests.find(item => item.id === view?.request);
  if (!request || view.view !== 'confirm') return;
  if (request.status !== '未回答') {
    state.parentView = { view: 'used', request: request.id };
    render('reply');
    focusTitle();
    return;
  }
  const key = view.pending === 'none' ? null : request.candidates[Number(view.pending)];
  if (key && seated(key) >= capacity) {
    state.parentView = { view: 'full', request: request.id };
    render('reply');
    focusTitle();
    return;
  }
  request.status = key ? '振替確定' : '振替なし';
  request.answer = key;
  if (key) state.makeups.push({ student: me, key });
  state.notices.push({ type: 'reply', request: request.id });
  state.changed = key ? [request.absent, key] : [request.absent];
  state.week = weekOf(key ?? request.absent);
  state.parentView = { view: 'result', request: request.id };
  render('reply');
  focusTitle();
}

function showRipple(button, event) {
  if (reducedMotion.matches) return;
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'intake-ripple';
  ripple.setAttribute('aria-hidden', 'true');
  const circle = document.createElement('span');
  circle.addEventListener('animationend', () => ripple.remove(), { once: true });
  ripple.append(circle);
  Object.assign(ripple.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  ripple.style.setProperty('--ripple-x', `${event.detail ? event.clientX - rect.left : rect.width / 2}px`);
  ripple.style.setProperty('--ripple-y', `${event.detail ? event.clientY - rect.top : rect.height / 2}px`);
  ripple.style.setProperty('--ripple-size', `${2 * Math.hypot(rect.width, rect.height)}px`);
  ripple.style.setProperty('--ripple-ink', button.matches('.primary,[aria-pressed=true]') ? '#fff' : '#2b59d1');
  document.body.append(ripple);
}

document.querySelector('.intake-main').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button && !button.disabled) showRipple(button, event);
});

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !panel.closest('.desk').contains(button)) return;
  const { dataset } = button;
  if (dataset.role) {
    if (dataset.role !== role) switchRole(dataset.role, dataset.role === 'teacher' ? 'teacher' : 'switch');
  } else if ('goTeacher' in dataset) {
    state.teacherTab = 'attendance';
    switchRole('teacher', 'teacher');
  } else if (dataset.absent) {
    state.absenceForm = dataset.absent;
    state.changed = [];
    render('form');
    panel.querySelector('#absence select')?.focus();
  } else if ('cancelAbsence' in dataset) {
    state.absenceForm = null;
    render('');
    focusTitle();
  } else if ('backSchedule' in dataset) {
    state.parentView = null;
    render('switch', -1);
    focusTitle();
  } else if ('mailAgain' in dataset) {
    state.parentView = { view: 'mail', request: state.parentView.request };
    render('reply');
    focusTitle();
  } else if ('answer' in dataset) {
    answer(dataset.answer);
  } else if ('replySubmit' in dataset) {
    submitReply();
  } else if (dataset.tab) {
    if (dataset.tab === state.teacherTab) return;
    state.teacherTab = dataset.tab;
    render('tab', dataset.tab === 'fees' ? 1 : -1);
    panel.querySelector(`[data-tab="${dataset.tab}"]`)?.focus();
  } else if (dataset.week) {
    const next = Math.min(weeks.length - 1, Math.max(0, state.week + Number(dataset.week)));
    if (next === state.week) return;
    state.week = next;
    render('week-move', Number(dataset.week));
    const target = panel.querySelector(`[data-week="${dataset.week}"]`);
    (target && !target.disabled ? target : panel.querySelector('#week-title'))?.focus();
  } else if (dataset.pay) {
    state.paid[dataset.pay] = true;
    state.lastPaid = dataset.pay;
    if (students.every(student => state.paid[student.id])) state.reminder = false;
    render('paid');
    panel.querySelector('.fee-summary')?.setAttribute('tabindex', '-1');
    panel.querySelector('.fee-summary')?.focus({ preventScroll: true });
  } else if ('remind' in dataset) {
    state.reminder = true;
    render('remind');
    panel.querySelector('.mail summary')?.focus();
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (!panel.contains(form)) return;
  event.preventDefault();
  if (form.id === 'absence') submitAbsence(form);
});

render();

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    entry.target.dataset.entrance = '';
    observer.disconnect();
  });
  observer.observe(document.querySelector('#desk'));
}
