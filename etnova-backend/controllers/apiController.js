import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../config/supabase.js';

const supabase = supabaseAdmin;
const PEOPLE_IMPORT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const IMPORT_ROLE_ADMIN_KEYWORDS = ['admin', 'hod', 'head', 'head of department', 'coordinator'];

const PEOPLE_IMPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          full_name: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          employee_id: { type: ['string', 'null'] },
          department: { type: ['string', 'null'] },
          specialization: {
            type: 'array',
            items: { type: 'string' },
          },
          role: {
            type: 'string',
            enum: ['admin', 'mentor'],
          },
        },
        required: ['full_name', 'email', 'employee_id', 'department', 'specialization', 'role'],
      },
    },
  },
  required: ['people'],
};

const normalizeDepartmentName = (value) => {
  const cleaned = normalizeTextField(value, { maxLength: 120 });
  if (!cleaned) return null;

  const key = cleaned.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const departmentMap = {
    cse: 'Computer Science',
    computerscience: 'Computer Science',
    computerscienceengineering: 'Computer Science',
    cs: 'Computer Science',
    ai: 'Artificial Intelligence',
    aiml: 'Artificial Intelligence and Machine Learning',
    artificialintelligence: 'Artificial Intelligence',
    artificialintelligenceandmachinelearning: 'Artificial Intelligence and Machine Learning',
    it: 'Information Technology',
    informationtechnology: 'Information Technology',
    ece: 'Electronics and Communication Engineering',
    electronicsandcommunicationengineering: 'Electronics and Communication Engineering',
    eee: 'Electrical and Electronics Engineering',
    electricalandelectronicsengineering: 'Electrical and Electronics Engineering',
    mech: 'Mechanical Engineering',
    mechanicalengineering: 'Mechanical Engineering',
    civil: 'Civil Engineering',
    civilengineering: 'Civil Engineering',
  };

  return departmentMap[key] || cleaned.replace(/\s+/g, ' ').trim();
};

const normalizeSpecializationList = (value) => {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[,;/\n]+/)
      .map((item) => item.trim());

  return [...new Set(
    rawValues
      .map((item) => normalizeTextField(item, { maxLength: 80 }))
      .filter(Boolean)
  )].slice(0, 12);
};

const inferImportedRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'mentor';
  return IMPORT_ROLE_ADMIN_KEYWORDS.some((keyword) => normalized.includes(keyword)) ? 'admin' : 'mentor';
};

const normalizeImportedPerson = (person = {}) => {
  const specialization = normalizeSpecializationList(person.specialization);
  return {
    full_name: normalizeTextField(person.full_name, { maxLength: 150 }),
    email: normalizeTextField(person.email, { maxLength: 160 })?.toLowerCase() || null,
    employee_id: normalizeTextField(person.employee_id, { maxLength: 60 }),
    department: normalizeDepartmentName(person.department),
    specialization,
    role: inferImportedRole(person.role),
  };
};

const normalizeImportHeaderKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const IMPORT_HEADER_ALIASES = {
  full_name: ['full_name', 'name', 'mentor_name', 'faculty_name', 'staff_name'],
  email: ['email', 'email_id', 'mail', 'mail_id'],
  employee_id: ['employee_id', 'employeeid', 'emp_id', 'staff_id', 'faculty_id', 'id'],
  department: ['department', 'dept', 'branch'],
  specialization: ['specialization', 'specialisation', 'skills', 'skill', 'domains', 'domain', 'expertise', 'area_of_interest', 'domain_of_interest'],
  role: ['role', 'designation', 'title', 'position'],
};

const STUDENT_IMPORT_HEADER_ALIASES = {
  full_name: ['full_name', 'name', 'student_name'],
  email: ['email', 'email_id', 'mail', 'mail_id'],
  class_section: ['class_section', 'class', 'section', 'batch'],
  roll_number: ['roll_number', 'rollno', 'roll_no', 'register_number', 'register_no', 'reg_no', 'student_roll_number'],
  department: ['department', 'dept', 'branch'],
};

const pickWorkbookField = (row, aliases) => {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim()) {
      return row[alias];
    }
  }
  return null;
};

const extractPeopleFromWorkbook = (fileBase64) => {
  const workbookBuffer = Buffer.from(String(fileBase64 || ''), 'base64');
  const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });
  const people = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    for (const rawRow of rows) {
      const normalizedRow = Object.fromEntries(
        Object.entries(rawRow || {}).map(([key, value]) => [normalizeImportHeaderKey(key), value])
      );

      const person = normalizeImportedPerson({
        full_name: pickWorkbookField(normalizedRow, IMPORT_HEADER_ALIASES.full_name),
        email: pickWorkbookField(normalizedRow, IMPORT_HEADER_ALIASES.email),
        employee_id: pickWorkbookField(normalizedRow, IMPORT_HEADER_ALIASES.employee_id),
        department: pickWorkbookField(normalizedRow, IMPORT_HEADER_ALIASES.department),
        specialization: pickWorkbookField(normalizedRow, IMPORT_HEADER_ALIASES.specialization),
        role: pickWorkbookField(normalizedRow, IMPORT_HEADER_ALIASES.role),
      });

      if (
        person.full_name
        || person.email
        || person.employee_id
        || person.department
        || person.specialization.length > 0
      ) {
        people.push(person);
      }
    }
  }

  return people;
};

const normalizeImportedStudent = (student = {}) => ({
  full_name: normalizeTextField(student.full_name, { maxLength: 150 }),
  email: normalizeTextField(student.email, { maxLength: 160 })?.toLowerCase() || null,
  class_section: normalizeClassSectionInput(student.class_section),
  roll_number: normalizeTextField(student.roll_number, { maxLength: 60 }),
  department: normalizeDepartmentName(student.department),
});

const extractStudentsFromWorkbook = (fileBase64) => {
  const workbookBuffer = Buffer.from(String(fileBase64 || ''), 'base64');
  const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });
  const students = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    for (const rawRow of rows) {
      const normalizedRow = Object.fromEntries(
        Object.entries(rawRow || {}).map(([key, value]) => [normalizeImportHeaderKey(key), value])
      );

      const student = normalizeImportedStudent({
        full_name: pickWorkbookField(normalizedRow, STUDENT_IMPORT_HEADER_ALIASES.full_name),
        email: pickWorkbookField(normalizedRow, STUDENT_IMPORT_HEADER_ALIASES.email),
        class_section: pickWorkbookField(normalizedRow, STUDENT_IMPORT_HEADER_ALIASES.class_section),
        roll_number: pickWorkbookField(normalizedRow, STUDENT_IMPORT_HEADER_ALIASES.roll_number),
        department: pickWorkbookField(normalizedRow, STUDENT_IMPORT_HEADER_ALIASES.department),
      });

      if (
        student.full_name
        || student.email
        || student.class_section
        || student.roll_number
        || student.department
      ) {
        students.push(student);
      }
    }
  }

  return students;
};

const parseStudentsFromJsonPayload = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(normalizeImportedStudent).filter((student) => (
      student.full_name || student.email || student.class_section || student.roll_number || student.department
    ));
  }

  if (typeof value === 'object') {
    const nestedRows = Array.isArray(value.students)
      ? value.students
      : Array.isArray(value.people)
        ? value.people
        : null;
    if (nestedRows) {
      return nestedRows.map(normalizeImportedStudent).filter((student) => (
        student.full_name || student.email || student.class_section || student.roll_number || student.department
      ));
    }
  }

  return [];
};

const parseDelimitedStudentText = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const separator = lines[0].includes('\t') ? '\t' : ',';
  if (!lines[0].includes(separator)) return [];

  const headers = lines[0].split(separator).map((value) => normalizeImportHeaderKey(value));
  const hasRelevantHeader = headers.some((header) => [
    ...STUDENT_IMPORT_HEADER_ALIASES.full_name,
    ...STUDENT_IMPORT_HEADER_ALIASES.email,
    ...STUDENT_IMPORT_HEADER_ALIASES.class_section,
    ...STUDENT_IMPORT_HEADER_ALIASES.roll_number,
    ...STUDENT_IMPORT_HEADER_ALIASES.department,
  ].includes(header));

  if (!hasRelevantHeader) return [];

  return lines.slice(1).map((line) => {
    const values = line.split(separator);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return normalizeImportedStudent({
      full_name: pickWorkbookField(row, STUDENT_IMPORT_HEADER_ALIASES.full_name),
      email: pickWorkbookField(row, STUDENT_IMPORT_HEADER_ALIASES.email),
      class_section: pickWorkbookField(row, STUDENT_IMPORT_HEADER_ALIASES.class_section),
      roll_number: pickWorkbookField(row, STUDENT_IMPORT_HEADER_ALIASES.roll_number),
      department: pickWorkbookField(row, STUDENT_IMPORT_HEADER_ALIASES.department),
    });
  }).filter((student) => (
    student.full_name || student.email || student.class_section || student.roll_number || student.department
  ));
};

const STUDENT_TEXT_PATTERNS = {
  full_name: /(?:^|\n)\s*(?:full[_\s-]*name|name)\s*[:\-]\s*(.+)$/im,
  email: /(?:^|\n)\s*(?:email|email[_\s-]*id|mail)\s*[:\-]\s*(.+)$/im,
  class_section: /(?:^|\n)\s*(?:class[_\s-]*section|class|section|batch)\s*[:\-]\s*(.+)$/im,
  roll_number: /(?:^|\n)\s*(?:roll[_\s-]*number|roll[_\s-]*no|register[_\s-]*number|register[_\s-]*no|reg[_\s-]*no)\s*[:\-]\s*(.+)$/im,
  department: /(?:^|\n)\s*(?:department|dept|branch)\s*[:\-]\s*(.+)$/im,
};

const fallbackExtractStudentsFromText = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const parsedJson = extractJsonObjectFromText(text);
  const jsonStudents = parseStudentsFromJsonPayload(parsedJson);
  if (jsonStudents.length > 0) return jsonStudents;

  const delimitedStudents = parseDelimitedStudentText(text);
  if (delimitedStudents.length > 0) return delimitedStudents;

  const blocks = text
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const getMatch = (key) => {
      const match = block.match(STUDENT_TEXT_PATTERNS[key]);
      return match?.[1] ? match[1].trim() : null;
    };

    return normalizeImportedStudent({
      full_name: getMatch('full_name'),
      email: getMatch('email'),
      class_section: getMatch('class_section'),
      roll_number: getMatch('roll_number'),
      department: getMatch('department'),
    });
  }).filter((student) => (
    student.full_name || student.email || student.class_section || student.roll_number || student.department
  ));
};

const parseStructuredStudentsPayload = (value) => {
  if (!value) return [];
  const rawPayload = typeof value === 'string' ? extractJsonObjectFromText(value) : value;
  const rows = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload?.students)
      ? rawPayload.students
      : [];

  return rows.map(normalizeImportedStudent);
};

const buildStudentImportSummary = (students) => ({
  extractedCount: students.length,
  validStudentCount: students.filter((student) => student.full_name && student.email).length,
});

const extractJsonObjectFromText = (value) => {
  const source = String(value || '').trim();
  if (!source) return null;

  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(source.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
};

const parseStructuredPeoplePayload = (value) => {
  if (!value) return [];

  const payload = Array.isArray(value)
    ? { people: value }
    : (typeof value === 'object' ? value : extractJsonObjectFromText(value));

  const people = Array.isArray(payload?.people)
    ? payload.people
    : Array.isArray(payload)
      ? payload
      : [];

  return people.map(normalizeImportedPerson).filter((person) => (
    person.full_name
    || person.email
    || person.employee_id
    || person.department
    || person.specialization.length > 0
  ));
};

const splitImportRecords = (text) => {
  const normalized = String(text || '').replace(/\r/g, '').trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length > 1) return blocks;

  return normalized
    .split(/\n(?=(?:\d+\.\s+)?(?:name|full name|mentor|admin|coordinator|hod|head|email)\b)/i)
    .map((block) => block.trim())
    .filter(Boolean);
};

const HEURISTIC_FIELD_PATTERNS = {
  full_name: /(?:^|\n)\s*(?:name|full name)\s*[:\-]\s*(.+)$/im,
  email: /(?:^|\n)\s*email\s*[:\-]\s*([^\s,;]+)/im,
  employee_id: /(?:^|\n)\s*(?:employee\s*id|employee_id|emp\s*id|staff\s*id|id)\s*[:\-]\s*([A-Za-z0-9/_-]+)/im,
  department: /(?:^|\n)\s*department\s*[:\-]\s*(.+)$/im,
  specialization: /(?:^|\n)\s*(?:specialization|specialisation|skills?|domains?|domain of interest|area of interest|expertise)\s*[:\-]\s*(.+)$/im,
  title: /(?:^|\n)\s*(?:title|role|designation|position)\s*[:\-]\s*(.+)$/im,
};

const extractHeuristicPerson = (record) => {
  const getMatch = (key) => {
    const match = String(record || '').match(HEURISTIC_FIELD_PATTERNS[key]);
    return match?.[1]?.trim() || null;
  };

  const fullName = getMatch('full_name');
  const email = getMatch('email');
  const employeeId = getMatch('employee_id');
  const department = getMatch('department');
  const specialization = getMatch('specialization');
  const title = getMatch('title');

  if (!fullName && !email && !employeeId) return null;

  return normalizeImportedPerson({
    full_name: fullName,
    email,
    employee_id: employeeId,
    department,
    specialization,
    role: title,
  });
};

const fallbackExtractPeopleFromText = (rawText) => {
  const directJson = parseStructuredPeoplePayload(rawText);
  if (directJson.length > 0) return directJson;

  return splitImportRecords(rawText)
    .map(extractHeuristicPerson)
    .filter(Boolean);
};

async function extractPeopleWithOpenAI(rawText) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PEOPLE_IMPORT_OPENAI_MODEL,
        reasoning: { effort: 'low' },
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are a highly accurate multi-person data extraction system.',
                  'Extract all individuals from the provided text and classify each one separately.',
                  'Return only JSON matching the schema.',
                  'Fields per person: full_name, email, employee_id, department, specialization, role.',
                  'Role rule: assign "admin" if title includes admin, hod, head, head of department, or coordinator. Otherwise assign "mentor".',
                  'Do not merge people. Do not hallucinate. Missing values must be null. specialization must be an array of strings.',
                  'Normalize department names and clean values.',
                ].join('\n'),
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: rawText,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'people_import',
            strict: true,
            schema: PEOPLE_IMPORT_SCHEMA,
          },
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return null;
    }

    return parseStructuredPeoplePayload(data?.output_text || data);
  } catch {
    return null;
  }
}

async function extractTextFromImportPayload({ fileName, mimeType, text, fileBase64 }) {
  const normalizedMimeType = String(mimeType || '').toLowerCase();
  const normalizedFileName = String(fileName || '').toLowerCase();

  if (typeof text === 'string' && text.trim()) {
    return text;
  }

  if (fileBase64 && (normalizedMimeType.includes('pdf') || normalizedFileName.endsWith('.pdf'))) {
    const pdfBuffer = Buffer.from(String(fileBase64), 'base64');
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const parsedPdf = await parser.getText();
      return String(parsedPdf?.text || '').trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (
    fileBase64
    && (
      normalizedMimeType.includes('spreadsheet')
      || normalizedMimeType.includes('excel')
      || normalizedFileName.endsWith('.xlsx')
      || normalizedFileName.endsWith('.xls')
      || normalizedFileName.endsWith('.csv')
    )
  ) {
    const workbookBuffer = Buffer.from(String(fileBase64), 'base64');
    const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });
    return workbook.SheetNames
      .map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
        return csv ? `Sheet: ${sheetName}\n${csv}` : '';
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  if (fileBase64) {
    return Buffer.from(String(fileBase64), 'base64').toString('utf8').trim();
  }

  return '';
}

function buildImportSummary(people) {
  return {
    extractedCount: people.length,
    mentorCount: people.filter((person) => person.role === 'mentor').length,
    adminCount: people.filter((person) => person.role === 'admin').length,
    validMentorCount: people.filter((person) => person.role === 'mentor' && person.full_name && person.email).length,
  };
}

function createTemporaryPassword() {
  return `Etnova!${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

async function createImportedAuthUser({ email, role }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: createTemporaryPassword(),
    email_confirm: true,
    user_metadata: { role },
  });

  if (error) throw error;
  return data?.user || null;
}

const safeProfileName = (profile, fallback = 'Student') => {
  return profile?.full_name || profile?.email || fallback;
};

const LOCKED_PROJECT_STATUSES = new Set(['approved', 'completed']);
const isProjectLocked = (status) => LOCKED_PROJECT_STATUSES.has((status || '').toLowerCase());
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

const enrichProjectsWithAllocations = async (projects) => {
  if (!projects?.length) return projects || [];

  const projectIds = [...new Set(projects.map((project) => project?.id).filter(isUuid))];
  if (projectIds.length === 0) return projects;

  const { data: allocations, error: allocError } = await supabase
    .from('guide_allocations')
    .select(`
      id,
      project_id,
      guide_id,
      status,
      assigned_at,
      comment,
      guide:profiles!guide_allocations_guide_id_fkey(
        id,
        full_name,
        email,
        department
      )
    `)
    .eq('status', 'active')
    .in('project_id', projectIds)
    .order('assigned_at', { ascending: false });

  if (allocError) {
    throw allocError;
  }

  const allocationMap = new Map();
  (allocations || []).forEach((row) => {
    if (!row?.project_id) return;
    if (!allocationMap.has(row.project_id)) {
      allocationMap.set(row.project_id, row);
    }
  });

  return projects.map((project) => {
    const activeAllocation = allocationMap.get(project.id) || null;
    const allocatedGuide = activeAllocation?.guide || null;

    return {
      ...project,
      mentor: allocatedGuide || project.mentor || null,
      guide_allocation: activeAllocation
        ? {
          id: activeAllocation.id,
          guide_id: activeAllocation.guide_id,
          status: activeAllocation.status,
          assigned_at: activeAllocation.assigned_at,
          comment: activeAllocation.comment || null,
        }
        : null,
    };
  });
};

const getProjectAnchorProfile = (project) => {
  const members = Array.isArray(project?.team_members) ? project.team_members : [];
  const leader = members.find((member) => member?.role === 'leader');
  const orderedMembers = leader ? [leader, ...members.filter((member) => member !== leader)] : members;

  for (const member of orderedMembers) {
    const profile = Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles;
    if (profile) return profile;
  }

  return null;
};

const mapProjectIdeaSnapshot = (idea) => {
  if (!idea?.id) return null;
  return {
    id: idea.id,
    title: idea.title || '',
    domain: idea.domain || '',
    subdomain: idea.subdomain || '',
    description: idea.description || '',
    technologies: Array.isArray(idea.technologies) ? idea.technologies : [],
    confidence_score: typeof idea.confidence_score === 'number' ? idea.confidence_score : 0,
    keywords: Array.isArray(idea.keywords) ? idea.keywords : [],
    status: idea.status || '',
    submitted_at: idea.submitted_at || null,
    created_at: idea.created_at || null,
    updated_at: idea.updated_at || null,
  };
};

const isMentorVisibleIdeaSnapshot = (idea) => {
  if (!idea?.id) return false;
  const status = String(idea.status || '').toLowerCase();
  return Boolean(
    idea.submitted_at
    || ['submitted', 'revision_required', 'rejected', 'approved'].includes(status)
  );
};

const enrichProjectsWithIdeaSnapshots = async (projects) => {
  if (!projects?.length) return projects || [];

  const ideaIds = [...new Set(
    (projects || [])
      .flatMap((project) => [project?.approved_idea_id, project?.current_idea_id])
      .filter(isUuid)
  )];

  if (!ideaIds.length) {
    return (projects || []).map((project) => ({
      ...project,
      approved_idea: null,
      current_idea: null,
      active_idea: null,
      mentor_visible_idea: null,
    }));
  }

  const { data: ideas, error } = await supabase
    .from('project_ideas')
    .select(`
      id,
      title,
      domain,
      subdomain,
      description,
      technologies,
      confidence_score,
      keywords,
      status,
      submitted_at,
      created_at,
      updated_at
    `)
    .in('id', ideaIds);

  if (error) throw error;

  const ideaById = new Map((ideas || []).map((idea) => [idea.id, mapProjectIdeaSnapshot(idea)]));

  return (projects || []).map((project) => {
    const approvedIdea = ideaById.get(project?.approved_idea_id) || null;
    const currentIdea = ideaById.get(project?.current_idea_id) || null;
    const activeIdea = approvedIdea || currentIdea || null;
    const mentorVisibleIdea = isMentorVisibleIdeaSnapshot(approvedIdea)
      ? approvedIdea
      : (isMentorVisibleIdeaSnapshot(currentIdea) ? currentIdea : null);

    return {
      ...project,
      approved_idea: approvedIdea,
      current_idea: currentIdea,
      active_idea: activeIdea,
      mentor_visible_idea: mentorVisibleIdea,
    };
  });
};

const enrichProjectsWithCoordinatorFallback = async (projects) => {
  if (!projects?.length) return projects || [];

  const missingCoordinatorProjects = projects.filter((project) => !project?.coordinator);
  if (!missingCoordinatorProjects.length) return projects;

  const classSections = [...new Set(
    missingCoordinatorProjects
      .map((project) => {
        const anchor = getProjectAnchorProfile(project);
        return String(anchor?.batch || anchor?.class_section || '').trim();
      })
      .filter(Boolean)
  )];

  if (!classSections.length) return projects;

  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, class_section')
    .in('class_section', classSections);

  if (classesError) {
    throw classesError;
  }

  const classIdBySection = new Map(
    (classes || []).map((row) => [String(row.class_section || '').trim(), row.id])
  );
  const classIds = [...new Set((classes || []).map((row) => row.id).filter(Boolean))];
  if (!classIds.length) return projects;

  const { data: coordinatorRows, error: coordinatorsError } = await supabase
    .from('profiles')
    .select('id, full_name, email, department, class_id')
    .eq('is_coordinator', true)
    .in('class_id', classIds)
    .order('full_name', { ascending: true });

  if (coordinatorsError) {
    throw coordinatorsError;
  }

  const coordinatorsByClassId = new Map();
  (coordinatorRows || []).forEach((row) => {
    if (!row?.class_id) return;
    if (!coordinatorsByClassId.has(row.class_id)) {
      coordinatorsByClassId.set(row.class_id, []);
    }
    coordinatorsByClassId.get(row.class_id).push({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      department: row.department,
    });
  });

  return projects.map((project) => {
    if (project?.coordinator) return project;

    const anchor = getProjectAnchorProfile(project);
    const classSection = String(anchor?.batch || anchor?.class_section || '').trim();
    const classId = classIdBySection.get(classSection);
    if (!classId) return project;

    const candidates = coordinatorsByClassId.get(classId) || [];
    if (!candidates.length) return project;

    const departmentMatch = anchor?.department
      ? candidates.find((candidate) => candidate.department === anchor.department)
      : null;

    return {
      ...project,
      coordinator: departmentMatch || candidates[0],
    };
  });
};

const enrichStudentProjects = async (projects) => {
  const withAllocations = await enrichProjectsWithAllocations(projects || []);
  const withIdeaSnapshots = await enrichProjectsWithIdeaSnapshots(withAllocations);
  return enrichProjectsWithCoordinatorFallback(withIdeaSnapshots);
};

const STUDENT_PROJECT_SELECT = `
  *,
  mentor:profiles!projects_mentor_id_fkey(id, full_name, email, department),
  guide:profiles!projects_guide_id_fkey(id, full_name, email, department),
  coordinator:profiles!projects_coordinator_id_fkey(id, full_name, email, department),
  team_members(
    id,
    student_id,
    role,
    joined_at,
    profiles!team_members_student_id_fkey(
      id,
      full_name,
      email,
      roll_number,
      department,
      batch,
      class_section
    )
  ),
  documents(id, document_type, status, uploaded_at, file_name, file_url, version, feedback),
  evaluations(id, evaluation_type, obtained_marks, max_marks, feedback, created_at)
`;
const createNotifications = async (rows) => {
  if (!rows?.length) return;
  const validRows = rows.filter((r) => r?.user_id && r?.title && r?.message && r?.type);
  if (!validRows.length) return;
  const { error } = await supabase.from('notifications').insert(validRows);
  if (error) {
    console.error('Notification insert skipped:', error.message);
  }
};

const normalizeTextField = (value, { required = false, maxLength = 5000 } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) {
    if (required) return null;
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    if (required) return null;
    return null;
  }

  return normalized.slice(0, maxLength);
};

const normalizeLooseKey = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeClassSectionInput = (value) => {
  const normalized = normalizeTextField(value, { maxLength: 120 });
  if (!normalized) return null;
  return String(normalized).replace(/\s+/g, ' ').trim().toUpperCase();
};

const resolveProfileClassAssignment = async ({ classSection, semester, department }) => {
  if (classSection === undefined) {
    return {};
  }

  const normalizedInput = normalizeClassSectionInput(classSection);
  if (!normalizedInput) {
    return { class_section: null, class_id: null };
  }

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, class_section, department')
    .order('class_section', { ascending: true });

  if (error) throw error;

  const parsedSemester = Number.parseInt(semester, 10);
  const semesterToken = Number.isFinite(parsedSemester) && parsedSemester > 0 ? `S${parsedSemester}` : null;
  const departmentKey = normalizeLooseKey(department);
  const exactKey = normalizeLooseKey(normalizedInput);
  const sectionLetter = /^[A-Z]$/.test(normalizedInput) ? normalizedInput : null;

  const rows = (classes || []).map((row) => ({
    id: row.id,
    classSection: String(row.class_section || '').trim(),
    classKey: normalizeClassSectionInput(row.class_section),
    departmentKey: normalizeLooseKey(row.department),
  }));

  let match = rows.find((row) => normalizeLooseKey(row.classKey) === exactKey) || null;

  if (!match && sectionLetter) {
    let candidates = rows.filter((row) => row.classKey?.endsWith(` ${sectionLetter}`) || row.classKey === sectionLetter);

    if (semesterToken) {
      const semesterMatches = candidates.filter((row) => row.classKey?.startsWith(`${semesterToken} `));
      if (semesterMatches.length) {
        candidates = semesterMatches;
      }
    }

    if (departmentKey) {
      const departmentMatches = candidates.filter((row) => row.departmentKey === departmentKey);
      if (departmentMatches.length) {
        candidates = departmentMatches;
      }
    }

    match = candidates[0] || null;
  }

  return {
    class_section: match?.classSection || normalizedInput,
    class_id: match?.id || null,
  };
};

const normalizeTechnologyStacks = (value) => {
  if (value === undefined) return undefined;

  const raw = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((item) => item.trim());

  const unique = [...new Set(
    raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => item.slice(0, 40))
  )];

  return unique.slice(0, 20);
};

const normalizeRecommendationTagList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }

  return [...new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )];
};

const getRecommendationMentorCapacity = (mentor) => {
  const value = Number(mentor?.max_team_capacity);
  return Number.isFinite(value) && value > 0 ? value : 2;
};

const tokenizeRecommendationTerms = (values) => {
  return [...new Set(
    values
      .flatMap((value) => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
  )];
};

const buildRecommendationProjectSignals = (project) => {
  const domain = String(project?.detected_domain || project?.domain || '').trim();
  const subdomain = String(project?.detected_subdomain || '').trim();
  const keywords = normalizeRecommendationTagList(project?.detected_keywords || []);
  const technologies = normalizeRecommendationTagList(project?.technologies || []);
  const department = String(project?.team_department || '').trim();

  return {
    domain,
    subdomain,
    keywords,
    technologies,
    department,
    terms: tokenizeRecommendationTerms([domain, subdomain, ...keywords, ...technologies]),
  };
};

const scoreGuideRecommendation = (project, mentor, workload) => {
  const signals = buildRecommendationProjectSignals(project);
  const interests = normalizeRecommendationTagList(mentor?.domains_of_interest);
  const mentorTerms = tokenizeRecommendationTerms([mentor?.specialization || '', ...interests]);
  const mentorDepartment = String(mentor?.department || '').trim().toLowerCase();
  const projectDepartment = String(signals.department || '').trim().toLowerCase();
  const capacity = getRecommendationMentorCapacity(mentor);
  const remainingCapacity = capacity - workload;

  let score = 20;
  const reasons = [];

  const hasDomainMatch = signals.domain && interests.some(
    (item) => item.toLowerCase().includes(signals.domain.toLowerCase())
      || signals.domain.toLowerCase().includes(item.toLowerCase())
  );
  if (hasDomainMatch) {
    score += 32;
    reasons.push('domain interest aligned');
  }

  const hasSubdomainMatch = signals.subdomain && mentorTerms.some(
    (term) => signals.subdomain.toLowerCase().includes(term) || term.includes(signals.subdomain.toLowerCase())
  );
  if (hasSubdomainMatch) {
    score += 18;
    reasons.push('subdomain aligned');
  }

  const keywordMatches = signals.terms.filter((term) => mentorTerms.includes(term));
  if (keywordMatches.length > 0) {
    score += Math.min(18, keywordMatches.length * 6);
    reasons.push(`matched ${keywordMatches.slice(0, 3).join(', ')}`);
  }

  if (
    mentor?.specialization
    && signals.terms.some((term) => String(mentor.specialization).toLowerCase().includes(term))
  ) {
    score += 12;
    reasons.push('specialization matched');
  }

  if (mentorDepartment && projectDepartment && mentorDepartment === projectDepartment) {
    score += 8;
    reasons.push('department aligned');
  }

  if (remainingCapacity > 0) {
    score += Math.min(10, remainingCapacity * 4);
    reasons.push(`${remainingCapacity}/${capacity} slots free`);
  } else {
    score -= 18;
    reasons.push('at capacity');
  }

  return {
    mentor_id: mentor.id,
    mentor_name: mentor.full_name,
    score: Math.max(0, Math.min(99, Math.round(score))),
    reasons: reasons.slice(0, 3),
    workload,
    capacity,
    remainingCapacity,
    eligible: remainingCapacity > 0,
  };
};

// ====== USER PROFILE FUNCTIONS ======

export const getUserProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ message: 'Profile not found', error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    const resolvedClassAssignment = await resolveProfileClassAssignment({
      classSection: req.body?.class_section,
      semester: req.body?.semester,
      department: req.body?.department,
    });

    if (Object.prototype.hasOwnProperty.call(resolvedClassAssignment, 'class_section')) {
      updates.class_section = resolvedClassAssignment.class_section;
      updates.class_id = resolvedClassAssignment.class_id;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: 'Update failed', error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    const [profileResult, notificationsResult, membershipsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      supabase
        .from('notifications')
        .select('id, user_id, type, title, message, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('team_members')
        .select('project_id')
        .eq('student_id', userId),
    ]);

    if (profileResult.error) {
      return res.status(404).json({ message: 'Profile not found', error: profileResult.error.message });
    }
    if (notificationsResult.error) throw notificationsResult.error;
    if (membershipsResult.error) throw membershipsResult.error;

    const projectIds = [...new Set((membershipsResult.data || []).map((m) => m.project_id).filter(Boolean))];
    let projects = [];
    if (projectIds.length > 0) {
      const { data: projectRows, error: projectsError } = await supabase
        .from('projects')
        .select(STUDENT_PROJECT_SELECT)
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      projects = await enrichStudentProjects(projectRows || []);
    }

    const notifications = notificationsResult.data || [];
    res.json({
      profile: profileResult.data,
      projects,
      notifications,
      meta: {
        unreadNotifications: notifications.filter((n) => !n.read).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    const [profileResult, projectsResult, mentorsResult, classesResult, reviewStagesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, department')
        .eq('id', userId)
        .eq('role', 'admin')
        .single(),
      supabase
        .from('projects')
        .select('id, title, guide_id, status, class_id, team_members(id, student_id, profiles:student_id(class_section))'),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'mentor'),
      supabase
        .from('classes')
        .select('id, class_section, department')
        .order('class_section', { ascending: true, nullsFirst: false }),
      supabase
        .from('review_stages')
        .select('id, class_id, stage_name, coordinator_deadline, is_active, is_completed, is_locked'),
    ]);

    if (profileResult.error) {
      return res.status(404).json({ message: 'Admin profile not found', error: profileResult.error.message });
    }
    if (projectsResult.error) throw projectsResult.error;
    if (mentorsResult.error) throw mentorsResult.error;
    if (classesResult.error) throw classesResult.error;
    if (reviewStagesResult.error) throw reviewStagesResult.error;

    res.json({
      profile: profileResult.data || null,
      projects: projectsResult.data || [],
      mentors: mentorsResult.data || [],
      classes: classesResult.data || [],
      review_stages: reviewStagesResult.data || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminGuideAllocationData = async (req, res) => {
  try {
    const [mentorResult, projectResult, classResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, department, specialization, domains_of_interest, max_team_capacity')
        .eq('role', 'mentor')
        .eq('designation', 'guide')
        .order('full_name', { ascending: true }),
      supabase
        .from('projects')
        .select(`
          id,
          title,
          guide_id,
          domain,
          approved_idea_id,
          current_idea_id,
          team_members (
            project_id,
            student_id,
            profiles:student_id (
              class_id,
              class_section,
              department
            )
          )
        `)
        .order('title', { ascending: true }),
      supabase
        .from('classes')
        .select('id, class_section')
        .order('class_section', { ascending: true }),
    ]);

    if (mentorResult.error) throw mentorResult.error;
    if (projectResult.error) throw projectResult.error;
    if (classResult.error) throw classResult.error;

    const projectRows = projectResult.data || [];
    const projectIds = projectRows.map((row) => row.id).filter(Boolean);
    const ideaIds = [...new Set(
      projectRows.flatMap((row) => [row.approved_idea_id, row.current_idea_id]).filter(Boolean)
    )];

    const { data: ideaRows, error: ideasError } = ideaIds.length > 0
      ? await supabase
        .from('project_ideas')
        .select('id, title, domain, subdomain, keywords, confidence_score, technologies, status')
        .in('id', ideaIds)
      : { data: [], error: null };
    if (ideasError) throw ideasError;

    const { data: allocationRows, error: allocationsError } = projectIds.length > 0
      ? await supabase
        .from('guide_allocations')
        .select('project_id, guide_id, status, assigned_at')
        .eq('status', 'active')
        .in('project_id', projectIds)
        .order('assigned_at', { ascending: false })
      : { data: [], error: null };
    if (allocationsError) throw allocationsError;

    const guideIds = [...new Set((allocationRows || []).map((row) => row.guide_id).filter(Boolean))];
    const { data: guideRows, error: guidesError } = guideIds.length > 0
      ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', guideIds)
      : { data: [], error: null };
    if (guidesError) throw guidesError;

    const guideNameById = new Map((guideRows || []).map((row) => [row.id, row.full_name || '']));
    const ideaById = new Map((ideaRows || []).map((row) => [row.id, row]));
    const allocationByProject = new Map();
    const classRows = (classResult.data || []).map((row) => ({
      id: row.id,
      class_name: String(row.class_section || '').trim(),
      class_key: normalizeClassSectionInput(row.class_section),
    }));
    const classById = new Map(classRows.map((row) => [row.id, row]));
    const classByKey = new Map(classRows.map((row) => [String(row.class_key || '').trim(), row]));

    (allocationRows || []).forEach((row) => {
      if (!row?.project_id || allocationByProject.has(row.project_id)) return;
      allocationByProject.set(row.project_id, row);
    });

    const mentors = (mentorResult.data || []).map((mentor) => ({
      id: mentor.id,
      full_name: mentor.full_name || 'Unnamed Mentor',
      email: mentor.email || '-',
      department: mentor.department || '',
      specialization: mentor.specialization || '',
      domains_of_interest: normalizeRecommendationTagList(mentor.domains_of_interest),
      max_team_capacity: getRecommendationMentorCapacity(mentor),
    }));

    const projects = projectRows.map((project) => {
      const allocation = allocationByProject.get(project.id) || null;
      const members = Array.isArray(project.team_members) ? project.team_members : [];
      const classProfile = members
        .map((member) => (Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles))
        .find(Boolean) || null;
      const normalizedClassSection = normalizeClassSectionInput(classProfile?.class_section);
      const matchedClass = (
        (classProfile?.class_id && classById.get(classProfile.class_id))
        || (normalizedClassSection ? classByKey.get(normalizedClassSection) : null)
        || null
      );
      const teamDepartment = members
        .map((member) => {
          const profile = Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles;
          return String(profile?.department || '').trim();
        })
        .find(Boolean) || '';
      const detectedIdea = ideaById.get(project.approved_idea_id) || ideaById.get(project.current_idea_id) || null;

      return {
        id: project.id,
        title: project.title || 'Untitled Project',
        guide_id: project.guide_id || null,
        domain: project.domain || '',
        detected_domain: detectedIdea?.domain || project.domain || '',
        detected_subdomain: detectedIdea?.subdomain || '',
        detected_keywords: Array.isArray(detectedIdea?.keywords) ? detectedIdea.keywords : [],
        confidence_score: typeof detectedIdea?.confidence_score === 'number' ? detectedIdea.confidence_score : 0,
        technologies: Array.isArray(detectedIdea?.technologies) ? detectedIdea.technologies : [],
        idea_title: detectedIdea?.title || '',
        team_department: teamDepartment,
        class_id: matchedClass?.id || classProfile?.class_id || null,
        class_name: matchedClass?.class_name || String(classProfile?.class_section || '').trim(),
        allocated_guide_id: allocation?.guide_id || null,
        allocated_guide_name: guideNameById.get(allocation?.guide_id) || '',
      };
    });

    res.json({
      mentors,
      projects,
      classes: classRows.map(({ id, class_name }) => ({ id, class_name })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminMentorManagementData = async (req, res) => {
  try {
    const [mentorResult, classResult, projectResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'mentor')
        .order('full_name', { ascending: true }),
      supabase
        .from('classes')
        .select('id, class_section')
        .order('class_section', { ascending: true }),
      supabase
        .from('projects')
        .select('id, guide_id'),
    ]);

    if (mentorResult.error) throw mentorResult.error;
    if (classResult.error) throw classResult.error;
    if (projectResult.error) throw projectResult.error;

    res.json({
      mentors: mentorResult.data || [],
      classes: classResult.data || [],
      projects: projectResult.data || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const extractAdminMentorImport = async (req, res) => {
  try {
    const normalizedMimeType = String(req.body?.mimeType || '').toLowerCase();
    const normalizedFileName = String(req.body?.fileName || '').toLowerCase();
    const isWorkbookUpload = Boolean(
      req.body?.fileBase64
      && (
        normalizedMimeType.includes('spreadsheet')
        || normalizedMimeType.includes('excel')
        || normalizedFileName.endsWith('.xlsx')
        || normalizedFileName.endsWith('.xls')
        || normalizedFileName.endsWith('.csv')
      )
    );

    const workbookPeople = isWorkbookUpload ? extractPeopleFromWorkbook(req.body?.fileBase64) : [];
    const rawText = workbookPeople.length > 0 ? '' : await extractTextFromImportPayload(req.body || {});

    if (!workbookPeople.length && !rawText) {
      return res.status(400).json({ message: 'Upload a non-empty TXT, JSON, or PDF file.' });
    }

    const aiPeople = rawText ? await extractPeopleWithOpenAI(rawText) : null;
    const people = (workbookPeople.length ? workbookPeople : (aiPeople?.length ? aiPeople : fallbackExtractPeopleFromText(rawText)))
      .map(normalizeImportedPerson);

    res.json({
      people,
      meta: buildImportSummary(people),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to extract people from file.' });
  }
};

export const applyAdminMentorImport = async (req, res) => {
  try {
    const people = parseStructuredPeoplePayload(req.body?.people);
    const skipped = [];
    let created = 0;
    let updated = 0;
    const { data: currentAdminProfile, error: currentAdminError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', req.user.id)
      .maybeSingle();

    if (currentAdminError) throw currentAdminError;

    for (const person of people) {
      if (!person.full_name) {
        skipped.push({
          full_name: person.full_name,
          email: person.email,
          reason: 'Missing full name.',
        });
        continue;
      }

      let existingProfile = null;
      if (person.email) {
        const { data, error: existingError } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('email', person.email)
          .maybeSingle();

        if (existingError) throw existingError;
        existingProfile = data || null;
      }

      const matchesCurrentAdmin = Boolean(
        currentAdminProfile?.id
        && currentAdminProfile.role === 'admin'
        && (
          !person.email
          || !currentAdminProfile.email
          || String(person.email).toLowerCase() === String(currentAdminProfile.email).toLowerCase()
        )
      );

      const baseProfilePayload = {
        full_name: person.full_name,
        email: person.email || currentAdminProfile?.email || null,
        employee_id: person.employee_id,
        department: person.department,
        specialization: person.specialization.join(', '),
        domains_of_interest: person.specialization,
      };

      if (person.role === 'admin' || matchesCurrentAdmin) {
        if (existingProfile?.id && existingProfile.role === 'admin') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              ...baseProfilePayload,
              role: 'admin',
            })
            .eq('id', existingProfile.id);

          if (updateError) throw updateError;
          updated += 1;
          continue;
        }

        if (existingProfile?.id && existingProfile.role !== 'admin') {
          skipped.push({
            full_name: person.full_name,
            email: person.email,
            reason: 'Matched account is not an admin profile, so it was not updated as admin.',
          });
          continue;
        }

        if (currentAdminProfile?.id && currentAdminProfile.role === 'admin') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              ...baseProfilePayload,
              role: 'admin',
            })
            .eq('id', currentAdminProfile.id);

          if (updateError) throw updateError;
          updated += 1;
          continue;
        }

        skipped.push({
          full_name: person.full_name,
          email: person.email,
          reason: 'No admin profile could be resolved for this uploaded admin row.',
        });
        continue;
      }

      if (!person.email) {
        skipped.push({
          full_name: person.full_name,
          email: person.email,
          reason: 'Missing email for mentor row.',
        });
        continue;
      }

      const profilePayload = {
        ...baseProfilePayload,
        role: 'mentor',
        designation: 'guide',
      };

      if (existingProfile?.id) {
        if (existingProfile.role === 'admin') {
          skipped.push({
            full_name: person.full_name,
            email: person.email,
            reason: 'Matched account is an admin profile, so it was not converted into a mentor.',
          });
          continue;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;
        updated += 1;
        continue;
      }

      const createdUser = await createImportedAuthUser({
        email: person.email,
        role: 'mentor',
      });

      if (!createdUser?.id) {
        skipped.push({
          full_name: person.full_name,
          email: person.email,
          reason: 'User account could not be created.',
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: createdUser.id,
          ...profilePayload,
        });

      if (updateError) throw updateError;
      created += 1;
    }

    res.json({
      message: 'Mentor import completed.',
      summary: {
        created,
        updated,
        skipped: skipped.length,
      },
      skipped,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to import mentors.' });
  }
};

export const extractCoordinatorStudentImport = async (req, res) => {
  try {
    const normalizedMimeType = String(req.body?.mimeType || '').toLowerCase();
    const normalizedFileName = String(req.body?.fileName || '').toLowerCase();
    const isWorkbookUpload = Boolean(
      req.body?.fileBase64
      && (
        normalizedMimeType.includes('spreadsheet')
        || normalizedMimeType.includes('excel')
        || normalizedFileName.endsWith('.xlsx')
        || normalizedFileName.endsWith('.xls')
        || normalizedFileName.endsWith('.csv')
      )
    );

    const workbookStudents = isWorkbookUpload ? extractStudentsFromWorkbook(req.body?.fileBase64) : [];
    const rawText = workbookStudents.length > 0 ? '' : await extractTextFromImportPayload(req.body || {});
    const textStudents = workbookStudents.length > 0 ? [] : fallbackExtractStudentsFromText(rawText);
    const students = (workbookStudents.length > 0 ? workbookStudents : textStudents)
      .map(normalizeImportedStudent);

    res.json({
      students,
      meta: buildStudentImportSummary(students),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to extract students from file.' });
  }
};

export const applyCoordinatorStudentImport = async (req, res) => {
  try {
    const students = parseStructuredStudentsPayload(req.body?.students);
    const skipped = [];
    let created = 0;
    let updated = 0;

    const { data: coordinatorProfile, error: coordinatorError } = await supabase
      .from('profiles')
      .select('id, class_id, class_section, department')
      .eq('id', req.user.id)
      .maybeSingle();

    if (coordinatorError) throw coordinatorError;
    if (!coordinatorProfile?.class_id) {
      return res.status(403).json({ message: 'Coordinator class assignment is required for student import.' });
    }

    const coordinatorClassSection = String(coordinatorProfile.class_section || '').trim();

    for (const student of students) {
      if (!student.full_name || !student.email) {
        skipped.push({
          full_name: student.full_name,
          email: student.email,
          reason: 'Missing full name or email.',
        });
        continue;
      }

      const targetClassSection = student.class_section || coordinatorClassSection || null;
      const targetDepartment = student.department || coordinatorProfile.department || null;
      const resolvedClassAssignment = await resolveProfileClassAssignment({
        classSection: targetClassSection,
        department: targetDepartment,
      });

      if (resolvedClassAssignment.class_id && resolvedClassAssignment.class_id !== coordinatorProfile.class_id) {
        skipped.push({
          full_name: student.full_name,
          email: student.email,
          reason: 'Student row belongs to a different class and was skipped.',
        });
        continue;
      }

      const profilePayload = {
        full_name: student.full_name,
        email: student.email,
        role: 'student',
        roll_number: student.roll_number,
        department: targetDepartment,
        class_section: resolvedClassAssignment.class_section || coordinatorClassSection || null,
        class_id: coordinatorProfile.class_id,
      };

      const { data: existingProfile, error: existingError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('email', student.email)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingProfile?.id) {
        if (existingProfile.role && existingProfile.role !== 'student') {
          skipped.push({
            full_name: student.full_name,
            email: student.email,
            reason: 'Matched account is not a student profile.',
          });
          continue;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;
        updated += 1;
        continue;
      }

      const createdUser = await createImportedAuthUser({
        email: student.email,
        role: 'student',
      });

      if (!createdUser?.id) {
        skipped.push({
          full_name: student.full_name,
          email: student.email,
          reason: 'User account could not be created.',
        });
        continue;
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: createdUser.id,
          ...profilePayload,
        });

      if (upsertError) throw upsertError;
      created += 1;
    }

    res.json({
      summary: {
        created,
        updated,
        skipped: skipped.length,
      },
      skipped,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to apply student import.' });
  }
};

// ====== PROJECT MANAGEMENT FUNCTIONS ======

export const createProject = async (req, res) => {
  try {
    const teamName = normalizeTextField(req.body?.team_name, { required: true, maxLength: 200 });
    const title = normalizeTextField(req.body?.title, { maxLength: 200 });
    const domain = normalizeTextField(req.body?.domain, { maxLength: 120 });
    const description = normalizeTextField(req.body?.description, { maxLength: 3000 });
    const abstract = normalizeTextField(req.body?.abstract, { maxLength: 3000 });
    const technologyStacks = normalizeTechnologyStacks(req.body?.technology_stacks);

    if (!teamName) {
      return res.status(400).json({ message: 'Team name is required' });
    }

    const initialIdeaTitle = title || null;
    const projectTitle = initialIdeaTitle || teamName;
    const defaultDomain = domain || 'General';
    let resolvedClassId = null;

    const { data: creatorProfile, error: profileError } = await supabase
      .from('profiles')
      .select('class_id, class_section, batch')
      .eq('id', req.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    resolvedClassId = creatorProfile?.class_id || null;
    const profileSection = String(creatorProfile?.class_section || creatorProfile?.batch || '').trim();
    if (!resolvedClassId && profileSection) {
      const { data: classRow, error: classLookupError } = await supabase
        .from('classes')
        .select('id')
        .ilike('class_section', profileSection)
        .maybeSingle();
      if (classLookupError) throw classLookupError;
      resolvedClassId = classRow?.id || null;
    }

    const { data: projectRow, error } = await supabase
      .from('projects')
      .insert({
        title: projectTitle,
        team_name: teamName,
        class_id: resolvedClassId,
        domain: defaultDomain,
        description,
        abstract,
        technology_stacks: technologyStacks ?? [],
        created_by: req.user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Ensure creator exists as team leader (safe even if DB trigger already inserted row).
    const { error: teamError } = await supabase
      .from('team_members')
      .insert({
        project_id: projectRow.id,
        student_id: req.user.id,
        role: 'leader'
      });
    if (teamError && teamError.code !== '23505') throw teamError;

    let createdIdea = null;
    if (initialIdeaTitle || description || (technologyStacks || []).length) {
      const { data: ideaRow, error: ideaError } = await supabase
        .from('project_ideas')
        .insert({
          project_id: projectRow.id,
          version_no: 1,
          title: initialIdeaTitle || teamName,
          domain: defaultDomain,
          description,
          technologies: technologyStacks ?? [],
          status: 'draft',
          created_by: req.user.id,
        })
        .select()
        .single();

      if (ideaError) throw ideaError;
      createdIdea = ideaRow;

      const { error: syncError } = await supabase
        .from('projects')
        .update({
          current_idea_id: ideaRow.id,
          approved_idea_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectRow.id);

      if (syncError) throw syncError;
    }

    res.status(201).json({
      ...projectRow,
      current_idea_id: createdIdea?.id || null,
      approved_idea_id: null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    // Filter based on user role
    if (req.userRole === 'student') {
      // Students see projects where they are a member.
      // Fetch ids first so nested team_members can include the entire team (not only self row).
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('project_id')
        .eq('student_id', req.user.id);

      if (membershipError) throw membershipError;

      const projectIds = [...new Set((memberships || []).map((m) => m.project_id).filter(Boolean))];
      if (projectIds.length === 0) {
        return res.json([]);
      }

      const { data, error } = await supabase
        .from('projects')
        .select(STUDENT_PROJECT_SELECT)
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(await enrichStudentProjects(data || []));
    } else if (req.userRole === 'mentor') {
      const mentorProjectsSelect = `
        *,
        mentor:profiles!projects_mentor_id_fkey(id, full_name, email, department),
        guide:profiles!projects_guide_id_fkey(id, full_name, email, department),
        team_members(
          id, student_id, role,
          profiles!team_members_student_id_fkey(full_name, email, roll_number, batch, class_section, class_id)
        ),
        documents(id, document_type, status, uploaded_at, file_name),
        evaluations(evaluation_type, obtained_marks, max_marks, feedback)
      `;

      const { data: assignedProjects, error: assignedError } = await supabase
        .from('projects')
        .select(mentorProjectsSelect)
        .or(`mentor_id.eq.${req.user.id},coordinator_id.eq.${req.user.id}`);

      if (assignedError) throw assignedError;

      const { data: reviewerAccessRows, error: reviewerAccessError } = await supabase
        .from('reviewer_access')
        .select('class_id, batch')
        .eq('mentor_id', req.user.id);

      if (reviewerAccessError) throw reviewerAccessError;

      const reviewerBatchMap = (reviewerAccessRows || []).reduce((acc, row) => {
        if (!row?.class_id) return acc;
        if (!acc[row.class_id]) {
          acc[row.class_id] = { batches: new Set(), hasSpecificBatch: false };
        }
        if (row.batch == null) {
          if (!acc[row.class_id].hasSpecificBatch) {
            acc[row.class_id].batches.add('all');
          }
        } else {
          if (!acc[row.class_id].hasSpecificBatch) {
            acc[row.class_id].batches.clear();
            acc[row.class_id].hasSpecificBatch = true;
          }
          acc[row.class_id].batches.add(String(row.batch));
        }
        return acc;
      }, {});

      const reviewerClassIds = Object.keys(reviewerBatchMap);
      let reviewerProjects = [];

      if (reviewerClassIds.length > 0) {
        const normalizeSectionKey = (value) => String(value || '').trim().toLowerCase();
        const { data: reviewerClasses, error: reviewerClassesError } = await supabase
          .from('classes')
          .select('id, class_section')
          .in('id', reviewerClassIds);
        if (reviewerClassesError) throw reviewerClassesError;

        const classIdBySection = new Map(
          (reviewerClasses || []).map((row) => [normalizeSectionKey(row.class_section), row.id])
        );

        const resolveAnchorProfile = (project) => {
          const members = Array.isArray(project?.team_members) ? project.team_members : [];
          const leader = members.find((member) => member?.role === 'leader');
          return leader?.profiles || members[0]?.profiles || null;
        };

        const resolveProjectClassId = (project) => {
          if (project?.class_id && reviewerBatchMap[project.class_id]) return project.class_id;
          const anchor = resolveAnchorProfile(project);
          if (!anchor) return null;
          if (anchor.class_id && reviewerBatchMap[anchor.class_id]) return anchor.class_id;
          const classSection = String(anchor.class_section || anchor.batch || '').trim();
          if (!classSection) return null;
          return classIdBySection.get(normalizeSectionKey(classSection)) || null;
        };

        const resolveProjectBatch = (project) => {
          if (project?.batch != null) return String(project.batch);
          const anchor = resolveAnchorProfile(project);
          if (anchor?.batch != null && /^[0-9]+$/.test(String(anchor.batch).trim())) return String(anchor.batch);
          return null;
        };

        const { data: reviewerClassProjects, error: reviewerProjectsError } = await supabase
          .from('projects')
          .select(mentorProjectsSelect)
          .in('class_id', reviewerClassIds);

        if (reviewerProjectsError) throw reviewerProjectsError;

        const { data: reviewerLegacyProjects, error: reviewerLegacyProjectsError } = await supabase
          .from('projects')
          .select(mentorProjectsSelect)
          .is('class_id', null);

        if (reviewerLegacyProjectsError) throw reviewerLegacyProjectsError;

        reviewerProjects = [...(reviewerClassProjects || []), ...(reviewerLegacyProjects || [])].filter((project) => {
          const resolvedClassId = resolveProjectClassId(project);
          const batchScope = resolvedClassId ? reviewerBatchMap[resolvedClassId] : null;
          const allowedBatches = batchScope?.batches;
          if (!allowedBatches || allowedBatches.size === 0) return false;
          if (allowedBatches.has('all')) return true;
          const effectiveBatch = resolveProjectBatch(project);
          return effectiveBatch != null && allowedBatches.has(String(effectiveBatch));
        });
      }

      const combinedAssignedProjects = [
        ...(assignedProjects || []),
        ...reviewerProjects,
      ].reduce((acc, project) => {
        if (!acc.some((item) => item.id === project.id)) {
          acc.push(project);
        }
        return acc;
      }, []);

      // Coordinators additionally get projects from their batch scope.
      if (!req.isCoordinator || !req.userBatch) {
        return res.json(await enrichProjectsWithIdeaSnapshots(await enrichProjectsWithAllocations(combinedAssignedProjects)));
      }

      const { data: teamRows, error: teamRowsError } = await supabase
        .from('team_members')
        .select(`
          project_id,
          role,
          profiles!team_members_student_id_fkey(batch, class_section, department)
        `);

      if (teamRowsError) throw teamRowsError;

      const batchProjectIds = new Set();
      const grouped = {};
      (teamRows || []).forEach((row) => {
        if (!grouped[row.project_id]) grouped[row.project_id] = [];
        grouped[row.project_id].push(row);
      });

      Object.entries(grouped).forEach(([projectId, rows]) => {
        const leader = rows.find((r) => r.role === 'leader');
        const anchor = leader?.profiles || rows[0]?.profiles;
        if (!anchor) return;
        const projectBatch = anchor.batch || anchor.class_section || null;
        if (!projectBatch || projectBatch !== req.userBatch) return;
        if (req.userDepartment && anchor.department && anchor.department !== req.userDepartment) return;
        batchProjectIds.add(projectId);
      });

      const assignedIds = new Set(combinedAssignedProjects.map((p) => p.id));
      const extraIds = [...batchProjectIds].filter((id) => !assignedIds.has(id));
      if (extraIds.length === 0) {
        return res.json(await enrichProjectsWithIdeaSnapshots(await enrichProjectsWithAllocations(combinedAssignedProjects)));
      }

      const { data: extraProjects, error: extraError } = await supabase
        .from('projects')
        .select(mentorProjectsSelect)
        .in('id', extraIds);

      if (extraError) throw extraError;

      const combined = [...combinedAssignedProjects, ...(extraProjects || [])];
        return res.json(await enrichProjectsWithIdeaSnapshots(await enrichProjectsWithAllocations(combined)));
    } else if (req.userRole === 'admin') {
      // Admins see all projects
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          team_members(count),
          evaluations(count),
          mentor:profiles!projects_mentor_id_fkey(full_name, email),
          guide:profiles!projects_guide_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(await enrichProjectsWithIdeaSnapshots(await enrichProjectsWithAllocations(data || [])));
    }

    return res.json([]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyReviewerAccess = async (req, res) => {
  try {
    if (req.userRole !== 'mentor') {
      return res.json([]);
    }

    let data = null;
    let error = null;
    {
      const result = await supabaseAdmin
        .from('reviewer_access')
        .select('class_id, stage, batch, is_open, updated_at')
        .eq('mentor_id', req.user.id);
      data = result.data;
      error = result.error;
    }

    if (error) {
      const missingBatchColumn =
        error.code === 'PGRST204' ||
        /batch/i.test(error.message || '') ||
        /batch/i.test(error.details || '');

      if (missingBatchColumn) {
        const fallback = await supabaseAdmin
          .from('reviewer_access')
          .select('class_id, stage, is_open, updated_at')
          .eq('mentor_id', req.user.id);
        data = (fallback.data || []).map((row) => ({ ...row, batch: null }));
        error = fallback.error;
      }
    }

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        mentor:profiles!projects_mentor_id_fkey(id, full_name, email, department),
        guide:profiles!projects_guide_id_fkey(id, full_name, email, department),
        coordinator:profiles!projects_coordinator_id_fkey(id, full_name, email, department),
        team_members(
          id, student_id, role, joined_at,
          profiles!team_members_student_id_fkey(id, full_name, email, roll_number, department, batch, class_section)
        ),
        documents(id, document_type, status, uploaded_at, file_name, file_url, version, feedback),
        evaluations(id, evaluation_type, obtained_marks, max_marks, feedback, created_at),
        individual_marks(
          id, student_id, category, obtained_marks, max_marks, feedback,
          profiles!individual_marks_student_id_fkey(full_name, email)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    const [enriched] = await enrichStudentProjects([data]);
    res.json(enriched || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const title = normalizeTextField(req.body.title, { required: true, maxLength: 200 });
      if (!title) return res.status(400).json({ message: 'Project title cannot be empty' });
      updates.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'domain')) {
      const domain = normalizeTextField(req.body.domain, { required: true, maxLength: 120 });
      if (!domain) return res.status(400).json({ message: 'Project domain cannot be empty' });
      updates.domain = domain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      updates.description = normalizeTextField(req.body.description, { maxLength: 3000 });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'abstract')) {
      updates.abstract = normalizeTextField(req.body.abstract, { maxLength: 3000 });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'technology_stacks')) {
      updates.technology_stacks = normalizeTechnologyStacks(req.body.technology_stacks) ?? [];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid project fields provided for update' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveProject = async (req, res) => {
  try {
    const { status, feedback } = req.body; // status: 'approved' or 'rejected'
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const { data: projectBefore, error: projectFetchError } = await supabase
      .from('projects')
      .select('id, title, current_idea_id, approved_idea_id')
      .eq('id', req.params.id)
      .single();

    if (projectFetchError || !projectBefore) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update({
        status: normalizedStatus,
        approved_idea_id: normalizedStatus === 'approved'
          ? (projectBefore.current_idea_id || projectBefore.approved_idea_id || null)
          : (projectBefore.approved_idea_id === projectBefore.current_idea_id ? null : projectBefore.approved_idea_id),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (projectBefore.current_idea_id) {
      const { error: ideaUpdateError } = await supabase
        .from('project_ideas')
        .update({
          status: normalizedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectBefore.current_idea_id);

      if (ideaUpdateError) throw ideaUpdateError;

      const { error: reviewInsertError } = await supabase
        .from('idea_reviews')
        .insert({
          idea_id: projectBefore.current_idea_id,
          reviewer_id: req.user.id,
          action: normalizedStatus,
          comment: feedback || null,
        });

      if (reviewInsertError) throw reviewInsertError;
    }

    // Optionally create a feedback record
    if (feedback) {
      await supabase
        .from('evaluations')
        .insert({
          project_id: req.params.id,
          evaluator_id: req.user.id,
          evaluation_type: 'approval_feedback',
          max_marks: 0,
          obtained_marks: 0,
          feedback
        });
    }

    const { data: members } = await supabase
      .from('team_members')
      .select('student_id')
      .eq('project_id', req.params.id);

    const projectTitle = data?.title || 'your project';
    const actorName = safeProfileName(req.userProfile, 'Guide');
    const feedbackText = String(feedback || '').trim();
    await createNotifications((members || [])
      .map((member) => member?.student_id)
      .filter(Boolean)
      .map((studentId) => ({
        user_id: studentId,
        type: normalizedStatus === 'approved' ? 'project_approved' : 'project_rejected',
        title: normalizedStatus === 'approved' ? 'Idea Accepted' : 'Idea Rejected',
        message: feedbackText
          ? `${actorName} ${normalizedStatus === 'approved' ? 'accepted' : 'rejected'} the idea for ${projectTitle}. Feedback: ${feedbackText}`
          : `${actorName} ${normalizedStatus === 'approved' ? 'accepted' : 'rejected'} the idea for ${projectTitle}.`,
      })));

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== TEAM MANAGEMENT FUNCTIONS ======

export const joinProject = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        project_id: req.params.id,
        student_id: req.user.id,
        role: 'member'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'You are already a member of this project' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

export const leaveProject = async (req, res) => {
  try {
    const projectId = req.params.id;

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('project_id', projectId)
      .eq('student_id', req.user.id)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ message: 'You are not a member of this project' });
    }

    if (membership.role === 'leader') {
      return res.status(400).json({ message: 'Leader cannot leave team. Transfer leadership or delete project.' });
    }

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', projectId)
      .single();

    if (projectError || !projectRow) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (isProjectLocked(projectRow.status)) {
      return res.status(400).json({ message: `Team is locked because project is ${projectRow.status}` });
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('student_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Left project successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTeamMembers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profiles!team_members_student_id_fkey(
          id, full_name, email, roll_number, phone
        )
      `)
      .eq('project_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== DOCUMENT MANAGEMENT FUNCTIONS ======

export const uploadDocument = async (req, res) => {
  try {
    const { document_type, file_name, file_url, file_size } = req.body;
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, approved_idea_id')
      .eq('id', req.params.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!project.approved_idea_id && String(project.status || '').toLowerCase() !== 'approved') {
      return res.status(400).json({ message: 'An idea must be approved before documents can be submitted.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        project_id: req.params.id,
        uploaded_by: req.user.id,
        document_type,
        file_name,
        file_url,
        file_size,
        status: 'submitted'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeTeamMember = async (req, res) => {
  try {
    const projectId = req.params.id;
    const targetStudentId = req.params.studentId;

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('id, title, status')
      .eq('id', projectId)
      .single();

    if (projectError || !projectRow) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (isProjectLocked(projectRow.status)) {
      return res.status(400).json({ message: `Team is locked because project is ${projectRow.status}` });
    }

    const { data: target, error: targetError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('project_id', projectId)
      .eq('student_id', targetStudentId)
      .single();

    if (targetError || !target) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    if (req.userRole !== 'admin') {
      const { data: requester } = await supabase
        .from('team_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('student_id', req.user.id)
        .single();

      if (!requester || requester.role !== 'leader') {
        return res.status(403).json({ message: 'Only leader can remove team members' });
      }

      if (target.role === 'leader') {
        return res.status(400).json({ message: 'Leader cannot remove themselves from this action' });
      }
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('student_id', targetStudentId);

    if (error) throw error;

    const actorName = req.userRole === 'admin'
      ? 'Administrator'
      : safeProfileName(req.userProfile, 'Team Leader');
    const projectTitle = projectRow.title || 'your team';
    await createNotifications([
      {
        user_id: targetStudentId,
        type: 'team_member_removed',
        title: 'Removed from Team',
        message: `${actorName} removed you from ${projectTitle}.`,
      },
    ]);

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDocument = async (req, res) => {
  try {
    const updates = {};
    const allowedFields = ['document_type', 'file_name', 'file_url', 'file_size', 'version', 'status', 'feedback'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.uploaded_by = req.user.id;
    updates.uploaded_at = new Date().toISOString();

    const { data: current, error: currentError } = await supabase
      .from('documents')
      .select('id, project_id')
      .eq('id', req.params.id)
      .single();

    if (currentError || !current) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', current.project_id)
      .eq('student_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ message: 'You do not have access to this document' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { data: current, error: currentError } = await supabase
      .from('documents')
      .select('id, project_id')
      .eq('id', req.params.id)
      .single();

    if (currentError || !current) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', current.project_id)
      .eq('student_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ message: 'You do not have access to this document' });
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        profiles!documents_uploaded_by_fkey(full_name, email)
      `)
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveDocument = async (req, res) => {
  try {
    const { status, feedback } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (feedback !== undefined) updates.feedback = feedback;

    const { data: doc, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, projects(id, title)')
      .single();

    if (error) throw error;

    // Notify team members
    const { data: members } = await supabase
      .from('team_members')
      .select('student_id')
      .eq('project_id', doc.project_id);

    if (members?.length) {
      const actorName = safeProfileName(req.userProfile, 'Mentor');
      const projectTitle = doc.projects?.title || 'your project';

      const getNotifType = (s) => {
        if (s === 'approved') return 'document_approved';
        if (s === 'rejected') return 'document_rejected';
        return 'document_comment';
      };

      const getNotifTitle = (s) => {
        if (s === 'approved') return 'Document Approved';
        if (s === 'rejected') return 'Submission Rejected';
        return 'Feedback Received';
      };

      const rows = members.map(m => ({
        user_id: m.student_id,
        type: getNotifType(status),
        title: getNotifTitle(status),
        message: status
          ? `Submission "${doc.file_name}" in ${projectTitle} has been ${status} by ${actorName}.`
          : `New feedback received for "${doc.file_name}" in ${projectTitle}.`,
      }));
      await createNotifications(rows);
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== EVALUATION FUNCTIONS ======

export const createEvaluation = async (req, res) => {
  try {
    const { evaluation_type, max_marks, obtained_marks, feedback } = req.body;

    const { data, error } = await supabase
      .from('evaluations')
      .insert({
        project_id: req.params.id,
        evaluator_id: req.user.id,
        evaluation_type,
        max_marks,
        obtained_marks,
        feedback
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEvaluations = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        profiles!evaluations_evaluator_id_fkey(full_name, email)
      `)
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateEvaluation = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('evaluations')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getIndividualMarks = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('individual_marks')
      .select(`
        *,
        profiles!individual_marks_student_id_fkey(full_name, email, roll_number),
        evaluator:profiles!individual_marks_evaluator_id_fkey(full_name, email)
      `)
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateIndividualMarks = async (req, res) => {
  try {
    const { marks } = req.body; // Array of individual mark objects

    const results = [];
    for (const mark of marks) {
      const { data, error } = await supabase
        .from('individual_marks')
        .upsert({
          project_id: req.params.id,
          student_id: mark.student_id,
          evaluator_id: req.user.id,
          category: mark.category,
          max_marks: mark.max_marks,
          obtained_marks: mark.obtained_marks,
          feedback: mark.feedback
        })
        .select()
        .single();

      if (error) throw error;
      results.push(data);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== ADMIN FUNCTIONS ======

export const getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSystemSettings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*');

    if (error) throw error;

    // Convert to key-value object
    const settings = {};
    data?.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const settings = req.body;
    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_by: req.user.id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      results.push(data);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const assignMentor = async (req, res) => {
  try {
    const { project_id, mentor_id, coordinator_id } = req.body;

    const { data, error } = await supabase
      .from('projects')
      .update({
        mentor_id,
        coordinator_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingProjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        team_name,
        domain,
        description,
        status,
        created_at,
        created_by,
        team_members(student_id),
        creator:profiles!projects_created_by_fkey(id, full_name)
      `)
      .not('status', 'in', '(approved,completed)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createJoinRequest = async (req, res) => {
  try {
    const { message } = req.body || {};
    const projectId = req.params.id;

    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('student_id', req.user.id)
      .single();

    if (membership) {
      return res.status(400).json({ message: 'You are already in this project' });
    }

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from('join_requests')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('student_id', req.user.id)
      .single();

    if (existingRequestError && existingRequestError.code !== 'PGRST116') {
      throw existingRequestError;
    }

    if (existingRequest?.status === 'pending') {
      return res.status(400).json({ message: 'Join request already exists' });
    }

    let data;
    let reused = false;
    if (existingRequest?.id) {
      reused = true;
      const { data: updated, error: updateError } = await supabase
        .from('join_requests')
        .update({
          status: 'pending',
          message: message || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRequest.id)
        .select()
        .single();

      if (updateError) throw updateError;
      data = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('join_requests')
        .insert({
          project_id: projectId,
          student_id: req.user.id,
          status: 'pending',
          message: message || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ message: 'Join request already exists' });
        }
        throw error;
      }
      data = inserted;
    }

    const { data: projectRow } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', projectId)
      .single();

    const { data: leaders } = await supabase
      .from('team_members')
      .select('student_id')
      .eq('project_id', projectId)
      .eq('role', 'leader');

    const requesterName = safeProfileName(req.userProfile, 'Student');
    const projectTitle = projectRow?.title || 'your project';
    const leaderNotifications = (leaders || []).map((leader) => ({
      user_id: leader.student_id,
      type: 'join_request',
      title: 'New Join Request',
      message: `${requesterName} requested to join ${projectTitle}.`,
    }));
    await createNotifications(leaderNotifications);

    res.status(reused ? 200 : 201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLeaderJoinRequests = async (req, res) => {
  try {
    const { data: leaderProjects, error: projectsError } = await supabase
      .from('team_members')
      .select('project_id')
      .eq('student_id', req.user.id)
      .eq('role', 'leader');

    if (projectsError) throw projectsError;

    const projectIds = (leaderProjects || []).map((row) => row.project_id);
    if (projectIds.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from('join_requests')
      .select(`
        *,
        project:projects(id, title),
        student:profiles!join_requests_student_id_fkey(id, full_name, email, roll_number, department, semester)
      `)
      .in('project_id', projectIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyJoinRequests = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('join_requests')
      .select('*')
      .eq('student_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const respondToJoinRequest = async (req, res) => {
  try {
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const { data: requestRow, error: requestError } = await supabase
      .from('join_requests')
      .select('id, project_id, student_id, status')
      .eq('id', req.params.id)
      .single();

    if (requestError || !requestRow) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    const { data: leaderMembership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', requestRow.project_id)
      .eq('student_id', req.user.id)
      .eq('role', 'leader')
      .single();

    if (!leaderMembership) {
      return res.status(403).json({ message: 'Only team leaders can manage this request' });
    }

    if (action === 'approve') {
      const { error: addError } = await supabase
        .from('team_members')
        .insert({
          project_id: requestRow.project_id,
          student_id: requestRow.student_id,
          role: 'member',
        });

      if (addError && addError.code !== '23505') throw addError;
    }

    const finalStatus = action === 'approve' ? 'approved' : 'rejected';
    const { data, error } = await supabase
      .from('join_requests')
      .update({
        status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestRow.id)
      .select()
      .single();

    if (error) throw error;

    const { data: projectRow } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', requestRow.project_id)
      .single();

    const { data: leaderProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', req.user.id)
      .single();

    const leaderName = safeProfileName(leaderProfile, 'Team Leader');
    const projectTitle = projectRow?.title || 'your requested project';
    const decisionText = finalStatus === 'approved' ? 'approved' : 'rejected';

    await createNotifications([
      {
        user_id: requestRow.student_id,
        type: finalStatus === 'approved' ? 'join_request_approved' : 'join_request_rejected',
        title: `Join Request ${finalStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `${leaderName} ${decisionText} your join request for ${projectTitle}.`,
      },
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== NOTIFICATION FUNCTIONS ======

export const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, message, read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, user_id, type, title, message, read, created_at')
      .single();

    if (error) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== LEGACY FUNCTIONS (for backwards compatibility) ======

export const getAllItems = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    const { data, error, count } = await supabase
      .from('projects') // Changed from 'items' to 'projects'
      .select('*', { count: 'exact' })
      .range(from, to);

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createItem = async (req, res) => {
  // Redirect to createProject for backwards compatibility
  return createProject(req, res);
};
