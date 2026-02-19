/*
  Teaching Success Portal (Supabase)
  Required config:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY

  Setup notes:
  1) Run supabase/migrations/0001_portal.sql in Supabase SQL Editor
  2) Create a PRIVATE storage bucket named: assignment-files
  3) Use this page for tutor/student/parent portal flows
*/

const SUPABASE_URL = 'https://vcnophmfmzpanqglqopz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0gOJeJ9z8WZfZH1ZeVm-Ww_GzoGg-kk';

const hasConfig = !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_');
const $ = (id) => document.getElementById(id);

let sb = null;
let currentUser = null;
let currentProfile = null;
let tutorStudentsById = new Map();

function showMsg(el, text, type = 'ok') {
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
  el.style.display = 'block';
}

function clearMsg(el) {
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

function safeBind(id, event, handler) {
  const el = $(id);
  if (!el) {
    console.warn(`Missing element #${id} for ${event} binding`);
    return;
  }
  el.addEventListener(event, handler);
}

function formatDate(value) {
  if (!value) return 'No due date';
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString();
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function parseYearGroupInt(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value);
  const m = s.match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeSubject(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'maths' || raw === 'math') return 'maths';
  if (raw === 'english') return 'english';
  if (raw === 'science') return 'science';
  if (raw === '11+' || raw === '11 plus' || raw === 'eleven plus') return '11+';
  if (raw === 'general') return 'general';
  return raw;
}

function subjectVariants(value) {
  const s = normalizeSubject(value);
  if (s === 'maths') return ['maths', 'math'];
  if (s === '11+') return ['11+', '11 plus', 'eleven_plus', 'eleven plus'];
  return s ? [s] : [];
}

function expandYearGroupValues(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === 'number' && Number.isFinite(value)) return [value];

  const s = String(value).toLowerCase();
  if (s.includes('gcse')) return [10, 11];
  if (s.includes('a-level') || s.includes('alevel') || s.includes('a level')) return [12, 13];

  const allNums = [...s.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])).filter((n) => Number.isFinite(n));
  if (!allNums.length) return [];
  if (allNums.length >= 2 && (s.includes('-') || s.includes('to'))) {
    const min = Math.min(allNums[0], allNums[1]);
    const max = Math.max(allNums[0], allNums[1]);
    const out = [];
    for (let i = min; i <= max; i += 1) out.push(i);
    return out;
  }
  return [allNums[0]];
}

function setSelectOptions(el, options, emptyLabel) {
  if (!el) return;
  el.innerHTML = '';
  if (!options.length) {
    el.innerHTML = `<option value="">${emptyLabel}</option>`;
    return;
  }
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    el.appendChild(o);
  });
}

async function ensureProfile(user) {
  const meta = user.user_metadata || {};
  const roleFromMeta = meta.signup_role === 'parent' ? 'parent' : (meta.signup_role === 'tutor' ? 'tutor' : 'student');

  const { data: existing, error: existingErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingErr) throw existingErr;

  const payload = {
    id: user.id,
    email: user.email,
    full_name: meta.full_name || existing?.full_name || user.email,
    year_group: meta.year_group ?? existing?.year_group ?? null,
    role: existing?.role || roleFromMeta
  };

  const { error: upsertErr } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
  if (upsertErr) throw upsertErr;

  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr) throw profileErr;
  return profile;
}

async function getSignedUrl(filePath) {
  if (!filePath) return null;
  const { data, error } = await sb.storage.from('assignment-files').createSignedUrl(filePath, 600);
  if (error) {
    console.warn('Signed URL error:', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

async function uploadAssignmentFile(file, studentId, assignmentId) {
  if (!file) return null;
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileName = safeFileName(file.name || 'attachment');
  const path = `${studentId}/${assignmentId}/${uuid}_${fileName}`;

  const { error } = await sb.storage
    .from('assignment-files')
    .upload(path, file, { upsert: false, cacheControl: '3600' });

  if (error) throw error;
  return path;
}

async function loadStudentsForTutor() {
  const { data, error } = await sb
    .from('profiles')
    .select('id,full_name,email,year_group')
    .eq('role', 'student')
    .order('full_name', { ascending: true });

  if (error) throw error;
  const studentSelect = $('asg-student');
  const linkStudentSelect = $('link-student');
  tutorStudentsById = new Map((data || []).map((x) => [x.id, x]));
  studentSelect.innerHTML = '';
  linkStudentSelect.innerHTML = '';

  if (!data.length) {
    studentSelect.innerHTML = '<option value="">No student accounts yet</option>';
    linkStudentSelect.innerHTML = '<option value="">No student accounts yet</option>';
    return;
  }

  data.forEach((st) => {
    const txt = `${st.full_name || st.email} (${st.email})${st.year_group ? ` - ${st.year_group}` : ''}`;
    const a = document.createElement('option');
    a.value = st.id;
    a.textContent = txt;
    studentSelect.appendChild(a);

    const b = document.createElement('option');
    b.value = st.id;
    b.textContent = txt;
    linkStudentSelect.appendChild(b);
  });
  await loadUnitsForAssignmentForm();
}

async function loadUnitsForAssignmentForm() {
  const studentId = $('asg-student')?.value || '';
  const subjectRaw = $('asg-subject')?.value || '';
  const examBoardRaw = String($('asg-exam-board')?.value || '').trim().toLowerCase();
  const unitSelect = $('asg-unit');
  const lessonSelect = $('asg-lesson');

  if (!studentId || !subjectRaw) {
    setSelectOptions(unitSelect, [], 'Select student + subject first');
    setSelectOptions(lessonSelect, [], 'Select a unit first');
    return;
  }

  const subjectList = subjectVariants(subjectRaw);
  if (!subjectList.length) {
    setSelectOptions(unitSelect, [], 'No units for selected subject');
    setSelectOptions(lessonSelect, [], 'Select a unit first');
    return;
  }

  const student = tutorStudentsById.get(studentId);
  const years = [...new Set(expandYearGroupValues(student?.year_group))];

  let query = sb
    .from('curriculum_units')
    .select('id,year_group,subject,unit_title,unit_order,exam_board,course')
    .in('subject', subjectList)
    .order('year_group', { ascending: true })
    .order('unit_order', { ascending: true, nullsFirst: false })
    .order('unit_title', { ascending: true });

  if (years.length) query = query.in('year_group', years);
  if (examBoardRaw) query = query.ilike('exam_board', examBoardRaw);

  const { data, error } = await query;
  if (error) {
    console.warn('loadUnitsForAssignmentForm error:', error.message);
    setSelectOptions(unitSelect, [], 'Could not load units');
    setSelectOptions(lessonSelect, [], 'Select a unit first');
    return;
  }

  const options = (data || []).map((u) => ({
    value: u.id,
    label: `Y${u.year_group} · ${u.unit_title}${u.exam_board ? ` · ${String(u.exam_board).toUpperCase()}` : ''}${u.course ? ` · ${u.course}` : ''}`
  }));

  setSelectOptions(unitSelect, options, 'No matching units for this student/subject');
  setSelectOptions(lessonSelect, [], 'Select a unit first');
  if (options.length) {
    unitSelect.value = options[0].value;
    await loadLessonsForAssignmentForm();
  }
}

async function loadLessonsForAssignmentForm() {
  const unitId = $('asg-unit')?.value || '';
  const lessonSelect = $('asg-lesson');
  if (!unitId) {
    setSelectOptions(lessonSelect, [], 'Select a unit first');
    return;
  }

  const { data, error } = await sb
    .from('curriculum_lessons')
    .select('id,lesson_order,lesson_title')
    .eq('unit_id', unitId)
    .order('lesson_order', { ascending: true })
    .order('lesson_title', { ascending: true });

  if (error) {
    console.warn('loadLessonsForAssignmentForm error:', error.message);
    setSelectOptions(lessonSelect, [], 'Could not load lessons');
    return;
  }

  const options = (data || []).map((l) => ({
    value: l.id,
    label: `L${l.lesson_order} · ${l.lesson_title}`
  }));
  setSelectOptions(lessonSelect, options, 'No lessons in this unit');
}

async function loadParentsForTutor() {
  const { data, error } = await sb
    .from('profiles')
    .select('id,full_name,email')
    .eq('role', 'parent')
    .order('full_name', { ascending: true });

  if (error) throw error;

  const parentSelect = $('link-parent');
  parentSelect.innerHTML = '';

  if (!data.length) {
    parentSelect.innerHTML = '<option value="">No parent accounts yet</option>';
    return;
  }

  data.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.full_name || p.email} (${p.email})`;
    parentSelect.appendChild(o);
  });
}

function attachmentButtonHtml(a, context) {
  const buttons = [];

  if (a.resource_url) {
    const label = a.resource_title || 'Open resource link';
    buttons.push(`<button class="btn ghost small" type="button" data-action="open-resource" data-url="${escapeHtml(a.resource_url)}">${escapeHtml(label)}</button>`);
  }

  if (a.file_path) {
    buttons.push(`<button class="btn ghost small" type="button" data-action="open-file" data-path="${escapeHtml(a.file_path)}" data-context="${escapeHtml(context)}" data-id="${escapeHtml(a.id)}">View file</button>`);
  }

  return buttons.length ? `<div class="actions" style="margin-top:.45rem">${buttons.join('')}</div>` : '';
}

function tutorItemHtml(a) {
  const statusClass = a.status === 'marked' || a.status === 'completed' ? 'ok' : 'warn';
  const studentName = a.student?.full_name || a.student?.email || 'Unknown student';
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';
  const unitTag = a.unit?.unit_title ? `<span class="tag">Unit: ${escapeHtml(a.unit.unit_title)}</span>` : '';
  const lessonTag = a.lesson?.lesson_title
    ? `<span class="tag">Lesson: ${a.lesson.lesson_order ? `L${a.lesson.lesson_order} · ` : ''}${escapeHtml(a.lesson.lesson_title)}</span>`
    : '';

  const submittedTag = a.submission
    ? `<span class="tag ok">Submitted: ${new Date(a.submission.submitted_at).toLocaleString()}</span>`
    : '<span class="tag warn">Not submitted yet</span>';

  const gradingBlock = a.submission
    ? `
      <div style="margin-top:.65rem;border-top:1px solid var(--border);padding-top:.65rem">
        <p class="muted" style="margin-bottom:.35rem"><b>Student Notes:</b> ${a.submission.notes || 'No notes added.'}</p>
        <div class="row">
          <div><label>Mark (%)</label><input id="mark-${a.id}" type="number" min="0" max="100" step="0.1" value="${a.submission.mark ?? ''}"></div>
          <div><label>Grade</label><input id="grade-${a.id}" type="text" placeholder="e.g. 7 / B+ / A*" value="${a.submission.grade || ''}"></div>
          <div><label>Tutor Feedback</label><textarea id="feedback-${a.id}" placeholder="Feedback for student">${a.submission.tutor_feedback || ''}</textarea></div>
          <div class="actions"><button class="btn dark small" type="button" data-action="save-grade" data-id="${a.id}">Save Mark/Grade</button></div>
        </div>
      </div>
    `
    : '';

  return `
    <article class="item">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${a.subject}</span>
        <span class="tag">${studentName}</span>
        <span class="tag ${statusClass}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
        ${unitTag}
        ${lessonTag}
        ${submittedTag}
      </div>
      <p class="muted">${desc}</p>
      ${attachmentButtonHtml(a, 'tutor')}
      ${gradingBlock}
    </article>
  `;
}

function studentItemHtml(a) {
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';
  const unitTag = a.unit?.unit_title ? `<span class="tag">Unit: ${escapeHtml(a.unit.unit_title)}</span>` : '';
  const lessonTag = a.lesson?.lesson_title
    ? `<span class="tag">Lesson: ${a.lesson.lesson_order ? `L${a.lesson.lesson_order} · ` : ''}${escapeHtml(a.lesson.lesson_title)}</span>`
    : '';
  const gradeHtml = a.submission
    ? `
      <p class="muted" style="margin:.35rem 0"><b>Mark:</b> ${a.submission.mark ?? '-'} · <b>Grade:</b> ${a.submission.grade || '-'}</p>
      <p class="muted" style="margin-bottom:.45rem"><b>Tutor Feedback:</b> ${a.submission.tutor_feedback || 'No feedback yet.'}</p>
    `
    : '';

  return `
    <article class="item">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${a.subject}</span>
        <span class="tag ${a.status === 'marked' || a.status === 'completed' ? 'ok' : 'warn'}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
        ${unitTag}
        ${lessonTag}
      </div>
      <p class="muted" style="margin-bottom:.5rem">${desc}</p>
      ${attachmentButtonHtml(a, 'student')}
      ${gradeHtml}
      <label style="margin-top:.5rem;margin-bottom:.35rem">Submission Notes</label>
      <textarea id="notes-${a.id}" placeholder="What did you complete? Add links/evidence if needed">${a.submission?.notes || ''}</textarea>
      <div class="actions" style="margin-top:.45rem">
        <button class="btn blue small" type="button" data-action="submit" data-id="${a.id}">Submit Work</button>
      </div>
    </article>
  `;
}

function parentItemHtml(a) {
  const due = formatDate(a.due_date);
  const studentName = a.student?.full_name || a.student?.email || a.student_id;
  const desc = a.description || 'No instructions provided.';
  const unitTag = a.unit?.unit_title ? `<span class="tag">Unit: ${escapeHtml(a.unit.unit_title)}</span>` : '';
  const lessonTag = a.lesson?.lesson_title
    ? `<span class="tag">Lesson: ${a.lesson.lesson_order ? `L${a.lesson.lesson_order} · ` : ''}${escapeHtml(a.lesson.lesson_title)}</span>`
    : '';
  const submissionTag = a.submission
    ? `<span class="tag ok">Submitted: ${new Date(a.submission.submitted_at).toLocaleString()}</span>`
    : '<span class="tag warn">Not submitted yet</span>';

  return `
    <article class="item">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${studentName}</span>
        <span class="tag">${a.subject}</span>
        <span class="tag ${a.status === 'marked' || a.status === 'completed' ? 'ok' : 'warn'}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
        ${unitTag}
        ${lessonTag}
        ${submissionTag}
      </div>
      <p class="muted">${desc}</p>
      ${attachmentButtonHtml(a, 'parent')}
      <p class="muted" style="margin:.35rem 0"><b>Mark:</b> ${a.submission?.mark ?? '-'} · <b>Grade:</b> ${a.submission?.grade || '-'}</p>
      <p class="muted" style="margin-bottom:.35rem"><b>Tutor Feedback:</b> ${a.submission?.tutor_feedback || 'No feedback yet.'}</p>
    </article>
  `;
}

function parentLinkItemHtml(link) {
  const p = link.parent?.full_name || link.parent?.email || 'Unknown parent';
  const s = link.student?.full_name || link.student?.email || link.student_id;
  return `
    <article class="item">
      <h3>${p}</h3>
      <div class="meta"><span class="tag">Linked student: ${s}</span></div>
    </article>
  `;
}

async function renderParentLinksForTutor() {
  const { data, error } = await sb
    .from('parent_student_links')
    .select(`
      id, parent_id, student_id, created_at,
      parent:profiles!parent_student_links_parent_id_fkey(full_name,email),
      student:profiles!parent_student_links_student_id_fkey(full_name,email,year_group)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  $('parent-links-list').innerHTML = (data || []).length
    ? data.map(parentLinkItemHtml).join('')
    : '<p class="muted">No parent links yet.</p>';
}

async function renderTutorDashboard() {
  const { data: assignments, error } = await sb
    .from('assignments')
    .select(`
      id,tutor_id,student_id,subject,title,description,due_date,status,resource_title,resource_url,file_path,file_url,year_group,exam_board,created_at,
      student:profiles!assignments_student_id_fkey(full_name,email,year_group),
      unit:curriculum_units!assignments_unit_id_fkey(unit_title),
      lesson:curriculum_lessons!assignments_lesson_id_fkey(lesson_title,lesson_order)
    `)
    .eq('tutor_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { count: submissionsCount, error: subCountErr } = await sb
    .from('submissions')
    .select('id', { count: 'exact', head: true });
  if (subCountErr) throw subCountErr;

  const assignmentIds = (assignments || []).map((a) => a.id);
  let submissionMap = new Map();
  if (assignmentIds.length) {
    const { data: subs, error: subErr } = await sb
      .from('submissions')
      .select('assignment_id,notes,submitted_at,mark,grade,tutor_feedback,graded_at')
      .in('assignment_id', assignmentIds);
    if (subErr) throw subErr;
    submissionMap = new Map((subs || []).map((s) => [s.assignment_id, s]));
  }

  const enriched = (assignments || []).map((a) => ({
    ...a,
    submission: submissionMap.get(a.id) || null
  }));
  $('kpi-active').textContent = String(enriched.filter((x) => x.status === 'assigned' || x.status === 'submitted').length);
  $('kpi-complete').textContent = String(enriched.filter((x) => x.status === 'marked' || x.status === 'completed').length);
  $('kpi-subs').textContent = String(submissionsCount || 0);
  $('tutor-list').innerHTML = enriched.length
    ? enriched.map(tutorItemHtml).join('')
    : '<p class="muted">No assignments yet. Create the first one on the left.</p>';
}

async function renderStudentAssignments() {
  const { data: assignments, error } = await sb
    .from('assignments')
    .select(`
      id,student_id,subject,title,description,due_date,status,resource_title,resource_url,file_path,file_url,created_at,
      unit:curriculum_units!assignments_unit_id_fkey(unit_title),
      lesson:curriculum_lessons!assignments_lesson_id_fkey(lesson_title,lesson_order)
    `)
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const assignmentIds = (assignments || []).map((a) => a.id);
  let submissionMap = new Map();
  if (assignmentIds.length) {
    const { data: subs, error: subErr } = await sb
      .from('submissions')
      .select('assignment_id,notes,submitted_at,mark,grade,tutor_feedback,graded_at')
      .eq('student_id', currentUser.id)
      .in('assignment_id', assignmentIds);
    if (subErr) throw subErr;
    submissionMap = new Map((subs || []).map((s) => [s.assignment_id, s]));
  }

  const enriched = (assignments || []).map((a) => ({
    ...a,
    submission: submissionMap.get(a.id) || null
  }));
  $('student-list').innerHTML = enriched.length
    ? enriched.map(studentItemHtml).join('')
    : '<p class="muted">No assignments yet. Your tutor will assign work here.</p>';
}

async function renderParentTracker() {
  const { data: links, error: linksErr } = await sb
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', currentUser.id);
  if (linksErr) throw linksErr;

  const studentIds = [...new Set((links || []).map((x) => x.student_id).filter(Boolean))];
  $('kpi-parent-students').textContent = String(studentIds.length);

  if (!studentIds.length) {
    $('kpi-parent-total').textContent = '0';
    $('kpi-parent-complete').textContent = '0';
    $('parent-linked-students').innerHTML = '';
    $('parent-list').innerHTML = '<p class="muted">No linked students yet. Ask tutor to link your account.</p>';
    return;
  }

  const { data: students } = await sb
    .from('profiles')
    .select('id,full_name,email,year_group')
    .in('id', studentIds);
  const studentsById = new Map((students || []).map((s) => [s.id, s]));

  $('parent-linked-students').innerHTML = studentIds.map((id) => {
    const st = studentsById.get(id);
    const label = st ? `${st.full_name || st.email}${st.year_group ? ` (${st.year_group})` : ''}` : id;
    return `<article class="item"><div class="meta"><span class="tag">Linked Student</span></div><p><b>${label}</b></p></article>`;
  }).join('');

  const { data: assignments, error: asgErr } = await sb
    .from('assignments')
    .select(`
      id,tutor_id,student_id,subject,title,description,due_date,status,resource_title,resource_url,file_path,file_url,created_at,
      student:profiles!assignments_student_id_fkey(full_name,email,year_group),
      unit:curriculum_units!assignments_unit_id_fkey(unit_title),
      lesson:curriculum_lessons!assignments_lesson_id_fkey(lesson_title,lesson_order)
    `)
    .in('student_id', studentIds)
    .order('created_at', { ascending: false });
  if (asgErr) throw asgErr;

  const assignmentIds = (assignments || []).map((a) => a.id);
  let submissionMap = new Map();
  if (assignmentIds.length) {
    const { data: subs, error: subErr } = await sb
      .from('submissions')
      .select('assignment_id,notes,submitted_at,mark,grade,tutor_feedback,graded_at')
      .in('assignment_id', assignmentIds);
    if (subErr) throw subErr;
    submissionMap = new Map((subs || []).map((s) => [s.assignment_id, s]));
  }

  const enriched = (assignments || []).map((a) => ({
    ...a,
    submission: submissionMap.get(a.id) || null
  }));
  $('kpi-parent-total').textContent = String(enriched.length);
  $('kpi-parent-complete').textContent = String(enriched.filter((x) => x.status === 'marked' || x.status === 'completed').length);
  $('parent-list').innerHTML = enriched.length
    ? enriched.map(parentItemHtml).join('')
    : '<p class="muted">No assignments found for linked students.</p>';
}

async function createAssignment() {
  clearMsg($('asg-msg'));

  const studentId = $('asg-student').value;
  const subject = $('asg-subject').value;
  const title = $('asg-title').value.trim();
  const dueDate = $('asg-due').value || null;
  const description = $('asg-desc').value.trim();
  const resourceTitle = $('asg-resource-title').value.trim();
  const resourceUrl = $('asg-resource-url').value.trim();
  const examBoard = $('asg-exam-board') ? String($('asg-exam-board').value || '').trim().toLowerCase() : null;
  const unitId = $('asg-unit')?.value || null;
  const lessonId = $('asg-lesson')?.value || null;
  const file = $('asg-file')?.files?.[0] || null;

  if (!studentId || !title) {
    showMsg($('asg-msg'), 'Select a student and add a title.', 'err');
    return;
  }

  const studentProfile = tutorStudentsById.get(studentId) || null;

  const payload = {
    tutor_id: currentUser.id,
    student_id: studentId,
    subject,
    title,
    description: description || null,
    due_date: dueDate,
    status: 'assigned',
    resource_title: resourceTitle || null,
    resource_url: resourceUrl || null,
    year_group: parseYearGroupInt(studentProfile?.year_group),
    exam_board: examBoard || null,
    unit_id: unitId || null,
    lesson_id: lessonId || null
  };

  const { data: created, error: insErr } = await sb
    .from('assignments')
    .insert(payload)
    .select('id,student_id')
    .single();

  if (insErr) {
    showMsg($('asg-msg'), insErr.message, 'err');
    return;
  }

  if (file) {
    try {
      const path = await uploadAssignmentFile(file, created.student_id, created.id);
      const { error: updErr } = await sb
        .from('assignments')
        .update({ file_path: path })
        .eq('id', created.id)
        .eq('tutor_id', currentUser.id);
      if (updErr) throw updErr;
    } catch (e) {
      showMsg($('asg-msg'), `Assignment created, but file upload failed: ${e.message}`, 'err');
      await renderTutorDashboard();
      return;
    }
  }

  $('asg-title').value = '';
  $('asg-due').value = '';
  $('asg-desc').value = '';
  $('asg-resource-title').value = '';
  $('asg-resource-url').value = '';
  if ($('asg-exam-board')) $('asg-exam-board').value = '';
  if ($('asg-file')) $('asg-file').value = '';
  if ($('asg-unit')) $('asg-unit').value = '';
  if ($('asg-lesson')) $('asg-lesson').value = '';
  await loadUnitsForAssignmentForm();

  showMsg($('asg-msg'), 'Assignment created.', 'ok');
  await renderTutorDashboard();
}

async function linkParentToStudent() {
  clearMsg($('link-msg'));
  const parentId = $('link-parent').value;
  const studentId = $('link-student').value;

  if (!parentId || !studentId) {
    showMsg($('link-msg'), 'Select both parent and student.', 'err');
    return;
  }

  const { error } = await sb
    .from('parent_student_links')
    .insert({ parent_id: parentId, student_id: studentId });

  if (error) {
    showMsg($('link-msg'), error.message, 'err');
    return;
  }

  showMsg($('link-msg'), 'Parent linked to student.', 'ok');
  await renderParentLinksForTutor();
}

async function submitStudentWork(assignmentId) {
  const notes = ($(`notes-${assignmentId}`)?.value || '').trim();

  const { error: submitErr } = await sb
    .from('submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: currentUser.id,
        notes: notes || null,
        submitted_at: new Date().toISOString()
      },
      { onConflict: 'assignment_id,student_id' }
    );

  if (submitErr) {
    alert(`Submission failed: ${submitErr.message}`);
    return;
  }

  const { error: statusErr } = await sb
    .from('assignments')
    .update({ status: 'submitted' })
    .eq('id', assignmentId)
    .eq('student_id', currentUser.id);

  if (statusErr) {
    alert(`Status update failed: ${statusErr.message}`);
    return;
  }

  alert('Work submitted successfully.');
  await renderStudentAssignments();
}

async function saveTutorGrade(assignmentId) {
  const markRaw = ($(`mark-${assignmentId}`)?.value || '').trim();
  const grade = ($(`grade-${assignmentId}`)?.value || '').trim();
  const feedback = ($(`feedback-${assignmentId}`)?.value || '').trim();

  let mark = null;
  if (markRaw !== '') {
    mark = Number(markRaw);
    if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
      alert('Mark must be between 0 and 100.');
      return;
    }
  }

  const { error: subErr } = await sb
    .from('submissions')
    .update({
      mark,
      grade: grade || null,
      tutor_feedback: feedback || null,
      graded_at: new Date().toISOString()
    })
    .eq('assignment_id', assignmentId);

  if (subErr) {
    alert(`Saving mark/grade failed: ${subErr.message}`);
    return;
  }

  const { error: asgErr } = await sb
    .from('assignments')
    .update({ status: 'marked' })
    .eq('id', assignmentId)
    .eq('tutor_id', currentUser.id);

  if (asgErr) {
    alert(`Assignment status update failed: ${asgErr.message}`);
    return;
  }

  alert('Mark/grade saved.');
  await renderTutorDashboard();
}

function openExternalUrl(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function openAssignmentFile(path) {
  const signedUrl = await getSignedUrl(path);
  if (!signedUrl) {
    alert('Could not generate secure file link.');
    return;
  }
  openExternalUrl(signedUrl);
}

function bindListActions() {
  const studentList = $('student-list');
  if (studentList) studentList.addEventListener('click', async (e) => {
    const submitBtn = e.target.closest('[data-action="submit"]');
    if (submitBtn) {
      await submitStudentWork(submitBtn.dataset.id);
      return;
    }

    const resourceBtn = e.target.closest('[data-action="open-resource"]');
    if (resourceBtn) {
      openExternalUrl(resourceBtn.dataset.url);
      return;
    }

    const fileBtn = e.target.closest('[data-action="open-file"]');
    if (fileBtn) {
      await openAssignmentFile(fileBtn.dataset.path);
    }
  });

  const tutorList = $('tutor-list');
  if (tutorList) tutorList.addEventListener('click', async (e) => {
    const gradeBtn = e.target.closest('[data-action="save-grade"]');
    if (gradeBtn) {
      await saveTutorGrade(gradeBtn.dataset.id);
      return;
    }

    const resourceBtn = e.target.closest('[data-action="open-resource"]');
    if (resourceBtn) {
      openExternalUrl(resourceBtn.dataset.url);
      return;
    }

    const fileBtn = e.target.closest('[data-action="open-file"]');
    if (fileBtn) {
      await openAssignmentFile(fileBtn.dataset.path);
    }
  });

  const parentList = $('parent-list');
  if (parentList) parentList.addEventListener('click', async (e) => {
    const resourceBtn = e.target.closest('[data-action="open-resource"]');
    if (resourceBtn) {
      openExternalUrl(resourceBtn.dataset.url);
      return;
    }

    const fileBtn = e.target.closest('[data-action="open-file"]');
    if (fileBtn) {
      await openAssignmentFile(fileBtn.dataset.path);
    }
  });
}

async function renderAppForRole() {
  $('who-name').textContent = currentProfile.full_name || currentUser.email;
  $('who-role').textContent = `Role: ${currentProfile.role}`;

  if (currentProfile.role === 'tutor') {
    $('tutor-view').classList.remove('hidden');
    $('student-view').classList.add('hidden');
    $('parent-view').classList.add('hidden');
    await loadStudentsForTutor();
    await loadParentsForTutor();
    await renderTutorDashboard();
    await renderParentLinksForTutor();
    return;
  }

  if (currentProfile.role === 'parent') {
    $('tutor-view').classList.add('hidden');
    $('student-view').classList.add('hidden');
    $('parent-view').classList.remove('hidden');
    await renderParentTracker();
    return;
  }

  $('tutor-view').classList.add('hidden');
  $('student-view').classList.remove('hidden');
  $('parent-view').classList.add('hidden');
  await renderStudentAssignments();
}

async function toSignedIn(user) {
  currentUser = user;
  currentProfile = await ensureProfile(user);
  $('auth-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  await renderAppForRole();
}

function toSignedOut() {
  currentUser = null;
  currentProfile = null;
  $('auth-view').classList.remove('hidden');
  $('app-view').classList.add('hidden');
}

async function handleSignIn() {
  try {
    const msgEl = $('signin-msg');
    clearMsg(msgEl);
    showMsg(msgEl, 'Signing in...', 'ok');

    const email = $('signin-email')?.value?.trim() || '';
    const password = $('signin-password')?.value || '';
    if (!email || !password) {
      showMsg(msgEl, 'Please enter both email and password.', 'err');
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      showMsg(msgEl, error.message, 'err');
      return;
    }

    $('signin-email').value = '';
    $('signin-password').value = '';
    showMsg(msgEl, 'Signed in.', 'ok');
    await toSignedIn(data.user);
  } catch (err) {
    console.error('Sign-in crash:', err);
    showMsg($('signin-msg'), `Sign-in failed: ${err.message}`, 'err');
  }
}

async function handleSignUp() {
  clearMsg($('signup-msg'));

  const full_name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const signupRole = $('signup-role').value === 'parent' ? 'parent' : 'student';
  const year_group = $('signup-year').value || null;

  if (!full_name || !email || password.length < 8) {
    showMsg($('signup-msg'), 'Use full name, valid email, and password with 8+ characters.', 'err');
    return;
  }

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        signup_role: signupRole,
        year_group: signupRole === 'student' ? year_group : null
      }
    }
  });

  if (error) {
    showMsg($('signup-msg'), error.message, 'err');
    return;
  }

  $('signup-name').value = '';
  $('signup-email').value = '';
  $('signup-password').value = '';
  $('signup-role').value = 'student';
  $('signup-year').value = '';

  showMsg($('signup-msg'), 'Account created. Check email if confirmation is enabled, then sign in.', 'ok');
}

async function bootstrap() {
  if (!hasConfig) {
    $('config-warning').classList.remove('hidden');
    $('auth-view').classList.add('hidden');
    return;
  }

  $('config-warning').classList.add('hidden');
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  safeBind('btn-signin', 'click', handleSignIn);
  safeBind('btn-signup', 'click', handleSignUp);
  safeBind('btn-signout', 'click', async () => {
    await sb.auth.signOut();
    toSignedOut();
  });
  safeBind('btn-refresh', 'click', async () => {
    if (!currentUser) return;
    await renderAppForRole();
  });

  safeBind('btn-create-asg', 'click', createAssignment);
  safeBind('btn-link-parent', 'click', linkParentToStudent);
  safeBind('asg-student', 'change', loadUnitsForAssignmentForm);
  safeBind('asg-subject', 'change', loadUnitsForAssignmentForm);
  safeBind('asg-exam-board', 'change', loadUnitsForAssignmentForm);
  safeBind('asg-unit', 'change', loadLessonsForAssignmentForm);

  bindListActions();

  const { data } = await sb.auth.getUser();
  if (data?.user) {
    await toSignedIn(data.user);
  } else {
    toSignedOut();
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user;
    if (!user) {
      toSignedOut();
      return;
    }
    await toSignedIn(user);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  alert(`Portal bootstrap failed: ${err.message}`);
});
