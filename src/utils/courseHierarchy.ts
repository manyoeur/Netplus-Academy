import {
  Course,
  CourseChapterSection,
  CourseMainContentSection,
  CourseModule,
  ModuleType
} from '../types';

export interface ResolvedCourseContentItem {
  module: CourseModule;
  flatIndex: number;
  itemNumber: string; // e.g. "1.1.1"
}

export interface ResolvedMainContentSection {
  id: string;
  title: string; // Level 2: Main Contents
  summary?: string;
  contentMarkdown?: string;
  sectionNumber: string; // e.g. "1.1"
  items: ResolvedCourseContentItem[];
}

export interface ResolvedChapterSection {
  id: string;
  title: string; // Level 1: Chapter Section
  summary?: string;
  contentMarkdown?: string;
  chapterIndex: number; // 1-based
  chapterNumber: string; // e.g. "1.0"
  chapterLabel: string; // e.g. "Chapter 1"
  mainContents: ResolvedMainContentSection[];
  totalModules: number;
}

export interface ModuleSectionBreadcrumb {
  chapterId: string;
  chapterNumber: string;
  chapterLabel: string;
  chapterTitle: string;
  mainContentId: string;
  sectionNumber: string;
  mainContentTitle: string;
  itemNumber: string;
  contentTitle: string;
}

const normalizeKey = (value: string) => value.trim().toLowerCase();

function slugId(prefix: string, title: string, fallbackIdx: number): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${prefix}-${clean || fallbackIdx}`;
}

/**
 * Resolves any Course into a guaranteed 3-level hierarchy:
 * Level 1: Chapter Section
 * Level 2: Main Contents
 * Level 3: Course Contents (CourseModule)
 */
export function resolveCourseHierarchy(course: Course): ResolvedChapterSection[] {
  const chaptersOrder: CourseChapterSection[] = [];
  const chapterByNormTitle = new Map<string, CourseChapterSection>();

  const ensureChapter = (
    title: string,
    summary?: string,
    contentMarkdown?: string
  ): CourseChapterSection => {
    const cleanTitle = title.trim() || 'Chapter 1: Core Curriculum';
    const key = normalizeKey(cleanTitle);
    const existing = chapterByNormTitle.get(key);
    if (existing) {
      if (summary !== undefined) existing.summary = summary;
      if (contentMarkdown !== undefined) existing.contentMarkdown = contentMarkdown;
      return existing;
    }

    const created: CourseChapterSection = {
      id: slugId('chap', cleanTitle, chaptersOrder.length + 1),
      title: cleanTitle,
      summary,
      contentMarkdown,
      mainContents: []
    };
    chapterByNormTitle.set(key, created);
    chaptersOrder.push(created);
    return created;
  };

  const ensureMainContent = (
    chapter: CourseChapterSection,
    mainTitle: string,
    summary?: string,
    contentMarkdown?: string
  ): CourseMainContentSection => {
    const cleanMain = mainTitle.trim() || 'Core Topics';
    const key = normalizeKey(cleanMain);
    const existing = chapter.mainContents.find(mc => normalizeKey(mc.title) === key);
    if (existing) {
      if (summary !== undefined) existing.summary = summary;
      if (contentMarkdown !== undefined) existing.contentMarkdown = contentMarkdown;
      return existing;
    }

    const created: CourseMainContentSection = {
      id: slugId('sec', cleanMain, chapter.mainContents.length + 1),
      title: cleanMain,
      summary,
      contentMarkdown
    };
    chapter.mainContents.push(created);
    return created;
  };

  // Seed declared chapters/main-contents first so empty authoring sections remain visible in Builder
  for (const ch of course.chapters || []) {
    const targetCh = ensureChapter(ch.title, ch.summary, ch.contentMarkdown);
    targetCh.id = ch.id || targetCh.id;
    for (const mc of ch.mainContents || []) {
      const targetMc = ensureMainContent(targetCh, mc.title, mc.summary, mc.contentMarkdown);
      targetMc.id = mc.id || targetMc.id;
    }
  }

  // Group modules into (chapterTitle -> mainContentTitle) buckets
  const bucketMap = new Map<string, ResolvedCourseContentItem[]>();

  course.modules.forEach((mod, flatIndex) => {
    let chTitle = mod.chapterTitle?.trim();
    let mcTitle = mod.mainContentTitle?.trim();

    if (!chTitle) {
      if ((course.chapters || []).length > 0) {
        const fallbackChapter = course.chapters![Math.min(Math.floor(flatIndex / 3), course.chapters!.length - 1)];
        chTitle = fallbackChapter.title;
        if (!mcTitle && fallbackChapter.mainContents.length > 0) {
          mcTitle = fallbackChapter.mainContents[0].title;
        }
      } else {
        // Automatic 3-level grouping fallback for uncategorized courses
        const chapterGroupNum = Math.floor(flatIndex / 4) + 1;
        const mainGroupNum = (Math.floor(flatIndex / 2) % 2) + 1;
        chTitle =
          chapterGroupNum === 1
            ? 'Core Foundations & Architecture'
            : `Applied Engineering · Part ${chapterGroupNum}`;
        mcTitle =
          chapterGroupNum === 1 && mainGroupNum === 1
            ? 'Foundational Concepts & Setup'
            : chapterGroupNum === 1 && mainGroupNum === 2
            ? 'Hands-On Configuration & Labs'
            : `Section ${chapterGroupNum}.${mainGroupNum} Topics`;
      }
    }

    if (!mcTitle) {
      mcTitle = 'Core Lessons & Activities';
    }

    const chapterObj = ensureChapter(chTitle);
    const mainObj = ensureMainContent(chapterObj, mcTitle);
    const bucketKey = `${chapterObj.id}::${mainObj.id}`;
    const list = bucketMap.get(bucketKey) || [];
    list.push({
      module: mod,
      flatIndex,
      itemNumber: '' // populated below once sequential numbers are assigned
    });
    bucketMap.set(bucketKey, list);
  });

  // Assemble numbered 3-level output
  return chaptersOrder.map((ch, chIdx) => {
    const chNum = chIdx + 1;
    let totalModules = 0;

    const resolvedMains: ResolvedMainContentSection[] = ch.mainContents.map((mc, mcIdx) => {
      const secNum = `${chNum}.${mcIdx + 1}`;
      const bucketKey = `${ch.id}::${mc.id}`;
      const rawItems = bucketMap.get(bucketKey) || [];
      totalModules += rawItems.length;

      return {
        id: mc.id,
        title: mc.title,
        summary: mc.summary,
        contentMarkdown: mc.contentMarkdown,
        sectionNumber: secNum,
        items: rawItems.map((entry, itemIdx) => ({
          module: entry.module,
          flatIndex: entry.flatIndex,
          itemNumber: `${secNum}.${itemIdx + 1}`
        }))
      };
    });

    return {
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      contentMarkdown: ch.contentMarkdown,
      chapterIndex: chNum,
      chapterNumber: `${chNum}.0`,
      chapterLabel: `Chapter ${chNum}`,
      mainContents: resolvedMains,
      totalModules
    };
  });
}

export function getModuleSectionBreadcrumb(
  course: Course,
  moduleId: string
): ModuleSectionBreadcrumb | null {
  const tree = resolveCourseHierarchy(course);
  for (const ch of tree) {
    for (const mc of ch.mainContents) {
      for (const item of mc.items) {
        if (item.module.id === moduleId) {
          return {
            chapterId: ch.id,
            chapterNumber: ch.chapterNumber,
            chapterLabel: ch.chapterLabel,
            chapterTitle: ch.title,
            mainContentId: mc.id,
            sectionNumber: mc.sectionNumber,
            mainContentTitle: mc.title,
            itemNumber: item.itemNumber,
            contentTitle: item.module.title
          };
        }
      }
    }
  }
  return null;
}

export function mergeModuleHierarchyIntoChapters(
  existingChapters: CourseChapterSection[] | undefined,
  chapterTitle?: string,
  mainContentTitle?: string
): CourseChapterSection[] | undefined {
  const cleanChapter = chapterTitle?.trim();
  const cleanMain = mainContentTitle?.trim();
  if (!cleanChapter) return existingChapters;

  const next: CourseChapterSection[] = (existingChapters || []).map(ch => ({
    ...ch,
    mainContents: ch.mainContents.map(mc => ({ ...mc }))
  }));

  let chapter = next.find(ch => normalizeKey(ch.title) === normalizeKey(cleanChapter));
  if (!chapter) {
    chapter = {
      id: `chap-${Date.now()}-${next.length + 1}`,
      title: cleanChapter,
      mainContents: []
    };
    next.push(chapter);
  }

  if (cleanMain) {
    const existsMain = chapter.mainContents.some(
      mc => normalizeKey(mc.title) === normalizeKey(cleanMain)
    );
    if (!existsMain) {
      chapter.mainContents.push({
        id: `sec-${Date.now()}-${chapter.mainContents.length + 1}`,
        title: cleanMain
      });
    }
  }

  return next;
}

export function toChapterConfigFromHierarchy(
  hierarchy: ResolvedChapterSection[]
): CourseChapterSection[] {
  return hierarchy.map(ch => ({
    id: ch.id,
    title: ch.title,
    summary: ch.summary,
    contentMarkdown: ch.contentMarkdown,
    mainContents: ch.mainContents.map(mc => ({
      id: mc.id,
      title: mc.title,
      summary: mc.summary,
      contentMarkdown: mc.contentMarkdown
    }))
  }));
}

export function createStarterModule(
  kind: ModuleType,
  course: Course,
  defaultQuizPass: number = course.gradingCriteria?.quizPassingScore ?? 75
): CourseModule {
  const stamp = Date.now();
  const nextNum = course.modules.length + 1;

  if (kind === 'quiz') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Knowledge Verification Quiz`,
      type: 'quiz',
      durationMin: 20,
      summary: 'Interactive graded assessment with immediate explanations and automated scoring.',
      quiz: {
        passingScore: defaultQuizPass,
        questions: [
          {
            id: `q-${stamp}-1`,
            question: `Key concept verification for ${course.code}:`,
            options: [
              'Primary Best Practice',
              'Deprecated Legacy Option',
              'Unencrypted Fallback',
              'None of the above'
            ],
            correctAnswerIndex: 0,
            explanation:
              'Immediate feedback explanation shown as soon as a learner selects an answer.'
          }
        ]
      }
    };
  }

  if (kind === 'lab') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Hands-On CLI Configuration Lab`,
      type: 'lab',
      durationMin: 40,
      summary: 'Interactive Cisco IOS CLI lab with automated command verification.',
      lab: {
        objective: 'Configure interface addressing and verify routing reachability.',
        nodes: course.modules.find(m => m.lab?.nodes?.length)?.lab?.nodes || [
          {
            id: 'R1',
            name: 'R1-Core',
            type: 'router',
            ip: '10.0.0.1',
            subnet: '/30',
            status: 'online',
            x: 140,
            y: 150
          },
          {
            id: 'R2',
            name: 'R2-Edge',
            type: 'router',
            ip: '10.0.0.2',
            subnet: '/30',
            status: 'online',
            x: 360,
            y: 150
          }
        ],
        links: course.modules.find(m => m.lab?.links?.length)?.lab?.links || [
          {
            from: 'R1',
            to: 'R2',
            interfaceFrom: 'Gig0/0/0',
            interfaceTo: 'Gig0/0/0',
            status: 'up'
          }
        ],
        initialConfigPrompt: 'R1-Core#',
        expectedCommands: [
          'configure terminal',
          'interface GigabitEthernet0/0/0',
          'no shutdown',
          'end'
        ],
        terminalHints: ['Enter global config mode with "configure terminal".'],
        verificationCheck: 'show ip interface brief'
      }
    };
  }

  if (kind === 'video') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Architecture Walkthrough Video`,
      type: 'video',
      durationMin: 25,
      summary: 'Guided instructor walkthrough covering key protocol design trade-offs.',
      videoUrl: 'https://stream.netplus.academy/walkthrough',
      videoDuration: '18:30',
      contentMarkdown:
        '### Companion Notes\n\nReview the CLI configuration sequences demonstrated in this session.'
    };
  }

  if (kind === 'pcap') {
    return {
      id: `mod-${stamp}`,
      title: `Module ${nextNum}: Packet Capture Inspection`,
      type: 'pcap',
      durationMin: 30,
      summary: 'Analyze captured control-plane and data-plane headers in Wireshark.',
      contentMarkdown:
        '### Packet Analysis Objectives\n\nInspect protocol flags, timers, and handshake state transitions.'
    };
  }

  return {
    id: `mod-${stamp}`,
    title: `Module ${nextNum}: Core Concepts & Design Notes`,
    type: 'theory',
    durationMin: 30,
    summary: 'Structured reading module covering protocol mechanics and deployment patterns.',
    contentMarkdown: `# Module ${nextNum}: Core Concepts\n\nOutline key protocol rules, timer defaults, and verification steps here.`
  };
}

