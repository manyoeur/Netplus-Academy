import {
  Course,
  CourseChapterSection,
  CourseMainContentSection,
  CourseModule
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
  sectionNumber: string; // e.g. "1.1"
  items: ResolvedCourseContentItem[];
}

export interface ResolvedChapterSection {
  id: string;
  title: string; // Level 1: Chapter Section
  summary?: string;
  chapterIndex: number; // 1-based
  chapterLabel: string; // e.g. "Chapter 1"
  mainContents: ResolvedMainContentSection[];
  totalModules: number;
}

export interface ModuleSectionBreadcrumb {
  chapterId: string;
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

  const ensureChapter = (title: string, summary?: string): CourseChapterSection => {
    const cleanTitle = title.trim() || 'Chapter 1: Core Curriculum';
    const key = normalizeKey(cleanTitle);
    const existing = chapterByNormTitle.get(key);
    if (existing) return existing;

    const created: CourseChapterSection = {
      id: slugId('chap', cleanTitle, chaptersOrder.length + 1),
      title: cleanTitle,
      summary,
      mainContents: []
    };
    chapterByNormTitle.set(key, created);
    chaptersOrder.push(created);
    return created;
  };

  const ensureMainContent = (
    chapter: CourseChapterSection,
    mainTitle: string,
    summary?: string
  ): CourseMainContentSection => {
    const cleanMain = mainTitle.trim() || 'Core Topics';
    const key = normalizeKey(cleanMain);
    const existing = chapter.mainContents.find(mc => normalizeKey(mc.title) === key);
    if (existing) return existing;

    const created: CourseMainContentSection = {
      id: slugId('sec', cleanMain, chapter.mainContents.length + 1),
      title: cleanMain,
      summary
    };
    chapter.mainContents.push(created);
    return created;
  };

  // Seed declared chapters/main-contents first so empty authoring sections remain visible in Builder
  for (const ch of course.chapters || []) {
    const targetCh = ensureChapter(ch.title, ch.summary);
    targetCh.id = ch.id || targetCh.id;
    for (const mc of ch.mainContents || []) {
      const targetMc = ensureMainContent(targetCh, mc.title, mc.summary);
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
      chapterIndex: chNum,
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
