import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const BASE = process.env.E2E_API_BASE || 'http://localhost:5000/api';
const PASSWORD = 'Etnova#12345';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[FAIL] Missing env: ${key}`);
    process.exit(1);
  }
}

const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const suffix = Date.now();
const leaderEmail = `qa_leader_${suffix}@etnova.edu`;
const requesterEmail = `qa_requester_${suffix}@etnova.edu`;

let leaderUserId = null;
let requesterUserId = null;
let projectId = null;

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
}

function logFail(msg) {
  console.error(`[FAIL] ${msg}`);
}

async function api(token, method, path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message = data?.message || `${resp.status} ${resp.statusText}`;
    throw new Error(`${method} ${path} -> ${message}`);
  }
  return data;
}

async function createUser(email, fullName, roll, section) {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'student' },
  });
  if (createError) throw createError;
  const userId = created.user.id;

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: fullName,
      role: 'student',
      roll_number: roll,
      department: 'Computer Science',
      semester: 6,
      class_section: section,
    })
    .eq('id', userId);
  if (profileError) throw profileError;

  const { data: signIn, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw signInError;

  return {
    userId,
    token: signIn.session.access_token,
  };
}

async function cleanup() {
  try {
    if (projectId) {
      await supabaseAdmin.from('projects').delete().eq('id', projectId);
    }
  } catch (e) {
    console.error('[WARN] cleanup project failed:', e.message);
  }
  try {
    if (leaderUserId) {
      await supabaseAdmin.auth.admin.deleteUser(leaderUserId);
    }
  } catch (e) {
    console.error('[WARN] cleanup leader failed:', e.message);
  }
  try {
    if (requesterUserId) {
      await supabaseAdmin.auth.admin.deleteUser(requesterUserId);
    }
  } catch (e) {
    console.error('[WARN] cleanup requester failed:', e.message);
  }
}

async function run() {
  console.log('Running join-flow E2E...');
  const health = await fetch('http://localhost:5000/health');
  if (!health.ok) throw new Error('Backend not reachable on http://localhost:5000');
  logPass('Backend reachable');

  const leader = await createUser(leaderEmail, 'QA Leader', `LEAD-${suffix}`, 'A');
  leaderUserId = leader.userId;
  logPass('Leader user created/sign-in');

  const requester = await createUser(requesterEmail, 'QA Requester', `REQ-${suffix}`, 'B');
  requesterUserId = requester.userId;
  logPass('Requester user created/sign-in');

  const createdProject = await api(leader.token, 'POST', '/projects', {
    title: `QA Project ${suffix}`,
    description: 'QA project for join request flow',
    abstract: 'QA abstract',
  });
  projectId = createdProject.id;
  logPass('Leader project created');

  await api(requester.token, 'POST', `/projects/${projectId}/join-requests`, {});
  logPass('Requester sent join request');

  const leaderNotifications1 = await api(leader.token, 'GET', '/notifications');
  const gotLeaderNotification = leaderNotifications1.some((n) => n.type === 'join_request');
  if (!gotLeaderNotification) throw new Error('Leader did not receive join request notification');
  logPass('Leader received join request notification');

  const leaderRequests1 = await api(leader.token, 'GET', '/join-requests/leader');
  const pending1 = leaderRequests1.find((r) => r.project_id === projectId && r.student_id === requesterUserId);
  if (!pending1) throw new Error('Leader pending list missing request');
  logPass('Leader pending list shows request');

  await api(leader.token, 'PUT', `/join-requests/${pending1.id}`, { action: 'reject' });
  logPass('Leader rejected request');

  const requesterNotifications1 = await api(requester.token, 'GET', '/notifications');
  const gotRejectNotification = requesterNotifications1.some((n) => n.type === 'join_request_rejected');
  if (!gotRejectNotification) throw new Error('Requester did not receive rejection notification');
  logPass('Requester received rejection notification');

  await api(requester.token, 'POST', `/projects/${projectId}/join-requests`, {});
  logPass('Requester re-requested successfully after rejection');

  const leaderRequests2 = await api(leader.token, 'GET', '/join-requests/leader');
  const pending2 = leaderRequests2.find((r) => r.project_id === projectId && r.student_id === requesterUserId);
  if (!pending2) throw new Error('Re-request is not pending for leader');
  logPass('Re-request visible to leader');

  await api(leader.token, 'PUT', `/join-requests/${pending2.id}`, { action: 'approve' });
  logPass('Leader approved request');

  const requesterNotifications2 = await api(requester.token, 'GET', '/notifications');
  const gotApproveNotification = requesterNotifications2.some((n) => n.type === 'join_request_approved');
  if (!gotApproveNotification) throw new Error('Requester did not receive approval notification');
  logPass('Requester received approval notification');

  const requesterProjects = await api(requester.token, 'GET', '/projects');
  const inProject = requesterProjects.some((p) => p.id === projectId);
  if (!inProject) throw new Error('Requester not added to team after approval');
  logPass('Requester added to team');

  await api(leader.token, 'DELETE', `/projects/${projectId}/team/${requesterUserId}`);
  logPass('Leader removed approved member');

  const requesterNotifications3 = await api(requester.token, 'GET', '/notifications');
  const gotRemovalNotification = requesterNotifications3.some((n) => n.type === 'team_member_removed');
  if (!gotRemovalNotification) throw new Error('Removed member did not receive removal notification');
  logPass('Removed member received removal notification');

  const requesterProjectsAfterRemoval = await api(requester.token, 'GET', '/projects');
  const stillInProject = requesterProjectsAfterRemoval.some((p) => p.id === projectId);
  if (stillInProject) throw new Error('Removed member still appears in project list');
  logPass('Removed member no longer appears in project');

  console.log('E2E join flow passed.');
}

run()
  .catch((err) => {
    logFail(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
