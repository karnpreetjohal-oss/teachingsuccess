/*
  Teaching Success Portal (Supabase)
  1) Fill SUPABASE_URL and SUPABASE_ANON_KEY
  2) Run supabase/schema.sql in Supabase SQL editor
*/

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

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
}

function tutorItemHtml(a) {
  const statusClass = a.status === 'completed' ? 'ok' : 'warn';
  const studentName = a.student?.full_name || a.student?.email || 'Unknown student';
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';

  return `
    <article class="item">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${a.subject}</span>
        <span class="tag">${studentName}</span>
        <span class="tag ${statusClass}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
      </div>
      <p class="muted">${desc}</p>
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

  const active = assignments.filter((x) => x.status === 'assigned').length;
  const complete = assignments.filter((x) => x.status === 'completed').length;

  $('kpi-active').textContent = String(active);
  $('kpi-complete').textContent = String(complete);
  $('kpi-subs').textContent = String(submissionsCount || 0);

  $('tutor-list').innerHTML = assignments.length
    ? assignments.map(tutorItemHtml).join('')
    : '<p class="muted">No assignments yet. Create the first one on the left.</p>';
}

function studentItemHtml(a) {
  const due = formatDate(a.due_date);
  const desc = a.description || 'No instructions provided.';

  return `
    <article class="item" data-assignment-id="${a.id}">
      <h3>${a.title}</h3>
      <div class="meta">
        <span class="tag">${a.subject}</span>
        <span class="tag ${a.status === 'completed' ? 'ok' : 'warn'}">${a.status}</span>
        <span class="tag">Due: ${due}</span>
      </div>
      <p class="muted" style="margin-bottom:.5rem">${desc}</p>
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
    .select('id,title,subject,description,due_date,status,created_at')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  $('student-list').innerHTML = data.length
    ? data.map(studentItemHtml).join('')
    : '<p class="muted">No assignments yet. Your tutor will assign work here.</p>';
}

async function createAssignment() {
  clearMsg($('asg-msg'));

  const studentId = $('asg-student').value;
  const subject = $('asg-subject').value;
  const title = $('asg-title').value.trim();
  const dueDate = $('asg-due').value || null;
  const description = $('asg-desc').value.trim();

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
  showMsg($('asg-msg'), 'Assignment created.', 'ok');
  await renderTutorDashboard();
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

function bindStudentActions() {
  $('student-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="submit"]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    await submitStudentWork(id);
  });
}

async function renderAppForRole() {
  $('who-name').textContent = currentProfile.full_name || currentUser.email;
  $('who-role').textContent = `Role: ${currentProfile.role}`;

  if (currentProfile.role === 'tutor') {
    $('tutor-view').classList.remove('hidden');
    $('student-view').classList.add('hidden');
    await loadStudentsForTutor();
    await renderTutorDashboard();
    return;
  }

  $('tutor-view').classList.add('hidden');
  $('student-view').classList.remove('hidden');
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
  const year_group = $('signup-year').value || null;

  if (!full_name || !email || password.length < 8) {
    showMsg($('signup-msg'), 'Use full name, valid email, and password with 8+ characters.', 'err');
    return;
  }

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, year_group }
    }
  });

  if (error) {
    showMsg($('signup-msg'), error.message, 'err');
    return;
  }

  $('signup-name').value = '';
  $('signup-email').value = '';
  $('signup-password').value = '';
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

  bindStudentActions();

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
