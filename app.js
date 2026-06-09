
const DATA = window.DIVA_DATA;
const STORE_KEY = 'diva2-webapp-state-v1';

const defaultState = () => {
  const s = {
    tab: 'start',
    viewMode: 'single',
    symptomIndex: 0,
    meta: { name:'', dob:'', gender:'', date:new Date().toISOString().slice(0,10), interviewer:'', patientNo:'' },
    symptoms: {},
    supplements: { oAdult:null, oChild:null, hiAdult:null, hiChild:null },
    onset: { lifelong:null, age:'' },
    dysfunction: { adult:{}, child:{}, adult2plus:null, child2plus:null, notes:'' },
    result: {
      criteriaE:'notset', explainedBy:'',
      parentSource:'', parentSupport:'notset',
      partnerSource:'', partnerSupport:'notset',
      schoolSupport:'notset',
      diagnosis:'notset', subtype:'notset', notes:''
    }
  };
  DATA.symptoms.forEach(item => {
    s.symptoms[item.code] = {
      adult: { present:null, examples:{}, other:'' },
      child: { present:null, examples:{}, other:'' },
      notes:''
    };
  });
  ['adult','child'].forEach(phase => {
    Object.entries(DATA.dysfunction[phase]).forEach(([cat, arr]) => {
      s.dysfunction[phase][cat] = { items:{}, other:'' };
    });
  });
  return s;
};

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    const base = defaultState();
    if(!raw) return base;
    const saved = JSON.parse(raw);
    return mergeDeep(base, saved);
  }catch(e){ return defaultState(); }
}
function mergeDeep(target, source){
  if(!source || typeof source !== 'object') return target;
  Object.keys(source).forEach(key => {
    if(source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])){
      target[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  });
  return target;
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function checked(v){ return v ? 'checked' : ''; }
function active(a,b){ return a===b ? 'active' : ''; }
function phaseLabel(phase){ return phase === 'adult' ? 'Voksenalderen' : 'Barndommen'; }
function yesNo(v){ return v === true ? 'Ja' : v === false ? 'Nej' : 'Ikke vurderet'; }
function radioButtons(value, path, labels=[['true','Ja','yes'],['false','Nej','no'],['null','Ikke vurderet','maybe']]){
  return `<div class="segment">${labels.map(([val,txt,cls]) => `<button type="button" class="choice ${cls} ${active(String(value), val)}" data-radio="${esc(path)}" data-value="${val}">${txt}</button>`).join('')}</div>`;
}
function setByPath(obj, path, value){
  const parts = path.split('.');
  let cur = obj;
  for(let i=0;i<parts.length-1;i++){ cur = cur[parts[i]]; }
  const last = parts[parts.length-1];
  if(value === 'true') cur[last] = true;
  else if(value === 'false') cur[last] = false;
  else if(value === 'null') cur[last] = null;
  else cur[last] = value;
}
function getCounts(){
  const counts = { oAdult:0, oChild:0, hiAdult:0, hiChild:0, oTotal:9, hiTotal:9 };
  DATA.symptoms.forEach(item => {
    const isO = item.code.startsWith('O');
    if(state.symptoms[item.code]?.adult?.present === true) counts[isO?'oAdult':'hiAdult']++;
    if(state.symptoms[item.code]?.child?.present === true) counts[isO?'oChild':'hiChild']++;
  });
  return counts;
}
function selectedCategoryCount(phase){
  let n = 0;
  Object.values(state.dysfunction[phase]).forEach(cat => {
    if(Object.values(cat.items).some(Boolean) || (cat.other || '').trim()) n++;
  });
  return n;
}
function selectedItemCountForCat(phase, cat){
  const entry = state.dysfunction[phase][cat];
  return Object.values(entry.items).filter(Boolean).length + ((entry.other||'').trim()?1:0);
}
function subtypeSuggestion(){
  const c = getCounts();
  const adultO = c.oAdult >= 6;
  const adultHI = c.hiAdult >= 6;
  if(adultO && adultHI) return 'Kombineret';
  if(adultO) return 'Overvejende uopmærksom';
  if(adultHI) return 'Overvejende hyperaktiv/impulsiv';
  return 'Ingen subtypeforslag ud fra ≥ 6 i voksenalderen';
}

function render(){
  const app = document.getElementById('app');
  const c = getCounts();
  app.innerHTML = `
    <div class="hero no-print">
      <div class="hero-inner">
        <div class="brand">
          <div class="logo">D2</div>
          <div>
            <h1>DIVA 2.0 webapp</h1>
            <p>Diagnostisk interview til ADHD hos voksne - lokal, mobilvenlig udfyldning</p>
          </div>
        </div>
        <div class="hero-actions">
          <button class="icon-btn" type="button" data-modal="patient">Info til patient</button>
          <button class="icon-btn hide-mobile" type="button" data-modal="guide">Vejledning</button>
          <button class="primary-btn" type="button" data-copy-summary>Kopiér resultat</button>
        </div>
      </div>
    </div>
    <main class="app-shell">
      <div class="kpi-row">
        <div class="kpi"><strong>${c.oAdult}/9</strong><span>Opmærksomhed - voksen</span></div>
        <div class="kpi"><strong>${c.oChild}/9</strong><span>Opmærksomhed - barn</span></div>
        <div class="kpi"><strong>${c.hiAdult}/9</strong><span>H/I - voksen</span></div>
        <div class="kpi"><strong>${c.hiChild}/9</strong><span>H/I - barn</span></div>
      </div>
      ${state.tab === 'start' ? renderStart() : ''}
      ${state.tab === 'o' ? renderSymptomSection('Opmærksomhedsforstyrrelse') : ''}
      ${state.tab === 'hi' ? renderSymptomSection('Hyperaktivitet/Impulsivitet') : ''}
      ${state.tab === 'dys' ? renderDysfunction() : ''}
      ${state.tab === 'result' ? renderResult() : ''}
      <p class="footer-note">DIVA 2.0 webapp v1.0 · Oplysninger gemmes kun lokalt i browseren · Klinisk støtteværktøj, ikke en selvstændig diagnosemaskine</p>
    </main>
    ${renderNav()}
  `;
}
function renderNav(){
  const items = [
    ['start','⌂','Start'], ['o','O','Del 1'], ['hi','H/I','Del 2'], ['dys','◇','Dysf.'], ['result','✓','Resultat']
  ];
  return `<nav class="nav-bottom no-print"><div class="nav-inner">${items.map(([id,ico,label]) => `<button class="nav-btn ${active(state.tab,id)}" type="button" data-tab="${id}"><span>${ico}</span>${label}</button>`).join('')}</div></nav>`;
}
function renderStart(){
  return `
    <section class="card">
      <h2>Start</h2>
      <p class="muted">Udfyld patientoplysninger, brug popup'en med patientinformationen før interviewet, og gå derefter igennem Del 1, Del 2 og dysfunktion. Alt gemmes automatisk lokalt i browseren.</p>
      <div class="grid three">
        ${field('Patientens navn','meta.name',state.meta.name,'text')}
        ${field('Fødselsdato','meta.dob',state.meta.dob,'date')}
        <div class="field"><label>Køn</label><select data-input="meta.gender"><option value="">Ikke angivet</option><option ${state.meta.gender==='M'?'selected':''} value="M">M</option><option ${state.meta.gender==='K'?'selected':''} value="K">K</option><option ${state.meta.gender==='Andet'?'selected':''} value="Andet">Andet/ikke relevant</option></select></div>
        ${field('Dato','meta.date',state.meta.date,'date')}
        ${field('Navn på interviewer','meta.interviewer',state.meta.interviewer,'text')}
        ${field('Patientnummer','meta.patientNo',state.meta.patientNo,'text')}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px" class="no-print">
        <button class="primary-btn" type="button" data-modal="patient">Vis information til patienten</button>
        <button class="ghost-btn" type="button" data-modal="guide">Vis kort vejledning</button>
        <button class="ghost-btn" type="button" data-export-json>Eksportér JSON</button>
        <button class="danger-btn" type="button" data-reset>Nulstil</button>
      </div>
    </section>
    <section class="card">
      <h2>Sådan er den bygget</h2>
      <div class="grid two">
        <div class="notice"><strong>Interviewflow</strong><br>Alle 18 DSM-IV-kriterier kan udfyldes for både voksenalder og barndom. Eksempler kan markeres, og selve symptomet vurderes separat med Ja/Nej.</div>
        <div class="notice"><strong>Popup til information</strong><br>Patientinformationen fra originalen ligger som en knap/popup, så den kan læses op uden at fylde hele skærmen.</div>
        <div class="notice"><strong>Resultat</strong><br>Appen tæller O og H/I automatisk og samler kriterierne i en resultatside. Den foreslår ikke en klinisk diagnose uden din vurdering.</div>
        <div class="notice"><strong>Data</strong><br>Der er ingen server. Data ligger i localStorage på den enhed/browser, hvor appen bruges.</div>
      </div>
    </section>
  `;
}
function field(label,path,value,type='text'){
  return `<div class="field"><label>${esc(label)}</label><input type="${type}" value="${esc(value)}" data-input="${esc(path)}"></div>`;
}
function renderSymptomSection(sectionName){
  const sectionItems = DATA.symptoms.filter(x => x.section === sectionName);
  const globalStart = DATA.symptoms.findIndex(x => x.section === sectionName);
  const localIndex = Math.max(0, Math.min(sectionItems.length-1, state.symptomIndex - globalStart));
  const shown = state.viewMode === 'all' ? sectionItems : [sectionItems[localIndex]];
  const progress = Math.round(((localIndex+1)/sectionItems.length)*100);
  const isO = sectionName.startsWith('Opm');
  return `
    <section class="section-title no-print">
      <div>
        <h2>${isO ? 'Del 1: Opmærksomhedsforstyrrelse' : 'Del 2: Hyperaktivitet/Impulsivitet'}</h2>
        <p class="muted small">Vurder både voksenalderen og barndommen. Markering af eksempler er støtte - selve Ja/Nej på symptomet er det, der tælles.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <div class="progress-wrap" title="Fremskridt"><div class="progress-bar" style="width:${state.viewMode==='all'?100:progress}%"></div></div>
        <button class="ghost-btn" type="button" data-view-mode>${state.viewMode === 'all' ? 'Vis ét punkt' : 'Vis alle'}</button>
      </div>
    </section>
    ${state.viewMode === 'single' ? renderPager(sectionItems, localIndex, globalStart) : ''}
    ${shown.map(renderSymptomCard).join('')}
    ${isO ? renderSupplement('oAdult','oChild','opmærksomhedsforstyrrelse') : renderSupplement('hiAdult','hiChild','hyperaktivitet/impulsivitet')}
    ${state.viewMode === 'single' ? renderPager(sectionItems, localIndex, globalStart) : ''}
  `;
}
function renderPager(sectionItems, localIndex, globalStart){
  const idx = globalStart + localIndex;
  return `<div class="card compact no-print" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
    <button class="ghost-btn" type="button" data-goto-index="${Math.max(globalStart, idx-1)}" ${localIndex===0?'disabled':''}>← Forrige</button>
    <strong>${localIndex+1} / ${sectionItems.length}</strong>
    <button class="primary-btn" type="button" data-goto-index="${Math.min(globalStart+sectionItems.length-1, idx+1)}" ${localIndex===sectionItems.length-1?'disabled':''}>Næste →</button>
  </div>`;
}
function renderSymptomCard(item){
  const st = state.symptoms[item.code];
  return `<section class="card symptom-card">
    <div class="symptom-head">
      <div class="code-badge">${esc(item.display)}<small>${esc(item.dsm)}</small></div>
      <div style="flex:1">
        <div class="pill blue">${esc(item.part)} · ${esc(item.section)}</div>
        <p class="question">${esc(item.question)}</p>
        ${item.note ? `<p class="muted small">${esc(item.note)}</p>` : ''}
      </div>
    </div>
    <div class="grid two">
      ${renderPhase(item, 'adult', st.adult)}
      ${renderPhase(item, 'child', st.child)}
    </div>
    <div class="field" style="margin-top:12px"><label>Noter til kriteriet</label><textarea data-input="symptoms.${item.code}.notes" placeholder="Kort klinisk note, eksempel eller kilde...">${esc(st.notes)}</textarea></div>
  </section>`;
}
function renderPhase(item, phase, st){
  const examples = item[phase];
  return `<div class="phase-card">
    <div class="phase-title">
      <h3>${phaseLabel(phase)}</h3>
      ${st.present === true ? '<span class="pill green">Tælles</span>' : st.present === false ? '<span class="pill red">Tælles ikke</span>' : '<span class="pill">Ikke vurderet</span>'}
    </div>
    <div class="check-list">
      ${examples.map((txt, idx) => `<label class="check-row"><input type="checkbox" data-example="${item.code}.${phase}.${idx}" ${checked(st.examples[idx])}><span>${esc(txt)}</span></label>`).join('')}
    </div>
    <div class="field"><label>Andet</label><input type="text" value="${esc(st.other)}" data-input="symptoms.${item.code}.${phase}.other" placeholder="Andet eksempel..."></div>
    <div style="margin-top:12px"><label class="small" style="font-weight:850;color:#344054">Er symptomet til stede?</label>${radioButtons(st.present, `symptoms.${item.code}.${phase}.present`)}</div>
  </div>`;
}
function renderSupplement(adultKey, childKey, label){
  const qAdult = `Har patienten ovennævnte symptomer på ${label} i højere grad eller oftere end andre?`;
  const qChild = `Havde patienten tidligere ovennævnte symptomer på ${label} i højere grad eller oftere end jævnaldrende?`;
  return `<section class="card">
    <h2>Supplement til kriterium A</h2>
    <div class="grid two">
      <div class="phase-card"><h3>I voksenalderen</h3><p>${esc(qAdult)}</p>${radioButtons(state.supplements[adultKey], `supplements.${adultKey}`)}</div>
      <div class="phase-card"><h3>I barndommen</h3><p>${esc(qChild)}</p>${radioButtons(state.supplements[childKey], `supplements.${childKey}`)}</div>
    </div>
  </section>`;
}
function renderDysfunction(){
  const adultCount = selectedCategoryCount('adult');
  const childCount = selectedCategoryCount('child');
  return `<section class="card">
    <h2>Del 3: Dysfunktion og symptomernes opståen</h2>
    <p class="muted">Kriterium B, C og D. Appen tæller automatisk, hvor mange livsområder der er markeret, men Ja/Nej-vurderingen står separat, så din kliniske vurdering ikke bliver overstyret.</p>
    <div class="grid two">
      <div class="phase-card">
        <h3>Kriterium B</h3>
        <p>Har patienten haft ovennævnte symptomer på opmærksomhedsforstyrrelse og/eller hyperaktivitet/impulsivitet altid?</p>
        ${radioButtons(state.onset.lifelong, 'onset.lifelong', [['true','Ja, før 7 år','yes'],['false','Nej','no'],['null','Ikke vurderet','maybe']])}
        <div class="field" style="margin-top:12px"><label>Hvis nej: Symptomerne begyndte ved alder</label><input type="text" value="${esc(state.onset.age)}" data-input="onset.age" placeholder="fx 12 år"></div>
      </div>
      <div class="phase-card">
        <h3>Kriterium C/D</h3>
        <p><strong>Voksenalderen:</strong> ${adultCount} livsområder markeret. <br><strong>Barndommen:</strong> ${childCount} livsområder markeret.</p>
        <div class="grid two">
          <div><label class="small" style="font-weight:850">Dysfunktion i ≥ 2 forhold i voksenalderen?</label>${radioButtons(state.dysfunction.adult2plus, 'dysfunction.adult2plus')}</div>
          <div><label class="small" style="font-weight:850">Dysfunktion i ≥ 2 forhold i barndommen?</label>${radioButtons(state.dysfunction.child2plus, 'dysfunction.child2plus')}</div>
        </div>
      </div>
    </div>
  </section>
  <section class="card"><h2>I voksenalderen</h2>${renderDysPhase('adult')}</section>
  <section class="card"><h2>I barndommen</h2>${renderDysPhase('child')}</section>
  <section class="card"><div class="field"><label>Eventuelle bemærkninger</label><textarea data-input="dysfunction.notes">${esc(state.dysfunction.notes)}</textarea></div></section>`;
}
function renderDysPhase(phase){
  return Object.entries(DATA.dysfunction[phase]).map(([cat, items]) => {
    const selected = selectedItemCountForCat(phase, cat);
    return `<div class="category-card"><h3><span>${esc(cat)}</span><span>${selected} markeret</span></h3>
      <div class="check-list">${items.map((txt, idx) => `<label class="check-row"><input type="checkbox" data-dys-item="${phase}|${esc(cat)}|${idx}" ${checked(state.dysfunction[phase][cat].items[idx])}><span>${esc(txt)}</span></label>`).join('')}</div>
      <div class="field"><label>Andet</label><input type="text" value="${esc(state.dysfunction[phase][cat].other)}" data-dys-other="${phase}|${esc(cat)}" placeholder="Andet..."></div>
    </div>`;
  }).join('');
}
function renderResult(){
  const c = getCounts();
  const adultDys = selectedCategoryCount('adult');
  const childDys = selectedCategoryCount('child');
  return `<section class="card">
    <h2>Sammenfatning af symptomerne O og H/I</h2>
    <div style="overflow:auto">
    <table class="table">
      <thead><tr><th>Kriterium</th><th>Symptom</th><th>Voksenalderen</th><th>Barndommen</th></tr></thead>
      <tbody>
        ${DATA.symptoms.filter(x=>x.code.startsWith('O')).map(item => rowSummary(item)).join('')}
        <tr class="total"><td colspan="2">Antal opfyldte kriterier i alt, Opmærksomhedsforstyrrelse</td><td>${c.oAdult} / 9</td><td>${c.oChild} / 9</td></tr>
        ${DATA.symptoms.filter(x=>x.code.startsWith('HI')).map(item => rowSummary(item)).join('')}
        <tr class="total"><td colspan="2">Antal opfyldte kriterier i alt, Hyperaktivitet/Impulsivitet</td><td>${c.hiAdult} / 9</td><td>${c.hiChild} / 9</td></tr>
      </tbody>
    </table>
    </div>
  </section>
  <section class="card">
    <h2>Resultatformular</h2>
    <div class="result-box">
      ${resultRow('DSM-IV kriterium A', `I barndommen: O ≥ 6 = <strong>${c.oChild>=6?'Ja':'Nej'}</strong>, H/I ≥ 6 = <strong>${c.hiChild>=6?'Ja':'Nej'}</strong><br>I voksenalderen: O ≥ 6 = <strong>${c.oAdult>=6?'Ja':'Nej'}</strong>, H/I ≥ 6 = <strong>${c.hiAdult>=6?'Ja':'Nej'}</strong>`, 'Automatisk ud fra markerede symptomer')}
      ${resultRow('DSM-IV kriterium B', 'Er der tegn på et livsvarigt mønster af symptomer og dysfunktion?', radioButtons(state.onset.lifelong, 'onset.lifelong'))}
      ${resultRow('DSM-IV kriterium C og D', `Symptomerne og dysfunktionen ses i mindst 2 forhold i livet.<br><span class="muted small">Markerede områder: voksen ${adultDys}, barn ${childDys}</span>`, `<div class="grid two"><div><strong>Voksen</strong>${radioButtons(state.dysfunction.adult2plus, 'dysfunction.adult2plus')}</div><div><strong>Barn</strong>${radioButtons(state.dysfunction.child2plus, 'dysfunction.child2plus')}</div></div>`)}
      ${resultRow('DSM-IV kriterium E', 'Symptomerne kan ikke forklares bedre med en anden psykisk lidelse', renderCriteriaE())}
    </div>
    <div class="warn" style="margin-top:12px">Bemærk: Den originale resultatformular nævner, at studier har vist, at ADHD i voksenalderen kan stilles ved fire eller flere symptomer på uopmærksomhed og/eller hyperaktivitet/impulsivitet. Appen viser DSM-IV ≥ 6 automatisk og overlader klinisk vurdering til intervieweren.</div>
  </section>
  <section class="card">
    <h2>Anamnese og dokumentation</h2>
    <div class="grid two">
      <div class="field"><label>Forældre/bror/søster/anden</label><input type="text" value="${esc(state.result.parentSource)}" data-input="result.parentSource"><label class="small">Understøtter</label>${supportButtons('parentSupport')}</div>
      <div class="field"><label>Partner/god ven(inde)/anden</label><input type="text" value="${esc(state.result.partnerSource)}" data-input="result.partnerSource"><label class="small">Understøtter</label>${supportButtons('partnerSupport')}</div>
      <div class="field"><label>Skriftlige udtalelser fra skolen</label>${supportButtons('schoolSupport')}</div>
      <div class="field"><label>Bemærkninger</label><textarea data-input="result.notes">${esc(state.result.notes)}</textarea></div>
    </div>
  </section>
  <section class="card">
    <h2>ADHD diagnose</h2>
    <p class="muted">Dette felt er manuelt. Appens subtypeforslag er kun en teknisk opsummering af voksenscoren: <strong>${esc(subtypeSuggestion())}</strong>.</p>
    <div class="grid two">
      <div><label class="small" style="font-weight:850">ADHD diagnose</label>${radioButtons(state.result.diagnosis, 'result.diagnosis', [['false','Nej','no'],['true','Ja','yes'],['null','Ikke vurderet','maybe']])}</div>
      <div><label class="small" style="font-weight:850">Undertype</label><select data-input="result.subtype"><option value="notset">Ikke valgt</option><option ${state.result.subtype==='combined'?'selected':''} value="combined">314.01 Kombineret</option><option ${state.result.subtype==='inattentive'?'selected':''} value="inattentive">314.00 Overvejende uopmærksom</option><option ${state.result.subtype==='hyper'?'selected':''} value="hyper">314.01 Overvejende hyperaktiv/impulsiv</option></select></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px" class="no-print">
      <button class="primary-btn" type="button" data-copy-summary>Kopiér resultat</button>
      <button class="ghost-btn" type="button" data-print>Print/gem som PDF</button>
      <button class="ghost-btn" type="button" data-export-json>Eksportér JSON</button>
    </div>
  </section>`;
}
function rowSummary(item){
  const st = state.symptoms[item.code];
  return `<tr><td><strong>${esc(item.dsm)}</strong></td><td><strong>${esc(item.display)}.</strong> ${esc(item.question.split('?')[0])}</td><td>${yesNo(st.adult.present)}</td><td>${yesNo(st.child.present)}</td></tr>`;
}
function resultRow(left, mid, right){ return `<div class="result-row"><div><strong>${left}</strong><br>${mid}</div><div>${right}</div></div>`; }
function supportButtons(key){
  return `<div class="segment">
    ${['notset','na','0','1','2'].map(v => `<button type="button" class="choice ${active(state.result[key], v)}" data-support="${key}" data-value="${v}">${v==='notset'?'Ikke valgt':v==='na'?'Ikke relevant':v}</button>`).join('')}
  </div>`;
}
function renderCriteriaE(){
  return `<div class="segment"><button type="button" class="choice ${active(state.result.criteriaE,'no')}" data-criteria-e="no">Nej</button><button type="button" class="choice ${active(state.result.criteriaE,'yes')}" data-criteria-e="yes">Jo, med</button><button type="button" class="choice ${active(state.result.criteriaE,'notset')}" data-criteria-e="notset">Ikke vurderet</button></div>
  <input style="margin-top:8px" type="text" value="${esc(state.result.explainedBy)}" data-input="result.explainedBy" placeholder="Hvis jo, med...">`;
}

function openModal(kind){
  const root = document.getElementById('modalRoot');
  let title = kind === 'patient' ? 'Information til patienten før interviewet' : 'Kort vejledning til intervieweren';
  let body = kind === 'patient' ? DATA.patientInfo : DATA.interviewerInfo;
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close-modal>Luk</button></div><div class="modal-body"><p>${esc(body)}</p></div></div>`;
  root.classList.add('open'); root.setAttribute('aria-hidden','false');
}
function closeModal(){ const root=document.getElementById('modalRoot'); root.classList.remove('open'); root.setAttribute('aria-hidden','true'); root.innerHTML=''; }
function toast(msg){
  const el = document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(), 2200);
}
function summaryText(){
  const c = getCounts();
  const meta = state.meta;
  const lines = [];
  lines.push('DIVA 2.0 - sammenfatning');
  lines.push(`Patient: ${meta.name || 'ikke angivet'}${meta.patientNo ? ' ('+meta.patientNo+')' : ''}`);
  lines.push(`Dato: ${meta.date || ''}`);
  lines.push(`Interviewer: ${meta.interviewer || ''}`);
  lines.push('');
  lines.push(`Opmærksomhedsforstyrrelse: voksenalder ${c.oAdult}/9, barndom ${c.oChild}/9.`);
  lines.push(`Hyperaktivitet/impulsivitet: voksenalder ${c.hiAdult}/9, barndom ${c.hiChild}/9.`);
  lines.push(`Kriterium B livsvarigt mønster: ${yesNo(state.onset.lifelong)}${state.onset.age ? ' (debutalder: '+state.onset.age+')' : ''}.`);
  lines.push(`Dysfunktion ≥2 forhold: voksenalder ${yesNo(state.dysfunction.adult2plus)} (${selectedCategoryCount('adult')} markerede områder), barndom ${yesNo(state.dysfunction.child2plus)} (${selectedCategoryCount('child')} markerede områder).`);
  lines.push(`Kriterium E: ${state.result.criteriaE === 'no' ? 'Kan ikke forklares bedre med anden psykisk lidelse' : state.result.criteriaE === 'yes' ? 'Kan muligvis forklares bedre med: ' + (state.result.explainedBy || '') : 'Ikke vurderet'}.`);
  lines.push(`Teknisk subtypeforslag ud fra voksenscoren: ${subtypeSuggestion()}.`);
  lines.push(`ADHD-diagnose manuelt markeret: ${state.result.diagnosis === 'true' || state.result.diagnosis === true ? 'Ja' : state.result.diagnosis === 'false' || state.result.diagnosis === false ? 'Nej' : 'Ikke vurderet'}.`);
  if(state.result.notes) lines.push(`Bemærkninger: ${state.result.notes}`);
  return lines.join('\n');
}
function exportJson(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (state.meta.name || 'diva').toLowerCase().replace(/[^a-z0-9æøå]+/gi,'-').replace(/^-|-$/g,'') || 'diva';
  a.href = url; a.download = `${name}-diva-2-0.json`; a.click();
  URL.revokeObjectURL(url);
}

function handleClick(e){
  const t = e.target.closest('button'); if(!t) return;
  if(t.dataset.tab){ state.tab=t.dataset.tab; save(); render(); window.scrollTo(0,0); return; }
  if(t.dataset.modal){ openModal(t.dataset.modal); return; }
  if(t.dataset.closeModal !== undefined){ closeModal(); return; }
  if(t.dataset.radio){ setByPath(state, t.dataset.radio, t.dataset.value); save(); render(); return; }
  if(t.dataset.support){ state.result[t.dataset.support] = t.dataset.value; save(); render(); return; }
  if(t.dataset.criteriaE){ state.result.criteriaE = t.dataset.criteriaE; save(); render(); return; }
  if(t.dataset.viewMode !== undefined){ state.viewMode = state.viewMode === 'all' ? 'single' : 'all'; save(); render(); return; }
  if(t.dataset.gotoIndex){ state.symptomIndex = Number(t.dataset.gotoIndex); save(); render(); window.scrollTo(0,0); return; }
  if(t.dataset.copySummary !== undefined){ navigator.clipboard?.writeText(summaryText()).then(()=>toast('Resultat kopieret')).catch(()=>toast('Kunne ikke kopiere automatisk')); return; }
  if(t.dataset.print !== undefined){ window.print(); return; }
  if(t.dataset.exportJson !== undefined){ exportJson(); return; }
  if(t.dataset.reset !== undefined){ if(confirm('Nulstil alle udfyldte data i denne browser?')){ state = defaultState(); save(); render(); toast('Nulstillet'); } return; }
}
function handleInput(e){
  const t = e.target;
  if(t.dataset.input){ setByPath(state, t.dataset.input, t.value); save(); return; }
  if(t.dataset.dysOther){ const [phase, cat] = t.dataset.dysOther.split('|'); state.dysfunction[phase][cat].other = t.value; save(); return; }
}
function handleChange(e){
  const t = e.target;
  if(t.dataset.example){ const [code, phase, idx] = t.dataset.example.split('.'); state.symptoms[code][phase].examples[idx] = t.checked; save(); return; }
  if(t.dataset.dysItem){ const [phase, cat, idx] = t.dataset.dysItem.split('|'); state.dysfunction[phase][cat].items[idx] = t.checked; save(); return; }
}

document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);
document.getElementById('modalRoot').addEventListener('click', (e)=>{ if(e.target.id==='modalRoot') closeModal(); });
if('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }
render();
