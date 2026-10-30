// 両サイト共通の動きと、横送りの直し。ページ本体のスクリプトのあとに読み込む。
// 通信はしない。動きを減らす設定では、動きは入れず、横送りなどの機能だけを整える。
(()=>{
'use strict';
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isArtist=!!document.querySelector('#works');
if(!reduced)root.classList.add('ink-on');
const SVGNS='http://www.w3.org/2000/svg';

// 画面に入ったら一度だけ呼ぶ。IntersectionObserver は1つだけ。
const once=new Map();
const io='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(e=>{
  if(!e.isIntersecting)return;const fns=once.get(e.target);if(fns){once.delete(e.target);io.unobserve(e.target);fns.forEach(fn=>fn(e.target));}
}),{threshold:.18,rootMargin:'0px 0px -6% 0px'}):null;
function onView(el,fn){if(!el)return;if(!io||reduced){fn(el);return;}const fns=once.get(el);if(fns){fns.push(fn);return;}once.set(el,[fn]);io.observe(el);}

// ---------- 最初の画面 ----------
const hero=document.querySelector('.school-hero,.artist-hero');
// 切り抜いた状態の写真は「見えていない」扱いになり、元の判定では2.5秒の保険まで出てこなかった。
// 最初の画面の要素は、読み込んですぐに出す。
if(hero)setTimeout(()=>hero.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')),reduced?0:250);
if(hero&&!reduced){
  const photo=hero.querySelector('.hero-photo,.hero-work-image');
  if(photo)setTimeout(()=>photo.classList.add('ink-kenburns'),900);
  const motes=document.createElement('div');motes.className='ink-motes';motes.setAttribute('aria-hidden','true');
  for(let i=0;i<8;i++){
    const m=document.createElement('i');m.className='ink-mote';
    const r=(a,b)=>a+Math.random()*(b-a);
    m.style.cssText=`--x:${r(4,92)}%;--y:${r(10,88)}%;--s:${r(6,22)}px;--t:${r(9,16)}s;--d:${-r(0,9)}s;--dx:${r(-60,60)}px;--dy:${r(-70,40)}px`;
    motes.append(m);
  }
  hero.prepend(motes);
  const cue=document.createElement('span');cue.className='ink-scroll-cue';cue.setAttribute('aria-hidden','true');hero.append(cue);
}

// ---------- セクションの境目の筆の線 ----------
const sections=Array.from(document.querySelectorAll('main > section')).filter(s=>s!==hero);
sections.forEach((sec,i)=>{
  const svg=document.createElementNS(SVGNS,'svg');svg.setAttribute('class','ink-divider');svg.setAttribute('viewBox','0 0 1200 26');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const a=i%2?'M8 18 C 260 4, 640 24, 1192 9':'M8 10 C 380 22, 760 2, 1192 16';
  const b=i%2?'M60 22 C 420 14, 820 20, 1140 14':'M40 16 C 400 24, 780 10, 1150 20';
  svg.innerHTML=`<path d="${a}" pathLength="1"/><path class="thin" d="${b}" pathLength="1"/>`;
  sec.prepend(svg);
  onView(svg,el=>el.classList.add('on'));
});

// ---------- 見出しの番号 ----------
document.querySelectorAll('.section-head').forEach(h=>onView(h,el=>el.classList.add('ink-head-on')));

// ---------- カード ----------
const cardSel=['.audience-card','.feature','.flow-grid > *','.fee-group','.room','.commission-grid > *','.shop-grid > *','.work-card','.ink-step','.review-row'].join(',');
const groups=new Map();
document.querySelectorAll(cardSel).forEach(card=>{
  if(card.closest('.ink-card'))return;
  card.classList.remove('reveal');card.classList.add('ink-card');
  const g=card.parentElement;const n=groups.get(g)||0;groups.set(g,n+1);
  card.style.setProperty('--ink-delay',(Math.min(n,5)*.09)+'s');
  onView(card,el=>el.classList.add('on'));
});

// ---------- 写真（最初の画面は除く） ----------
document.querySelectorAll('.photo-reveal').forEach(el=>{
  if(hero&&hero.contains(el))return;
  // 作品は切り抜かずに全体を見せる（台紙ごと浮き上がる動きだけ）
  if(el.closest('.work-card')){el.classList.remove('reveal','photo-reveal');return;}
  el.classList.remove('reveal','photo-reveal');el.classList.add('ink-photo');
  // 切り抜いた写真そのものは「見えていない」扱いになるので、外側の箱で判定する
  onView(el.parentElement||el,()=>el.classList.add('on'));
});

// ---------- 横送り：PC幅で送る物がないときは操作を隠す。1枚ずつ送る ----------
document.querySelectorAll('[data-carousel]').forEach(track=>{
  const prev=document.querySelector('[data-carousel-prev="'+track.id+'"]');
  const next=document.querySelector('[data-carousel-next="'+track.id+'"]');
  const controls=prev&&prev.closest('.carousel-controls');
  if(!prev||!next||!controls)return;
  const label=controls.querySelector('span');
  const left=document.createElement('div');left.className='ink-controls-left';
  const dots=document.createElement('div');dots.className='ink-dots';dots.setAttribute('aria-hidden','true');
  if(label){label.replaceWith(left);left.append(label,dots);}else controls.prepend(dots);
  const items=()=>Array.from(track.children).filter(c=>!c.hidden);
  const offsets=()=>{const base=track.getBoundingClientRect().left-track.scrollLeft;return items().map(c=>c.getBoundingClientRect().left-base);};
  function current(){const o=offsets();let best=0;o.forEach((x,i)=>{if(Math.abs(x-track.scrollLeft)<Math.abs(o[best]-track.scrollLeft))best=i;});return best;}
  function update(){
    const scrollable=track.scrollWidth>track.clientWidth+4;
    controls.classList.toggle('ink-none',!scrollable);
    const max=track.scrollWidth-track.clientWidth;
    prev.disabled=track.scrollLeft<=4;next.disabled=track.scrollLeft>=max-4;
    const n=items().length,c=next.disabled?n-1:current();
    if(dots.children.length!==n){dots.replaceChildren(...Array.from({length:n},()=>document.createElement('i')));}
    Array.from(dots.children).forEach((d,i)=>d.classList.toggle('on',i===c));
  }
  function go(step){
    const o=offsets(),i=Math.max(0,Math.min(o.length-1,current()+step));
    const target=Math.min(o[i],track.scrollWidth-track.clientWidth);
    const start=track.scrollLeft;
    track.scrollTo({left:target,behavior:reduced?'auto':'smooth'});
    setTimeout(()=>{if(Math.abs(track.scrollLeft-start)<2&&Math.abs(target-start)>2)track.scrollLeft=target;update();},450);
  }
  prev.onclick=()=>go(-1);next.onclick=()=>go(1);
  let t=0;track.addEventListener('scroll',()=>{cancelAnimationFrame(t);t=requestAnimationFrame(update);},{passive:true});
  addEventListener('resize',update);update();
  // 画面に入ったとき、一度だけ少し左に動いて戻り、横に送れることを知らせる
  if(!reduced)onView(track,el=>{if(el.scrollWidth>el.clientWidth+4)setTimeout(()=>items().forEach((c,i)=>c.animate([{transform:'translateX(0)'},{transform:'translateX(-34px)'},{transform:'translateX(0)'}],{duration:900,delay:500+i*40,easing:'cubic-bezier(.5,0,.3,1)'})),300);});
});

// ---------- 金額を数え上げる ----------
document.querySelectorAll('.fee-line dd').forEach(dd=>{
  const m=dd.textContent.match(/^([\d,]+)(.*)$/);if(!m)return;
  const end=parseInt(m[1].replace(/,/g,''),10),rest=m[2];
  dd.classList.add('ink-count');dd.setAttribute('aria-label',dd.textContent);
  if(reduced)return;
  const run=()=>{const t0=performance.now();const tick=now=>{const p=Math.min(1,(now-t0)/850),v=Math.round(end*(1-Math.pow(1-p,3)));dd.textContent=v.toLocaleString('ja-JP')+rest;if(p<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);};
  dd.textContent='0'+rest;
  // タブで隠れている金額は、表示されたときに数える
  const panel=dd.closest('[data-panel]');
  if(panel){new MutationObserver((_,obs)=>{if(!panel.hidden){obs.disconnect();onView(dd,run);}}).observe(panel,{attributes:true,attributeFilter:['hidden']});if(!panel.hidden)onView(dd,run);}
  else onView(dd,run);
});

// ---------- タブの切り替え：払うように入れ替わる ----------
if(!reduced)document.querySelectorAll('[data-tabs]').forEach(group=>{
  group.querySelectorAll('[data-tab]').forEach((b,i)=>b.addEventListener('click',()=>{
    const p=group.querySelector('[data-panel="'+i+'"]');if(!p)return;
    p.animate([{clipPath:'inset(0 100% 0 0)',transform:'translateX(24px)',opacity:.3},{clipPath:'inset(0 0 0 0)',transform:'none',opacity:1}],{duration:560,easing:'cubic-bezier(.3,.7,.2,1)'});
    p.querySelectorAll('.ink-card').forEach(c=>c.classList.add('on'));
  }));
});

// ---------- ボタンを押すと墨が広がる ----------
if(!reduced)document.addEventListener('pointerdown',e=>{
  const b=e.target.closest('.btn,.tab-list button,.filters button,.carousel-controls button,.quiet-button,[type=submit]');if(!b||b.disabled)return;
  const r=b.getBoundingClientRect();const s=document.createElement('span');s.className='ink-ripple';
  s.style.setProperty('--rx',(e.clientX-r.left)+'px');s.style.setProperty('--ry',(e.clientY-r.top)+'px');
  b.classList.add('ink-ripple-host');b.append(s);setTimeout(()=>s.remove(),720);
},{passive:true});

// ---------- フッターの署名 ----------
const footerWrap=document.querySelector('.footer .wrap');
if(footerWrap){
  const name=isArtist?'小出あかり':'あかり習字教室';
  const svg=document.createElementNS(SVGNS,'svg');svg.setAttribute('class','ink-sign');svg.setAttribute('viewBox',isArtist?'0 0 400 96':'0 0 520 96');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=`<text x="0" y="72">${name}</text><circle class="seal-dot" cx="${isArtist?352:488}" cy="40" r="11"/>`;
  footerWrap.prepend(svg);onView(svg,el=>el.classList.add('on'));
}

// ---------- 申し込み完了：墨の粒が散る ----------
function burst(from){
  if(reduced||!from)return;const r=from.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+Math.min(r.height/2,140);
  for(let i=0;i<18;i++){const d=document.createElement('i');d.className='ink-burst';const a=Math.random()*Math.PI*2,dist=80+Math.random()*140,s=.4+Math.random()*1.2;
    if(i%3===0)d.style.background='var(--red)';document.body.append(d);
    d.animate([{transform:`translate(${cx}px,${cy}px) scale(${s})`,opacity:.9},{transform:`translate(${cx+Math.cos(a)*dist}px,${cy+Math.sin(a)*dist+60}px) scale(${s*.4})`,opacity:0}],{duration:900+Math.random()*500,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>d.remove();}
}
['#booking-success','#artist-success'].forEach(sel=>{const el=document.querySelector(sel);if(!el)return;
  new MutationObserver(()=>{if(!el.hidden)setTimeout(()=>burst(el),250);}).observe(el,{attributes:true,attributeFilter:['hidden']});});

// ---------- 書体の比較（デモ用。Owner が書体を選ぶまでの仮の切り替え） ----------
const FONTS={
  a:{name:'今',serif:null,sans:null},
  b:{name:'くっきり',css:'Noto+Serif+JP:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700',serif:'"Noto Serif JP"',sans:'"Noto Sans JP"'},
  c:{name:'明朝',css:'Shippori+Mincho:wght@400;500;700',serif:'"Shippori Mincho"',sans:'"Shippori Mincho"'},
  d:{name:'筆文字の見出し',css:'Yuji+Syuku&family=Noto+Sans+JP:wght@400;500;700',serif:'"Yuji Syuku"',sans:'"Noto Sans JP"'},
  e:{name:'すべて筆文字',css:'Yuji+Syuku',serif:'"Yuji Syuku"',sans:'"Yuji Syuku"'}
};
function setFont(k){
  const f=FONTS[k]||FONTS.a;
  if(!f.css){root.removeAttribute('data-font');root.style.removeProperty('--serif');root.style.removeProperty('--ink-sans');}
  else{
    if(!document.querySelector('link[data-font="'+k+'"]')){const l=document.createElement('link');l.rel='stylesheet';l.dataset.font=k;l.href='https://fonts.googleapis.com/css2?family='+f.css+'&display=swap';document.head.append(l);}
    root.dataset.font=k;root.style.setProperty('--serif',f.serif);root.style.setProperty('--ink-sans',f.sans);
  }
  document.querySelectorAll('.ink-font-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.k===k)));
}
{
  const bar=document.createElement('div');bar.className='ink-font-switch';bar.setAttribute('role','group');bar.setAttribute('aria-label','書体の比較（デモ用）');
  bar.innerHTML='<span>書体</span>'+Object.keys(FONTS).map(k=>`<button type="button" data-k="${k}" title="${FONTS[k].name}">${k.toUpperCase()}</button>`).join('');
  bar.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setFont(b.dataset.k);});
  // 書体は E（すべて筆文字）に決定（2026-10-30 Owner）。比べたいときだけ URL に ?fonts を付けると切り替えが出る
  const params=new URLSearchParams(location.search);
  if(params.has('fonts'))document.body.append(bar);
  const k=params.has('fonts')?(params.get('font')||'e'):'e';
  setFont(FONTS[k]?k:'e');
}

window.inkMotion={onView,reduced,isArtist};
})();
