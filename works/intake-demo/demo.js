import templates from './mail-templates.js';

const contact = [
  { key: 'name', label: 'お名前', example: '見本 はな', max: 100 },
  { key: 'email', label: 'メールアドレス', type: 'email', example: 'hana@example.test', max: 254 },
];

const lesson = {
  title: '体験レッスン', shop: 'こもれび習字教室', prefix: 'T',
  fields: [
    { key: 'room', label: '教室', options: ['駅前教室', '公園前教室'], example: '駅前教室' },
    { key: 'grade', label: '学年', options: ['小学1年', '小学2年', '小学3年', '小学4年', '小学5年', '小学6年', '中学生', '高校生以上'], example: '小学3年' },
    { key: 'first', label: '第1希望', type: 'datetime-local', example: '2027-01-16T10:00' },
    { key: 'second', label: '第2希望', type: 'datetime-local', example: '2027-01-17T13:00' },
    ...contact,
  ],
  ack: '体験レッスンのお申し込みを受け付けました。教室からの連絡で日程が確定します。',
  actions: [
    { label: '第1希望で確定', status: '確定', subject: '体験レッスンの日程が確定しました', dateKey: 'first' },
    { label: '第2希望で確定', status: '確定', subject: '体験レッスンの日程が確定しました', dateKey: 'second' },
    { label: '別日を提案', proposal: true },
  ],
};

const quote = {
  title: '見積もり相談', shop: 'みずき住まい相談室', prefix: 'Q',
  fields: [
    { key: 'message', label: '相談内容', type: 'textarea', example: '玄関の収納を増やしたいです。今ある棚を活かせるか相談したいです。', max: 2000 },
    { key: 'area', label: '地域（市区町村）', example: '架空市 西町', max: 100 },
    { key: 'timing', label: '希望時期', options: ['1か月以内', '3か月以内', '半年以内', '未定'], example: '3か月以内' },
    ...contact,
  ],
  ack: '見積もりのご相談を受け付けました。2営業日以内を目安にご連絡します。\nご相談内容の確認 → 必要に応じて相談日や現地確認の調整 → お見積もりの提示、の順で進みます。',
  actions: [
    { label: '相談日を案内', button: '相談日の案内を作る', status: '相談日案内済み', subject: 'ご相談日のご案内', prompt: '案内する日時', type: 'datetime-local', example: '2027-01-20T14:00',
      message: date => `次の日時にオンラインでご相談を承ります。ご都合を返信でお知らせください。\n\n相談日時：${date}` },
    { label: '追加情報を依頼', button: '追加情報の依頼文を作る', status: '追加情報待ち', subject: 'お見積もりに必要な追加情報のお願い', prompt: '依頼する情報', type: 'textarea', example: '収納を設けたい場所の幅・奥行きと、差し支えなければ現状が分かる写真をお送りください。',
      message: text => `お見積もりの準備のため、次の情報を返信でお知らせください。\n\n${text}` },
  ],
};

const cases = { lesson, quote };
const state = Object.fromEntries(Object.keys(cases).map(key => [key, {
  records: [], receipt: null, selected: null, draft: {}, noticeSeen: null, proposalView: null,
}]));
let kind = 'lesson';
let role = 'applicant';

const panel = document.querySelector('#panel');
const current = () => state[kind];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const envelope = '<svg aria-hidden="true" viewBox="0 0 24 18" width="20" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="22" height="16" rx="2"/><path d="m2 3 10 7 10-7"/></svg>';

// User input is inserted into HTML only after escaping. Mail remains plain text.
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function display(field, value) {
  if (field.type !== 'datetime-local') return value;
  const [day, time] = value.split('T');
  const date = new Date(day + 'T12:00:00Z');
  const [year, month, dateOfMonth] = day.split('-').map(Number);
  const weekday = '日月火水木金土'[date.getUTCDay()];
  return `${year}年${month}月${dateOfMonth}日（${weekday}）${time}`;
}

function activate(target) {
  const heading = panel.querySelector(target);
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}

function fieldsHtml(config, draft) {
  return config.fields.map(field => {
    const { key, label, options, type = 'text', max = 200 } = field;
    const value = draft[key] ?? '';
    const control = options
      ? `<select name="${key}" required><option value="">選んでください</option>${options.map(option =>
        `<option${value === option ? ' selected' : ''}>${escape(option)}</option>`).join('')}</select>`
      : type === 'textarea'
        ? `<textarea name="${key}" required maxlength="${max}" rows="4">${escape(value)}</textarea>`
        : `<input name="${key}" type="${type}" required ${type === 'datetime-local' ? 'max="9999-12-31T23:59"' : `maxlength="${max}"`} value="${escape(value)}">`;
    return `<label class="${type === 'textarea' ? 'wide' : ''}">${label}${control}</label>`;
  }).join('');
}

function mail(title, to, subject, body, { open = false, footer = '', notice = false, fresh = false } = {}) {
  return `<details class="mail${notice ? ' notice' : ''}"${open ? ' open' : ''}>
    <summary>${envelope}<span>${title}</span>${fresh ? '<span class="notice-new">新着</span>' : ''}</summary>
    <div class="mail-paper"><p class="hint">宛先　${escape(to)}</p>
      <p><strong>${escape(subject)}</strong></p><pre>${escape(body)}</pre>${footer}</div>
  </details>`;
}

function statusHtml(record, changed = false) {
  const state = record.status === '未対応' ? 'pending' : record.status === '確定' ? 'confirmed' : 'proposed';
  return `<span class="status${changed ? ' status-updated' : ''}" data-state="${state}">${record.status}</span>`;
}

function summary(config, record) {
  return config.fields.map(field => [field.label, display(field, record.values[field.key])]);
}

function receiptBody(template, config, record) {
  const fields = summary(config, record).map(([label, value]) =>
    `${label}：${value.includes('\n') ? '\n' : ''}${value}`).join('\n');
  const replacements = { name: record.values.name, intro: config.ack, id: record.id, fields, shop: config.shop };
  return template.replace(/\{([a-z]+)\}/g, (_, key) => replacements[key]);
}

function receiptHtml(config, record) {
  const body = receiptBody(templates.customer, config, record);
  return `<div class="ticket"><h3 id="receipt">受け付けました</h3><p>受付番号 <strong>${record.id}</strong></p></div>
    <dl>${summary(config, record).map(([label, value]) => `<dt>${label}</dt><dd>${escape(value)}</dd>`).join('')}</dl>
    ${mail('自動返信の見本', record.values.email, `受付のお知らせ（${record.id}）`, body, { open: true })}
    <div class="actions"><button class="primary" data-go-staff>担当者の通知を見る</button><button data-new>もう一件試す</button></div>`;
}

function applicantHtml(config, data) {
  if (data.proposalView) return proposalHtml(data.proposalView);
  if (data.receipt) return receiptHtml(config, data.receipt);
  return `<h3 id="panel-title">${config.title}の申し込み</h3>
    <p class="hint">すべて必須です。実在する個人情報は入力せず、見本の情報でお試しください。</p>
    <form id="application" novalidate>
      <div class="actions"><button type="button" data-fill>見本を入力</button></div>
      <div class="fields">${fieldsHtml(config, data.draft)}</div>
      <p class="error" role="alert"></p>
      <div><button class="primary" type="submit">申し込む</button></div>
    </form>`;
}

function proposalHtml({ record, view, pending }) {
  const { proposal } = record;
  if (view === 'confirm') {
    const date = pending === 'none' ? null : proposal.dates[Number(pending)];
    const message = date ? `${dateLabel(date)}で確定します。` : 'どの候補も合わないことをお店にお知らせします。';
    return `<section class="reply-card" aria-labelledby="panel-title">
      <p class="hint">申込者の回答画面（メールのボタンを押した先）</p>
      <h3 id="panel-title">日程の回答</h3>
      <p>${escape(message)}</p>
      <div class="actions"><button class="primary" data-reply-submit>この内容で回答する</button><button data-proposal-mail>提案メールに戻る</button></div>
    </section>`;
  }
  if (view !== 'mail') {
    const title = view === 'used' ? 'このリンクは使えません'
      : !proposal.answer ? '回答を受け付けました'
      : proposal.answer.includes('T') ? '日時が確定しました' : '日程が確定しました';
    const message = view === 'used' ? 'すでに回答済みか、有効期限を過ぎています。お店に直接ご連絡ください。' : '回答はお店にも共有されます。';
    return `<section class="reply-card" aria-labelledby="panel-title">
      <p class="hint">申込者の回答画面</p>
      <h3 id="panel-title">${title}</h3>
      <p>${message}</p>
      ${view === 'result' && proposal.answer ? `<p><strong>${escape(dateLabel(proposal.answer))}</strong></p>` : ''}
      <div class="actions"><button class="primary" data-go-staff>担当者への知らせを見る</button><button data-proposal-mail>提案メールに戻る</button><button data-back-to-form>申込画面に戻る</button></div>
    </section>`;
  }

  const buttons = proposal.dates.map((date, index) =>
    `<button class="primary" data-answer="${index}">${escape(dateLabel(date))}で確定する</button>`).join('');
  return `<h3 id="panel-title">申込者に届いた提案メール</h3>
    ${mail('提案メールの見本', record.values.email, proposal.mail.subject, proposal.mail.body, {
      open: true, footer: `<div class="reply-choices">${buttons}<button data-answer="none">どれも合わない</button></div>`,
    })}
    <div class="actions"><button data-back-to-form>申込画面に戻る</button></div>`;
}

function detailHtml(config, record, changed) {
  const { proposal } = record;
  if (record.status === '提案中') {
    return `<section class="detail" aria-labelledby="record-title"><h3 id="record-title">${record.id} の対応</h3>
      <p>${statusHtml(record, changed)}</p>
      ${mail('提案メールの見本', record.values.email, proposal.mail.subject, proposal.mail.body, {
        open: true, footer: '<div class="actions"><button class="primary" data-proposal-mail>申込者に届いたメールを開く</button></div>',
      })}</section>`;
  }

  const replyNotice = proposal?.notice
    ? mail('担当者への回答通知の見本', 'desk@example.test', proposal.notice.subject, proposal.notice.body, { open: true })
    : '';
  if (record.response) {
    const { subject, body } = record.response;
    return `<section class="detail" aria-labelledby="record-title"><h3 id="record-title">${record.id} の対応</h3>
      <p>${statusHtml(record, changed)}</p>${replyNotice}${mail(record.status === '確定' ? '確定メールの見本' : '案内メールの見本', record.values.email, subject, body, { open: true })}</section>`;
  }
  return `<section class="detail" aria-labelledby="record-title"><h3 id="record-title">${record.id} の対応</h3>
    ${replyNotice}<dl>${summary(config, record).map(([label, value]) => `<dt>${label}</dt><dd>${escape(value)}</dd>`).join('')}</dl>
    <div class="actions">${config.actions.map((action, index) => `<button data-action="${index}"${index === 0 ? ' class="primary"' : ''}>${action.label}</button>`).join('')}</div>
    <div id="action-form"></div></section>`;
}

function staffHtml(config, data, motion) {
  if (!data.records.length) return '<h3 id="panel-title">担当者の受付画面</h3><p>受付はまだありません。<button data-applicant>申込者に切り替える</button></p>';
  const newest = data.records.at(-1);
  const selected = data.records.find(record => record.id === data.selected);
  const fresh = data.noticeSeen !== newest.id;
  const changed = motion === 'respond' || motion === 'reply-staff';
  const pending = data.records.filter(record => record.status === '未対応').length;
  const notification = mail('担当者への通知メールの見本', 'desk@example.test', `新しい${config.title}の受付（${newest.id}）`,
    receiptBody(templates.staff, config, newest), {
      open: !selected, notice: true, fresh,
      footer: `<button class="primary" data-open="${newest.id}">${newest.id} の申込を開く</button>`,
    });
  data.noticeSeen = newest.id;
  return `<h3 id="panel-title">担当者の受付画面</h3>
    ${notification}
    ${selected ? detailHtml(config, selected, changed) : ''}
    <section aria-labelledby="list-heading"><div class="records-head"><h3 id="list-heading">対応状況の一覧</h3><p>未対応 <strong>${pending}件</strong></p></div>
      <ul class="records">${[...data.records].reverse().map(record =>
        `<li><button data-open="${record.id}">${record.id} の詳細</button>${statusHtml(record, changed && selected === record)}</li>`).join('')}</ul>
    </section>`;
}

function render(motion = '', direction = 1) {
  document.querySelector('#cases').innerHTML = Object.entries(cases).map(([key, config]) =>
    `<button data-case="${key}" aria-pressed="${kind === key}">${config.title}</button>`).join('');
  document.querySelector('#roles').innerHTML =
    `<button data-role="applicant" aria-pressed="${role === 'applicant'}">申込者</button><button data-role="staff" aria-pressed="${role === 'staff'}">担当者</button>`;
  document.querySelector('#guide').textContent = role === 'applicant'
    ? (current().proposalView ? '提案メールのボタンから日程を回答できます。' : '申し込むと受付番号と自動返信が表示されます。')
    : '通知から申込を開き、次の対応を選んでください。';
  const config = cases[kind];
  panel.dataset.motion = motion;
  panel.style.setProperty('--shift', `${18 * direction}px`);
  panel.innerHTML = `<div class="panel-content">${role === 'applicant' ? applicantHtml(config, current()) : staffHtml(config, current(), motion)}</div>`;
}

function saveDraft() {
  const form = document.querySelector('#application');
  if (form) current().draft = Object.fromEntries(new FormData(form));
}

function switchRole(next) {
  saveDraft();
  const motion = next === role ? '' : next === 'staff'
    ? (current().proposalView?.view === 'result' ? 'reply-staff' : 'staff')
    : 'switch';
  role = next;
  render(motion, next === 'staff' ? 1 : -1);
  activate('#panel-title, #receipt');
}

function validationError(form, input, message) {
  form.querySelector('[role="alert"]').textContent = message;
  form.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

// The static demo follows form-kit's required, select and mail formatting rules.
function readFields(form, fields) {
  const values = {};
  for (const field of fields) {
    const input = form.elements[field.key];
    let value = input.value.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    if (field.type !== 'textarea') value = value.replaceAll('\n', ' ');
    if (!value || !input.validity.valid || (field.options && !field.options.includes(value))) {
      validationError(form, input, `${field.label}を${field.options ? '選んで' : '正しく入力して'}ください。`);
      return null;
    }
    values[field.key] = value;
  }
  return values;
}

function submitApplication(form) {
  const data = current();
  if (data.receipt) return;
  const config = cases[kind];
  const values = readFields(form, config.fields);
  if (!values) return;
  if (kind === 'lesson' && values.first === values.second) {
    validationError(form, form.elements.second, '第2希望には、第1希望と異なる日時を入力してください。');
    return;
  }
  const record = {
    id: `${config.prefix}-${String(data.records.length + 1).padStart(3, '0')}`,
    values, status: '未対応', response: null,
  };
  data.records.push(record);
  data.receipt = record;
  data.selected = null;
  data.draft = {};
  render('receipt');
  activate('#receipt');
}

const dateLabel = value => display({ type: 'datetime-local' }, value);

function demoMail(template, record, values) {
  const substitutions = {
    id: record.id, name: record.values.name, shop: lesson.shop, contact: 'desk@example.test',
    ...values,
  };
  return Object.fromEntries(Object.entries(template).map(([key, text]) => [
    key, text.replace(/\{([a-z_]+)\}/g, (match, token) => substitutions[token] ?? match),
  ]));
}

function confirmationMail(record, date) {
  const place = record.values.room === '駅前教室'
    ? '架空市 駅前1-2 こもれび会館 2階' : '架空市 公園通り3-4 みどり会館 1階';
  return demoMail(templates.confirmed, record, { date: dateLabel(date), place: `${record.values.room}（${place}）` });
}

function respond(record, action, extra = '') {
  if (!record || record.status !== '未対応') return;
  const config = cases[kind];
  record.response = action.dateKey
    ? confirmationMail(record, record.values[action.dateKey])
    : {
      subject: `${action.subject}（${record.id}）`,
      body: `${record.values.name} さま\n\n${action.message(display(action, extra))}\n\n${config.shop}`,
    };
  record.status = action.status;
  render('respond');
  activate('#record-title');
}

const proposalFields = ['第1候補', '第2候補', '第3候補'];
const proposalExamples = ['2027-01-23T10:00', '2027-01-24T13:00'];

function propose(form, record) {
  if (!record || record.status !== '未対応') return;
  const dates = [];
  const requested = [record.values.first, record.values.second];
  for (const [index, label] of proposalFields.entries()) {
    const input = form.elements[`choice${index}`];
    if (!input.validity.valid) {
      validationError(form, input, `${label}を正しく入力してください。`);
      return;
    }
    if (!input.value) continue;
    if (dates.includes(input.value) || requested.includes(input.value)) {
      validationError(form, input, '希望日時やほかの候補と異なる日時を入力してください。');
      return;
    }
    dates.push(input.value);
  }
  if (!dates.length) {
    validationError(form, form.elements.choice0, '候補日時を1つ以上入力してください。');
    return;
  }
  record.proposal = { dates, mail: demoMail(templates.proposed, record, { choices: dates.map(dateLabel).join('\n') }) };
  record.status = '提案中';
  current().proposalView = { record, view: 'mail' };
  render('respond');
  activate('#record-title');
}

function answerProposal(answer) {
  const view = current().proposalView;
  const record = view?.record;
  if (role !== 'applicant' || view?.view !== 'mail' || !record?.proposal) return;
  current().selected = record.id;
  if (record.status !== '提案中') {
    view.view = 'used';
  } else {
    if (answer !== 'none' && record.proposal.dates[Number(answer)] === undefined) return;
    view.view = 'confirm';
    view.pending = answer;
  }
  render('reply');
  activate('#panel-title');
}

function submitReply() {
  const view = current().proposalView;
  const record = view?.record;
  if (role !== 'applicant' || view?.view !== 'confirm' || !record?.proposal) return;
  const { proposal } = record;
  if (record.status !== '提案中') {
    view.view = 'used';
  } else {
    const date = view.pending === 'none' ? null : proposal.dates[Number(view.pending)];
    proposal.answer = date;
    proposal.notice = demoMail(templates.staffReply, record, {
      date: date ? dateLabel(date) : 'どれも合わない', admin_url: '受付の詳細は下の一覧から確認できます。',
    });
    record.status = date ? '確定' : '未対応';
    record.response = date ? confirmationMail(record, date) : null;
    view.view = 'result';
  }
  render('reply');
  activate('#panel-title');
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
  Object.assign(ripple.style, {
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  });
  ripple.style.setProperty('--ripple-x', `${event.detail ? event.clientX - rect.left : rect.width / 2}px`);
  ripple.style.setProperty('--ripple-y', `${event.detail ? event.clientY - rect.top : rect.height / 2}px`);
  ripple.style.setProperty('--ripple-size', `${2 * Math.hypot(rect.width, rect.height)}px`);
  ripple.style.setProperty('--ripple-ink', button.matches('.primary,[aria-pressed=true]') ? '#fff' : '#2b59d1');
  document.body.append(ripple);
}

document.querySelector('.intake-main').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) showRipple(button, event);
});

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const { dataset } = button;
  if (dataset.case) {
    saveDraft();
    const changed = kind !== dataset.case;
    kind = dataset.case;
    render(changed ? 'switch' : '', kind === 'quote' ? 1 : -1);
    document.querySelector('#cases [aria-pressed="true"]').focus();
  } else if (dataset.role || 'applicant' in dataset || 'goStaff' in dataset) {
    switchRole(dataset.role ?? ('goStaff' in dataset ? 'staff' : 'applicant'));
  } else if ('proposalMail' in dataset) {
    const data = current();
    const record = role === 'staff' ? data.records.find(item => item.id === data.selected) : data.proposalView?.record;
    if (!record?.proposal) return;
    data.proposalView = { record, view: 'mail' };
    switchRole('applicant');
  } else if ('backToForm' in dataset) {
    current().proposalView = null;
    render('switch');
    activate('#panel-title, #receipt');
  } else if ('answer' in dataset) {
    answerProposal(dataset.answer);
  } else if ('replySubmit' in dataset) {
    submitReply();
  } else if ('new' in dataset) {
    current().receipt = null;
    render('new');
    activate('#panel-title');
  } else if ('fill' in dataset) {
    const form = document.querySelector('#application');
    for (const field of cases[kind].fields) form.elements[field.key].value = field.example;
    form.querySelector('[role="alert"]').textContent = '';
    form.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
  } else if (dataset.open) {
    current().selected = dataset.open;
    render('open');
    activate('#record-title');
  } else if ('action' in dataset) {
    const record = current().records.find(item => item.id === current().selected);
    const action = cases[kind].actions[Number(dataset.action)];
    if (!record || record.status !== '未対応' || !action) return;
    if (action.proposal) {
      const controls = proposalFields.map((label, index) =>
        `<label>${label}<input name="choice${index}" type="datetime-local" max="9999-12-31T23:59" value="${proposalExamples[index] ?? ''}"></label>`).join('');
      document.querySelector('#action-form').innerHTML = `<form id="response" data-propose data-id="${record.id}" novalidate>
        <p class="hint">候補日時を1〜3つ入力してください。</p><div class="fields">${controls}</div>
        <p class="error" role="alert"></p>
        <div><button class="primary" type="submit">別日の案内を作る</button></div></form>`;
      document.querySelector('#response [name="choice0"]').focus();
      return;
    }
    if (!action.prompt) {
      respond(record, action);
      return;
    }
    const control = action.type === 'textarea'
      ? `<textarea name="extra" rows="3" required maxlength="1000">${escape(action.example)}</textarea>`
      : `<input name="extra" type="${action.type}" max="9999-12-31T23:59" value="${escape(action.example)}" required>`;
    document.querySelector('#action-form').innerHTML = `<form id="response" data-action="${dataset.action}" data-id="${record.id}" novalidate>
      <label>${action.prompt}${control}</label><p class="error" role="alert"></p>
      <div><button class="primary" type="submit">${action.button}</button></div></form>`;
    document.querySelector('#response [name="extra"]').focus();
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (!panel.contains(form)) return;
  event.preventDefault();
  if (form.id === 'application') {
    submitApplication(form);
  } else if (form.id === 'response') {
    const record = current().records.find(item => item.id === form.dataset.id);
    if ('propose' in form.dataset) {
      propose(form, record);
      return;
    }
    const action = cases[kind].actions[Number(form.dataset.action)];
    const values = readFields(form, [{ key: 'extra', label: action.prompt, type: action.type }]);
    if (!values) return;
    respond(record, action, values.extra);
  }
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
