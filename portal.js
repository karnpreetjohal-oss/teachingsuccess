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
let unitLoadSeq = 0;
let activeSection = 'dashboard';
const SCIENCE_UNITS = {
  biology: [
    'Cell biology',
    'Organisation',
    'Infection and response',
    'Bioenergetics',
    'Homeostasis and response',
    'Inheritance, variation and evolution',
    'Ecology',
    'Key ideas (Biology)'
  ],
  chemistry: [
    'Atomic structure and the periodic table',
    'Bonding, structure, and the properties of matter',
    'Quantitative chemistry',
    'Chemical changes',
    'Energy changes',
    'The rate and extent of chemical change',
    'Organic chemistry',
    'Chemical analysis',
    'Chemistry of the atmosphere',
    'Using resources',
    'Key ideas (Chemistry)'
  ],
  physics: [
    'Energy',
    'Electricity',
    'Particle model of matter',
    'Atomic structure',
    'Forces',
    'Waves',
    'Magnetism and electromagnetism',
    'Key ideas (Physics)'
  ]
};
const DEFAULT_EXAM_BOARD_OPTIONS = [
  { value: '', label: 'Select exam board first' },
  { value: 'aqa', label: 'AQA' },
  { value: 'edexcel', label: 'Edexcel' },
  { value: 'ocr', label: 'OCR' },
  { value: 'wjec', label: 'WJEC' },
  { value: 'ccea', label: 'CCEA' },
  { value: 'none', label: 'No exam board / General' }
];
const MATHS_GRADE_TOPICS = {
  'Grade 1': [
    'Addition and Subtraction',
    'Multiplication and Division',
    'Time',
    'Metric Conversions',
    'Writing, Simplifying and Ordering Fractions',
    'Place Value',
    'Rounding',
    'Negative Numbers',
    'Powers and Roots',
    'BIDMAS',
    'Factors and Multiples',
    'Coordinates',
    'Pictograms'
  ],
  'Grade 2': [
    'Calculation Problems',
    'Using a Calculator',
    'Systematic Listing',
    'Fractions of an Amount',
    'Fractions, Decimals and Percentages',
    'Simplifying Algebra',
    'Writing an Expression',
    'Function Machines',
    'Solving One Step Equations',
    'Angles',
    'Area and Perimeter',
    'Probability',
    'Frequency Polygons',
    'Averages',
    'Bar Charts',
    'Stem and Leaf',
    'Pie Charts'
  ],
  'Grade 3': [
    'Error Intervals',
    'Fractions',
    'Estimating',
    'Writing and Simplifying Ratio',
    'Ratio',
    'Proportion',
    'Percentages',
    'Percentage Change',
    'Exchange Rates',
    'Conversions and Units',
    'Scale Drawings',
    'Best Buy Questions',
    'Substitution',
    'Solving Equations',
    'Drawing Linear Graphs',
    'Area and Circumference of Circles',
    'Transformations',
    'Area of Compound Shapes',
    'Frequency Trees',
    'Two Way Tables'
  ],
  'Grade 4': [
    'Compound Interest and Depreciation',
    'Indices',
    'Prime Factors, HCF and LCM',
    'Real Life and Distance Time Graphs',
    'Inequalities',
    'Forming and Solving Equations',
    'Sequences (Nth Term)',
    'Expanding and Factorising',
    'Pythagoras',
    'Angles in Parallel Lines',
    'Angles in Polygons',
    'Surface Area',
    'Volume of a Prism',
    'Cylinders',
    'Loci and Construction',
    'Bearings',
    'Plans and Elevations',
    'Averages from Frequency Tables',
    'Probability',
    'Scatter Graphs'
  ],
  'Grade 5': [
    'Writing a Ratio as a Fraction or Linear Function',
    'Direct and Inverse Proportion',
    'Reverse Percentages',
    'Standard Form',
    'Speed and Density',
    'Changing the Subject of a Formula',
    'Expanding and Factorising Quadratics',
    'Solving Quadratics',
    'Drawing Quadratic Graphs',
    'Drawing Other Graphs: Cubic/Reciprocal',
    'Simultaneous Equations',
    'Solving Simultaneous Equations Graphically',
    'Midpoint of a Line Segment',
    'Gradient of a Line',
    'Equation of a Line',
    'Spheres and Cones',
    'Sector Areas and Arc Lengths',
    'Similar Shapes (Lengths)',
    'SOHCAHTOA (Trigonometry)',
    'Exact trig values',
    'Vectors',
    'Probability Trees',
    'Venn Diagrams'
  ],
  'Grade 6': [
    'Recurring Decimals to Fractions',
    'Fractional and Negative Indices',
    'The Product Rule for Counting',
    'Repeated Percentage Change',
    'Expanding Triple Brackets',
    'Parallel and Perpendicular Lines',
    'Inequalities on Graphs',
    'Similar Shapes (Area and Volume)',
    'Enlarging with Negative Scale Factors',
    'Circle Theorems',
    'Cumulative Frequency',
    'Box Plots',
    'Capture Recapture'
  ],
  'Grade 7': [
    'Surds',
    'Bounds',
    'Direct and Inverse Proportion',
    'Quadratic Formula',
    'Factorising Harder Quadratics',
    'Algebraic Fractions',
    'Rearranging Harder Formulae',
    'Trigonometric and Exponential Graphs',
    'Inverse and Composite Functions',
    'Iteration',
    'Finding the Area of Any Triangle',
    'The Sine Rule',
    'The Cosine Rule',
    'Congruent Triangles',
    '3d Pythagoras and Trigonometry',
    'Histograms',
    'Conditional Probability'
  ],
  'Grade 8/9': [
    'Quadratic Simultaneous Equations',
    'Transforming Graphs y=f(x)',
    'Proof',
    'Completing the Square',
    'The Nth Term of a Quadratic Sequence',
    'Quadratic Inequalities',
    'Velocity Time Graphs',
    'Proof of the Circle Theorems',
    'Perpendicular Lines and the equation of a tangent',
    'Vectors Proof Questions',
    'Probability Equation Questions'
  ]
};
const DEFAULT_SUBJECT_OPTIONS = [
  { value: 'Maths', label: 'Maths' },
  { value: 'English', label: 'English' },
  { value: 'Science', label: 'Science' },
  { value: '11+', label: '11+' },
  { value: 'General', label: 'General' }
];
const PRIMARY_SUBJECT_OPTIONS = [
  { value: 'Maths', label: 'Maths' },
  { value: 'English', label: 'English' }
];
const PRIMARY_CURRICULUM = {
  2: {
    maths: {
      'Number and Place Value': ['Count in steps of 2, 3, 5 and 10', 'Read and write numbers to 100', 'Compare and order numbers'],
      'Addition and Subtraction': ['Add two 2-digit numbers', 'Subtract with exchanging', 'Solve one-step and two-step problems'],
      'Multiplication and Division': ['Understand arrays and equal groups', 'Use 2, 5 and 10 times tables', 'Solve division as sharing and grouping'],
      Fractions: ['Recognise 1/3, 1/4, 2/4 and 3/4', 'Find fractions of shapes and amounts', 'Compare simple fractions'],
      'Measurement and Time': ['Tell time to 5 minutes', 'Compare length, mass and temperature', 'Solve money problems with pounds and pence']
    },
    english: {
      Reading: ['Apply phonics to decode words', 'Build fluency and expression', 'Answer retrieval questions from short texts'],
      Writing: ['Use capital letters and full stops correctly', 'Write expanded noun phrases', 'Plan and write short narratives'],
      Grammar: ['Use present and past tense consistently', 'Use commas in lists', 'Use apostrophes for contraction and possession'],
      Spelling: ['Common exception words', 'Suffixes: -ment, -ness, -ful, -less', 'Homophones and near-homophones'],
      'Speaking and Listening': ['Retell stories confidently', 'Ask and answer questions clearly', 'Present ideas in full sentences']
    }
  },
  3: {
    maths: {
      'Number and Place Value': ['Read and write numbers to 1000', 'Round to nearest 10 and 100', 'Count forwards/backwards in multiples'],
      'Addition and Subtraction': ['Column addition and subtraction', 'Estimate and check answers', 'Solve multi-step word problems'],
      'Multiplication and Division': ['3, 4 and 8 times tables', 'Written multiplication methods', 'Short division with remainders'],
      Fractions: ['Recognise and compare fractions', 'Add/subtract fractions with same denominator', 'Find unit and non-unit fractions of amounts'],
      'Measurement and Geometry': ['Perimeter of simple shapes', 'Time to nearest minute', 'Identify and classify 2D/3D shapes']
    },
    english: {
      Reading: ['Develop vocabulary through context', 'Infer meaning from evidence', 'Summarise key events and ideas'],
      Writing: ['Write paragraphs around a theme', 'Use fronted adverbials', 'Draft and improve writing for effect'],
      Grammar: ['Use conjunctions: when, if, because, although', 'Use direct speech punctuation', 'Use present perfect form'],
      Spelling: ['Prefixes: dis-, mis-, in-, il-, im-', 'Suffix rules for vowels/consonants', 'Year 3/4 statutory word list'],
      'Comprehension and Discussion': ['Explain word choices', 'Predict from details in text', 'Justify answers with evidence']
    }
  },
  4: {
    maths: {
      'Number and Place Value': ['Count in multiples up to 10,000', 'Round to nearest 10, 100, 1000', 'Read Roman numerals to 100'],
      'Addition and Subtraction': ['Efficient written methods', 'Estimate and inverse checking', 'Solve two-step contextual problems'],
      'Multiplication and Division': ['Recall times tables up to 12x12', 'Multiply 2- and 3-digit by 1-digit', 'Use factor pairs and short division'],
      Fractions: ['Equivalent fractions', 'Add/subtract fractions with same denominator', 'Decimal equivalents of tenths/hundredths'],
      'Measurement, Geometry and Statistics': ['Area by counting squares', 'Convert between units', 'Interpret bar charts and line graphs']
    },
    english: {
      Reading: ['Read a wider range of fiction/non-fiction', 'Identify themes and conventions', 'Retrieve and infer with evidence'],
      Writing: ['Organise writing into coherent paragraphs', 'Use expanded noun phrases and adverbials', 'Write for purpose and audience'],
      Grammar: ['Use apostrophes accurately', 'Standard English verb forms', 'Punctuate direct speech correctly'],
      Spelling: ['Further prefixes and suffixes', 'Possessive apostrophes with plurals', 'Year 4 statutory word list'],
      'Editing and Performance': ['Proofread for grammar/spelling', 'Improve sentence variety', 'Read aloud with expression']
    }
  },
  5: {
    maths: {
      'Number and Place Value': ['Read/write numbers to 1,000,000', 'Round within 1,000,000', 'Interpret negative numbers in context'],
      'Addition and Subtraction': ['Add/subtract large numbers', 'Use mental strategies efficiently', 'Solve multi-step problems with reasoning'],
      'Multiplication and Division': ['Multiply up to 4 digits by 1/2 digits', 'Divide up to 4 digits by 1 digit', 'Solve scaling and correspondence problems'],
      Fractions: ['Equivalent and mixed/improper fractions', 'Add/subtract fractions with related denominators', 'Multiply fractions by whole numbers'],
      'Decimals, Percentages and Measurement': ['Read/write decimals to 3 places', 'Percentages and fraction equivalents', 'Perimeter/area and metric conversion']
    },
    english: {
      Reading: ['Develop inference and author intent', 'Compare characters/settings/themes', 'Retrieve and summarise accurately'],
      Writing: ['Use cohesion across paragraphs', 'Use varied sentence structures', 'Write balanced arguments and narratives'],
      Grammar: ['Modal verbs and adverbs of possibility', 'Relative clauses', 'Parenthesis using brackets/dashes/commas'],
      Spelling: ['Words ending -able/-ible and -ably/-ibly', 'Silent letters', 'Year 5/6 statutory words'],
      'Composition and Editing': ['Plan-draft-edit-publish cycle', 'Evaluate own writing', 'Improve precision and vocabulary']
    }
  },
  6: {
    maths: {
      'Number and Place Value': ['Use numbers up to 10,000,000', 'Round and estimate in complex contexts', 'Order and compare integers/decimals/fractions'],
      'Four Operations and Reasoning': ['Long multiplication and division', 'Multi-step word problems', 'BIDMAS and inverse operations'],
      Fractions: ['Simplify and compare fractions', 'Add/subtract/multiply/divide fractions', 'Fraction-decimal-percentage conversions'],
      Algebra: ['Generate and describe sequences', 'Use simple formulae', 'Solve one- and two-step equations'],
      'Geometry, Measure and Statistics': ['Angles in triangles/quadrilaterals/circles', 'Area/volume of shapes', 'Interpret pie charts and calculate mean']
    },
    english: {
      Reading: ['Analyse language, structure and viewpoint', 'Compare across texts', 'Support inferences with quotations'],
      Writing: ['Write with controlled tone and register', 'Use cohesive devices across longer texts', 'Craft effective openings/endings'],
      Grammar: ['Active and passive voice', 'Formal/informal structures', 'Punctuation for clarity and effect'],
      Spelling: ['Confusable words and morphology', 'Hyphen rules', 'Secure Year 5/6 statutory words'],
      'SATs Preparation': ['Reading test techniques', 'SPaG accuracy and speed', 'Extended writing under timed conditions']
    }
  }
};

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

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
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

function getSelectedStudentYearInt() {
  const studentId = $('asg-student')?.value || '';
  const student = tutorStudentsById.get(studentId);
  return parseYearGroupInt(student?.year_group);
}

function isPrimaryYear(yearInt) {
  return Number.isFinite(yearInt) && yearInt >= 2 && yearInt <= 6;
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

function parseKeywordCsv(value) {
  return String(value || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function subjectNeedsTier(value) {
  const s = normalizeSubject(value);
  if (isPrimaryYear(getSelectedStudentYearInt())) return false;
  return s === 'maths' || s === 'science';
}

function updateTierVisibility() {
  const subject = $('asg-subject')?.value || '';
  const wrap = $('asg-tier-wrap');
  const tier = $('asg-tier');
  if (!wrap || !tier) return;
  if (subjectNeedsTier(subject)) {
    wrap.style.display = '';
    return;
  }
  wrap.style.display = 'none';
  tier.value = '';
}

async function handleSubjectChange() {
  updateExamBoardOptionsBySubject();
  updateScienceComponentVisibility();
  updateEnglishTypeVisibility();
  updateTopicVisibility();
  updateTierVisibility();
  await loadUnitsForAssignmentForm();
}

function updateScienceComponentVisibility() {
  const subject = normalizeSubject($('asg-subject')?.value || '');
  const primary = isPrimaryYear(getSelectedStudentYearInt());
  const wrap = $('asg-science-component-wrap');
  const select = $('asg-science-component');
  if (!wrap || !select) return;
  if (!primary && subject === 'science') {
    wrap.style.display = '';
    return;
  }
  wrap.style.display = 'none';
  select.value = '';
}

function updateEnglishTypeVisibility() {
  const subject = normalizeSubject($('asg-subject')?.value || '');
  const primary = isPrimaryYear(getSelectedStudentYearInt());
  const wrap = $('asg-english-type-wrap');
  const select = $('asg-english-type');
  if (!wrap || !select) return;
  if (!primary && subject === 'english') {
    wrap.style.display = '';
    return;
  }
  wrap.style.display = 'none';
  select.value = '';
}

function updateTopicVisibility() {
  const subject = normalizeSubject($('asg-subject')?.value || '');
  const primary = isPrimaryYear(getSelectedStudentYearInt());
  const wrap = $('asg-topic-wrap');
  const topicSelect = $('asg-topic');
  if (!wrap || !topicSelect) return;
  if (primary || subject === 'maths') {
    wrap.style.display = '';
    return;
  }
  wrap.style.display = 'none';
  topicSelect.value = '';
  setSelectOptions(topicSelect, [], 'Select a unit first');
}

function updateSubjectOptionsByYear() {
  const subjectSelect = $('asg-subject');
  if (!subjectSelect) return;
  const current = subjectSelect.value || '';
  const primary = isPrimaryYear(getSelectedStudentYearInt());
  const opts = primary ? PRIMARY_SUBJECT_OPTIONS : DEFAULT_SUBJECT_OPTIONS;
  setSelectOptions(subjectSelect, opts, 'Select subject');
  if (opts.some((o) => o.value === current)) {
    subjectSelect.value = current;
  } else if (opts.length) {
    subjectSelect.value = opts[0].value;
  }
}

async function handleStudentChange() {
  updateSubjectOptionsByYear();
  await handleSubjectChange();
}

function countWords(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function autoGradeFromPercent(percent) {
  const p = Number(percent);
  if (p >= 90) return 'A*';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  return 'E';
}

function calculateAutoMark(notes, keywords, targetWords) {
  const normalized = String(notes || '').toLowerCase();
  const words = countWords(notes);
  const kw = Array.isArray(keywords) ? keywords.filter(Boolean) : [];
  const hits = kw.filter((k) => normalized.includes(k));
  const keywordRatio = kw.length ? (hits.length / kw.length) : 1;
  const keywordScore = keywordRatio * 70;
  const wcTarget = Number(targetWords || 0);
  const wcRatio = wcTarget > 0 ? Math.min(words / wcTarget, 1) : 1;
  const lengthScore = wcRatio * 30;
  const score = Math.max(0, Math.min(100, Math.round(keywordScore + lengthScore)));

  const feedbackParts = [];
  if (kw.length) feedbackParts.push(`Keywords matched: ${hits.length}/${kw.length}`);
  if (wcTarget > 0) feedbackParts.push(`Word count: ${words}/${wcTarget}`);
  if (!feedbackParts.length) feedbackParts.push(`Word count: ${words}`);

  return {
    score,
    grade: autoGradeFromPercent(score),
    feedback: `Auto-mark: ${feedbackParts.join(' · ')}`,
    keywordHits: hits,
    wordCount: words
  };
}

function subjectVariants(value) {
  const s = normalizeSubject(value);
  if (s === 'maths') return ['maths', 'math', 'mathematics'];
  if (s === 'english') return ['english', 'eng'];
  if (s === 'science') return ['science', 'combined_science', 'combined science', 'biology', 'chemistry', 'physics'];
  if (s === '11+') return ['11+', '11 plus', 'eleven_plus', 'eleven plus', '11plus'];
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

function updateExamBoardOptionsBySubject() {
  const subject = normalizeSubject($('asg-subject')?.value || '');
  const primary = isPrimaryYear(getSelectedStudentYearInt());
  const examSelect = $('asg-exam-board');
  const examWrap = $('asg-exam-board-wrap');
  if (!examSelect) return;

  if (examWrap) examWrap.style.display = primary ? 'none' : '';

  if (primary) {
    setSelectOptions(examSelect, [{ value: '', label: 'Primary curriculum (no exam board)' }], 'Primary curriculum');
    examSelect.value = '';
    return;
  }

  if (subject === 'maths') {
    setSelectOptions(examSelect, [{ value: 'edexcel', label: 'Edexcel' }], 'Edexcel');
    examSelect.value = 'edexcel';
    return;
  }

  if (subject === 'english') {
    setSelectOptions(examSelect, [
      { value: 'aqa', label: 'AQA' },
      { value: 'edexcel', label: 'Edexcel' }
    ], 'Select exam board first');
    examSelect.value = '';
    return;
  }

  setSelectOptions(examSelect, DEFAULT_EXAM_BOARD_OPTIONS, 'Select exam board first');
  examSelect.value = '';
}

function setActiveSection(section) {
  activeSection = section;
  $('section-dashboard')?.classList.toggle('hidden', section !== 'dashboard');
  $('section-reviews')?.classList.toggle('hidden', section !== 'reviews');
  $('btn-tab-dashboard')?.classList.toggle('active', section === 'dashboard');
  $('btn-tab-reviews')?.classList.toggle('active', section === 'reviews');
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
  const reviewStudentSelect = $('review-student');
  tutorStudentsById = new Map((data || []).map((x) => [x.id, x]));
  studentSelect.innerHTML = '';
  linkStudentSelect.innerHTML = '';
  if (reviewStudentSelect) reviewStudentSelect.innerHTML = '';

  if (!data.length) {
    studentSelect.innerHTML = '<option value="">No student accounts yet</option>';
    linkStudentSelect.innerHTML = '<option value="">No student accounts yet</option>';
    if (reviewStudentSelect) reviewStudentSelect.innerHTML = '<option value="">No student accounts yet</option>';
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

    if (reviewStudentSelect) {
      const c = document.createElement('option');
      c.value = st.id;
      c.textContent = txt;
      reviewStudentSelect.appendChild(c);
    }
  });
  await handleStudentChange();
}

async function loadUnitsForAssignmentForm() {
  const loadSeq = ++unitLoadSeq;
  const studentId = $('asg-student')?.value || '';
  const subjectRaw = $('asg-subject')?.value || '';
  const subjectNorm = normalizeSubject(subjectRaw);
  const yearInt = getSelectedStudentYearInt();
  const primary = isPrimaryYear(yearInt);
  const examBoardRaw = String($('asg-exam-board')?.value || '').trim().toLowerCase();
  const scienceComponent = String($('asg-science-component')?.value || '').trim().toLowerCase();
  const unitSelect = $('asg-unit');

  // Clear dependent selectors immediately so stale options disappear as soon as inputs change.
  setSelectOptions(unitSelect, [], 'Loading units...');

  if (!studentId || !subjectRaw) {
    setSelectOptions(unitSelect, [], 'Select student + subject first');
    updateMathsTopicOptions();
    return;
  }

  if (primary) {
    const unitMap = PRIMARY_CURRICULUM[yearInt]?.[subjectNorm] || {};
    const units = Object.keys(unitMap).map((unit) => ({
      value: `manual::${unit}`,
      label: unit
    }));
    setSelectOptions(unitSelect, units, 'No units found for this year/subject');
    if (units.length) unitSelect.value = units[0].value;
    updateMathsTopicOptions();
    return;
  }

  if (!examBoardRaw) {
    setSelectOptions(unitSelect, [], 'Select exam board first');
    updateMathsTopicOptions();
    return;
  }

  if (subjectNorm === 'maths') {
    const gradeUnits = Object.keys(MATHS_GRADE_TOPICS).map((grade) => ({
      value: `manual::${grade}`,
      label: grade
    }));
    setSelectOptions(unitSelect, gradeUnits, 'No grades found');
    if (gradeUnits.length) {
      unitSelect.value = gradeUnits[0].value;
      updateMathsTopicOptions();
    }
    return;
  }

  if (subjectNorm === 'science') {
    if (!scienceComponent) {
      setSelectOptions(unitSelect, [], 'Select Biology, Chemistry or Physics first');
      return;
    }
    const manual = (SCIENCE_UNITS[scienceComponent] || []).map((name) => ({
      value: `manual::${name}`,
      label: name
    }));
    setSelectOptions(unitSelect, manual, 'No units found');
    if (manual.length) unitSelect.value = manual[0].value;
    updateMathsTopicOptions();
    return;
  }

  const subjectList = subjectVariants(subjectRaw);
  if (!subjectList.length) {
    setSelectOptions(unitSelect, [], 'No units for selected subject');
    return;
  }

  const student = tutorStudentsById.get(studentId);
  const years = [...new Set(expandYearGroupValues(student?.year_group))];

  let query = sb
    .from('curriculum_units')
    .select('id,year_group,subject,unit_title,unit_order,exam_board,course')
    .order('year_group', { ascending: true })
    .order('unit_order', { ascending: true, nullsFirst: false })
    .order('unit_title', { ascending: true });

  if (years.length) query = query.in('year_group', years);
  if (examBoardRaw === 'none') {
    query = query.is('exam_board', null);
  } else {
    query = query.ilike('exam_board', examBoardRaw);
  }

  const { data, error } = await query;
  if (loadSeq !== unitLoadSeq) return; // ignore stale async responses
  if (error) {
    console.warn('loadUnitsForAssignmentForm error:', error.message);
    setSelectOptions(unitSelect, [], 'Could not load units');
    return;
  }

  const allowedSubjects = new Set(subjectList.map((x) => normalizeSubject(x)));
  const filteredUnits = (data || []).filter((u) => allowedSubjects.has(normalizeSubject(u.subject)));

  const options = filteredUnits.map((u) => ({
    value: u.id,
    label: `${String(u.unit_title || '').replace(/^\s*\d+(?:\.\d+)*\s*/, '')}${u.course ? ` · ${u.course}` : ''}`
  }));

  setSelectOptions(unitSelect, options, 'No matching units for this student/subject');
  if (options.length) unitSelect.value = options[0].value;
  updateMathsTopicOptions();
}

function updateMathsTopicOptions() {
  const subjectNorm = normalizeSubject($('asg-subject')?.value || '');
  const yearInt = getSelectedStudentYearInt();
  const primary = isPrimaryYear(yearInt);
  const unitVal = String($('asg-unit')?.value || '');
  const topicSelect = $('asg-topic');
  if (!topicSelect) return;

  if (!primary && subjectNorm !== 'maths') {
    setSelectOptions(topicSelect, [], 'Select a unit first');
    return;
  }

  const selectedUnit = unitVal.startsWith('manual::') ? unitVal.replace('manual::', '') : '';
  let topics = [];
  if (primary) {
    topics = PRIMARY_CURRICULUM[yearInt]?.[subjectNorm]?.[selectedUnit] || [];
  } else {
    topics = MATHS_GRADE_TOPICS[selectedUnit] || [];
  }
  const options = topics.map((topic) => ({ value: topic, label: topic }));
  setSelectOptions(topicSelect, options, primary ? 'No lessons for this unit' : 'No topics for this grade');
  if (options.length) topicSelect.value = options[0].value;
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
        ${a.submission.auto_mark !== null && a.submission.auto_mark !== undefined
          ? `<p class="muted" style="margin-bottom:.35rem"><b>Auto-Mark Suggestion:</b> ${a.submission.auto_mark}% (${a.submission.auto_grade || '-'}) · ${a.submission.auto_feedback || ''}</p>`
          : ''}
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
      ${a.submission.auto_mark !== null && a.submission.auto_mark !== undefined
        ? `<p class="muted" style="margin:.25rem 0"><b>Auto-Mark:</b> ${a.submission.auto_mark}% (${a.submission.auto_grade || '-'})</p>`
        : ''}
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
      ${a.submission?.auto_mark !== null && a.submission?.auto_mark !== undefined
        ? `<p class="muted" style="margin:.25rem 0"><b>Auto-Mark:</b> ${a.submission.auto_mark}% (${a.submission.auto_grade || '-'})</p>`
        : ''}
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

function reviewItemHtml(r, showStudent = false) {
  const studentLabel = r.student?.full_name || r.student?.email || r.student_id;
  const confidence = r.confidence_pct === null || r.confidence_pct === undefined ? '-' : `${Math.round(Number(r.confidence_pct))}%`;
  return `
    <article class="item">
      <h3>${escapeHtml(r.predicted_grade || 'Predicted grade not set')}</h3>
      <div class="meta">
        ${showStudent ? `<span class="tag">${escapeHtml(studentLabel)}</span>` : ''}
        <span class="tag">Period: ${escapeHtml(r.period_label || 'General')}</span>
        <span class="tag">Confidence: ${escapeHtml(confidence)}</span>
        <span class="tag">Updated: ${escapeHtml(formatDateTime(r.created_at))}</span>
      </div>
      <p class="muted"><b>Doing Well:</b> ${escapeHtml(r.doing_well || 'Not specified')}</p>
      <p class="muted"><b>Needs Help:</b> ${escapeHtml(r.needs_help || 'Not specified')}</p>
      <p class="muted"><b>Next Steps:</b> ${escapeHtml(r.action_plan || 'Not specified')}</p>
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

async function renderTutorReviews() {
  const { data, error } = await sb
    .from('student_progress_reviews')
    .select(`
      id,tutor_id,student_id,period_label,predicted_grade,confidence_pct,doing_well,needs_help,action_plan,created_at,
      student:profiles!student_progress_reviews_student_id_fkey(full_name,email,year_group)
    `)
    .eq('tutor_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  $('tutor-reviews-list').innerHTML = (data || []).length
    ? data.map((r) => reviewItemHtml(r, true)).join('')
    : '<p class="muted">No progress reviews yet.</p>';
}

async function renderStudentReviews() {
  const { data, error } = await sb
    .from('student_progress_reviews')
    .select('id,student_id,period_label,predicted_grade,confidence_pct,doing_well,needs_help,action_plan,created_at')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  $('student-reviews-list').innerHTML = (data || []).length
    ? data.map((r) => reviewItemHtml(r, false)).join('')
    : '<p class="muted">No progress reviews yet.</p>';
}

async function renderParentReviews() {
  const { data: links, error: linksErr } = await sb
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', currentUser.id);
  if (linksErr) throw linksErr;
  const studentIds = [...new Set((links || []).map((x) => x.student_id).filter(Boolean))];
  if (!studentIds.length) {
    $('parent-reviews-list').innerHTML = '<p class="muted">No linked students yet.</p>';
    return;
  }

  const { data, error } = await sb
    .from('student_progress_reviews')
    .select(`
      id,tutor_id,student_id,period_label,predicted_grade,confidence_pct,doing_well,needs_help,action_plan,created_at,
      student:profiles!student_progress_reviews_student_id_fkey(full_name,email,year_group)
    `)
    .in('student_id', studentIds)
    .order('created_at', { ascending: false });
  if (error) throw error;

  $('parent-reviews-list').innerHTML = (data || []).length
    ? data.map((r) => reviewItemHtml(r, true)).join('')
    : '<p class="muted">No progress reviews for linked students yet.</p>';
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
      .select('assignment_id,notes,submitted_at,mark,grade,tutor_feedback,graded_at,auto_mark,auto_grade,auto_feedback,auto_graded_at')
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
      .select('assignment_id,notes,submitted_at,mark,grade,tutor_feedback,graded_at,auto_mark,auto_grade,auto_feedback,auto_graded_at')
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
      .select('assignment_id,notes,submitted_at,mark,grade,tutor_feedback,graded_at,auto_mark,auto_grade,auto_feedback,auto_graded_at')
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
  const tier = $('asg-tier')?.value || '';
  const englishType = String($('asg-english-type')?.value || '').trim();
  const resourceTitle = $('asg-resource-title').value.trim();
  const resourceUrl = $('asg-resource-url').value.trim();
  const automarkEnabled = Boolean($('asg-automark-enabled')?.checked);
  const automarkKeywordsCsv = $('asg-automark-keywords')?.value?.trim() || '';
  const automarkTargetWordsRaw = $('asg-automark-target-words')?.value?.trim() || '';
  const examBoardRaw = $('asg-exam-board') ? String($('asg-exam-board').value || '').trim().toLowerCase() : '';
  const examBoard = examBoardRaw && examBoardRaw !== 'none' ? examBoardRaw : null;
  const unitId = $('asg-unit')?.value || null;
  const topic = String($('asg-topic')?.value || '').trim();
  const file = $('asg-file')?.files?.[0] || null;
  const selectedUnitValue = String(unitId || '');
  const manualUnit = selectedUnitValue.startsWith('manual::') ? selectedUnitValue.replace('manual::', '') : '';
  const dbUnitId = manualUnit ? null : unitId;
  const subjectNorm = normalizeSubject(subject);
  const primary = isPrimaryYear(getSelectedStudentYearInt());
  const assignmentDescription = [
    tier ? `Tier: ${tier}` : '',
    (subjectNorm === 'english' && englishType) ? `English: ${englishType}` : '',
    manualUnit ? `Unit: ${manualUnit}` : '',
    ((subjectNorm === 'maths' || primary) && topic) ? `${primary ? 'Lesson' : 'Topic'}: ${topic}` : '',
    description
  ].filter(Boolean).join('\n') || null;

  if (!studentId || !title) {
    showMsg($('asg-msg'), 'Select a student and add a title.', 'err');
    return;
  }

  if (!primary && !examBoardRaw) {
    showMsg($('asg-msg'), 'Select an exam board first.', 'err');
    return;
  }

  if (subjectNeedsTier(subject) && !tier) {
    showMsg($('asg-msg'), 'Select a tier (Foundation or Higher).', 'err');
    return;
  }

  if ((subjectNorm === 'maths' || primary) && !topic) {
    showMsg($('asg-msg'), primary ? 'Select a lesson.' : 'Select a maths topic.', 'err');
    return;
  }

  if (subjectNorm === 'english' && !englishType) {
    showMsg($('asg-msg'), 'Select Language or Literature.', 'err');
    return;
  }

  const studentProfile = tutorStudentsById.get(studentId) || null;

  const payload = {
    tutor_id: currentUser.id,
    student_id: studentId,
    subject,
    title,
    description: assignmentDescription,
    due_date: dueDate,
    status: 'assigned',
    resource_title: resourceTitle || null,
    resource_url: resourceUrl || null,
    year_group: parseYearGroupInt(studentProfile?.year_group),
    exam_board: examBoard || null,
    unit_id: dbUnitId || null,
    automark_enabled: automarkEnabled,
    automark_keywords: parseKeywordCsv(automarkKeywordsCsv),
    automark_target_words: automarkTargetWordsRaw === '' ? null : Number(automarkTargetWordsRaw)
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
  if ($('asg-automark-enabled')) $('asg-automark-enabled').checked = false;
  if ($('asg-automark-keywords')) $('asg-automark-keywords').value = '';
  if ($('asg-automark-target-words')) $('asg-automark-target-words').value = '';
  if ($('asg-exam-board')) $('asg-exam-board').value = '';
  if ($('asg-science-component')) $('asg-science-component').value = '';
  if ($('asg-english-type')) $('asg-english-type').value = '';
  if ($('asg-tier')) $('asg-tier').value = '';
  if ($('asg-topic')) $('asg-topic').value = '';
  if ($('asg-file')) $('asg-file').value = '';
  if ($('asg-unit')) $('asg-unit').value = '';
  updateExamBoardOptionsBySubject();
  updateScienceComponentVisibility();
  updateEnglishTypeVisibility();
  updateTopicVisibility();
  updateTierVisibility();
  await loadUnitsForAssignmentForm();

  showMsg($('asg-msg'), 'Assignment created.', 'ok');
  await renderTutorDashboard();
}

async function createProgressReview() {
  clearMsg($('review-msg'));
  const studentId = $('review-student')?.value || '';
  const period = $('review-period')?.value?.trim() || null;
  const predictedGrade = $('review-predicted-grade')?.value?.trim() || null;
  const confidenceRaw = $('review-confidence')?.value?.trim() || '';
  const strengths = $('review-strengths')?.value?.trim() || null;
  const support = $('review-support')?.value?.trim() || null;
  const nextSteps = $('review-next-steps')?.value?.trim() || null;

  if (!studentId) {
    showMsg($('review-msg'), 'Select a student first.', 'err');
    return;
  }
  if (!predictedGrade) {
    showMsg($('review-msg'), 'Add a predicted grade.', 'err');
    return;
  }

  let confidence = null;
  if (confidenceRaw !== '') {
    confidence = Number(confidenceRaw);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
      showMsg($('review-msg'), 'Confidence must be between 0 and 100.', 'err');
      return;
    }
  }

  const payload = {
    tutor_id: currentUser.id,
    student_id: studentId,
    period_label: period,
    predicted_grade: predictedGrade,
    confidence_pct: confidence,
    doing_well: strengths,
    needs_help: support,
    action_plan: nextSteps
  };

  const { error } = await sb.from('student_progress_reviews').insert(payload);
  if (error) {
    showMsg($('review-msg'), error.message, 'err');
    return;
  }

  $('review-period').value = '';
  $('review-predicted-grade').value = '';
  $('review-confidence').value = '';
  $('review-strengths').value = '';
  $('review-support').value = '';
  $('review-next-steps').value = '';

  showMsg($('review-msg'), 'Progress review saved.', 'ok');
  await renderTutorReviews();
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
  const { data: assignment, error: asgErr } = await sb
    .from('assignments')
    .select('id,student_id,automark_enabled,automark_keywords,automark_target_words')
    .eq('id', assignmentId)
    .eq('student_id', currentUser.id)
    .maybeSingle();
  if (asgErr) {
    alert(`Could not load assignment: ${asgErr.message}`);
    return;
  }
  if (!assignment) {
    alert('Assignment not found.');
    return;
  }

  const { data: existingSubmission, error: exSubErr } = await sb
    .from('submissions')
    .select('mark,grade,tutor_feedback')
    .eq('assignment_id', assignmentId)
    .eq('student_id', currentUser.id)
    .maybeSingle();
  if (exSubErr) {
    alert(`Could not load current submission: ${exSubErr.message}`);
    return;
  }

  let autoFields = {};
  if (assignment.automark_enabled) {
    const result = calculateAutoMark(
      notes,
      assignment.automark_keywords || [],
      assignment.automark_target_words || 0
    );
    autoFields = {
      auto_mark: result.score,
      auto_grade: result.grade,
      auto_feedback: result.feedback,
      auto_graded_at: new Date().toISOString()
    };

    if (!existingSubmission?.mark && existingSubmission?.mark !== 0) {
      autoFields.mark = result.score;
      autoFields.grade = result.grade;
      if (!existingSubmission?.tutor_feedback) {
        autoFields.tutor_feedback = `Auto-mark generated on submission. ${result.feedback}`;
      }
    }
  }

  const { error: submitErr } = await sb
    .from('submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: currentUser.id,
        notes: notes || null,
        submitted_at: new Date().toISOString(),
        ...autoFields
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

async function renderDashboardForRole() {
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

async function renderReviewsForRole() {
  if (currentProfile.role === 'tutor') {
    $('tutor-reviews-view').classList.remove('hidden');
    $('student-reviews-view').classList.add('hidden');
    $('parent-reviews-view').classList.add('hidden');
    await loadStudentsForTutor();
    await renderTutorReviews();
    return;
  }

  if (currentProfile.role === 'parent') {
    $('tutor-reviews-view').classList.add('hidden');
    $('student-reviews-view').classList.add('hidden');
    $('parent-reviews-view').classList.remove('hidden');
    await renderParentReviews();
    return;
  }

  $('tutor-reviews-view').classList.add('hidden');
  $('student-reviews-view').classList.remove('hidden');
  $('parent-reviews-view').classList.add('hidden');
  await renderStudentReviews();
}

async function switchSection(section) {
  if (section === 'reviews') {
    await renderReviewsForRole();
    setActiveSection('reviews');
    return;
  }
  await renderDashboardForRole();
  setActiveSection('dashboard');
}

async function renderAppForRole() {
  $('who-name').textContent = currentProfile.full_name || currentUser.email;
  $('who-role').textContent = `Role: ${currentProfile.role}`;
  await switchSection(activeSection || 'dashboard');
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
    await switchSection(activeSection);
  });

  safeBind('btn-create-asg', 'click', createAssignment);
  safeBind('btn-link-parent', 'click', linkParentToStudent);
  safeBind('btn-save-review', 'click', createProgressReview);
  safeBind('btn-tab-dashboard', 'click', async () => switchSection('dashboard'));
  safeBind('btn-tab-reviews', 'click', async () => switchSection('reviews'));
  safeBind('asg-student', 'change', handleStudentChange);
  safeBind('asg-subject', 'change', handleSubjectChange);
  safeBind('asg-exam-board', 'change', loadUnitsForAssignmentForm);
  safeBind('asg-science-component', 'change', loadUnitsForAssignmentForm);
  safeBind('asg-english-type', 'change', loadUnitsForAssignmentForm);
  safeBind('asg-unit', 'change', updateMathsTopicOptions);
  updateSubjectOptionsByYear();
  updateExamBoardOptionsBySubject();
  updateScienceComponentVisibility();
  updateEnglishTypeVisibility();
  updateTopicVisibility();
  updateTierVisibility();

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
