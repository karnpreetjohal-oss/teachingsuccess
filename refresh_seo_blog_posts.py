#!/usr/bin/env python3
"""Refresh static SEO blog posts with slug-aware unique copy.

This script targets the live blog landing pages that use the shared
`blog-lp` layout. Redirect helpers and pages already refreshed manually in the
current workspace are skipped.
"""

from __future__ import annotations

import re
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BLOG_DIR = ROOT / "blog"
SITEMAP_PATH = ROOT / "sitemap.xml"
DATE = "2026-07-12"
# Hand-maintained digital-skills course pages: blp layout, but their main
# content is written by hand — never regenerate it. They still get a
# dateModified + sitemap bump each refresh via the loop in main().
SKIP = {
    "microsoft-office-training-birmingham",
    "excel-training-birmingham",
    "ai-training-birmingham",
    "touch-typing-course-smethwick",
}


YEAR_DETAILS = {
    2: {
        "general": "settling into classroom routines, early reading confidence and basic number security",
        "english": "phonics security, early handwriting, sentence building and talking before writing",
        "maths": "number bonds, counting, place value and simple one-step problems",
        "pressure": "when a child understands orally but still needs help recording ideas independently",
    },
    3: {
        "general": "moving from early basics into longer reading, fuller writing and more deliberate working",
        "english": "reading fluency, vocabulary growth and writing answers in complete sentences",
        "maths": "times-table foundations, written methods and choosing the right operation in word problems",
        "pressure": "when Key Stage 2 expectations rise faster than confidence",
    },
    4: {
        "general": "building independence, stronger habits and more consistent accuracy across the week",
        "english": "comprehension evidence, paragraph shape and more controlled grammar",
        "maths": "multiplication fluency, fractions, perimeter and multi-step reasoning",
        "pressure": "when a pupil can start work but struggles to sustain focus through longer tasks",
    },
    5: {
        "general": "upper-KS2 confidence, longer homework routines and preparation for a bigger academic jump",
        "english": "inference, richer vocabulary and more organised written explanations",
        "maths": "fractions, percentages, problem-solving and upper-KS2 reasoning stamina",
        "pressure": "when families are balancing normal school progress with possible SATs or 11+ interest ahead",
    },
    6: {
        "general": "SATs calm, end-of-primary confidence and readiness for Year 7 expectations",
        "english": "reading under time pressure, SPaG accuracy and writing with clearer structure",
        "maths": "arithmetic fluency, reasoning marks and keeping method stable under pressure",
        "pressure": "when assessment pressure starts to affect confidence more than the actual content difficulty",
    },
    7: {
        "general": "the jump into secondary routines, wider subject language and stronger independence",
        "english": "paragraph structure, evidence use and reading with more precision than in Year 6",
        "maths": "algebra basics, fractions, negatives and secure written method at KS3 pace",
        "pressure": "when the new school routine makes gaps feel bigger than they did in primary school",
    },
    8: {
        "general": "consolidating KS3 habits before confidence drift turns into a bigger pattern",
        "english": "analytical writing, explanation depth and clearer organisation of longer answers",
        "maths": "ratio, algebra manipulation, percentages and choosing methods without prompting",
        "pressure": "when a student is coping on the surface but quietly avoiding the subjects that now feel harder",
    },
    9: {
        "general": "building a proper GCSE runway before options and Year 10 pressure arrive",
        "english": "text response discipline, comparison thinking and more mature written control",
        "maths": "algebra reasoning, graph work, proportion and the first topics that punish weak foundations",
        "pressure": "when KS3 gaps are about to roll straight into GCSE content",
    },
    10: {
        "general": "starting GCSE seriously, not just attending lessons and hoping revision later will fix it",
        "english": "locking down essay structure, text knowledge and English Language timing habits",
        "maths": "topic diagnosis, method marks and building a routine for mixed-paper practice",
        "pressure": "when mock data starts to reveal which habits need fixing before Year 11",
    },
    11: {
        "general": "turning mock information into final-exam improvement rather than repeated panic revision",
        "english": "timed responses, question interpretation and maintaining quality under exam pressure",
        "maths": "converting weak topics into usable marks on full papers, not just worksheets",
        "pressure": "when every assessment feels high stakes and confidence can swing quickly from one paper to the next",
    },
    12: {
        "general": "managing the sixth-form jump in pace, independence and subject depth",
        "english": "more demanding reading, note-making and longer-form argument where relevant",
        "maths": "a much steeper level of abstraction, algebraic fluency and independent practice discipline",
        "pressure": "when strong GCSE students discover that A-Level requires a different standard of independent thinking",
    },
    13: {
        "general": "final exam execution, course completion and calm decision-making under pressure",
        "english": "sustaining analytical quality under time pressure where relevant",
        "maths": "timed full-paper control, error reduction and sharper revision sequencing",
        "pressure": "when students know a lot but still need a tighter plan to perform on the actual papers",
    },
}

YEAR_SEARCH_ANGLES = {
    2: "early confidence, parent-visible routines and gentle correction before small gaps become habits",
    3: "the first full Key Stage 2 step up, especially when reading stamina or times tables start to slow schoolwork down",
    4: "more independent written work, stronger multiplication recall and the bridge into upper-KS2 expectations",
    5: "upper-KS2 momentum, SATs foundations and, where relevant, a calm start to 11+ preparation",
    6: "SATs, secondary readiness and keeping confidence steady while school assessment pressure rises",
    7: "the secondary-school transition, new routines and making sure primary gaps do not follow the pupil into KS3",
    8: "KS3 drift: the year where a student can look fine on the surface while habits and confidence quietly weaken",
    9: "the GCSE runway, when option choices and harder subject language start to expose older gaps",
    10: "early GCSE intervention, mock preparation and building revision habits before Year 11 becomes urgent",
    11: "final GCSE improvement, converting mock feedback into marks and choosing revision priorities properly",
    12: "the sixth-form jump, where independent study and subject depth become as important as lesson understanding",
    13: "final A-Level execution, paper judgement and keeping revision focused while deadlines tighten",
}

ENGLISH_YEAR_FOCUS = {
    2: "phonics, handwriting and simple sentence control",
    3: "reading fluency, vocabulary and complete written answers",
    4: "paragraph control, comprehension evidence and grammar accuracy",
    5: "inference, richer vocabulary and longer explanation",
    6: "SATs reading, SPaG accuracy and writing stamina",
    7: "secondary paragraph structure, quotations and evidence",
    8: "analytical writing, unseen reading and clearer explanations",
    9: "GCSE-style analysis, comparison and more mature argument",
    10: "English Language timing, Literature structure and text knowledge",
    11: "timed GCSE responses, question selection and exam-ready paragraph control",
}

MATHS_YEAR_FOCUS = {
    2: "number bonds, place value and simple problem solving",
    3: "times tables, column methods and choosing operations",
    4: "multiplication, fractions, perimeter and multi-step reasoning",
    5: "fractions, percentages, decimals and upper-KS2 reasoning",
    6: "SATs arithmetic, reasoning marks and method accuracy",
    7: "algebra basics, negatives, fractions and secondary written method",
    8: "ratio, algebra manipulation, percentages and multi-step accuracy",
    9: "graphs, proportion, algebra reasoning and GCSE foundations",
    10: "GCSE topic repair, mixed papers and method marks",
    11: "full-paper performance, weak-topic conversion and exam judgement",
}


LOCATION_META = {
    "bearwood": {
        "focus": "11+, upper-KS2 support and early GCSE guidance because the area sits so naturally between primary ambition and secondary pressure",
        "journey": "Bearwood is one of the shortest journeys into the Teaching Success base, which makes consistent in-person lessons much easier to sustain.",
        "format": "Many families choose in-person because the route is simple, but online still works well for older students who want flexibility after school.",
        "school_context": "Parents often want a local route that feels easier than travelling deeper into Birmingham every week.",
        "links": [
            ("/blog/11-plus-tutor-bearwood.html", "11+ tutor in Bearwood"),
            ("/blog/in-person-tutor-smethwick.html", "In-person tutor in Smethwick"),
            ("/blog/private-tutor-harborne.html", "Private tutor in Harborne"),
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
        ],
    },
    "cape-hill": {
        "focus": "a practical mix of primary catch-up, 11+ planning and secondary core-subject support",
        "journey": "Cape Hill families are very close to the Smethwick base, so face-to-face lessons are realistic without turning the week into a travel exercise.",
        "format": "In-person often suits younger pupils here, while online is a useful option for older students with tighter after-school schedules.",
        "school_context": "The big decision is usually not whether to get help, but whether that help should start with English, maths or a broader transition route.",
        "links": [
            ("/blog/tutor-near-me-smethwick-birmingham.html", "Tutors in Smethwick"),
            ("/blog/private-tutor-bearwood.html", "Private tutor in Bearwood"),
            ("/blog/ks2-english-tuition-smethwick.html", "KS2 English tuition"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
        ],
    },
    "edgbaston": {
        "focus": "selective-school planning, GCSE exam support and sixth-form subject depth",
        "journey": "Edgbaston families are close enough for in-person lessons, but many still choose online because schedules are packed and consistency matters more than format alone.",
        "format": "The right choice often depends on age: younger pupils may benefit from direct teacher presence, while older students often work very efficiently online.",
        "school_context": "Parents are usually comparing high-quality teacher input rather than generic tutoring.",
        "links": [
            ("/blog/grammar-school-tutor-birmingham.html", "Grammar school tutor in Birmingham"),
            ("/blog/a-level-maths-tutor-birmingham.html", "A-Level Maths tutor"),
            ("/blog/private-tutor-harborne.html", "Private tutor in Harborne"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
        ],
    },
    "handsworth": {
        "focus": "11+ routes, upper primary English and maths, and core GCSE subjects",
        "journey": "Handsworth is close enough to make weekly lessons practical without a long commute.",
        "format": "Families often mix formats here: in-person for steadier routines, online when the week becomes busier.",
        "school_context": "Because Handsworth sits near several selective-school pathways, 11+ and grammar-school questions come up more often than in many nearby areas.",
        "links": [
            ("/blog/11-plus-tutor-west-bromwich.html", "11+ tutor in West Bromwich"),
            ("/blog/grammar-school-tutor-birmingham.html", "Grammar school tutor in Birmingham"),
            ("/blog/private-tutor-edgbaston.html", "Private tutor in Edgbaston"),
            ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
        ],
    },
    "harborne": {
        "focus": "GCSE core subjects, A-Level depth and longer-term academic planning",
        "journey": "Harborne families can reach the Smethwick base reasonably easily, but online is often preferred because older students have fuller schedules.",
        "format": "This is one of the areas where online and in-person are often equally viable, so the better choice is the one that protects routine and energy.",
        "school_context": "Parents here often want subject expertise, clear planning and honest feedback more than a general homework helper.",
        "links": [
            ("/blog/private-tutor-edgbaston.html", "Private tutor in Edgbaston"),
            ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
            ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
        ],
    },
    "oldbury": {
        "focus": "a broad local mix of KS2 support, 11+ planning and GCSE catch-up",
        "journey": "Oldbury is close to the Smethwick base, which keeps in-person tuition realistic for families who want a local weekly routine.",
        "format": "In-person often wins for younger pupils and 11+ families, while online works well for older students who need convenience.",
        "school_context": "Families often want a local teaching route that feels more structured than broad online marketplaces.",
        "links": [
            ("/blog/11-plus-tutor-oldbury.html", "11+ tutor in Oldbury"),
            ("/blog/private-tutor-west-bromwich.html", "Private tutor in West Bromwich"),
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
            ("/blog/tuition-in-smethwick.html", "Tuition in Smethwick"),
        ],
    },
    "quinton": {
        "focus": "GCSE English, maths and science alongside selective or sixth-form routes where needed",
        "journey": "Quinton is a little further out, so online often becomes the simplest way to protect consistency through the week.",
        "format": "Older students usually do very well online from Quinton, especially when they mainly need exam practice and careful review.",
        "school_context": "The key comparison here is often convenience versus quality, and the best route is the one that keeps support going steadily.",
        "links": [
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ("/blog/private-tutor-harborne.html", "Private tutor in Harborne"),
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/gcse-resit-tutor-birmingham.html", "GCSE resit tutor"),
        ],
    },
    "rowley-regis": {
        "focus": "GCSE catch-up, KS3 re-engagement and practical online support",
        "journey": "Rowley Regis is reachable, but many families prefer to remove travel completely and keep sessions online.",
        "format": "Online often suits best here because it makes it easier to keep a calm after-school routine while still getting teacher-led support.",
        "school_context": "The common need is usually to stop drift in core subjects before it becomes a full exam-year problem.",
        "links": [
            ("/blog/private-tutor-tipton.html", "Private tutor in Tipton"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
        ],
    },
    "tipton": {
        "focus": "core-subject GCSE support plus practical KS2 and transition help",
        "journey": "Tipton is close enough for in-person arrangements, but online is often the easier weekly routine for families balancing school and clubs.",
        "format": "The strongest choice usually depends on age: younger pupils may benefit from travelling in, while older students often prefer online consistency.",
        "school_context": "Most Tipton enquiries are driven by maths, English or science results rather than a general search for tuition.",
        "links": [
            ("/blog/private-tutor-oldbury.html", "Private tutor in Oldbury"),
            ("/blog/private-tutor-west-bromwich.html", "Private tutor in West Bromwich"),
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
        ],
    },
    "wednesbury": {
        "focus": "GCSE core subjects, upper primary support and a sensible online-first route",
        "journey": "Wednesbury families can travel in, but many choose online because it keeps the timetable simpler across the week.",
        "format": "This is one of the areas where online tends to be the practical default, especially for secondary and sixth-form students.",
        "school_context": "The biggest decision is usually which subject to stabilise first, not whether support is needed at all.",
        "links": [
            ("/blog/private-tutor-west-bromwich.html", "Private tutor in West Bromwich"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ("/blog/sats-preparation-smethwick.html", "SATs preparation in Smethwick"),
        ],
    },
    "west-bromwich": {
        "focus": "GCSE core subjects, local secondary catch-up, school English or English Language support, and selective-school comparisons where relevant",
        "journey": "West Bromwich is close enough to keep in-person options realistic, but online also works well for families who want less travel pressure.",
        "format": "The best fit depends on the pupil: some benefit from a physical teaching base, others work better once the lesson can happen straight after school at home.",
        "school_context": "Many searches from West Bromwich are really about finding a reliable, teacher-led route for maths, English or science rather than a broad tutor marketplace. If the search says language tutor, this page keeps that honest by routing school English and English Language needs clearly instead of implying modern foreign language tuition.",
        "links": [
            ("/blog/11-plus-tutor-west-bromwich.html", "11+ tutor in West Bromwich"),
            ("/blog/private-tutor-oldbury.html", "Private tutor in Oldbury"),
            ("/blog/english-tutor-smethwick.html", "English and English Language support"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
        ],
    },
}


GUIDE_META = {
    "affordable-tuition-smethwick-birmingham": {
        "service": "affordable tuition",
        "intro": "Families searching for affordable tuition are usually balancing budget, consistency and teacher quality at the same time. The strongest value comes from a plan you can sustain and from lessons that actually target the right subject gap.",
        "points": [
            "Clear pricing and lesson frequency that fit the family budget without turning support into an all-or-nothing decision",
            "Teacher-led diagnosis so money is spent on the right subject and stage rather than generic extra work",
            "A realistic weekly routine that can be maintained through term time, mocks and exam season",
            "Honest advice on whether one-to-one, in-person or online is the better value route for the pupil",
        ],
        "fit": "This route is best for families who want support to feel realistic over a full term rather than cheap for only a week or two.",
        "links": [
            ("/blog/one-to-one-tuition-smethwick.html", "One-to-one tuition in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ("/blog/maths-tutor-smethwick.html", "Maths tutor in Smethwick"),
            ("/blog/english-tutor-smethwick.html", "English teacher in Smethwick"),
        ],
    },
    "best-maths-tutor-near-b676rs": {
        "service": "a hyper-local maths tutor search near B67 6RS",
        "intro": "A postcode search like B67 6RS is usually about practicality: families want someone close enough to keep lessons consistent, but still strong enough to deliver real maths teaching rather than casual supervision.",
        "points": [
            "Short, workable travel routes for in-person lessons around Bearwood and Smethwick",
            "Qualified-teacher maths input rather than a vague 'homework helper' offer",
            "A clear route into KS2, KS3, GCSE or A-Level depending on the student's stage",
            "A free trial so the family can judge teaching quality before committing to weekly lessons",
        ],
        "fit": "This page is best used when local convenience matters, but only if the teaching still matches the year group and level properly.",
        "links": [
            ("/blog/private-tutor-bearwood.html", "Private tutor in Bearwood"),
            ("/blog/maths-tutor-smethwick.html", "Maths tutor in Smethwick"),
            ("/blog/in-person-tutor-smethwick.html", "In-person tutor in Smethwick"),
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
        ],
    },
    "btec-science-tutor-birmingham": {
        "service": "BTEC science support",
        "intro": "BTEC Applied Science students rarely need the same kind of help as GCSE students. The pressure is usually about assignment structure, understanding command verbs, and staying organised across units as well as external assessments.",
        "points": [
            "Breaking assignments into workable stages so students are not overwhelmed by a full brief",
            "Teaching the science properly so written work is accurate rather than descriptive",
            "Supporting external assessments with a clearer revision and retrieval routine",
            "Helping students understand exactly what distinction-level evidence usually looks like",
        ],
        "fit": "This route suits students who know roughly what the unit is about but need clearer structure, accuracy and accountability to finish strong work.",
        "links": [
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor in Smethwick"),
            ("/blog/a-level-biology-tutor-birmingham.html", "A-Level Biology tutor"),
            ("/blog/ucat-tutor-birmingham.html", "UCAT tutor in Birmingham"),
            ("/blog/year-12-tutor-smethwick.html", "Year 12 tutor in Smethwick"),
        ],
    },
    "catch-up-tuition-smethwick": {
        "service": "catch-up tuition",
        "intro": "Catch-up tuition works best when it does more than repeat class notes. The goal is to identify exactly where the pupil fell behind and rebuild that confidently enough that normal school lessons start making sense again.",
        "points": [
            "Sorting out whether the gap is knowledge, confidence, pace or written method",
            "Prioritising the topics that are blocking progress in the next school lessons",
            "Keeping the workload calm so catch-up feels achievable rather than punishing",
            "Linking catch-up work to current school tasks so improvement shows up quickly",
        ],
        "fit": "This route is useful after absence, a difficult transition, a drop in confidence or a period where school support has not been enough on its own.",
        "links": [
            ("/blog/homework-help-smethwick.html", "Homework help in Smethwick"),
            ("/blog/one-to-one-tuition-smethwick.html", "One-to-one tuition in Smethwick"),
            ("/blog/year-7-tutor-smethwick.html", "Year 7 tutor in Smethwick"),
            ("/blog/year-10-maths-intervention-smethwick.html", "Year 10 maths intervention"),
        ],
    },
    "easter-revision-courses-smethwick": {
        "service": "Easter revision support",
        "intro": "Easter is one of the most useful revision windows of the year because students finally have enough time to stop reacting to school deadlines and start working through mock data properly.",
        "points": [
            "Turning mock results into a short list of topics that genuinely need revisiting",
            "Using holiday sessions for timed paper practice while there is still time to fix errors",
            "Balancing intensity with rest so motivation stays stable through the final exam run-in",
            "Building a post-Easter plan so revision does not collapse once term starts again",
        ],
        "fit": "This page is best for Year 6, Year 11 and Year 13 families who want the holiday to do more than create a pile of notes.",
        "links": [
            ("/blog/half-term-tuition-birmingham.html", "Half-term tuition in Birmingham"),
            ("/blog/mock-exam-preparation-smethwick.html", "Mock exam preparation in Smethwick"),
            ("/blog/year-11-gcse-revision-smethwick.html", "Year 11 GCSE revision"),
            ("/blog/summer-tuition-birmingham.html", "Summer tuition in Birmingham"),
        ],
    },
    "exam-technique-gcse-smethwick": {
        "service": "GCSE exam technique support",
        "intro": "Exam technique is what turns knowledge into marks. Many students know more than their paper score suggests, but they lose marks through timing, weak structure, incomplete method or misreading the command word.",
        "points": [
            "Understanding how mark schemes actually reward method, evidence and precision",
            "Learning when to move on, when to return and how to manage paper timing",
            "Practising under realistic conditions instead of only reading model answers",
            "Using mock papers to spot repeated exam habits, not just repeated topic gaps",
        ],
        "fit": "This route is most useful when the student can often explain answers verbally but still underperforms on the actual paper.",
        "links": [
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/mock-exam-preparation-smethwick.html", "Mock exam preparation in Smethwick"),
        ],
    },
    "half-term-tuition-birmingham": {
        "service": "half-term tuition",
        "intro": "Half-term is not long enough for a complete academic reset, but it is very effective for a sharp, targeted block of work when the next school pressure point is already clear.",
        "points": [
            "Repairing one or two priority topics before the next mock or class assessment",
            "Using the break to build revision rhythm without the full term-time timetable",
            "Giving students a calmer space to practise harder questions they avoid during busy school weeks",
            "Returning to school with a clearer plan instead of more vague intentions to revise",
        ],
        "fit": "This route usually works best for exam-year pupils or for students who need a short confidence rebuild after a poor assessment block.",
        "links": [
            ("/blog/easter-revision-courses-smethwick.html", "Easter revision support"),
            ("/blog/summer-tuition-birmingham.html", "Summer tuition in Birmingham"),
            ("/blog/year-11-gcse-revision-smethwick.html", "Year 11 GCSE revision"),
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
        ],
    },
    "homework-help-smethwick": {
        "service": "homework help",
        "intro": "Homework help is useful when the real problem is getting started, staying organised or checking understanding from the week. It becomes less useful when the student actually needs reteaching of the underlying content.",
        "points": [
            "Using homework as a window into where school learning is wobbling",
            "Helping pupils organise, prioritise and complete work without panic",
            "Spotting when homework difficulty is really a reading, maths or confidence gap underneath",
            "Turning one difficult worksheet into a clearer longer-term teaching target",
        ],
        "fit": "This route suits students who are struggling with routine and follow-through, especially in upper KS2 and early KS3.",
        "links": [
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
            ("/blog/year-7-tutor-smethwick.html", "Year 7 tutor in Smethwick"),
            ("/blog/ks2-english-tuition-smethwick.html", "KS2 English tuition"),
            ("/blog/ks2-maths-tuition-smethwick.html", "KS2 Maths tuition"),
        ],
    },
    "english-tutor-smethwick": {
        "service": "English tutoring in Smethwick",
        "intro": "A strong English tutor page should not collapse reading, writing and exam technique into one vague offer. Families searching for English support, English Language help or even language tutors in Smethwick usually need a quick answer on whether the real issue is comprehension, vocabulary, paragraph structure, confidence or timed exam performance.",
        "points": [
            "A route from KS2 reading and writing into KS3 analysis and GCSE English Language or Literature",
            "Live modelling of answers so pupils see how stronger sentences and paragraphs are built",
            "Separate diagnosis for reading, writing, SPaG, vocabulary and exam timing",
            "Clear wording for language-tutor searches: Teaching Success supports school English, GCSE English Language and written communication, not a modern foreign language course",
            "Clear next steps into year-group, KS2 and GCSE English pages so families can choose the right level",
        ],
        "fit": "This page is the English hub for Smethwick families who know the subject is the issue but still need help choosing the exact stage and priority.",
        "queries": [
            "english teacher in Smethwick",
            "language tutors in Smethwick",
            "English tutor near me",
            "GCSE English tutor Smethwick",
        ],
        "intent": "Families using English teacher or language-tutor wording need a clear school-English route. This page answers that wording honestly, then moves families into reading, writing, GCSE English Language or Literature support instead of creating a misleading modern-language page.",
        "links": [
            ("/blog/ks2-english-tuition-smethwick.html", "KS2 English tuition"),
            ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
            ("/blog/year-7-english-tutor-smethwick.html", "Year 7 English tutor"),
            ("/blog/year-11-english-tutor-smethwick.html", "Year 11 English tutor"),
        ],
    },
    "in-person-tutor-smethwick": {
        "service": "in-person tuition",
        "intro": "In-person tuition is most valuable when live working, attention and physical routine make a meaningful difference to how the student learns.",
        "points": [
            "Direct observation of how the student writes, calculates and responds to feedback",
            "A dedicated teaching base that can feel easier than trying to work at home",
            "Particular value for younger pupils, 11+ preparation and pupils who need calmer routines",
            "The option to combine in-person structure with online flexibility when needed",
        ],
        "fit": "This route is most useful for pupils who focus better away from home distractions or need closer teacher modelling on paper.",
        "links": [
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
            ("/blog/one-to-one-tuition-smethwick.html", "One-to-one tuition in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ("/blog/11-plus-mock-test-smethwick.html", "11+ mock test in Smethwick"),
        ],
    },
    "ks2-english-tuition-smethwick": {
        "service": "KS2 English tuition",
        "intro": "Strong KS2 English support is about more than reading aloud. The real work is usually fluency, comprehension evidence, vocabulary growth, sentence control and writing with more confidence.",
        "points": [
            "Separating reading, writing and grammar so families know exactly what needs work",
            "Building vocabulary and comprehension habits that support both SATs and normal school progress",
            "Using live writing to improve sentence control, punctuation and idea organisation",
            "Helping pupils explain answers clearly rather than guessing or writing too little",
        ],
        "fit": "This route suits Year 3 to Year 6 pupils who need stronger written clarity, calmer reading habits or better SATs preparation without last-minute panic.",
        "links": [
            ("/blog/year-6-english-tutor-smethwick.html", "Year 6 English tutor in Smethwick"),
            ("/blog/sats-preparation-smethwick.html", "SATs preparation in Smethwick"),
            ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
            ("/blog/english-tutor-smethwick.html", "English teacher in Smethwick"),
        ],
    },
    "ks2-maths-tuition-smethwick": {
        "service": "KS2 Maths tuition",
        "intro": "KS2 maths progress usually improves fastest when arithmetic accuracy and reasoning habits are built together. Many pupils can do one in isolation, but the stronger result comes when they can choose and explain the right method independently.",
        "points": [
            "Building fluency with number facts, written methods and mental calculation",
            "Strengthening fractions, measure and multi-step reasoning before Year 6 pressure rises",
            "Helping pupils show their working more clearly so school assessments reflect what they know",
            "Using practice that supports both SATs and the normal weekly maths curriculum",
        ],
        "fit": "This route is useful from Year 3 onward, especially when a child is becoming hesitant with arithmetic or losing marks on reasoning questions.",
        "links": [
            ("/blog/year-6-maths-tutor-smethwick.html", "Year 6 Maths tutor in Smethwick"),
            ("/blog/sats-preparation-smethwick.html", "SATs preparation in Smethwick"),
            ("/blog/maths-tutor-smethwick.html", "Maths tutor in Smethwick"),
            ("/blog/11-plus-maths-tutor-smethwick.html", "11+ Maths tutor in Smethwick"),
        ],
    },
    "maths-tutor-smethwick": {
        "service": "maths tutoring in Smethwick",
        "intro": "A broad maths page should help families move quickly into the right level rather than treating every maths problem as the same. Families searching for a maths teacher in Smethwick need the answer quickly: qualified teacher, correct stage, clear diagnosis and a free trial route.",
        "points": [
            "A teacher-led route from primary number confidence through to A-Level Maths",
            "Clear diagnosis of whether the issue is topic knowledge, method, pace or exam judgement",
            "Internal routes into KS2, KS3, GCSE and A-Level pages so families do not get stuck on a generic overview",
            "Early separation of arithmetic, algebra, reasoning and exam-technique issues so parents can see what will actually be taught",
            "In-person and online options depending on age, schedule and focus",
        ],
        "fit": "This page is best used as the maths hub before moving into the year group or exam stage that matches your child most closely, especially if the search started with maths teacher in Smethwick.",
        "queries": [
            "maths teacher in Smethwick",
            "maths tutor Smethwick",
            "maths tutor near me",
            "GCSE maths tuition Smethwick",
        ],
        "intent": "This page gives parents a clearer reason to choose the result before they move into a narrower year-group or exam page: teacher-led maths support, the right stage and an obvious next step.",
        "links": [
            ("/blog/ks2-maths-tuition-smethwick.html", "KS2 Maths tuition in Smethwick"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/a-level-maths-tutor-birmingham.html", "A-Level Maths tutor"),
            ("/blog/year-11-maths-tutor-smethwick.html", "Year 11 Maths tutor in Smethwick"),
        ],
    },
    "smethwick-tuition-centre": {
        "service": "the Smethwick tuition centre route",
        "intro": "A tuition centre page should answer a practical question: why travel to a teaching base instead of arranging another online lesson or a home tutor? Families comparing centre-style searches need to understand the local base, teacher-led structure and free trial quickly.",
        "points": [
            "In-person teaching for pupils who focus better away from home distractions",
            "A local base for Smethwick, Bearwood, Cape Hill, Oldbury and West Bromwich families",
            "Teacher-led support across maths, English, science, SATs, 11+ and GCSE routes",
            "Clear separation from broad tutor-near-me searches: this page is about the physical Smethwick learning routine",
            "A free trial so families can judge fit before committing to weekly tuition",
        ],
        "fit": "This route suits families who want the structure of a physical teaching space and a local routine that can be maintained every week.",
        "queries": [
            "Smethwick tuition centre",
            "Smethwick Windmill tuition centre",
            "tuition centre near me",
            "in-person tutor Smethwick",
        ],
        "intent": "This page answers centre-style searches directly, including Smethwick Windmill tuition centre wording, then separates the physical Smethwick base from broader tutor-near-me and online-tuition searches.",
        "links": [
            ("/blog/in-person-tutor-smethwick.html", "In-person tutor in Smethwick"),
            ("/blog/tutor-near-me-smethwick-birmingham.html", "Tutors near Smethwick"),
            ("/blog/private-tutor-bearwood.html", "Private tutor in Bearwood"),
            ("/blog/tuition-in-smethwick.html", "Tuition in Smethwick"),
        ],
    },
    "maths-tutor-walsall": {
        "service": "the Walsall maths route with Mr Vasta",
        "intro": "Families looking for maths tuition in Walsall usually need one of two things: stronger KS3 foundations before GCSE gets serious, or sharper GCSE paper performance where method and question choice are costing marks.",
        "points": [
            "A Walsall-based route with Mr Vasta for KS3 and GCSE support",
            "Clear focus on algebra, proportion, written method and exam habits rather than vague extra worksheets",
            "A practical local option for Walsall, Bloxwich, Willenhall and nearby areas",
            "A free trial to establish whether the first priority should be topic repair or paper technique",
        ],
        "fit": "This route is most useful for families who want a Walsall-specific maths plan rather than a broad West Midlands search.",
        "links": [
            ("/blog/gcse-maths-walsall.html", "GCSE Maths in Walsall"),
            ("/blog/private-tutor-bloxwich.html", "Tutor in Bloxwich"),
            ("/blog/private-tutor-willenhall.html", "Tutor in Willenhall"),
            ("/tutors/mr-vasta-walsall.html", "Mr Vasta's profile"),
        ],
    },
    "maths-tutor-coventry": {
        "service": "the Coventry maths route with Mr Olu",
        "intro": "A Coventry maths search is usually driven by one pressure point: GCSE results, KS3 confidence drift or the need for a teacher who can explain methods properly rather than just mark answers.",
        "points": [
            "A local Coventry route through Mr Olu for KS3 and GCSE Maths",
            "Strong emphasis on algebra, problem-solving and method marks under time pressure",
            "Support that connects school assessment data to a clearer weekly plan",
            "The option of online lessons when families want less travel around busy evenings",
        ],
        "fit": "This route suits families who want maths support anchored to Coventry rather than a broader Birmingham search.",
        "links": [
            ("/blog/gcse-maths-coventry.html", "GCSE Maths in Coventry"),
            ("/blog/secondary-tutor-coventry.html", "Secondary tutor in Coventry"),
            ("/blog/gcse-science-coventry.html", "GCSE Science in Coventry"),
            ("/tutors/mr-olu-coventry.html", "Mr Olu's profile"),
        ],
    },
    "mock-exam-preparation-smethwick": {
        "service": "mock exam preparation",
        "intro": "Mock exams matter because they tell you where marks are being lost while there is still time to do something useful about it. The strongest preparation is never just 'do more papers'; it is knowing what those papers are showing you.",
        "points": [
            "Reading mock results topic by topic instead of only looking at the total score",
            "Using mocks to decide what must be retaught before the next paper",
            "Practising under timed conditions so stamina and judgement improve as well as knowledge",
            "Turning weak mock outcomes into a calm revision plan rather than a panic response",
        ],
        "fit": "This route is best for students whose performance changes sharply under exam conditions or whose mock feedback feels too vague to act on.",
        "links": [
            ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
            ("/blog/year-11-gcse-revision-smethwick.html", "Year 11 GCSE revision"),
            ("/blog/predicted-grade-improvement-gcse.html", "Predicted grade improvement at GCSE"),
            ("/blog/11-plus-mock-test-smethwick.html", "11+ mock test in Smethwick"),
        ],
    },
    "one-to-one-tuition-smethwick": {
        "service": "one-to-one tuition",
        "intro": "One-to-one teaching is most useful when the pace, explanation and feedback need to follow the individual student rather than the shape of a group or a standard workbook.",
        "points": [
            "Immediate correction of misunderstandings instead of waiting for them to settle into habit",
            "A lesson pace that can slow down for reteaching or speed up when the student is ready",
            "Better visibility for parents around what is actually improving week to week",
            "Clearer links between school work, tutor work and the next target",
        ],
        "fit": "This route suits students who need a more personal pace, more confidence rebuilding, or more precise subject diagnosis than group settings usually allow.",
        "links": [
            ("/blog/in-person-tutor-smethwick.html", "In-person tutor in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
        ],
    },
    "online-tutor-smethwick-birmingham": {
        "service": "online tuition",
        "intro": "Online tuition works best when it is chosen for the right reasons: less travel, easier scheduling, stronger consistency and a pupil who can engage well through a screen. It is not automatically better or worse than in-person; it is a different route.",
        "points": [
            "Consistency across busy weeks when travel would otherwise break the routine",
            "Particular value for older students, exam classes and families slightly further from the Smethwick base",
            "Live annotation, worked examples and paper review without losing lesson pace",
            "The option to switch between formats when the year gets busier",
        ],
        "fit": "This route is strongest when the student is old enough to work independently on screen and the family wants to remove unnecessary travel friction.",
        "links": [
            ("/blog/in-person-tutor-smethwick.html", "In-person tutor in Smethwick"),
            ("/blog/private-tutor-quinton.html", "Private tutor in Quinton"),
            ("/blog/private-tutor-rowley-regis.html", "Private tutor in Rowley Regis"),
            ("/blog/ucat-tutor-birmingham.html", "UCAT tutor in Birmingham"),
        ],
    },
    "predicted-grade-improvement-gcse": {
        "service": "predicted grade improvement at GCSE",
        "intro": "Predicted grades do move, but usually only when there is new evidence. The useful question is not whether a grade can improve in theory; it is what kind of performance change the school needs to see before it updates its judgement.",
        "points": [
            "Using mock papers and class assessments as the clearest route to fresh evidence",
            "Improving the exact topics and exam habits that are holding the average down",
            "Understanding that predicted grades often lag behind progress until more than one result changes",
            "Keeping the focus on real paper improvement rather than chasing the number on its own",
        ],
        "fit": "This page is most useful for Year 10 and Year 11 families trying to understand how actual school predictions shift over time.",
        "links": [
            ("/blog/mock-exam-preparation-smethwick.html", "Mock exam preparation in Smethwick"),
            ("/blog/year-11-gcse-revision-smethwick.html", "Year 11 GCSE revision"),
            ("/blog/gcse-resit-tutor-birmingham.html", "GCSE resit tutor"),
            ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
        ],
    },
    "sats-preparation-smethwick": {
        "service": "SATs preparation",
        "intro": "Strong SATs preparation is not about turning Year 6 into an endless cycle of papers. The biggest gains usually come from identifying the reading, arithmetic or reasoning habits that keep costing marks and strengthening them calmly over time.",
        "points": [
            "Reading comprehension and SPaG work that support both SATs and everyday classroom performance",
            "Maths fluency and reasoning practice that focus on how marks are actually won",
            "A calm routine that stops SATs pressure from damaging confidence in the final months of primary school",
            "A link between SATs work now and smoother secondary-school readiness later",
        ],
        "fit": "This route is best for Year 6 families who want proper preparation without last-minute panic, and for Year 5 families who want to build stronger habits early.",
        "links": [
            ("/blog/year-6-english-tutor-smethwick.html", "Year 6 English tutor in Smethwick"),
            ("/blog/year-6-maths-tutor-smethwick.html", "Year 6 Maths tutor in Smethwick"),
            ("/blog/ks2-english-tuition-smethwick.html", "KS2 English tuition"),
            ("/blog/ks2-maths-tuition-smethwick.html", "KS2 Maths tuition"),
        ],
    },
    "science-tutor-smethwick": {
        "service": "a broad science route in Smethwick",
        "intro": "A science page should help families choose the right route quickly: KS3 foundations, GCSE Combined or Triple Science, or A-Level subject depth. The most useful starting point is knowing which stage the pupil is actually struggling at.",
        "points": [
            "A teacher-led route across Biology, Chemistry and Physics depending on level",
            "Clear distinction between knowledge gaps, weak written explanation and exam-technique problems",
            "Direct routes into GCSE subject-specific pages where the issue is clearly Biology, Chemistry or Physics",
            "Support available in person or online depending on age and location",
        ],
        "fit": "This page works best as a science hub before moving into the exact subject and stage your child needs most.",
        "links": [
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/gcse-biology-tutor-smethwick.html", "GCSE Biology tutor"),
            ("/blog/gcse-chemistry-tutor-smethwick.html", "GCSE Chemistry tutor"),
            ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
        ],
    },
    "secondary-tutor-coventry": {
        "service": "a secondary-school route in Coventry",
        "intro": "A broad secondary tutor search in Coventry is usually driven by KS3 drift, GCSE pressure or the need for one clear local route into Maths and Science support.",
        "points": [
            "Teacher-led support through Mr Olu for KS3 and GCSE pathways",
            "A practical local route before families decide whether they need a more subject-specific page",
            "Support for transition, confidence and exam preparation rather than generic extra work",
            "Options for both in-person and online depending on the family's routine",
        ],
        "fit": "This route suits families who know they need secondary support but want help deciding whether the next page should be Maths, Science or a more general KS3 route.",
        "links": [
            ("/blog/maths-tutor-coventry.html", "Maths tutor in Coventry"),
            ("/blog/gcse-science-coventry.html", "GCSE Science in Coventry"),
            ("/blog/gcse-maths-coventry.html", "GCSE Maths in Coventry"),
            ("/tutors/mr-olu-coventry.html", "Mr Olu's profile"),
        ],
    },
    "smethwick-tuition-guide": {
        "service": "a Smethwick tuition guide",
        "intro": "The strongest local tuition choice usually comes down to three questions: does the tutor fit the subject and year group, is the plan clear, and will the format be easy to sustain every week?",
        "points": [
            "Start by identifying the real stage and subject need rather than searching everything at once",
            "Use local pages as decision routes, not dead ends: maths, English, science, SATs, 11+ and GCSE all need different answers",
            "Compare whether in-person, online or the Smethwick base will make the routine most sustainable",
            "Look for qualified-teacher input and a plan that can explain progress in plain English",
        ],
        "fit": "This page is the broad local overview before moving into the more exact subject, year-group or location route that matches your child.",
        "links": [
            ("/blog/tutor-near-me-smethwick-birmingham.html", "Tutors in Smethwick"),
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
            ("/blog/maths-tutor-smethwick.html", "Maths tutor in Smethwick"),
            ("/blog/english-tutor-smethwick.html", "English teacher in Smethwick"),
        ],
    },
    "summer-tuition-birmingham": {
        "service": "summer tuition",
        "intro": "Summer is one of the best times to rebuild confidence because the work can be slower, more targeted and less tied to the pace of current school homework.",
        "points": [
            "Repairing weak topics before they become next year's starting problem",
            "Using the break to move calmly from one stage to the next: Year 6 to Year 7, Year 11 to sixth form, or mock season into final exams",
            "Balancing revision with confidence rebuilding so students return to school steadier",
            "Creating a short summer plan that actually fits around holidays and family life",
        ],
        "fit": "This route is useful for transition years, catch-up after a difficult term and quiet early exam preparation before school pressure restarts.",
        "links": [
            ("/blog/half-term-tuition-birmingham.html", "Half-term tuition in Birmingham"),
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
            ("/blog/year-7-tutor-smethwick.html", "Year 7 tutor in Smethwick"),
            ("/blog/year-12-tutor-smethwick.html", "Year 12 tutor in Smethwick"),
        ],
    },
    "supportive-learning-needs-tuition-smethwick": {
        "service": "supportive learning-needs tuition",
        "intro": "Supportive tuition for learning needs works best when the lesson pace, explanation style and environment are all adjusted thoughtfully. The goal is not to push faster, but to make progress feel clearer and more manageable.",
        "points": [
            "Calmer pacing and clearer chunking of tasks so the student is not overwhelmed",
            "More explicit modelling, repetition and checking for understanding",
            "Honest communication with parents about what helps attention, confidence and retention",
            "A focus on sustainable progress rather than unrealistic promises",
        ],
        "fit": "This route is useful for families who know their child needs a more supportive, better-structured teaching approach than a standard lesson usually offers.",
        "links": [
            ("/blog/one-to-one-tuition-smethwick.html", "One-to-one tuition in Smethwick"),
            ("/blog/in-person-tutor-smethwick.html", "In-person tutor in Smethwick"),
            ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
            ("/blog/homework-help-smethwick.html", "Homework help in Smethwick"),
        ],
    },
    "tutor-near-me-smethwick-birmingham": {
        "service": "tutors in Smethwick",
        "intro": "A tutor-near-me search is partly about distance, but a helpful local page also needs to answer the deeper parent question: who can actually teach the right subject, at the right level, in a format the family can keep up? This page works as the local decision hub for Smethwick families comparing nearby tuition options.",
        "points": [
            "A local comparison route for Smethwick, Bearwood, Oldbury, West Bromwich and Birmingham families",
            "Clear links into maths, English, science, 11+, SATs, GCSE and A-Level support",
            "A practical choice between in-person lessons at the Smethwick base and online tuition",
            "A cleaner next step for desktop visitors who may be comparing several local tutor sites before calling",
            "Qualified-teacher input rather than a generic directory-style tutor listing",
        ],
        "fit": "This page is the local search hub for families who want nearby help but still need to narrow the choice by subject, year group and lesson format.",
        "queries": [
            "tuition near me",
            "tutors in Smethwick",
            "tutor near me",
            "tutoring near me",
        ],
        "intent": "This is the best landing page for near-me searches because it answers distance and choice first, then routes families into Smethwick tuition, the tuition centre, maths, English and 11+ pages. It is tuned to make comparison and calling easier for parents who are weighing up several local tutor options.",
        "links": [
            ("/blog/tuition-in-smethwick.html", "Tuition in Smethwick"),
            ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
            ("/blog/maths-tutor-smethwick.html", "Maths tutor in Smethwick"),
            ("/blog/english-tutor-smethwick.html", "English tutor in Smethwick"),
        ],
    },
    "ucat-tutor-birmingham": {
        "service": "UCAT preparation",
        "intro": "UCAT preparation is different from school revision because the core challenge is speed, decision-making and recovery under pressure, not content memorisation.",
        "points": [
            "Breaking the test into sections so practice is targeted rather than repetitive",
            "Tracking accuracy and speed separately, because students often need different fixes for each",
            "Using short, high-pressure timed sets rather than only full mocks",
            "Connecting UCAT planning to Medicine or Dentistry application goals rather than treating the test in isolation",
        ],
        "fit": "This route is best for students applying to Medicine or Dentistry who want a structured, section-by-section build rather than self-study alone.",
        "links": [
            ("/blog/a-level-biology-tutor-birmingham.html", "A-Level Biology tutor"),
            ("/blog/a-level-chemistry-tutor-birmingham.html", "A-Level Chemistry tutor"),
            ("/blog/year-13-tutor-smethwick.html", "Year 13 tutor in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
        ],
    },
}


GCSE_META = {
    "gcse-biology-tutor-smethwick": {
        "service": "GCSE Biology",
        "intro": "GCSE Biology scores often rise when students stop treating the subject as pure memorisation and start learning how to explain processes clearly enough to earn marks.",
        "points": [
            "Required practical language, six-mark answers and process explanations",
            "Topic areas such as cells, organisation, infection, bioenergetics and inheritance where detail matters",
            "Making diagrams, data and key terminology easier to retrieve under timed conditions",
            "Using Biology-specific practice rather than hiding weak Biology inside broader science revision",
        ],
        "fit": "This route is best for students who cope with the factual load but still lose marks on written precision and longer responses.",
        "links": [
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/gcse-chemistry-tutor-smethwick.html", "GCSE Chemistry tutor"),
            ("/blog/gcse-physics-tutor-smethwick.html", "GCSE Physics tutor"),
            ("/blog/a-level-biology-tutor-birmingham.html", "A-Level Biology tutor"),
        ],
    },
    "gcse-chemistry-tutor-smethwick": {
        "service": "GCSE Chemistry",
        "intro": "Chemistry usually becomes easier when students can connect the ideas instead of memorising them as isolated facts. The marks are often lost on calculations, particle explanations and the precise wording of answers.",
        "points": [
            "Moles, formulae, bonding, rates and other topics where method and explanation both matter",
            "Required practical questions and how to write a stronger scientific method answer",
            "Retrieval practice that keeps knowledge active rather than letting one topic replace another",
            "Structured question practice so calculations and written science improve together",
        ],
        "fit": "This route suits students who find Chemistry more abstract than Biology and need clearer step-by-step teaching before exam practice feels useful.",
        "links": [
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/gcse-biology-tutor-smethwick.html", "GCSE Biology tutor"),
            ("/blog/gcse-physics-tutor-smethwick.html", "GCSE Physics tutor"),
            ("/blog/a-level-chemistry-tutor-birmingham.html", "A-Level Chemistry tutor"),
        ],
    },
    "gcse-english-tutor-smethwick": {
        "service": "GCSE English",
        "intro": "GCSE English improvement usually comes from separating the problem properly. Some students need stronger text knowledge, some need structure, and some mainly need to learn how to think clearly under time pressure.",
        "points": [
            "English Language and Literature can be taught together or separated depending on where marks are being lost",
            "Live modelling of paragraph structure, textual evidence and argument control",
            "Clear work on timing and question interpretation rather than vague 'revise harder' advice",
            "A sharper route from classroom understanding into exam-ready written answers",
        ],
        "fit": "This route is best when a student can talk through a text well but struggles to turn that understanding into marks on the page.",
        "links": [
            ("/blog/year-10-english-tutor-smethwick.html", "Year 10 English tutor"),
            ("/blog/year-11-english-tutor-smethwick.html", "Year 11 English tutor"),
            ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
            ("/blog/gcse-resit-tutor-birmingham.html", "GCSE resit tutor"),
        ],
    },
    "gcse-maths-smethwick-birmingham": {
        "service": "GCSE Maths",
        "intro": "GCSE Maths moves fastest when weak topics are linked to the exact paper habits that keep marks low. Students often need both reteaching and better exam judgement, not one or the other.",
        "points": [
            "Topic diagnosis from mocks and class tests rather than random worksheet selection",
            "Method marks, calculator judgement and mixed-paper stamina",
            "Secure routes through algebra, ratio, geometry, statistics and problem-solving",
            "A plan that shows families what is changing before the next assessment window arrives",
        ],
        "fit": "This route suits Year 10 and Year 11 students who need sharper topic repair and better full-paper performance.",
        "links": [
            ("/blog/year-10-maths-tutor-smethwick.html", "Year 10 Maths tutor"),
            ("/blog/year-11-maths-tutor-smethwick.html", "Year 11 Maths tutor"),
            ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
            ("/blog/gcse-resit-tutor-birmingham.html", "GCSE resit tutor"),
        ],
    },
    "gcse-maths-walsall": {
        "service": "GCSE Maths in Walsall",
        "intro": "The Walsall GCSE Maths route is about building a clearer local plan through Mr Vasta, especially when schools, mocks and family schedules all need to line up with a realistic weekly routine.",
        "points": [
            "A Walsall-based teacher route into algebra, ratio, geometry and paper strategy",
            "Support for both Foundation and Higher pathways depending on current grade and target",
            "A calmer diagnosis-first approach rather than jumping straight into endless past papers",
            "Useful local coverage for Walsall, Bloxwich, Willenhall and nearby families",
        ],
        "fit": "This route is strongest for families who want GCSE Maths support anchored locally around Walsall rather than a wider regional search.",
        "links": [
            ("/blog/maths-tutor-walsall.html", "Maths tutor in Walsall"),
            ("/blog/private-tutor-bloxwich.html", "Tutor in Bloxwich"),
            ("/blog/private-tutor-willenhall.html", "Tutor in Willenhall"),
            ("/tutors/mr-vasta-walsall.html", "Mr Vasta's profile"),
        ],
    },
    "gcse-maths-coventry": {
        "service": "GCSE Maths in Coventry",
        "intro": "The Coventry GCSE Maths route is about strong local teaching through Mr Olu, especially for students who need clearer methods and more confidence before paper pressure gets heavier.",
        "points": [
            "A teacher-led route through KS3 into Foundation or Higher GCSE papers",
            "Focused work on the question types that repeatedly cost marks in school assessments",
            "Paper-practice routines that strengthen both speed and decision-making",
            "A practical local option for Coventry families who want subject-specific support",
        ],
        "fit": "This route suits families who want GCSE Maths support shaped around Coventry rather than a broad Midlands search.",
        "links": [
            ("/blog/maths-tutor-coventry.html", "Maths tutor in Coventry"),
            ("/blog/secondary-tutor-coventry.html", "Secondary tutor in Coventry"),
            ("/blog/gcse-science-coventry.html", "GCSE Science in Coventry"),
            ("/tutors/mr-olu-coventry.html", "Mr Olu's profile"),
        ],
    },
    "gcse-physics-tutor-smethwick": {
        "service": "GCSE Physics",
        "intro": "Physics often feels difficult because students have to remember content, choose equations correctly and communicate method clearly at the same time. It is rarely just a knowledge issue on its own.",
        "points": [
            "Equation use, rearranging formulae and showing working clearly enough for method marks",
            "Core topics such as energy, electricity, forces, waves and magnetism where mistakes snowball quickly",
            "Required practical understanding and better use of units, graphs and data",
            "A more structured approach to multi-step calculation questions under time pressure",
        ],
        "fit": "This route suits students who can follow Physics in class but freeze once the question asks them to calculate, explain and justify together.",
        "links": [
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
            ("/blog/gcse-biology-tutor-smethwick.html", "GCSE Biology tutor"),
            ("/blog/gcse-chemistry-tutor-smethwick.html", "GCSE Chemistry tutor"),
            ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
        ],
    },
    "gcse-resit-tutor-birmingham": {
        "service": "GCSE resit support",
        "intro": "A resit route is not the same as repeating the same revision again. Students usually need a clearer restart plan, tighter confidence work and a more honest diagnosis of why the first sitting did not land where they needed.",
        "points": [
            "Separate planning for November resits and longer rebuilds toward the next summer sitting",
            "Calmer confidence work for students who now associate the subject with failure",
            "Prioritising the topics and paper habits that offer the quickest mark return",
            "Building a smaller, more manageable revision system that can actually be maintained",
        ],
        "fit": "This route is best for students who need another attempt at GCSE Maths or English and want something more purposeful than starting the same workbook again.",
        "links": [
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
            ("/blog/predicted-grade-improvement-gcse.html", "Predicted grade improvement at GCSE"),
            ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
        ],
    },
    "gcse-science-tutor-smethwick": {
        "service": "GCSE Science",
        "intro": "GCSE Science support works best when families decide whether the problem is broad Combined Science performance or a more specific weakness in one subject that now needs direct attention.",
        "points": [
            "A clear route across Biology, Chemistry and Physics depending on whether the student studies Combined or Triple",
            "Work on command words, scientific explanation and practical-method questions",
            "Better retrieval and revision sequencing so one science does not erase the others",
            "Exam technique that helps students decide how to approach longer or unfamiliar questions",
        ],
        "fit": "This route is useful when science feels too broad to organise alone and the student needs a teacher-led plan across the set of papers.",
        "links": [
            ("/blog/gcse-biology-tutor-smethwick.html", "GCSE Biology tutor"),
            ("/blog/gcse-chemistry-tutor-smethwick.html", "GCSE Chemistry tutor"),
            ("/blog/gcse-physics-tutor-smethwick.html", "GCSE Physics tutor"),
            ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
        ],
    },
    "gcse-science-walsall": {
        "service": "GCSE Science in Walsall",
        "intro": "The Walsall GCSE Science route is about keeping Biology, Chemistry and Physics organised enough that none of them quietly slips behind the others through the year.",
        "points": [
            "A local route through Mr Vasta for GCSE Science support in Walsall and nearby areas",
            "Better management of Combined or Triple Science revision across the three papers",
            "Stronger written explanation and practical-method answers",
            "A clearer weekly plan so science revision does not become vague or repetitive",
        ],
        "fit": "This route suits Walsall families who want one science route anchored locally before splitting into subject-specific issues if needed.",
        "links": [
            ("/blog/maths-tutor-walsall.html", "Maths tutor in Walsall"),
            ("/blog/gcse-maths-walsall.html", "GCSE Maths in Walsall"),
            ("/blog/private-tutor-bloxwich.html", "Tutor in Bloxwich"),
            ("/tutors/mr-vasta-walsall.html", "Mr Vasta's profile"),
        ],
    },
    "gcse-science-coventry": {
        "service": "GCSE Science in Coventry",
        "intro": "The Coventry GCSE Science route gives families a local way to organise Biology, Chemistry and Physics support before the subject load becomes too fragmented to manage alone.",
        "points": [
            "Teacher-led science support through Mr Olu for Coventry students",
            "Stronger command-word handling, scientific explanation and practical understanding",
            "A local route that works well alongside GCSE Maths support where both are wobbling",
            "Clearer revision planning across Combined or Triple Science papers",
        ],
        "fit": "This route is best for Coventry families who want science support locally anchored and easier to sustain through the school year.",
        "links": [
            ("/blog/secondary-tutor-coventry.html", "Secondary tutor in Coventry"),
            ("/blog/gcse-maths-coventry.html", "GCSE Maths in Coventry"),
            ("/blog/maths-tutor-coventry.html", "Maths tutor in Coventry"),
            ("/tutors/mr-olu-coventry.html", "Mr Olu's profile"),
        ],
    },
}


A_LEVEL_META = {
    "a-level-biology-tutor-birmingham": {
        "service": "A-Level Biology",
        "intro": "A-Level Biology usually becomes difficult because the quantity of detail is high and the mark schemes still expect precise explanation rather than broad understanding alone.",
        "points": [
            "Long-answer structure, practical analysis and data interpretation",
            "Managing heavy content across cells, genetics, ecology and physiology without losing retrieval",
            "Using exam questions to sharpen the exact scientific language that earns marks",
            "Building a revision system that copes with volume instead of just rereading notes",
        ],
        "fit": "This route is best for students who know the content roughly but need stronger explanation, analysis and memory structure.",
        "links": [
            ("/blog/a-level-chemistry-tutor-birmingham.html", "A-Level Chemistry tutor"),
            ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
            ("/blog/year-12-tutor-smethwick.html", "Year 12 tutor in Smethwick"),
            ("/blog/ucat-tutor-birmingham.html", "UCAT tutor in Birmingham"),
        ],
    },
    "a-level-chemistry-tutor-birmingham": {
        "service": "A-Level Chemistry tutor in Birmingham",
        "intro": "A-Level Chemistry improves most when students build clearer systems for calculations, practical thinking and mechanism logic rather than treating each topic as a separate memory test. Around June and the summer planning window, the work usually shifts from topic coverage into sharper Paper 3, predicted-grade and Year 13 readiness decisions.",
        "points": [
            "Organic mechanisms, calculation chains and practical-method evaluation",
            "AQA and OCR A support that still keeps the bigger synoptic picture in view",
            "More reliable working for the questions where marks disappear in stages rather than all at once",
            "A cleaner revision structure across physical, inorganic and organic Chemistry",
            "Paper 3 and UCAS predicted-grade priorities for students moving from Year 12 into Year 13",
        ],
        "fit": "This route suits students who feel they understand the lesson but cannot yet reproduce that understanding accurately on timed AQA, OCR or synoptic papers.",
        "links": [
            ("/blog/a-level-biology-tutor-birmingham.html", "A-Level Biology tutor"),
            ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
            ("/blog/year-13-tutor-smethwick.html", "Year 13 tutor in Smethwick"),
            ("/blog/ucat-tutor-birmingham.html", "UCAT tutor in Birmingham"),
        ],
    },
    "a-level-maths-tutor-birmingham": {
        "service": "A-Level Maths",
        "intro": "A-Level Maths often feels harder not because the topics are impossible, but because the tolerance for weak algebra and inconsistent practice becomes much smaller than at GCSE.",
        "points": [
            "Pure Maths fluency, Statistics interpretation and Mechanics modelling",
            "Working through algebraic errors before they spread through entire solutions",
            "Timed paper control so students do not lose marks simply through poor sequencing or judgement",
            "Independent practice routines that are strong enough for sixth-form pace",
        ],
        "fit": "This route is useful for students who were strong at GCSE but now need sharper discipline, algebra control and paper strategy.",
        "links": [
            ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
            ("/blog/year-12-tutor-smethwick.html", "Year 12 tutor in Smethwick"),
            ("/blog/year-13-tutor-smethwick.html", "Year 13 tutor in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
        ],
    },
    "a-level-physics-tutor-birmingham": {
        "service": "A-Level Physics",
        "intro": "A-Level Physics is rarely just about remembering facts. The pressure usually comes from linking equations, concepts, data and written reasoning without losing control of the method.",
        "points": [
            "Equation fluency, graph interpretation and required-practical thinking",
            "Topic areas such as electricity, fields, mechanics and waves where earlier maths confidence matters",
            "Paper practice that helps students decide when to calculate, explain or justify more carefully",
            "A stronger bridge between Physics ideas and the mathematical method underneath them",
        ],
        "fit": "This route is strongest for students who enjoy the subject but need more structure to show that understanding reliably on full papers.",
        "links": [
            ("/blog/a-level-maths-tutor-birmingham.html", "A-Level Maths tutor"),
            ("/blog/a-level-chemistry-tutor-birmingham.html", "A-Level Chemistry tutor"),
            ("/blog/year-13-tutor-smethwick.html", "Year 13 tutor in Smethwick"),
            ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
        ],
    },
}


ELEVEN_PLUS_META = {
    "11-plus-primary-smethwick": {
        "service": "11+ preparation in Smethwick",
        "intro": "A broad 11+ page should help families understand how reading, maths, verbal reasoning and non-verbal reasoning fit together rather than treating the process as one long sequence of practice papers. For families searching for 11 plus tuition in Smethwick, this page is the main parent route before choosing mock tests, subject support or school-specific preparation.",
        "points": [
            "A full route through reading, maths, verbal reasoning and non-verbal reasoning",
            "Year 4 and Year 5 planning so the process feels progressive rather than rushed",
            "The link between core KS2 skills and actual selective-school performance",
            "Clearer wording for GL-style preparation, Birmingham exam practice and comprehension or reasoning searches",
            "A clear route into area-specific and mock-test pages once the family knows the target schools better",
        ],
        "fit": "This page works best as the central 11+ starting point before moving into school-specific, mock-test or subject-specific routes.",
        "queries": [
            "11 plus tuition Smethwick",
            "11 plus base Smethwick reviews",
            "GL 11 plus Birmingham",
            "11 plus comprehension Birmingham",
        ],
        "intent": "This central 11+ landing page routes families into mock tests, English, maths and reasoning pages once the first planning question has been answered.",
        "links": [
            ("/blog/11-plus-english-tutor-smethwick.html", "11+ English tutor in Smethwick"),
            ("/blog/11-plus-maths-tutor-smethwick.html", "11+ Maths tutor in Smethwick"),
            ("/blog/11-plus-verbal-reasoning-smethwick.html", "11+ verbal reasoning tutor"),
            ("/blog/11-plus-non-verbal-reasoning-smethwick.html", "11+ non-verbal reasoning tutor"),
        ],
    },
    "11-plus-verbal-reasoning-smethwick": {
        "service": "11+ verbal reasoning",
        "intro": "Verbal reasoning is usually where families discover that vocabulary, pattern recognition and timing all have to improve together. It is not just a language task and it is not just a puzzle task.",
        "points": [
            "Code, letter and word patterns taught explicitly rather than left to guesswork",
            "Vocabulary building that supports both verbal reasoning and broader English confidence",
            "Timed drills that help pupils decide quickly rather than linger too long on one question type",
            "A clearer way to spot whether the real barrier is language knowledge or exam pace",
        ],
        "fit": "This route is useful when a child is strong in school English but still finds 11+ reasoning questions unexpectedly slow or confusing.",
        "links": [
            ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
            ("/blog/11-plus-english-tutor-smethwick.html", "11+ English tutor in Smethwick"),
            ("/blog/11-plus-non-verbal-reasoning-smethwick.html", "11+ non-verbal reasoning tutor"),
            ("/blog/11-plus-mock-test-smethwick.html", "11+ mock test in Smethwick"),
        ],
    },
    "11-plus-non-verbal-reasoning-smethwick": {
        "service": "11+ non-verbal reasoning",
        "intro": "Non-verbal reasoning often improves quickly once patterns are taught systematically. The challenge is not general intelligence; it is learning how to recognise transformations, rotations and visual logic fast enough under pressure.",
        "points": [
            "Pattern families taught explicitly so pupils know what to look for",
            "Step-by-step work on rotation, reflection, movement and hidden rules",
            "Timed practice that sharpens decision-making without encouraging random guessing",
            "A useful complement to maths work where visual logic is strong but speed is inconsistent",
        ],
        "fit": "This route suits pupils who can often work the answer out eventually but need to become faster and calmer on the real paper style.",
        "links": [
            ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
            ("/blog/11-plus-maths-tutor-smethwick.html", "11+ Maths tutor in Smethwick"),
            ("/blog/11-plus-verbal-reasoning-smethwick.html", "11+ verbal reasoning tutor"),
            ("/blog/11-plus-mock-test-smethwick.html", "11+ mock test in Smethwick"),
        ],
    },
    "grammar-school-tutor-birmingham": {
        "service": "grammar-school preparation in Birmingham",
        "intro": "A grammar-school search is not only about the test. Families also need clarity on school routes, timings, realistic targets and how preparation should change depending on which schools are in view.",
        "points": [
            "Understanding the Birmingham and nearby selective-school landscape before overcommitting to the wrong route",
            "Balancing school choice, test timing and the real level of competition involved",
            "Using 11+ preparation as structured skill-building rather than a last-minute collection of papers",
            "Moving from a broad grammar-school search into more specific school or subject pages once priorities are clearer",
        ],
        "fit": "This route is best for families who are still comparing grammar-school options and need an overview before drilling into one exact test path.",
        "links": [
            ("/blog/king-edwards-11-plus-preparation.html", "King Edward's 11+ preparation"),
            ("/blog/11-plus-tutor-birmingham.html", "11+ tutor in Birmingham"),
            ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
            ("/blog/11-plus-mock-exams-birmingham.html", "11+ mock exams in Birmingham"),
        ],
    },
    "king-edwards-11-plus-preparation": {
        "service": "King Edward's 11+ preparation",
        "intro": "King Edward's preparation is usually where Birmingham 11+ ambition becomes more specific. Families often need to understand not just the format, but how competitive the route is and how calm preparation should be structured over time.",
        "points": [
            "Using the Birmingham grammar-school route as a planning framework rather than only a practice-paper target",
            "Keeping reading, maths and reasoning balanced instead of overworking one strength while another area slips",
            "Using mock feedback to check realism, not just confidence",
            "Understanding where the King Edward's route sits alongside other selective options in the region",
        ],
        "fit": "This route is strongest for families who already know the King Edward's schools are central to their shortlist and want preparation to feel intentional.",
        "links": [
            ("/blog/grammar-school-tutor-birmingham.html", "Grammar school tutor in Birmingham"),
            ("/blog/11-plus-tutor-birmingham.html", "11+ tutor in Birmingham"),
            ("/blog/11-plus-mock-exams-birmingham.html", "11+ mock exams in Birmingham"),
            ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
        ],
    },
}


SPECIAL_YEAR_SLUGS = {
    "year-10-maths-intervention-smethwick": {
        "service": "Year 10 maths intervention",
        "intro": "Year 10 intervention is about catching the GCSE pattern early enough that Year 11 does not become one long repair job. The goal is to identify the specific gaps that are already showing up in assessments and deal with them before they harden into exam habits.",
        "points": [
            "Using early GCSE data to find the topics and question types already dragging scores down",
            "Building a short intervention block around the highest-value maths gaps first",
            "Combining reteaching with mixed-paper work so the improvement transfers into real assessments",
            "Creating a stronger Year 10 routine before the pressure of Year 11 arrives",
        ],
        "links": [
            ("/blog/year-10-maths-tutor-smethwick.html", "Year 10 Maths tutor"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/year-11-maths-tutor-smethwick.html", "Year 11 Maths tutor"),
            ("/blog/mock-exam-preparation-smethwick.html", "Mock exam preparation in Smethwick"),
        ],
    },
    "year-11-gcse-revision-smethwick": {
        "service": "Year 11 GCSE revision",
        "intro": "Year 11 revision works best when it is selective and evidence-based. The strongest students do not revise everything equally; they prioritise the topics, subjects and question habits that are making the biggest difference to their total score.",
        "points": [
            "Using mock papers to decide what revision matters most over the next month",
            "Balancing content review with full-paper timing and judgement under pressure",
            "Keeping English, maths and science revision realistic enough to maintain every week",
            "Using short review cycles so one round of revision actually sticks",
        ],
        "links": [
            ("/blog/mock-exam-preparation-smethwick.html", "Mock exam preparation in Smethwick"),
            ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
            ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
            ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
        ],
    },
}


LOCATION_META.update(
    {
        "bloxwich": {
            "focus": "a Bloxwich tuition plan for GCSE Maths, GCSE Science, KS3 English and English Language support through the Walsall tutor route rather than a generic marketplace listing",
            "journey": "Bloxwich families usually need a practical Walsall-side option where weekly lessons can stay consistent without travelling across Birmingham.",
            "format": "In-person can work well through the Walsall route, while online is useful when school, clubs and family transport make the week tighter.",
            "school_context": "A tuition in Bloxwich search often starts when Year 7 to Year 9 gaps begin to show up before GCSE choices and mock pressure arrive. Maths teacher wording is routed into the Walsall maths plan, while language-tutor wording is treated as school English and English Language support unless the family specifically needs a modern foreign language route.",
            "links": [
                ("/blog/private-tutor-walsall.html", "Private tutor in Walsall"),
                ("/blog/private-tutor-willenhall.html", "Tutor in Willenhall"),
                ("/blog/english-tutor-walsall.html", "English tutor in Walsall"),
                ("/blog/gcse-maths-walsall.html", "GCSE Maths tutor in Walsall"),
            ],
        },
        "dudley": {
            "focus": "GCSE Maths, GCSE Science, KS3 English and practical online support for families who want teacher-led help without travelling across the Black Country",
            "journey": "Dudley families can use online tuition most easily, with nearby Smethwick or Walsall routes considered when in-person support is the stronger fit.",
            "format": "Online is usually the simplest starting point for Dudley students, especially at GCSE, because the lesson can stay consistent around school, travel and clubs.",
            "school_context": "Most Dudley enquiries are subject-led rather than purely local: parents usually want maths, science or English support that gives clearer feedback than a broad tutor marketplace.",
            "links": [
                ("/blog/private-tutor-coventry.html", "Private tutor in Coventry"),
                ("/blog/private-tutor-walsall.html", "Private tutor in Walsall"),
                ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
                ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ],
        },
        "manchester": {
            "focus": "GCSE Maths and GCSE Science support through Miss Kay's Manchester route",
            "journey": "Manchester families are usually looking for a local teacher-led route rather than support based around the Smethwick centre.",
            "format": "Manchester enquiries often work best as a local or online route depending on the student's timetable and the exact subject need.",
            "school_context": "The strongest enquiries tend to be exam-stage focused: algebra, paper technique, science explanations and confidence after mocks.",
            "links": [
                ("/blog/gcse-maths-manchester.html", "GCSE Maths tutor in Manchester"),
                ("/blog/gcse-science-manchester.html", "GCSE Science tutor in Manchester"),
                ("/tutors/miss-kay-manchester.html", "Miss Kay Manchester tutor profile"),
                ("/blog/online-tutor-smethwick-birmingham.html", "Online tuition options"),
            ],
        },
        "solihull": {
            "focus": "11+ preparation, GCSE core subjects and A-Level support for families who value teacher-led online tuition over a generic local listing",
            "journey": "Solihull families are usually far enough from the Smethwick base that online tuition is the cleanest route unless a specific in-person arrangement makes sense.",
            "format": "Online often works best for older Solihull students, while 11+ or younger pupils may need a more careful conversation about routine, attention and parent support at home.",
            "school_context": "Solihull searches often carry selective-school, GCSE or sixth-form pressure, so the page needs to route families into the right subject rather than just say 'private tutor'.",
            "links": [
                ("/blog/grammar-school-tutor-birmingham.html", "Grammar school tutor in Birmingham"),
                ("/blog/11-plus-tutor-birmingham.html", "11+ tutor in Birmingham"),
                ("/blog/a-level-maths-tutor-birmingham.html", "A-Level Maths tutor"),
                ("/blog/online-tutor-smethwick-birmingham.html", "Online tutor in Smethwick and Birmingham"),
            ],
        },
        "walsall": {
            "focus": "maths, science and KS3 English support through Mr Vasta's Walsall route",
            "journey": "Walsall families usually want a tutor close enough for a stable routine but still connected to the wider Teaching Success standards.",
            "format": "In-person works well for local Walsall families, while online is a useful fallback when transport or after-school timing gets difficult.",
            "school_context": "Most Walsall searches are tied to KS3 confidence, GCSE Maths, GCSE Science or a need for clearer written structure in English.",
            "links": [
                ("/tutors/mr-vasta-walsall.html", "Mr Vasta Walsall tutor profile"),
                ("/blog/gcse-maths-walsall.html", "GCSE Maths tutor in Walsall"),
                ("/blog/gcse-science-walsall.html", "GCSE Science tutor in Walsall"),
                ("/blog/private-tutor-bloxwich.html", "Private tutor in Bloxwich"),
            ],
        },
        "willenhall": {
            "focus": "GCSE Maths, GCSE Science, KS3 English and English Language support for families using the Walsall tutor route",
            "journey": "Willenhall families are close enough to the Walsall route for in-person support to be realistic without losing the week to travel.",
            "format": "The best format depends on age: KS3 students often benefit from in-person structure, while GCSE students can also work effectively online.",
            "school_context": "Enquiries usually start when maths, science or written English gaps begin to affect school confidence before GCSE pressure fully arrives. Where searches use language-tutor wording, this is handled as English and English Language support, not a promise of MFL tuition.",
            "links": [
                ("/blog/private-tutor-walsall.html", "Private tutor in Walsall"),
                ("/blog/private-tutor-bloxwich.html", "Private tutor in Bloxwich"),
                ("/blog/english-tutor-walsall.html", "English tutor in Walsall"),
                ("/blog/maths-tutor-walsall.html", "Maths tutor in Walsall"),
            ],
        },
        "coventry": {
            "focus": "secondary Maths and Science support through Mr Olu's Coventry route",
            "journey": "Coventry families usually need a local secondary route rather than travelling into Smethwick every week.",
            "format": "In-person lessons can work through the Coventry route, with online support available where a flexible routine is more realistic.",
            "school_context": "The main pressure points are KS3 foundations, GCSE Maths, GCSE Science and exam technique before or after mock results.",
            "links": [
                ("/tutors/mr-olu-coventry.html", "Mr Olu Coventry tutor profile"),
                ("/blog/maths-tutor-coventry.html", "Maths tutor in Coventry"),
                ("/blog/gcse-maths-coventry.html", "GCSE Maths tutor in Coventry"),
                ("/blog/gcse-science-coventry.html", "GCSE Science tutor in Coventry"),
            ],
        },
    }
)


GUIDE_META.update(
    {
        "tuition-in-smethwick": {
            "service": "tuition in Smethwick",
            "intro": "A broad tuition search usually means the family knows help is needed but has not yet chosen the subject, stage or format. The page should help them move from a general local search into the right teaching route.",
            "points": [
                "A clear overview of primary, 11+, KS3, GCSE and selected A-Level tuition",
                "Guidance on choosing the first subject based on the student's actual pressure point",
                "A distinction between the broader tuition offer, the tutor-near-me guide and the Smethwick tuition centre page",
                "Direct links into maths, English, science, 11+ and GCSE routes so the page acts as a real hub",
            ],
            "fit": "This page is best for parents searching broadly for tuition in Smethwick before they know whether maths, English, science, 11+ or GCSE support should come first.",
            "queries": [
                "tuition in Smethwick",
                "tutors in Smethwick",
                "tuition near me",
                "Smethwick tuition centre",
            ],
            "intent": "The page is deliberately broader than a subject page because the search data shows parents often begin with a location-first tuition query before narrowing the need.",
            "links": [
                ("/blog/tutor-near-me-smethwick-birmingham.html", "Tutors in Smethwick"),
                ("/blog/smethwick-tuition-centre.html", "Smethwick tuition centre"),
                ("/blog/maths-tutor-smethwick.html", "Maths teacher in Smethwick"),
                ("/blog/english-tutor-smethwick.html", "English teacher in Smethwick"),
            ],
        },
        "11-plus-tutor-wolverhampton": {
            "service": "11+ tutoring in Wolverhampton",
            "intro": "A Wolverhampton 11+ search is usually about selective-school readiness, but the useful starting point is still the same: reading, maths and reasoning have to be built together before mock scores mean much.",
            "points": [
                "Checking whether the child needs core KS2 repair before heavier reasoning work",
                "Balancing verbal and non-verbal reasoning instead of only repeating favourite question types",
                "Using mock-style tasks to expose timing and confidence issues without overtesting",
                "Linking the Wolverhampton route back to wider West Midlands grammar-school preparation where relevant",
            ],
            "fit": "This route is best for Wolverhampton families who want 11+ preparation explained clearly before choosing a mock-test or subject-specific page.",
            "links": [
                ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
                ("/blog/grammar-school-tutor-birmingham.html", "Grammar school tutor in Birmingham"),
                ("/blog/11-plus-mock-exams-birmingham.html", "11+ mock exams"),
                ("/tutor-network.html", "Teaching Success tutor network"),
            ],
        },
        "11-plus-year-4-smethwick": {
            "service": "Year 4 11+ preparation",
            "intro": "Year 4 should not feel like a full exam year. The most useful work is building calm foundations: reading accuracy, number confidence, vocabulary and early reasoning habits.",
            "points": [
                "Light-touch reasoning practice so pupils learn the patterns without pressure",
                "Reading and vocabulary routines that support both school English and later 11+ work",
                "Maths fluency checks before harder multi-step reasoning appears",
                "A measured plan that avoids burning out a child before Year 5 preparation begins",
            ],
            "fit": "This page suits families who want an early 11+ start but still want the work to feel age-appropriate.",
            "links": [
                ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
                ("/blog/11-plus-year-5-smethwick.html", "Year 5 11+ preparation"),
                ("/blog/year-4-english-tutor-smethwick.html", "Year 4 English tutor"),
                ("/blog/year-4-maths-tutor-smethwick.html", "Year 4 Maths tutor"),
            ],
        },
        "11-plus-year-6-smethwick": {
            "service": "Year 6 11+ preparation",
            "intro": "Year 6 11+ support has to become sharper and calmer at the same time. The focus is no longer broad exploration; it is timed performance, mock feedback and the exact weaknesses still costing marks.",
            "points": [
                "Turning mock results into a short priority list for the next few weeks",
                "Building exam timing without making every lesson feel like a test",
                "Reviewing reading, maths and reasoning errors separately so fixes are precise",
                "Keeping confidence stable as the real exam approaches",
            ],
            "fit": "This route suits families close to the exam who need focused 11+ correction rather than more general practice.",
            "links": [
                ("/blog/11-plus-primary-smethwick.html", "11 plus tuition in Smethwick"),
                ("/blog/11-plus-mock-test-smethwick.html", "11+ mock test in Smethwick"),
                ("/blog/11-plus-mock-exams-birmingham.html", "11+ mock exams Birmingham"),
                ("/blog/year-6-tutor-smethwick.html", "Year 6 tutor in Smethwick"),
            ],
        },
        "a-level-tutor-coventry": {
            "service": "A-Level tutoring in Coventry",
            "intro": "A-Level support in Coventry is usually about independence as much as content. Students often understand lessons but need sharper routines for practice, review and exam performance.",
            "points": [
                "Identifying whether the issue is subject knowledge, paper technique or weak independent practice",
                "Using past-paper evidence rather than vague revision confidence to plan lessons",
                "Supporting students through the jump from GCSE success to sixth-form depth",
                "Choosing online or local support based on consistency, not convenience alone",
            ],
            "fit": "This page is best for Coventry sixth-form students who need a clear plan before choosing a subject-specific A-Level route.",
            "links": [
                ("/blog/a-level-maths-tutor-birmingham.html", "A-Level Maths tutor"),
                ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
                ("/blog/year-12-tutor-smethwick.html", "Year 12 tutor"),
                ("/blog/year-13-tutor-smethwick.html", "Year 13 tutor"),
            ],
        },
        "english-tutor-walsall": {
            "service": "English tutoring in Walsall",
            "intro": "English support in Walsall is usually about written clarity: reading a question accurately, choosing evidence, and building a paragraph that says enough without drifting.",
            "points": [
                "Separating reading comprehension, vocabulary and written structure before setting more work",
                "Supporting KS3 pupils before weak written habits become GCSE problems",
                "Teaching students how to explain rather than simply retell",
                "Using Mr Vasta's Walsall route for families who need local KS3 English support",
            ],
            "fit": "This page suits Walsall families whose child can often talk through an answer but struggles to put it down clearly in writing.",
            "links": [
                ("/tutors/mr-vasta-walsall.html", "Mr Vasta Walsall tutor profile"),
                ("/blog/private-tutor-walsall.html", "Private tutor in Walsall"),
                ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
                ("/blog/english-tutor-smethwick.html", "English teacher in Smethwick"),
            ],
        },
        "english-tutor-coventry": {
            "service": "English tutoring in Coventry",
            "intro": "Coventry English support is most useful when it identifies whether the barrier is reading, vocabulary, essay structure, confidence or timing.",
            "points": [
                "Checking comprehension and written explanation separately",
                "Helping KS3 students build stronger paragraphs before GCSE texts become demanding",
                "Using model answers carefully without turning lessons into copying",
                "Linking English work to wider secondary support through the Coventry route",
            ],
            "fit": "This page suits families who want a secondary English route but still need to know which part of English is actually holding progress back.",
            "links": [
                ("/blog/private-tutor-coventry.html", "Private tutor in Coventry"),
                ("/blog/secondary-tutor-coventry.html", "Secondary tutor in Coventry"),
                ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
                ("/tutors/mr-olu-coventry.html", "Mr Olu Coventry profile"),
            ],
        },
        "gcse-maths-manchester": {
            "service": "GCSE Maths tutoring in Manchester",
            "intro": "Manchester GCSE Maths support should begin with the paper evidence: which topics are costing marks, whether the student is on the right tier, and how much of the issue is method rather than knowledge.",
            "points": [
                "Foundation or Higher tier support based on the student's actual paper profile",
                "Focused work on algebra, geometry, number, ratio and statistics where marks are leaking",
                "AQA-style exam practice where that matches the student's school route",
                "A clear link between Miss Kay's teaching and the student's next school assessment",
            ],
            "fit": "This route suits Manchester students who need targeted GCSE Maths improvement rather than another broad revision timetable.",
            "links": [
                ("/tutors/miss-kay-manchester.html", "Miss Kay Manchester tutor profile"),
                ("/blog/gcse-science-manchester.html", "GCSE Science tutor in Manchester"),
                ("/blog/gcse-maths-coventry.html", "GCSE Maths Coventry"),
                ("/blog/exam-technique-gcse-smethwick.html", "GCSE exam technique"),
            ],
        },
        "gcse-science-manchester": {
            "service": "GCSE Science tutoring in Manchester",
            "intro": "GCSE Science in Manchester usually needs a blend of content repair, practical-question confidence and better written explanations for Biology, Chemistry and Physics.",
            "points": [
                "Separating Biology, Chemistry and Physics gaps instead of treating science as one block",
                "Improving required-practical, data and graph questions that students often underestimate",
                "Building stronger six-mark answers through structure and scientific vocabulary",
                "Using exam-board practice so revision connects to the papers students actually sit",
            ],
            "fit": "This route suits Manchester students whose science grade is being held back by explanations, practical questions or uneven performance across the three sciences.",
            "links": [
                ("/tutors/miss-kay-manchester.html", "Miss Kay Manchester tutor profile"),
                ("/blog/gcse-maths-manchester.html", "GCSE Maths tutor in Manchester"),
                ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor in Smethwick"),
                ("/blog/gcse-science-coventry.html", "GCSE Science Coventry"),
            ],
        },
        "sats-preparation-birmingham": {
            "service": "SATs preparation in Birmingham",
            "intro": "SATs preparation should build calm Year 6 readiness rather than turn the spring term into constant testing. The most useful support strengthens reading, arithmetic, reasoning and SPaG in a balanced way.",
            "points": [
                "Checking arithmetic fluency before moving into harder reasoning questions",
                "Building reading stamina and evidence habits for comprehension papers",
                "Practising SPaG without making writing feel mechanical",
                "Using short assessment cycles so parents know what has improved before May",
            ],
            "fit": "This route suits Birmingham families who want SATs support that improves confidence as well as test scores.",
            "links": [
                ("/blog/sats-preparation-smethwick.html", "SATs preparation in Smethwick"),
                ("/blog/year-6-tutor-smethwick.html", "Year 6 tutor in Smethwick"),
                ("/blog/year-6-english-tutor-smethwick.html", "Year 6 English tutor"),
                ("/blog/year-6-maths-tutor-smethwick.html", "Year 6 Maths tutor"),
            ],
        },
    }
)


def section(title: str, body_html: str) -> str:
    return f"""      <div class="blp-section">
        <h2>{title}</h2>
        {body_html}
      </div>"""


def p(text: str) -> str:
    return f"<p>{text}</p>"


def ul(items: list[str]) -> str:
    joined = "\n".join(f"        <li>{item}</li>" for item in items)
    return f"<ul>\n{joined}\n      </ul>"


def ol(items: list[str]) -> str:
    joined = "\n".join(f"        <li>{item}</li>" for item in items)
    return f"<ol>\n{joined}\n      </ol>"


def next_step(paragraph: str | None = None) -> str:
    text = paragraph or (
        'Call <a href="tel:07909274901">07909&nbsp;274901</a> or '
        '<a href="/">book a free trial lesson</a> to discuss the best starting point '
        "for your child's next term."
    )
    return section("Next Step", f"<p>{text}</p>")


def intent_section(primary: str, supporting: list[str], action: str) -> str:
    terms = ", ".join(supporting[:4])
    return section(
        "Search intent this page is built for",
        p(
            f"This page is written for families searching for {primary}. It also helps when the search starts with related wording such as {terms}, because the useful next step is the same: identify the right stage, subject and lesson format before booking."
        )
        + p(action),
    )


def summer_section(title: str, lead: str, bullets: list[str], close: str | None = None) -> str:
    final_bullet = close or (
        "Keep the plan light enough to protect the holiday feel, but specific enough that September does not become a cold restart."
    )
    return section(
        title,
        p(lead)
        + ul(
            bullets
            + [final_bullet]
        ),
    )


def summer_year_general(year: int, detail: dict[str, str]) -> str:
    if year <= 4:
        lead = (
            f"Mid-July 2026 is the point where Year {year} school reports, class books and teacher comments have shown what needs a calm summer plan. "
            f"For this age, the best next step keeps {detail['general']} moving without making the break feel like another school term."
        )
        bullets = [
            f"Use report comments to decide whether {detail['english']} needs more attention than general confidence work.",
            f"Keep {detail['maths']} warm through short, repeated practice rather than long worksheet blocks.",
            "Make the first September target visible before the holiday starts, so support has a clear purpose.",
        ]
    elif year == 5:
        lead = (
            "Mid-July 2026 is a useful Year 5 checkpoint because families can now see whether upper-KS2 confidence is ready for Year 6. "
            "For some children that means SATs foundations; for others it means deciding whether 11+ preparation should become more structured over the summer."
        )
        bullets = [
            f"Use recent class work to see whether {detail['english']} or {detail['maths']} is the more urgent first step.",
            "Separate normal Year 6 readiness from selective-school preparation so the plan does not become overloaded.",
            "Build a summer routine that can continue into September when homework and school expectations rise.",
        ]
    elif year == 6:
        lead = (
            "The 2026 KS2 tests are now behind Year 6 pupils and the published papers give families a clearer way to read the evidence. "
            "Mid-July should be less about more test drilling and more about using SATs feedback, school reports and transition information to make the move into Year 7 feel steadier."
        )
        bullets = [
            "Look at English and maths separately so secondary transition support starts with the subject most likely to affect confidence.",
            "Turn SATs-style mistakes into a short transition list rather than repeating whole papers after the tests.",
            "Practise the routines Year 7 will expect: recording method, explaining answers and organising work independently.",
        ]
    elif year <= 9:
        lead = (
            f"Mid-July 2026 is when Year {year} families can use end-of-year assessments and reports before the next timetable lands. "
            "A few focused lessons can stop KS3 drift while the school evidence is still fresh."
        )
        bullets = [
            "Review the school report and choose the one subject where a confidence lift would change the most next term.",
            f"Revisit the routines behind {detail['general']} so the student returns with clearer habits.",
            "Use summer lessons for slower explanations and practice, not just extra homework in disguise.",
        ]
    elif year == 10:
        lead = (
            "Mid-July 2026 gives Year 10 families a live preview of the GCSE pressure coming next year, while this summer's Year 11 exam season is still fresh. "
            "The useful move now is to turn Year 10 assessments into a repair plan before mock season becomes urgent."
        )
        bullets = [
            "Compare recent topic tests with the question types that appear on full GCSE papers.",
            "Choose the highest-value English, maths or science priority before Year 11 starts narrowing the timetable.",
            "Build a weekly routine that mixes reteaching, retrieval and short timed practice.",
        ]
    elif year == 11:
        lead = (
            "By mid-July 2026, most Year 11 pupils have finished their final papers and are inside the results-day and sixth-form bridge period. "
            "Support should now be specific: fill the gaps that affect next steps, not restart broad GCSE revision for its own sake."
        )
        bullets = [
            "Use the final-paper experience to note which skills felt least secure under time pressure.",
            "Keep core English and maths warm if a resit plan might be needed after results day.",
            "Start bridging work for sixth-form subjects where GCSE knowledge will be assumed in September.",
        ]
    elif year <= 11:
        lead = (
            f"For Year {year}, summer can turn mock feedback and school targets into a more useful plan before the pressure rises again. "
            "It works best when the work is selective, not a full timetable copied into July and August."
        )
        bullets = [
            "Pick the papers, topics or question habits that cost the most marks last term.",
            "Use timed practice sparingly so exam stamina grows without making every session feel high stakes.",
            "Build a September-ready revision routine before school, mocks and coursework begin competing for attention.",
        ]
    elif year == 12:
        lead = (
            "Mid-July 2026 is the moment Year 12 students can connect end-of-year assessments with the 2027 UCAS cycle, which is already open for applications. "
            "The best tuition plan strengthens subject depth while also making independent study more deliberate."
        )
        bullets = [
            "Use recent papers or topic tests to identify the subject area most likely to limit next year's predicted grade.",
            "Link academic repair to wider goals such as course research, personal statement evidence and super-curricular reading.",
            "Create a summer study rhythm that is realistic enough to continue when Year 13 starts.",
        ]
    else:
        lead = (
            "By mid-July 2026, Year 13 support should be moving from broad revision into calm results-day and progression planning, with UCAS Clearing already open for eligible applicants. "
            "The aim is to keep key subject skills active while students prepare for university, apprenticeships, Clearing or a gap-year decision."
        )
        bullets = [
            "Capture the topics that felt weakest in final papers before the memory fades.",
            "Prepare a short plan for results day so Clearing, resits or course changes are not handled in a panic.",
            "Keep academic confidence steady for the next step without pretending the exam season is still running.",
        ]
    return summer_section(f"Mid-July 2026 timing for Year {year}", lead, bullets)


def summer_year_subject(year: int, subject: str, detail: dict[str, str]) -> str:
    subject_label = "English" if subject == "english" else "Maths"
    focus = detail["english"] if subject == "english" else detail["maths"]
    if subject == "english":
        if year <= 6:
            bullets = [
                "Use end-of-term report comments to separate reading fluency, vocabulary, SPaG and writing stamina.",
                f"Practise {focus} in small bursts so written quality improves without turning summer into school-at-home.",
                "Talk through answers before writing them, because primary English confidence often improves fastest orally first.",
            ]
        elif year <= 9:
            bullets = [
                "Use end-of-year assessments to spot whether the issue is reading depth, paragraph structure or confidence.",
                f"Practise {focus} with short modelled answers before asking for longer independent writing.",
                "Keep one reading habit alive through the break so September English does not feel like a cold start.",
            ]
        elif year == 10:
            bullets = [
                "Use Year 10 assessment feedback to choose one Language and one Literature priority before Year 11 starts.",
                f"Practise {focus} through timed paragraphs, not only notes or quotation lists.",
                "Build a September routine for text knowledge, unseen reading and question timing.",
            ]
        else:
            bullets = [
                "After the final GCSE papers, record which question types felt most difficult under time pressure.",
                f"Keep {focus} active if English resit, sixth-form essay subjects or course bridging may be relevant.",
                "Use short review sessions after results day only where they support the student's next route.",
            ]
    else:
        if year <= 6:
            bullets = [
                f"Use end-of-term class work or SATs-style feedback to decide whether {focus} is the first priority.",
                "Correct working line by line so the student remembers the method, not just the answer.",
                "Keep number fluency ticking over with short retrieval tasks between sessions.",
            ]
        elif year <= 9:
            bullets = [
                "Use end-of-year assessments to find whether arithmetic, algebra, ratio or problem-solving is blocking progress.",
                f"Warm up {focus} through short mixed questions before moving into longer problems.",
                "Practise explaining method clearly so September maths feels less rushed.",
            ]
        elif year == 10:
            bullets = [
                "Map Year 10 test results against GCSE topic families so the first repair target is obvious.",
                f"Practise {focus} with mixed exam questions rather than isolated worksheet pages only.",
                "Build a small routine for calculator judgement, method marks and checking before Year 11.",
            ]
        else:
            bullets = [
                "After the final GCSE papers, note whether timing, topic knowledge or method accuracy felt most fragile.",
                f"Keep {focus} warm if a resit, sixth-form Maths route or vocational course will need it.",
                "Use results-day outcomes to decide whether the next step is bridging, resit repair or a pause.",
            ]
    lead = (
        f"Mid-July 2026 {subject_label} tuition for Year {year} should start from the evidence families have now: reports, recent papers and the student's own confidence. "
        f"The goal is to return to school sharper on {focus}, while still leaving the holiday feeling like a holiday."
    )
    return summer_section(f"Mid-July 2026 {subject_label} plan for Year {year}", lead, bullets)


def summer_manual(service: str, fit_text: str) -> str:
    service_lower = service.lower()
    if "ucat" in service_lower:
        lead = (
            "UCAT 2026 is now in a live testing window: booking is open, July sittings are already running, and the booking deadline is 16 September. "
            "Preparation should therefore move from casual practice into section-by-section timing, test-window choices and recovery strategy."
        )
        bullets = [
            "Confirm registration, access arrangements and the intended test window before choosing a preparation schedule.",
            "Track speed and accuracy separately so each UCAT section has a clear improvement target.",
            "Connect UCAT preparation to Medicine or Dentistry course research and the October UCAS deadline.",
        ]
    elif "11+" in service or "grammar" in service_lower or "king edward" in service_lower:
        lead = (
            f"Mid-July 2026 is a practical 11+ checkpoint for {service}: West Midlands Grammar Schools registration for September 2027 entry has now closed, so families should use the waiting period before allocated test-centre information arrives in September to balance GL-style paper practice, section repair and confidence. "
            "The strongest holiday plan uses feedback carefully without overtesting the child."
        )
        bullets = [
            "Balance English comprehension, verbal reasoning, maths and non-verbal or spatial reasoning so one confident area does not hide a weaker one.",
            "Use a small number of timed tasks to practise pace, then spend more time reviewing the mistakes.",
            "Check answer-sheet habits and section timing as well as subject knowledge.",
        ]
    elif "sats" in service_lower:
        lead = (
            "The 2026 KS2 SATs papers and mark schemes are now available, so mid-July is a useful moment to turn test evidence into a calm next step. "
            "For Year 6, that means secondary transition; for Year 5, it means building foundations before the next May test window."
        )
        bullets = [
            "Use the published 2026 paper style to identify reading, arithmetic, reasoning or SPaG patterns rather than simply doing more tests.",
            "Separate post-SATs confidence rebuilding from new Year 6 preparation so the child gets the right kind of support.",
            "Keep maths method and written explanation active through the summer without extending exam pressure unnecessarily.",
        ]
    elif "gcse" in service_lower or "mock" in service_lower or "predicted" in service_lower or "exam" in service_lower or "resit" in service_lower:
        lead = (
            f"By mid-July 2026, {service} sits right between the finished GCSE exam season and the results-day or next-mock decisions families are already thinking about. "
            "Students usually make better progress when the target is a small set of mark-losing habits."
        )
        bullets = [
            "Start from the last paper, mock, school report or final-exam experience rather than guessing which topic matters most.",
            "Mix reteaching with short timed questions so knowledge starts transferring into marks.",
            "Decide whether the next step is Year 10 repair, Year 11 exam support, results-day planning or resit preparation.",
        ]
    elif "a-level" in service_lower or "ucat" in service_lower or "sixth" in service_lower:
        lead = (
            f"Mid-July 2026 makes {service} a live sixth-form planning issue: Year 13 students are moving into results-day and Clearing planning, while Year 12 students are now inside the 2027 UCAS application cycle. "
            "That matters most where the next term expects deeper thinking rather than more notes."
        )
        bullets = [
            "Identify the one topic or skill that will unlock the most later progress.",
            "Use past-paper review to separate understanding problems from timing or accuracy problems.",
            "Link academic support to predicted grades, course research and the September return to sixth form.",
        ]
    elif "btec" in service_lower:
        lead = (
            f"Mid-July 2026 is a useful checkpoint for {service} because assignments, external assessments and progression choices often collide at this point in the year. "
            "Good support should help the student organise evidence, not just polish individual paragraphs."
        )
        bullets = [
            "Review current unit feedback before deciding whether the priority is science understanding, assignment structure or exam technique.",
            "Break remaining assignment tasks into evidence, explanation and checking stages.",
            "Connect the work to the student's next step, whether that is sixth form, college, apprenticeship or university planning.",
        ]
    elif "summer" in service_lower:
        lead = (
            f"Mid-July 2026 is exactly when {service} becomes most useful: families have school reports, exam-season context and a clearer view of what September will demand. "
            "The best plan is short, specific and built around one or two goals rather than a full holiday timetable."
        )
        bullets = [
            "Choose the priority from recent evidence: report comments, mock marks, SATs feedback or end-of-year assessments.",
            "Use lessons to rebuild confidence and method before the next school year starts moving quickly.",
            "Set a September decision point so families know whether to continue, change subject or pause.",
        ]
    elif any(word in service_lower for word in ("ks2", "homework", "catch-up", "english", "maths", "science", "supportive", "learning")):
        lead = (
            f"Mid-July 2026 gives families fresh school evidence for {service}: reports, class tests, teacher comments and the student's own confidence after a long term. "
            "That makes this a good moment to choose a precise support target instead of starting broad extra work."
        )
        bullets = [
            "Read the recent school evidence first, then choose the subject or skill that will change the next term most.",
            "Keep the first block focused enough that parents can see what is improving by September.",
            "Use the summer pace for calm reteaching, not a pile of disconnected revision tasks.",
        ]
    elif service_lower == "tutors in smethwick":
        lead = (
            "Mid-July 2026 is a strong moment for Smethwick families to compare local tutor options because school reports, exam-season evidence and summer schedules are all visible at once. "
            "A short holiday block can show whether the student responds better online, in person or one-to-one before September routines harden."
        )
        bullets = [
            "Choose a lesson time that fits around childcare, travel and family plans so attendance stays consistent.",
            "Use the first session to identify the real subject priority instead of spreading the work too thinly.",
            "Finish with a simple September recommendation so the family knows whether to continue, pause or change focus.",
        ]
    elif "online" in service_lower or "in-person" in service_lower or "one-to-one" in service_lower or "centre" in service_lower or "near me" in service_lower or "private" in service_lower or "tuition" in service_lower:
        lead = (
            f"Mid-July 2026 is a strong moment to try {service} because families can compare end-of-term evidence with the reality of summer schedules. "
            "A short holiday block also shows whether the student responds better online, in person or one-to-one before September routines harden."
        )
        bullets = [
            "Choose a lesson time that fits around childcare, travel and family plans so attendance stays consistent.",
            "Use the first session to identify the real subject priority instead of spreading the work too thinly.",
            "Finish with a simple September recommendation so the family knows whether to continue, pause or change focus.",
        ]
    else:
        lead = (
            f"The summer holidays give families a calmer window to decide whether {service} is the right route. "
            f"{fit_text}"
        )
        bullets = [
            "Start with a clear diagnosis so the holiday work has a purpose.",
            "Keep tasks focused on the subject or skill most likely to affect the next school term.",
            "Review progress before September so the next step is obvious.",
        ]
    return summer_section(f"Mid-July 2026 update for {service}", lead, bullets)


def summer_private(title: str, focus: str) -> str:
    lead = (
        f"For {title} families, mid-July 2026 is when school reports, end-of-term feedback and September planning all overlap. "
        f"The local focus should stay practical: {focus}."
    )
    return summer_section(
        f"Mid-July 2026 tuition priorities for {title} families",
        lead,
        [
            "Use the first session to decide whether the student needs catch-up, confidence work or exam preparation.",
            "Choose online or in-person around summer travel plans so the routine is easy to keep.",
            "End the block with a September recommendation linked to the next school pressure point.",
        ],
    )


BESPOKE_2026_UPDATES = {
    "11-plus-english-tutor-smethwick": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026: build 11+ English without draining the final run-in.",
        "lead": "West Midlands 11+ preparation now needs to connect vocabulary, comprehension and verbal reasoning with the autumn test format. Mid-July is the right point to use mock feedback and reading habits carefully, before the summer turns into rushed paper practice.",
        "steps": [
            ("Read wider, but review properly", "Short discussion after reading helps children turn vocabulary, inference and evidence into marks instead of just finishing another chapter."),
            ("Drill one weak question type", "Inference, synonym, antonym or cloze work should be practised in small focused sets so mistakes are corrected properly."),
            ("Add timing after accuracy", "Timed passages matter, but mid-July and summer work should build pace calmly before full-paper pressure returns."),
        ],
        "grid": "mock-step-grid",
    },
    "11-plus-maths-tutor-smethwick": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026: sharpen 11+ Maths method before final-speed practice.",
        "lead": "The West Midlands 11+ includes mathematics alongside English, verbal reasoning and non-verbal or spatial reasoning. Mid-July is a useful checkpoint for deciding whether a child needs arithmetic repair, reasoning practice or tighter timing before the autumn test period.",
        "steps": [
            ("Repair the highest-value gaps", "Focus first on topics that appear often and cost marks quickly, especially fractions, arithmetic accuracy and multi-step reasoning."),
            ("Explain the method aloud", "Children who can describe their approach usually make fewer repeated mistakes when the question is unfamiliar."),
            ("Move into timed sets", "Once method is secure, short timed sets help build the pace needed for the GL-style paper without making every lesson feel high stakes."),
        ],
        "grid": "mock-step-grid",
    },
    "11-plus-mock-test-smethwick": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 mock tests should turn one sitting into a clear final plan.",
        "lead": "A Smethwick 11+ mock is most useful now when it shows which section needs teaching before the autumn test period, not when it simply adds another score to worry about.",
        "steps": [
            ("Test early enough to act", "Book the mock while there is still time to improve maths, English, verbal reasoning or non-verbal reasoning before the real exam window."),
            ("Review the weakest section first", "The report should lead to a short priority list, not a vague instruction to do more papers over the holiday."),
            ("Protect confidence", "Summer practice should build stamina without making every week feel like another high-stakes test."),
        ],
        "grid": "how-grid",
    },
    "11-plus-mock-test-birmingham": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 Birmingham mock tests should guide the final stretch.",
        "lead": "Birmingham families are now close enough to the autumn 11+ window that a mock result needs to become a teaching plan quickly. The useful question is not just the total score, but which section can still move the most.",
        "steps": [
            ("Compare sections honestly", "A child may look ready overall but still be losing marks in one section that needs urgent attention."),
            ("Turn scores into teaching", "The result should point toward the exact maths, English or reasoning work that will make the biggest difference next."),
            ("Avoid overtesting", "One good mid-July or summer mock followed by careful review is often better than repeated tests with no time to fix the errors."),
        ],
        "grid": "how-grid",
    },
    "11-plus-mock-exams-birmingham": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 mock exams help families choose the right final priorities.",
        "lead": "The current West Midlands Grammar Schools guidance keeps the test focus clear: English comprehension, verbal reasoning, mathematics and non-verbal or spatial reasoning. A mid-July mock should show how those sections balance for this child, not just produce one broad readiness label.",
        "steps": [
            ("Check the balance", "A strong maths score can hide English timing problems, while good comprehension can hide weaker spatial reasoning."),
            ("Prioritise teaching", "The mock should identify the section where direct teaching will change the result most before the real test period."),
            ("Plan the final weeks", "Use the report to decide whether the next step is tuition, a second mock, lighter practice or confidence maintenance."),
        ],
        "grid": "how-grid",
    },
    "11-plus-tutor-birmingham": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 Birmingham 11+ tutoring should narrow the plan, not broaden it.",
        "lead": "By mid-July, registration has closed and Birmingham families are waiting for allocated test-centre information. The best tutoring now turns mock evidence, target schools and the child's section profile into a focused final plan for the West Midlands GL-style format.",
        "steps": [
            ("Check all four sections", "English comprehension, verbal reasoning, maths and non-verbal or spatial reasoning need separate attention because one strong area can hide another weakness."),
            ("Use local school goals", "King Edward's, Handsworth, Sutton Coldfield and other grammar routes all need high-quality preparation, but the child's section profile should shape the weekly plan."),
            ("Keep practice purposeful", "Mid-July and summer lessons should combine targeted teaching with enough timed work to build confidence without exhausting the child."),
        ],
        "grid": "mock-step-grid",
    },
    "11-plus-tutor-bearwood": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 Bearwood families can test the 11+ routine before Year 6 pressure rises.",
        "lead": "Bearwood families are close enough to the Smethwick base to try a practical in-person routine before September. This is the moment to see whether the child needs core KS2 repair, reasoning practice or mock-test strategy first.",
        "steps": [
            ("Start from evidence", "Use recent school work, mock results or tutor assessment before choosing the first 11+ priority."),
            ("Protect the routine", "A short journey from Bearwood makes weekly lessons easier to sustain through the final preparation window."),
            ("Finish with a September plan", "The summer block should end with clear next steps for reading, maths, reasoning and mock timing."),
        ],
        "grid": "mock-step-grid",
    },
    "11-plus-tutor-oldbury": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 Oldbury 11+ preparation should be structured but not overloaded.",
        "lead": "Oldbury families are often comparing Birmingham, Walsall and nearby grammar-school routes. After the registration deadline, mid-July is the right time to turn that comparison into a balanced plan across English, maths and reasoning while families wait for allocated test-centre information.",
        "steps": [
            ("Use the closed-registration window", "Keep target schools in view while using the waiting period to decide how much mock practice and section repair is needed."),
            ("Find the first teaching gap", "The strongest starting point may be comprehension, arithmetic, verbal reasoning or non-verbal/spatial reasoning."),
            ("Keep summer realistic", "Lessons should fit around family plans while still building the confidence needed for the autumn test period."),
        ],
        "grid": "mock-step-grid",
    },
    "11-plus-tutor-west-bromwich": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 West Bromwich families can turn 11+ preparation into a clear final plan.",
        "lead": "West Bromwich students often have several realistic selective-school routes nearby. With registration now closed for September 2027 entry, mid-July is the practical point for checking mock evidence, travel routine and which section needs the most focused teaching.",
        "steps": [
            ("Review the section pattern", "Do not rely on a single score if English, maths or reasoning marks tell a more specific story."),
            ("Choose the format", "In-person lessons can help younger pupils with focus, while online can protect routine when family travel is tight."),
            ("Set the final priorities", "The next few weeks should be about targeted repair, answer-sheet habits and enough timed practice to stay calm."),
        ],
        "grid": "mock-step-grid",
    },
    "11-plus-year-5-smethwick": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 is the calmest point to make Year 5 11+ preparation more serious.",
        "lead": "Year 5 families now have enough school-year evidence to decide whether the child is ready for a more structured 11+ plan. The useful goal is not full exam pressure; it is building the foundations that Year 6 will need.",
        "steps": [
            ("Separate foundation from test practice", "Reading stamina, number confidence and vocabulary should be secure before heavy timed papers take over."),
            ("Introduce reasoning carefully", "Verbal and non-verbal or spatial reasoning improve fastest when patterns are taught, not guessed."),
            ("Build a Year 6 runway", "A mid-July-to-September plan should make the start of Year 6 feel purposeful rather than rushed."),
        ],
        "grid": "mock-step-grid",
    },
    "king-edwards-11-plus-preparation": {
        "eyebrow": "Mid-July 2026 Update",
        "title": "Mid-July 2026 King Edward's preparation should balance ambition with evidence.",
        "lead": "King Edward's preparation is competitive, but the current West Midlands test route still rewards the same balanced skills: English, verbal reasoning, maths and non-verbal or spatial reasoning. After registration closes, mid-July is the moment to check whether ambition is matched by section evidence.",
        "steps": [
            ("Check the school shortlist", "Use target schools to shape expectations, but use the child's section data to shape the actual teaching plan."),
            ("Avoid one-strength preparation", "A strong maths pupil still needs careful comprehension and verbal reasoning; a strong reader still needs speed and non-verbal logic."),
            ("Use mocks carefully", "Mock results should guide the final block of teaching, not become weekly pressure without enough review time."),
        ],
        "grid": "mock-step-grid",
    },
}


def render_bespoke_update(slug: str) -> str:
    meta = BESPOKE_2026_UPDATES[slug]
    if meta["grid"] == "how-grid":
        cards = "\n".join(
            f'        <div class="how-step"><div class="step-num">{idx}</div><h3>{title}</h3><p>{text}</p></div>'
            for idx, (title, text) in enumerate(meta["steps"], start=1)
        )
        grid_html = f'      <div class="how-grid">\n{cards}\n      </div>'
    else:
        cards = "\n".join(
            f'        <div class="mock-step"><div class="number">{idx}</div><h3>{title}</h3><p>{text}</p></div>'
            for idx, (title, text) in enumerate(meta["steps"], start=1)
        )
        grid_html = f'      <div class="mock-step-grid">\n{cards}\n      </div>'
    return f"""    <section class="section" id="summer">
      <div class="mock-section-head">
        <div>
          <div class="eyebrow">{meta["eyebrow"]}</div>
          <h2 class="sec-h2">{meta["title"]}</h2>
        </div>
        <p class="sec-sub">{meta["lead"]}</p>
      </div>
{grid_html}
    </section>"""


def replace_bespoke_update_section(text: str, slug: str) -> str:
    pattern = re.compile(r'    <section class="section" id="summer">.*?    </section>', re.S)
    replacement = render_bespoke_update(slug)
    new_text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not update Mid-July 2026 section for {slug}")
    return new_text


def render_related(links: list[tuple[str, str]]) -> str:
    uniq = []
    seen = set()
    for href, label in links:
        if href in seen:
            continue
        seen.add(href)
        uniq.append((href, label))
    links_html = "\n        ".join(f'<a href="{href}">{label}</a>' for href, label in uniq[:5])
    return (
        '  <div class="blp-related">\n'
        '    <div class="blp-related-inner">\n'
        '      <span class="blp-related-label">Related Guides</span>\n'
        f'      {links_html}\n'
        '    </div>\n'
        '  </div>'
    )


def replace_main(text: str, sections_html: str) -> str:
    pattern = re.compile(r'(<main class="blp-main">)\s*(.*?)(\s*</main>)', re.S)
    return pattern.sub(
        lambda m: f'{m.group(1)}\n{sections_html}\n    </main>',
        text,
        count=1,
    )


def replace_related(text: str, related_html: str) -> str:
    pattern = re.compile(
        r'\n\s*<div class="blp-related">\s*<div class="blp-related-inner">.*?</div>\s*</div>',
        re.S,
    )
    if pattern.search(text):
        return pattern.sub("\n" + related_html, text, count=1)
    return text


def update_date_modified(text: str) -> str:
    return re.sub(
        r'("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")',
        rf"\g<1>{DATE}\2",
        text,
    )


def page_title(text: str, fallback: str) -> str:
    h1 = re.search(r"<h1>(.*?)</h1>", text, re.S)
    if h1:
        return re.sub(r"\s+", " ", h1.group(1)).strip()
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    if title:
        return re.sub(r"\s+", " ", title.group(1)).strip()
    return fallback.replace("-", " ").title()


def page_description(text: str) -> str:
    desc = re.search(r'<meta name="description" content="(.*?)"', text, re.S)
    if desc:
        return re.sub(r"\s+", " ", desc.group(1)).strip()
    return "Teacher-led tuition from Teaching Success."


def service_type_for_slug(slug: str) -> str:
    if "11-plus" in slug or "grammar-school" in slug or "king-edwards" in slug:
        return "11 plus tuition"
    if "math" in slug or "maths" in slug:
        return "Maths tuition"
    if "english" in slug or "language" in slug:
        return "English tuition"
    if "science" in slug or "biology" in slug or "chemistry" in slug or "physics" in slug:
        return "Science tuition"
    if "sats" in slug:
        return "SATs preparation"
    if "a-level" in slug:
        return "A-Level tuition"
    if "gcse" in slug:
        return "GCSE tuition"
    if "ucat" in slug:
        return "UCAT preparation"
    if "mock" in slug:
        return "Exam preparation"
    return "Private tuition"


def areas_for_slug(slug: str) -> list[str]:
    areas = ["Smethwick", "Birmingham"]
    area_words = {
        "bearwood": "Bearwood",
        "oldbury": "Oldbury",
        "west-bromwich": "West Bromwich",
        "wolverhampton": "Wolverhampton",
        "coventry": "Coventry",
        "walsall": "Walsall",
        "bloxwich": "Bloxwich",
        "willenhall": "Willenhall",
        "wednesbury": "Wednesbury",
        "dudley": "Dudley",
        "solihull": "Solihull",
        "manchester": "Manchester",
        "harborne": "Harborne",
        "edgbaston": "Edgbaston",
        "handsworth": "Handsworth",
        "quinton": "Quinton",
        "tipton": "Tipton",
        "rowley-regis": "Rowley Regis",
        "cape-hill": "Cape Hill",
    }
    for key, label in area_words.items():
        if key in slug and label not in areas:
            areas.insert(0, label)
    return areas[:4]


def update_service_schema(text: str, slug: str) -> str:
    marker = "ts-service-schema"
    text = re.sub(
        rf'\n?<script type="application/ld\+json" id="{marker}">.*?</script>',
        "",
        text,
        flags=re.S,
    )
    url = f"https://www.teachingsuccess.co.uk/blog/{slug}.html"
    schema = {
        "@context": "https://schema.org",
        "@type": "Service",
        "@id": f"{url}#service",
        "name": page_title(text, slug),
        "description": page_description(text),
        "url": url,
        "serviceType": service_type_for_slug(slug),
        "provider": {
            "@type": ["EducationalOrganization", "LocalBusiness"],
            "@id": "https://www.teachingsuccess.co.uk/#organization",
            "name": "Teaching Success",
            "url": "https://www.teachingsuccess.co.uk/",
            "telephone": "+447909274901",
            "priceRange": "£15-£25",
        },
        "areaServed": [
            {"@type": "Place", "name": area} for area in areas_for_slug(slug)
        ],
        "audience": {
            "@type": "EducationalAudience",
            "educationalRole": "student",
        },
        "offers": {
            "@type": "Offer",
            "url": "https://www.teachingsuccess.co.uk/",
            "priceCurrency": "GBP",
            "price": "0",
            "description": "Free trial lesson and consultation before regular paid tuition.",
            "availability": "https://schema.org/InStock",
        },
    }
    block = (
        f'<script type="application/ld+json" id="{marker}">\n'
        f"{json.dumps(schema, ensure_ascii=False, indent=2)}\n"
        "</script>\n"
    )
    return text.replace("</head>", block + "</head>", 1)


def year_links(year: int, subject: str) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    if subject == "general":
        if 2 <= year <= 6:
            links.extend(
                [
                    (f"/blog/year-{year}-english-tutor-smethwick.html", f"Year {year} English tutor"),
                    (f"/blog/year-{year}-maths-tutor-smethwick.html", f"Year {year} Maths tutor"),
                    ("/blog/ks2-english-tuition-smethwick.html", "KS2 English tuition"),
                    ("/blog/ks2-maths-tuition-smethwick.html", "KS2 Maths tuition"),
                ]
            )
            if year >= 5:
                links.append(("/blog/sats-preparation-smethwick.html", "SATs preparation in Smethwick"))
        elif 7 <= year <= 9:
            links.extend(
                [
                    (f"/blog/year-{year}-english-tutor-smethwick.html", f"Year {year} English tutor"),
                    (f"/blog/year-{year}-maths-tutor-smethwick.html", f"Year {year} Maths tutor"),
                    ("/blog/homework-help-smethwick.html", "Homework help in Smethwick"),
                    ("/blog/catch-up-tuition-smethwick.html", "Catch-up tuition in Smethwick"),
                ]
            )
        elif year in (10, 11):
            links.extend(
                [
                    (f"/blog/year-{year}-english-tutor-smethwick.html", f"Year {year} English tutor"),
                    (f"/blog/year-{year}-maths-tutor-smethwick.html", f"Year {year} Maths tutor"),
                    ("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"),
                    ("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"),
                    ("/blog/gcse-science-tutor-smethwick.html", "GCSE Science tutor"),
                ]
            )
        else:
            links.extend(
                [
                    ("/blog/a-level-maths-tutor-birmingham.html", "A-Level Maths tutor"),
                    ("/blog/a-level-biology-tutor-birmingham.html", "A-Level Biology tutor"),
                    ("/blog/a-level-chemistry-tutor-birmingham.html", "A-Level Chemistry tutor"),
                    ("/blog/a-level-physics-tutor-birmingham.html", "A-Level Physics tutor"),
                ]
            )
    elif subject == "english":
        links.append((f"/blog/year-{year}-tutor-smethwick.html", f"Year {year} tutor"))
        if year > 2 and year <= 11:
            links.append((f"/blog/year-{year-1}-english-tutor-smethwick.html", f"Year {year-1} English tutor"))
        if year < 11:
            links.append((f"/blog/year-{year+1}-english-tutor-smethwick.html", f"Year {year+1} English tutor"))
        links.append(("/blog/english-tutor-smethwick.html", "English teacher in Smethwick"))
        if year <= 6:
            links.append(("/blog/ks2-english-tuition-smethwick.html", "KS2 English tuition"))
        else:
            links.append(("/blog/gcse-english-tutor-smethwick.html", "GCSE English tutor"))
    elif subject == "maths":
        links.append((f"/blog/year-{year}-tutor-smethwick.html", f"Year {year} tutor"))
        if year > 2 and year <= 11:
            links.append((f"/blog/year-{year-1}-maths-tutor-smethwick.html", f"Year {year-1} Maths tutor"))
        if year < 11:
            links.append((f"/blog/year-{year+1}-maths-tutor-smethwick.html", f"Year {year+1} Maths tutor"))
        links.append(("/blog/maths-tutor-smethwick.html", "Maths tutor in Smethwick"))
        if year <= 6:
            links.append(("/blog/ks2-maths-tuition-smethwick.html", "KS2 Maths tuition"))
        else:
            links.append(("/blog/gcse-maths-smethwick-birmingham.html", "GCSE Maths tuition"))
    return links


def render_year_general(year: int) -> tuple[str, str]:
    detail = YEAR_DETAILS[year]
    search_angle = YEAR_SEARCH_ANGLES[year]
    if year <= 6:
        sections = [
            section(
                f"What a Year {year} tutor should really be helping with",
                p(
                    f"Year {year} support should focus on {detail['general']}. At this stage, the aim is usually to make school feel steadier week by week rather than to pile on extra work without a plan."
                ),
            ),
            section(
                f"Where Year {year} pupils usually start to wobble",
                p(
                    f"The common pressure point in Year {year} is {detail['pressure']}. A strong plan makes those problems visible early, then works through them calmly before they grow into a bigger Key Stage 2 issue."
                ),
            ),
            section(
                f"What the first half-term of Year {year} tuition should include",
                ul(
                    [
                        f"Short checks on {detail['english']} so the tutor can see what is secure and what still needs direct teaching",
                        f"Regular work on {detail['maths']} rather than waiting until the next school test exposes the gap again",
                        "A simple weekly routine that parents and pupils can actually maintain",
                        "Enough review to build confidence, not just enough to finish the worksheet",
                    ]
                ),
            ),
            section(
                f"Why this Year {year} page is different",
                p(
                    f"Parents searching specifically for a Year {year} tutor are usually looking for {search_angle}. That makes this page different from a broad primary tuition page: the plan needs to match the child's current school year, not just the subject name."
                ),
            ),
            summer_year_general(year, detail),
            intent_section(
                f"Year {year} tutor in Smethwick",
                [
                    f"Year {year} tuition Smethwick",
                    f"Year {year} maths tutor Smethwick",
                    f"Year {year} English tutor Smethwick",
                    "primary tutor near me",
                ],
                "The page keeps the advice year-specific so parents can move from a broad local search into the English, maths, SATs or 11+ route that actually fits.",
            ),
            next_step(),
        ]
    elif year <= 9:
        sections = [
            section(
                f"What matters most in Year {year}",
                p(
                    f"Year {year} is really about {detail['general']}. The strongest tutoring at this stage stops small KS3 problems from quietly becoming GCSE problems later on."
                ),
            ),
            section(
                "Why this stage is easy to underestimate",
                p(
                    f"Many students look as if they are coping in Year {year}, but the real pressure is {detail['pressure']}. Good support spots those patterns before confidence starts to slip across multiple subjects."
                ),
            ),
            section(
                f"What a stronger Year {year} plan looks like",
                ol(
                    [
                        "Check where classroom understanding and written performance are drifting apart.",
                        "Stabilise one or two subjects first instead of trying to fix everything at once.",
                        "Build a routine for homework, revision and asking for help before the workload rises again.",
                        "Use that stronger routine to make the next school term feel more manageable.",
                    ]
                ),
            ),
            section(
                f"Why this Year {year} page is different",
                p(
                    f"A Year {year} search usually signals {search_angle}. The support should therefore connect school routine, homework habits and subject confidence instead of acting like a generic secondary tutor page."
                ),
            ),
            summer_year_general(year, detail),
            intent_section(
                f"Year {year} tutor in Smethwick",
                [
                    f"Year {year} tuition Smethwick",
                    "KS3 tutor Smethwick",
                    "secondary tutor near me",
                    "catch-up tuition Smethwick",
                ],
                "That search intent matters because KS3 families often need a practical confidence plan before they are ready to choose a GCSE subject page.",
            ),
            next_step(),
        ]
    elif year <= 11:
        sections = [
            section(
                f"What a Year {year} tutor should be doing",
                p(
                    f"In Year {year}, effective support is about {detail['general']}. The goal is to turn assessment evidence into a smarter next step rather than repeating broad revision without changing the outcome."
                ),
            ),
            section(
                "What usually needs fixing first",
                p(
                    f"The main risk in Year {year} is {detail['pressure']}. That is why strong tutoring usually starts by reading mocks, class tests and weak-paper habits very closely before deciding the weekly priorities."
                ),
            ),
            section(
                f"What the next few weeks should focus on in Year {year}",
                ul(
                    [
                        "One or two subject priorities with the strongest potential mark return",
                        "Clear timed-practice habits so revision does not stay theoretical",
                        "A tighter routine for balancing English, maths and science instead of revising whichever subject feels easiest",
                        "Enough feedback for the student to know what is improving and why",
                    ]
                ),
            ),
            section(
                f"Why this Year {year} page is different",
                p(
                    f"Families searching by Year {year} are usually thinking about {search_angle}. That is why the teaching plan should start from recent school evidence and turn it into a tighter set of exam priorities."
                ),
            ),
            summer_year_general(year, detail),
            intent_section(
                f"Year {year} tutor in Smethwick",
                [
                    f"Year {year} GCSE tutor",
                    "GCSE tutors near me",
                    "GCSE revision Smethwick",
                    "exam technique tutor",
                ],
                "The page points families toward subject-specific GCSE support once the first priority is clear, rather than leaving them on a broad exam-year overview.",
            ),
            next_step(),
        ]
    else:
        sections = [
            section(
                f"What the jump into Year {year} changes",
                p(
                    f"Year {year} is usually where {detail['general']}. Even strong students can feel unsettled because the work now expects more independence, sharper organisation and steadier decision-making."
                ),
            ),
            section(
                "Why sixth-form students often need a different kind of help",
                p(
                    f"The issue is often {detail['pressure']}. A useful tutor at this stage is not just reteaching content; they are helping the student plan, review and perform more independently on demanding papers."
                ),
            ),
            section(
                f"What a stronger Year {year} study plan should include",
                ul(
                    [
                        "A more deliberate routine for independent practice between lessons",
                        "Past-paper work that shows where understanding is not yet exam-ready",
                        "Subject-specific support where the jump in depth is sharpest",
                        "A calm strategy for balancing deadlines, revision and wellbeing",
                    ]
                ),
            ),
            section(
                f"Why this Year {year} page is different",
                p(
                    f"Year {year} searches tend to be about {search_angle}. The support should therefore include independent-study structure as well as subject teaching, because sixth-form progress depends on both."
                ),
            ),
            summer_year_general(year, detail),
            intent_section(
                f"Year {year} tutor in Smethwick",
                [
                    f"Year {year} A-Level tutor",
                    "A-Level tutor near me",
                    "sixth form tutor",
                    "online A-Level tuition",
                ],
                "The intent is different from GCSE: students usually need subject depth and a stronger independent-study routine, so the next link should lead into the exact A-Level subject.",
            ),
            next_step(),
        ]
    return "\n".join(sections), render_related(year_links(year, "general"))


def render_year_subject(year: int, subject: str) -> tuple[str, str]:
    detail = YEAR_DETAILS[year]
    subject_label = "English" if subject == "english" else "Maths"
    if subject == "english":
        focus = ENGLISH_YEAR_FOCUS[year]
        sections = [
            section(
                f"What English usually looks like in Year {year}",
                p(
                    f"Year {year} English is usually about {detail['english']}. Good support identifies whether the real issue is reading, writing, vocabulary, confidence or timing rather than treating everything as one generic English problem."
                ),
            ),
            section(
                "Where marks or confidence are usually lost",
                p(
                    f"The pressure point in Year {year} is often {detail['pressure']}. In English, that can show up as weak written structure, short answers, rushed reading or hesitation when the pupil is asked to explain more clearly."
                ),
            ),
            section(
                f"What a weekly Year {year} English plan should include",
                ul(
                    [
                        f"Live work on {detail['english']} so the pupil can be corrected in the moment",
                        "Reading and writing checked separately, because pupils are often stronger in one than the other",
                        "A simple between-lesson task that keeps progress moving without creating homework overload",
                        "Regular review so the family can see whether written quality is improving",
                    ]
                ),
            ),
            section(
                f"How Year {year} English support is different",
                p(
                    f"This page is aimed at {focus}, so it should not read like the Year {year} Maths page or a broad English hub. The useful starting point is to decide whether the student needs reading confidence, sentence-level correction, paragraph modelling or timed exam practice."
                ),
            ),
            summer_year_subject(year, subject, detail),
            intent_section(
                f"Year {year} English tutor in Smethwick",
                [
                    f"Year {year} English tuition",
                    "English teacher in Smethwick",
                    "language tutor Smethwick",
                    "English tutor near me",
                ],
                "Where searches mention language tutoring, this page is careful to answer school English, reading, writing and English Language needs rather than implying modern foreign language tuition.",
            ),
            next_step(
                f'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial lesson</a> to discuss the strongest starting point for Year {year} English support.'
            ),
        ]
    else:
        focus = MATHS_YEAR_FOCUS[year]
        sections = [
            section(
                f"What Maths gets harder in Year {year}",
                p(
                    f"Year {year} Maths is usually about {detail['maths']}. Strong tuition keeps method secure while the student is still learning how to choose the right approach independently."
                ),
            ),
            section(
                "The mistakes that usually need attention first",
                p(
                    f"The common pressure point is {detail['pressure']}. In Maths, that often becomes hesitation with method, weak working, or losing marks because a student cannot stay accurate once the question becomes multi-step."
                ),
            ),
            section(
                f"What a weekly Year {year} Maths plan should include",
                ul(
                    [
                        f"Direct teaching around {detail['maths']} before moving into mixed questions",
                        "Worked examples followed by independent practice, not just a stack of answers to copy",
                        "Regular checks on method and accuracy so the pupil is not only aiming for the final answer",
                        "A short review cycle so topics stay usable rather than being forgotten after one lesson",
                    ]
                ),
            ),
            section(
                f"How Year {year} Maths support is different",
                p(
                    f"This page is focused on {focus}, so it should not compete with a broad maths page or an English page for the same year group. The lesson plan needs to show the pupil how to choose methods, keep working clear and transfer practice into mixed questions."
                ),
            ),
            summer_year_subject(year, subject, detail),
            intent_section(
                f"Year {year} Maths tutor in Smethwick",
                [
                    f"Year {year} maths tuition",
                    "maths teacher in Smethwick",
                    "maths tutor near me",
                    "maths intervention Smethwick",
                ],
                "The wording keeps the page aligned with maths-teacher searches while still routing families toward KS2, KS3 or GCSE support when the year-group page is only the starting point.",
            ),
            next_step(
                f'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial lesson</a> to discuss the strongest starting point for Year {year} Maths support.'
            ),
        ]
    return "\n".join(sections), render_related(year_links(year, subject))


def render_private_tutor(slug: str) -> tuple[str, str]:
    location = slug.replace("private-tutor-", "")
    meta = LOCATION_META[location]
    title = location.replace("-", " ").title()
    search_phrase = f"tuition in {title}" if location == "bloxwich" else f"private tutor in {title}"
    nearby = [
        name
        for name in ("Smethwick", "Bearwood", "Oldbury", "Birmingham", "Walsall", "Wolverhampton")
        if name != title
    ]
    nearby_names = nearby[:3]
    nearby_text = ", ".join(nearby_names[:-1]) + f" and {nearby_names[-1]}"
    sections = [
        section(
            f"What {title} families usually want help with",
            p(
                f"Families looking for {search_phrase} are usually trying to find a practical route into {meta['focus']}. The search is rarely about tutoring in the abstract; it is usually about making one specific school pressure point feel more manageable."
            ),
        ),
        section(
            f"Why a {title} search is usually about practicality as much as teaching",
            p(meta["journey"] + " " + meta["school_context"]),
        ),
        section(
            "In-person or online?",
            p(meta["format"]),
        ),
        section(
            f"What makes the {title} page distinct",
            p(
                f"This page is written for families comparing a {title} tutor with nearby {nearby_text} options. It focuses on local travel, weekly consistency and the subject mix families in {title} usually ask about, rather than repeating a generic private tutor description."
            ),
        ),
        summer_private(title, meta["focus"]),
        intent_section(
            search_phrase,
            [
                f"tutors in {title}",
                f"tuition in {title}",
                f"maths teacher in {title}",
                f"language tutors in {title}",
            ],
            "If the search is subject-led, the related links help families move from the local-area page into maths, English, science, 11+ or GCSE support without losing the local context.",
        ),
        next_step(
            f'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial lesson</a> to talk through the best starting point for {title} tuition.'
        ),
    ]
    return "\n".join(sections), render_related(meta["links"])


def render_manual_meta(meta: dict[str, object], next_text: str | None = None) -> tuple[str, str]:
    fit_text = str(
        meta.get(
            "fit",
            "This route is most useful when the student needs a clearer, more targeted plan instead of broad extra work.",
        )
    )
    sections = [
        section(f"What {meta['service']} should really do", p(str(meta["intro"]))),
        section(f"What {meta['service']} should include", ul(list(meta["points"]))),
        section("When this route is the right fit", p(fit_text)),
        section(
            "How this guide helps you choose",
            p(
                f"This guide is built around families actively comparing {meta['service']} rather than browsing a general tuition article. The related links point toward the most relevant next route so the page acts as a useful decision point, not just a generic directory page."
            ),
        ),
        summer_manual(str(meta["service"]), fit_text),
        intent_section(
            str(meta["service"]),
            list(meta.get("queries", []))
            or [
                f"{meta['service']} near me",
                f"{meta['service']} Smethwick",
                "tutors in Smethwick",
                "tuition near me",
            ],
            str(
                meta.get(
                    "intent",
                    "The page is designed to answer the search quickly, then move the family toward a clearer subject, year-group or exam-stage decision.",
                )
            ),
        ),
        next_step(next_text),
    ]
    return "\n".join(sections), render_related(list(meta["links"]))


def render_slug(slug: str) -> tuple[str, str]:
    if slug in SPECIAL_YEAR_SLUGS:
        meta = SPECIAL_YEAR_SLUGS[slug]
        return render_manual_meta(
            meta,
            'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial lesson</a> to discuss the right next step for this exam-year route.',
        )

    m = re.fullmatch(r"year-(\d+)-english-tutor-smethwick", slug)
    if m:
        return render_year_subject(int(m.group(1)), "english")

    m = re.fullmatch(r"year-(\d+)-maths-tutor-smethwick", slug)
    if m:
        return render_year_subject(int(m.group(1)), "maths")

    m = re.fullmatch(r"year-(\d+)-tutor-smethwick", slug)
    if m:
        return render_year_general(int(m.group(1)))

    if slug.startswith("private-tutor-"):
        return render_private_tutor(slug)

    if slug in GCSE_META:
        return render_manual_meta(
            GCSE_META[slug],
            'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial lesson</a> to agree the most useful GCSE starting point for the next few weeks.',
        )

    if slug in A_LEVEL_META:
        return render_manual_meta(
            A_LEVEL_META[slug],
            'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial session</a> to discuss current grade, target grade and the most useful A-Level priorities.',
        )

    if slug in ELEVEN_PLUS_META:
        return render_manual_meta(
            ELEVEN_PLUS_META[slug],
            'Call <a href="tel:07909274901">07909&nbsp;274901</a> or <a href="/">book a free trial lesson</a> to discuss the right 11+ route for your child and target schools.',
        )

    if slug in GUIDE_META:
        return render_manual_meta(GUIDE_META[slug])

    raise KeyError(slug)


def is_target_page(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    return (
        'class="blog-lp"' in text
        and '<main class="blp-main">' in text
        and "noindex" not in text
        and path.stem not in SKIP
    )


def update_sitemap(slugs: list[str]) -> None:
    text = SITEMAP_PATH.read_text(encoding="utf-8")
    for slug in slugs:
        url = f"https://www.teachingsuccess.co.uk/blog/{slug}.html"
        pattern = re.compile(
            rf"(<loc>{re.escape(url)}</loc>\s*<lastmod>)([^<]+)(</lastmod>)"
        )
        text, count = pattern.subn(rf"\g<1>{DATE}\3", text, count=1)
        if count != 1:
            raise RuntimeError(f"Could not update sitemap entry for {slug}")
    SITEMAP_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    changed: list[str] = []
    targets = [path for path in sorted(BLOG_DIR.glob("*.html")) if is_target_page(path)]
    for path in targets:
        text = path.read_text(encoding="utf-8")
        sections_html, related_html = render_slug(path.stem)
        new_text = replace_main(text, sections_html)
        new_text = replace_related(new_text, related_html)
        new_text = update_date_modified(new_text)
        new_text = update_service_schema(new_text, path.stem)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed.append(path.stem)

    bespoke_targets = [
        BLOG_DIR / f"{slug}.html"
        for slug in sorted(BESPOKE_2026_UPDATES)
        if (BLOG_DIR / f"{slug}.html").exists()
    ]
    for path in bespoke_targets:
        text = path.read_text(encoding="utf-8")
        if "noindex" in text:
            continue
        new_text = replace_bespoke_update_section(text, path.stem)
        new_text = update_date_modified(new_text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed.append(path.stem)

    for slug in sorted(SKIP):
        path = BLOG_DIR / f"{slug}.html"
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        new_text = update_date_modified(text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed.append(path.stem)

    update_sitemap(changed)
    print(f"Refreshed {len(changed)} blog pages.")


if __name__ == "__main__":
    main()
