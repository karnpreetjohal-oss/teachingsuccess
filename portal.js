/*
  Teaching Success Portal (Supabase)
  1) Fill SUPABASE_URL and SUPABASE_ANON_KEY
  2) Run supabase/schema.sql in Supabase SQL editor
*/

const SUPABASE_URL = 'https://vcnophmfmzpanqglqopz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0gOJeJ9z8WZfZH1ZeVm-Ww_GzoGg-kk';

const hasConfig = !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_');
const $ = (id) => document.getElementById(id);

let sb = null;
let currentUser = null;
let currentProfile = null;

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

function formatDate(value) {
  if (!value) return 'No due date';
  const d = new Date(value + 'T00:00:00');
  return d.toLocaleDateString();
}

async function ensureProfile(user) {
  const meta = user.user_metadata || {};
  const payload = {
    id: user.id,
    email: user.email,
    full_name: meta.full_name || user.email,
    year_group: meta.year_group || null
  };

  const { error } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) throw error;

  const { data, error: profileErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr) throw profileErr;
  return data;
}

async function loadStudentsForTutor() {
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email, year_group')
    .eq('role', 'student')
    .order('full_name', { ascending: true });

  if (error) throw error;
  const select = $('asg-student');
  select.innerHTML = '';

  if (!data.length) {
    select.innerHTML = '<option value="">No student accounts yet</option>';
    return;
  }

  data.forEach((st) => {
    const opt = document.createElement('option');
    opt.value = st.id;
    const yr = st.year_group ? ` - ${st.year_group}` : '';
    opt.textContent = `${st.full_name || st.email} (${st.email})${yr}`;
    select.appendChild(opt);
  });

  const linkStudentSelect = $('link-student');
  linkStudentSelect.innerHTML = '';
  data.forEach((st) => {
    const opt = document.createElement('option');
    opt.value = st.id;
    const yr = st.year_group ? ` - ${st.year_group}` : '';
    opt.textContent = `${st.full_name || st.email} (${st.email})${yr}`;
    linkStudentSelect.appendChild(opt);
  });
}

async function loadParentsForTutor() {
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'parent')
    .order('full_name', { ascending: true });

  if (error) throw error;

  const select = $('link-parent');
  select.innerHTML = '';
  if (!data.length) {
    select.innerHTML = '<option value="">No parent accounts yet</option>';
    return;
  }

  data.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.full_name || p.email} (${p.email})`;
    select.appendChild(opt);
  });
}

function parentLinkItemHtml(link) {
  const parentName = link.parent?.full_name || link.parent?.email || 'Unknown parent';
  const studentName = link.student?.full_name || link.student?.email || 'Unknown student';
  return `
    <article class="item">
      <h3>${parentName}</h3>
      <div class="meta">
        <span class="tag">Linked Student: ${studentName}</span>
      </div>
    </article>
  `;
}

async function renderParentLinksForTutor() {
  const { data, error } = await sb
    .from('parent_student_links')
    .select(`
      id,
      created_at,
      parent:profiles!parent_student_links_parent_id_fkey(full_name,email),
      student:profiles!parent_student_links_student_id_fkey(full_name,email,year_group)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  $('parent-links-list').innerHTML = (data || []).length
    ? data.map(parentLinkItemHtml).join('')
    : '<p class="muted">No parent links yet.</p>';
}

function tutorItemHtml(a) {
  const statusClass = a.status === 'completed' ? 'ok' : 'warn';
  const studentName = a.student?.full_name || a.student?.email || 'Unknown student';
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';
  const resourceHtml = a.resource_url
    ? `<p class="muted" style="margin-top:.45rem"><b>Resource:</b> <a href="${a.resource_url}" target="_blank" rel="noopener noreferrer">${a.resource_title || a.resource_url}</a></p>`
    : '';

  const submittedTag = a.submission
    ? `<span class="tag ok">Submitted: ${new Date(a.submission.submitted_at).toLocaleString()}</span>`
    : '<span class="tag warn">Not submitted yet</span>';

  const gradeBlock = a.submission
    ? `
      <div style="margin-top:.6rem;border-top:1px solid var(--border);padding-top:.6rem">
        <p class="muted" style="margin-bottom:.35rem"><b>Student Notes:</b> ${a.submission.notes || 'No notes added.'}</p>
        <div class="row">
          <div><label>Mark (0-100)</label><input id="mark-${a.id}" type="number" min="0" max="100" value="${a.submission.mark ?? ''}"></div>
          <div><label>Grade</label><input id="grade-${a.id}" type="text" placeholder="e.g. 7, B+, A*" value="${a.submission.grade || ''}"></div>
          <div><label>Tutor Feedback</label><textarea id="feedback-${a.id}" placeholder="Feedback for student">${a.submission.tutor_feedback || ''}</textarea></div>
          <div class="actions">
            <button class="btn dark small" type="button" data-action="save-grade" data-id="${a.id}">Save Mark/Grade</button>
          </div>
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
        ${submittedTag}
      </div>
      <p class="muted">${desc}</p>
      ${resourceHtml}
      ${gradeBlock}
    </article>
  `;
}

async function renderTutorDashboard() {
  const { data: assignments, error } = await sb
    .from('assignments')
    .select(`
      id,
      title,
      subject,
      description,
      resource_title,
      resource_url,
      due_date,
      status,
      created_at,
      student:profiles!assignments_student_id_fkey(full_name,email,year_group)
    `)
    .eq('tutor_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { count: submissionsCount, error: subError } = await sb
    .from('submissions')
    .select('id', { count: 'exact', head: true });

  if (subError) throw subError;

  const assignmentIds = assignments.map((a) => a.id);
  let submissionMap = new Map();
  if (assignmentIds.length) {
    const { data: subs, error: subsErr } = await sb
      .from('submissions')
      .select('id, assignment_id, notes, submitted_at, mark, grade, tutor_feedback, graded_at')
      .in('assignment_id', assignmentIds);

    if (subsErr) throw subsErr;
    submissionMap = new Map((subs || []).map((s) => [s.assignment_id, s]));
  }

  const enrichedAssignments = assignments.map((a) => ({
    ...a,
    submission: submissionMap.get(a.id) || null
  }));

  const active = assignments.filter((x) => x.status === 'assigned').length;
  const complete = assignments.filter((x) => x.status === 'completed').length;

  $('kpi-active').textContent = String(active);
  $('kpi-complete').textContent = String(complete);
  $('kpi-subs').textContent = String(submissionsCount || 0);

  $('tutor-list').innerHTML = enrichedAssignments.length
    ? enrichedAssignments.map(tutorItemHtml).join('')
    : '<p class="muted">No assignments yet. Create the first one on the left.</p>';
}

function parentAssignmentItemHtml(a) {
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';
  const studentName = a.student?.full_name || a.student?.email || 'Unknown student';
  const resourceHtml = a.resource_url
    ? `<p class="muted" style="margin:.4rem 0"><b>Resource:</b> <a href="${a.resource_url}" target="_blank" rel="noopener noreferrer">${a.resource_title || a.resource_url}</a></p>`
    : '';
  const submissionTag = a.submission
    ? `<span class="tag ok">Submitted: ${new Date(a.submission.submitted_at).toLocaleString()}</span>`
    : '<span class="tag warn">Not submitted yet</span>';
  const gradeHtml = a.submission
    ? `
      <p class="muted" style="margin:.35rem 0">
        <b>Mark:</b> ${a.submission.mark ?? '-'} &nbsp;·&nbsp;
        <b>Grade:</b> ${a.submission.grade || '-'}
      </p>
      <p class="muted" style="margin-bottom:.45rem"><b>Tutor Feedback:</b> ${a.submission.tutor_feedback || 'No feedback yet.'}</p>
    `
    : '<p class="muted" style="margin-bottom:.45rem"><b>Tutor Feedback:</b> Awaiting submission.</p>';

  return `
    <article class="item">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${studentName}</span>
        <span class="tag">${a.subject}</span>
        <span class="tag ${a.status === 'completed' ? 'ok' : 'warn'}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
        ${submissionTag}
      </div>
      <p class="muted">${desc}</p>
      ${resourceHtml}
      ${gradeHtml}
    </article>
  `;
}

async function renderParentTracker() {
  const { data: links, error: linksErr } = await sb
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', currentUser.id);

  if (linksErr) throw linksErr;

  const studentIds = [...new Set((links || []).map((l) => l.student_id).filter(Boolean))];
  $('kpi-parent-students').textContent = String(studentIds.length);

  if (!studentIds.length) {
    $('kpi-parent-total').textContent = '0';
    $('kpi-parent-complete').textContent = '0';
    $('parent-linked-students').innerHTML = '';
    $('parent-list').innerHTML = '<p class="muted">No linked students yet. Ask tutor to link your account.</p>';
    return;
  }

  let studentsById = new Map();
  const { data: students, error: studentsErr } = await sb
    .from('profiles')
    .select('id,full_name,email,year_group')
    .in('id', studentIds);
  if (!studentsErr && students?.length) {
    studentsById = new Map(students.map((s) => [s.id, s]));
  }

  $('parent-linked-students').innerHTML = studentIds.map((id) => {
    const s = studentsById.get(id);
    const label = s ? `${s.full_name || s.email}${s.year_group ? ` (${s.year_group})` : ''}` : id;
    return `<article class="item"><div class="meta"><span class="tag">Linked Student</span></div><p><b>${label}</b></p></article>`;
  }).join('');

  const { data: assignments, error: asgErr } = await sb
    .from('assignments')
    .select(`
      id,title,subject,description,resource_title,resource_url,due_date,status,created_at,student_id,
      student:profiles!assignments_student_id_fkey(full_name,email,year_group)
    `)
    .in('student_id', studentIds)
    .order('created_at', { ascending: false });

  if (asgErr) throw asgErr;

  const assignmentIds = (assignments || []).map((a) => a.id);
  let submissionMap = new Map();
  if (assignmentIds.length) {
    const { data: subs, error: subErr } = await sb
      .from('submissions')
      .select('assignment_id, notes, submitted_at, mark, grade, tutor_feedback, graded_at')
      .in('assignment_id', assignmentIds);
    if (subErr) throw subErr;
    submissionMap = new Map((subs || []).map((s) => [s.assignment_id, s]));
  }

  const enriched = (assignments || []).map((a) => ({ ...a, submission: submissionMap.get(a.id) || null }));
  $('kpi-parent-total').textContent = String(enriched.length);
  $('kpi-parent-complete').textContent = String(enriched.filter((x) => x.status === 'completed').length);
  $('parent-list').innerHTML = enriched.length
    ? enriched.map(parentAssignmentItemHtml).join('')
    : '<p class="muted">No assignments found for linked students.</p>';
}

function studentItemHtml(a) {
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';
  const resourceHtml = a.resource_url
    ? `<p class="muted" style="margin:.4rem 0"><b>Resource:</b> <a href="${a.resource_url}" target="_blank" rel="noopener noreferrer">${a.resource_title || a.resource_url}</a></p>`
    : '';
  const gradeHtml = a.submission
    ? `
      <p class="muted" style="margin:.35rem 0">
        <b>Mark:</b> ${a.submission.mark ?? '-'} &nbsp;·&nbsp;
        <b>Grade:</b> ${a.submission.grade || '-'}
      </p>
      <p class="muted" style="margin-bottom:.45rem"><b>Tutor Feedback:</b> ${a.submission.tutor_feedback || 'No feedback yet.'}</p>
    `
    : '';

  return `
    <article class="item" data-assignment-id="${a.id}">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${a.subject}</span>
        <span class="tag ${a.status === 'completed' ? 'ok' : 'warn'}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
      </div>
      <p class="muted" style="margin-bottom:.5rem">${desc}</p>
      ${resourceHtml}
      ${gradeHtml}
      <label style="margin-bottom:.35rem">Submission Notes</label>
      <textarea id="notes-${a.id}" placeholder="What did you complete? Add links/evidence if needed"></textarea>
      <div class="actions" style="margin-top:.45rem">
        <button class="btn blue small" type="button" data-action="submit" data-id="${a.id}">Submit Work</button>
      </div>
    </article>
  `;
}

async function renderStudentAssignments() {
  const { data, error } = await sb
    .from('assignments')
    .select('id,title,subject,description,resource_title,resource_url,due_date,status,created_at')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const assignmentIds = (data || []).map((a) => a.id);
  let submissionMap = new Map();
  if (assignmentIds.length) {
    const { data: subs, error: subErr } = await sb
      .from('submissions')
      .select('assignment_id, notes, submitted_at, mark, grade, tutor_feedback, graded_at')
      .in('assignment_id', assignmentIds)
      .eq('student_id', currentUser.id);

    if (subErr) throw subErr;
    submissionMap = new Map((subs || []).map((s) => [s.assignment_id, s]));
  }

  const enriched = (data || []).map((a) => ({ ...a, submission: submissionMap.get(a.id) || null }));

  $('student-list').innerHTML = enriched.length
    ? enriched.map(studentItemHtml).join('')
    : '<p class="muted">No assignments yet. Your tutor will assign work here.</p>';
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

  if (!studentId || !title) {
    showMsg($('asg-msg'), 'Select a student and add a title.', 'err');
    return;
  }

  const payload = {
    tutor_id: currentUser.id,
    student_id: studentId,
    subject,
    title,
    due_date: dueDate,
    description,
    resource_title: resourceTitle || null,
    resource_url: resourceUrl || null,
    status: 'assigned'
  };

  const { error } = await sb.from('assignments').insert(payload);
  if (error) {
    showMsg($('asg-msg'), error.message, 'err');
    return;
  }

  $('asg-title').value = '';
  $('asg-due').value = '';
  $('asg-desc').value = '';
  $('asg-resource-title').value = '';
  $('asg-resource-url').value = '';
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

  const { error } = await sb.from('parent_student_links').insert({
    parent_id: parentId,
    student_id: studentId
  });

  if (error) {
    showMsg($('link-msg'), error.message, 'err');
    return;
  }

  showMsg($('link-msg'), 'Parent linked to student.', 'ok');
  await renderParentLinksForTutor();
}

async function submitStudentWork(assignmentId) {
  const notes = ($(`notes-${assignmentId}`)?.value || '').trim();

  const { error: submitErr } = await sb.from('submissions').upsert(
    {
      assignment_id: assignmentId,
      student_id: currentUser.id,
      notes,
      submitted_at: new Date().toISOString()
    },
    { onConflict: 'assignment_id,student_id' }
  );

  if (submitErr) {
    alert(`Submission failed: ${submitErr.message}`);
    return;
  }

  const { error: updateErr } = await sb
    .from('assignments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .eq('student_id', currentUser.id);

  if (updateErr) {
    alert(`Status update failed: ${updateErr.message}`);
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
      alert('Mark must be a number between 0 and 100.');
      return;
    }
  }

  const { error } = await sb
    .from('submissions')
    .update({
      mark,
      grade: grade || null,
      tutor_feedback: feedback || null,
      graded_at: new Date().toISOString()
    })
    .eq('assignment_id', assignmentId);

  if (error) {
    alert(`Saving mark/grade failed: ${error.message}`);
    return;
  }

  alert('Mark/grade saved.');
  await renderTutorDashboard();
}

function bindStudentActions() {
  $('student-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="submit"]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    await submitStudentWork(id);
  });
}

function bindTutorActions() {
  $('tutor-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="save-grade"]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    await saveTutorGrade(id);
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
  clearMsg($('signin-msg'));
  const email = $('signin-email').value.trim();
  const password = $('signin-password').value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    showMsg($('signin-msg'), error.message, 'err');
    return;
  }

  $('signin-email').value = '';
  $('signin-password').value = '';
  showMsg($('signin-msg'), 'Signed in.', 'ok');
  await toSignedIn(data.user);
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
      data: { full_name, year_group: signupRole === 'student' ? year_group : null, signup_role: signupRole }
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

  $('btn-signin').addEventListener('click', handleSignIn);
  $('btn-signup').addEventListener('click', handleSignUp);
  $('btn-signout').addEventListener('click', async () => {
    await sb.auth.signOut();
    toSignedOut();
  });
  $('btn-refresh').addEventListener('click', async () => {
    if (!currentUser) return;
    await renderAppForRole();
  });
  $('btn-create-asg').addEventListener('click', createAssignment);
  $('btn-link-parent').addEventListener('click', linkParentToStudent);

  bindStudentActions();
  bindTutorActions();

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
