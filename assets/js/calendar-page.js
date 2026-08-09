(() => {
  'use strict';

  if (!/\/programs\/calendar\.html$/.test(location.pathname) && !/calendar\.html$/.test(location.pathname)) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/أ|إ|آ/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = value => {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    return m ? new Date(+m[1], +m[2]-1, +m[3], 12) : null;
  };
  const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

  const daysEl = $('#calendarDays');
  const titleEl = $('#calendarPeriodTitle');
  const listEl = $('#calendarProgramsList');
  const upcomingEl = $('#calendarUpcomingTitle');
  const selectionBar = $('#calendarSelectionBar');
  const selectionText = $('#calendarSelectionText');
  const clearDayBtn = $('#calendarClearDay');
  const todayBtn = $('#calendarTodayBtn');
  const prevBtn = $('#calendarPrevBtn');
  const nextBtn = $('#calendarNextBtn');
  const catSelect = $("select[data-filter='المجال']");
  const locSelect = $("select[data-filter='الموقع']");
  const modeSelect = $("select[data-filter='طريقة التنفيذ']");
  const resetBtn = $('.tc-filters button');
  if (!daysEl || !listEl) return;

  const monthFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {month:'long', year:'numeric'});
  const fullFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const shortFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {day:'numeric', month:'short', year:'numeric'});

  const state = { cursor: new Date(), selectedDay: null, items: [], loaded: false };

  function filters() {
    return {cat: catSelect?.value || '', loc: locSelect?.value || '', mode: modeSelect?.value || ''};
  }

  function filteredItems() {
    const f = filters();
    return state.items.filter(item => {
      const cat = item.program.category?.name || '';
      const loc = item.schedule.location || '';
      const mode = item.schedule.execution_mode || '';
      return (!f.cat || norm(cat).includes(norm(f.cat))) && (!f.loc || norm(loc).includes(norm(f.loc))) && (!f.mode || norm(mode).includes(norm(f.mode)));
    });
  }

  function statusMeta(s) {
    const seats = Number(s.available_seats);
    const status = norm(s.status || '');
    if (status.includes('مكتمل') || seats === 0) return {cls:'full', text:'مكتمل'};
    if (status.includes('محدود') || (Number.isFinite(seats) && seats > 0 && seats <= 5)) return {cls:'limited', text:'مقاعد محدودة'};
    return {cls:'open', text:'متاح'};
  }

  function imagePath(raw) {
    if (!raw) return '../assets/images/programs/courses/course-001.jpeg';
    let v = String(raw).trim();
    try {
      if (/^https?:\/\//i.test(v)) {
        const u = new URL(v); const idx = u.pathname.indexOf('/assets/');
        if (idx >= 0) v = u.pathname.slice(idx + 1); else return v;
      }
    } catch (_) {}
    v = v.replace(/^\/+/, '');
    return v.startsWith('assets/') ? '../' + v : (v.startsWith('../') ? v : '../' + v);
  }

  function renderGrid() {
    if (titleEl) titleEl.textContent = monthFmt.format(state.cursor);
    daysEl.innerHTML = '';
    const y = state.cursor.getFullYear(), m = state.cursor.getMonth();
    const first = new Date(y,m,1,12);
    const offset = (first.getDay()+1)%7; // Saturday first
    const start = addDays(first, -offset);
    const byDate = new Map();
    for (const item of filteredItems()) {
      const k = keyOf(item.date);
      if (!byDate.has(k)) byDate.set(k, []);
      byDate.get(k).push(item);
    }
    const todayKey = keyOf(new Date());
    for (let i=0; i<42; i++) {
      const d = addDays(start, i), k = keyOf(d), items = byDate.get(k) || [];
      const cell = document.createElement('div');
      cell.className = 'tc-day' + (d.getMonth() !== m ? ' muted' : '') + (k === todayKey ? ' tc-today' : '') + (k === state.selectedDay ? ' tc-selected-day' : '');
      const chips = items.slice(0,2).map(item => {
        const meta = statusMeta(item.schedule);
        return `<a class="tc-event-chip ${meta.cls}" href="program-details.html?slug=${encodeURIComponent(item.program.slug || item.program.id)}" title="${esc(item.program.title)}"><strong>${esc(item.program.title)}</strong><small>${esc(item.schedule.execution_mode || '')}</small></a>`;
      }).join('');
      const more = items.length > 2 ? `<button type="button" class="tc-more-events" data-date="${k}">+${items.length-2} برامج</button>` : '';
      cell.innerHTML = `<button type="button" class="tc-day-number" data-date="${k}" aria-label="${esc(fullFmt.format(d))}">${d.getDate()}</button><div class="tc-day-events">${chips}${more}</div>`;
      daysEl.appendChild(cell);
    }
  }

  function monthItems() {
    const y = state.cursor.getFullYear(), m = state.cursor.getMonth();
    return filteredItems().filter(x => x.date.getFullYear() === y && x.date.getMonth() === m).sort((a,b) => a.date-b.date || String(a.program.title).localeCompare(String(b.program.title),'ar'));
  }

  function renderCard(item) {
    const p = item.program, s = item.schedule, meta = statusMeta(s);
    const start = parseDate(s.start_date), end = parseDate(s.end_date);
    const dateText = start ? (end && keyOf(end) !== keyOf(start) ? `${shortFmt.format(start)} — ${shortFmt.format(end)}` : fullFmt.format(start)) : 'موعد متاح';
    return `<article class="tc-program-card">
      <a class="tc-program-thumb" href="program-details.html?slug=${encodeURIComponent(p.slug || p.id)}"><img src="${esc(imagePath(p.image))}" alt="${esc(p.title)}" loading="lazy" onerror="this.onerror=null;this.src='../assets/images/programs/courses/course-001.jpeg'" /></a>
      <div class="tc-program-main"><div class="tc-program-title-row"><h3>${esc(p.title)}</h3><span class="tc-status ${meta.cls}">${meta.text}</span></div><p>${esc(p.category?.name || 'برنامج تدريبي')}</p></div>
      <div class="tc-program-meta"><strong>${esc(dateText)}</strong><span>${esc(s.location || '')}</span><span>${esc(s.execution_mode || '')}${p.duration_days ? ` · ${Number(p.duration_days)} أيام` : ''}</span></div>
      <div class="tc-program-actions"><a class="btn btn-primary" href="../registration/registration-personal.html?program=${encodeURIComponent(p.id)}&schedule=${encodeURIComponent(s.id)}">التسجيل</a><a class="btn btn-outline" href="program-details.html?slug=${encodeURIComponent(p.slug || p.id)}">التفاصيل</a></div>
    </article>`;
  }

  function renderList() {
    let items = state.selectedDay ? filteredItems().filter(x => keyOf(x.date) === state.selectedDay) : monthItems();
    if (upcomingEl) upcomingEl.textContent = state.selectedDay ? `برامج ${fullFmt.format(parseDate(state.selectedDay))}` : 'البرامج القادمة';
    if (selectionBar) selectionBar.hidden = !state.selectedDay;
    if (state.selectedDay && selectionText) selectionText.textContent = `تم اختيار ${fullFmt.format(parseDate(state.selectedDay))}`;
    if (!state.loaded) {
      listEl.innerHTML = '<div class="tc-empty-state">جاري تحميل المواعيد من قاعدة البيانات…</div>';
      return;
    }
    listEl.innerHTML = items.length ? items.map(renderCard).join('') : '<div class="tc-empty-state">لا توجد برامج في هذا الشهر أو لا توجد نتائج مطابقة للفلاتر.</div>';
  }

  function renderAll(){ renderGrid(); renderList(); }

  function selectDay(k){
    state.selectedDay = k;
    const d = parseDate(k);
    if (d && (d.getMonth() !== state.cursor.getMonth() || d.getFullYear() !== state.cursor.getFullYear())) state.cursor = new Date(d.getFullYear(), d.getMonth(), 1, 12);
    renderAll();
    upcomingEl?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  daysEl.addEventListener('click', e => {
    const more = e.target.closest('.tc-more-events');
    const day = e.target.closest('.tc-day-number');
    if (more) { e.preventDefault(); selectDay(more.dataset.date); }
    else if (day) { e.preventDefault(); selectDay(day.dataset.date); }
  });
  prevBtn?.addEventListener('click', () => { state.selectedDay=null; state.cursor=new Date(state.cursor.getFullYear(), state.cursor.getMonth()-1,1,12); renderAll(); });
  nextBtn?.addEventListener('click', () => { state.selectedDay=null; state.cursor=new Date(state.cursor.getFullYear(), state.cursor.getMonth()+1,1,12); renderAll(); });
  todayBtn?.addEventListener('click', () => { state.selectedDay=null; state.cursor=new Date(); renderAll(); });
  clearDayBtn?.addEventListener('click', () => { state.selectedDay=null; renderAll(); });
  [catSelect,locSelect,modeSelect].filter(Boolean).forEach(el => el.addEventListener('change', () => { state.selectedDay=null; renderAll(); }));
  resetBtn?.addEventListener('click', e => { e.preventDefault(); [catSelect,locSelect,modeSelect].filter(Boolean).forEach(el => el.selectedIndex=0); state.selectedDay=null; renderAll(); });

  // Render the calendar immediately, independently of Laravel/API.
  renderAll();

  async function loadData(){
    try {
      if (!window.QEIAPI?.getPrograms) throw new Error('QEIAPI غير متاح');
      const [programRes, categoryRes] = await Promise.all([
        window.QEIAPI.getPrograms(),
        window.QEIAPI.getCategories().catch(() => null)
      ]);
      const programs = programRes?.data || [];
      state.items = [];
      programs.forEach(program => (program.schedules || []).forEach(schedule => {
        const date = parseDate(schedule.start_date);
        if (date) state.items.push({program, schedule, date});
      }));
      state.loaded = true;

      if (catSelect && categoryRes?.data) catSelect.innerHTML = '<option value="">المجال — جميع المجالات</option>' + categoryRes.data.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
      if (locSelect) {
        const locs = [...new Set(state.items.map(x => String(x.schedule.location || '').trim()).filter(Boolean))];
        locSelect.innerHTML = '<option value="">الموقع — جميع المواقع</option>' + locs.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      }
      if (modeSelect) {
        const modes = [...new Set(state.items.map(x => String(x.schedule.execution_mode || '').trim()).filter(Boolean))];
        modeSelect.innerHTML = '<option value="">طريقة التنفيذ — الكل</option>' + modes.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      }

      // If current month has no programs, jump once to the earliest real schedule.
      const y=state.cursor.getFullYear(), m=state.cursor.getMonth();
      const currentHas = state.items.some(x => x.date.getFullYear()===y && x.date.getMonth()===m);
      if (!currentHas && state.items.length) {
        const first = state.items.slice().sort((a,b)=>a.date-b.date)[0].date;
        state.cursor = new Date(first.getFullYear(), first.getMonth(), 1, 12);
      }
      renderAll();
    } catch (err) {
      console.error('[QEI Calendar]', err);
      state.loaded = true;
      renderGrid();
      listEl.innerHTML = '<div class="tc-empty-state"><strong>التقويم يعمل، لكن المواعيد لم تصل من Laravel.</strong><br>تأكد أن الخادم يعمل على <span dir="ltr">http://127.0.0.1:8000</span> ثم حدّث الصفحة.</div>';
    }
  }
  loadData();
})();
