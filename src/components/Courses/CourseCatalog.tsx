import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Star,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  LayoutGrid,
  List,
  X,
  ArrowUpDown,
  Calendar,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Signal,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course } from '../../types';
import { CourseThumbnail } from './CourseThumbnail';
import {
  DEFAULT_ENROLLMENT_DAYS,
  resolveCourseEnrollment,
  formatEnrollmentDateRange,
  getEnrollmentExpirationInfo
} from '../../utils/enrollmentDates';

interface CourseCatalogProps {
  onSelectCourse: (courseId: string) => void;
  onOpenPaymentModal: () => void;
  onOpenCourseCheckout?: (course: Course) => void;
}

type CatalogViewMode = 'grid' | 'list';
type SortOption =
  | 'recommended'
  | 'recent'
  | 'popular'
  | 'difficulty_asc'
  | 'difficulty_desc'
  | 'rating'
  | 'duration';

const DIFFICULTY_RANK: Record<Course['level'], number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4
};

function parseCourseDateMs(dateStr?: string): number {
  if (!dateStr) return 0;
  const parsed = Date.parse(dateStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const CATALOG_VIEW_STORAGE_KEY = 'netpulse_academy_catalog_view';

export const CourseCatalog: React.FC<CourseCatalogProps> = ({
  onSelectCourse,
  onOpenPaymentModal,
  onOpenCourseCheckout
}) => {
  const { courses, currentUser, enrollInCourse } = useAcademy();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<CatalogViewMode>(() => {
    try {
      const saved = localStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, viewMode);
    } catch {
      // Ignore storage write errors in restricted browsing contexts
    }
  }, [viewMode]);

  const categories = useMemo(() => {
    const presetTracks = [
      'All',
      'CCNA',
      'CCNP',
      'Security',
      'Cloud & SD-WAN',
      'Packet Analysis'
    ];
    const coveredCategories = new Set([
      'Enterprise Routing & Switching',
      'Network Security & Firewalls',
      'Cloud & SD-WAN',
      'Packet Analysis & Forensics'
    ]);
    const customCategories = courses
      .map(c => c.category)
      .filter(cat => !coveredCategories.has(cat));
    return Array.from(new Set([...presetTracks, ...customCategories]));
  }, [courses]);

  const levels = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const matchesSelectedCategory = (course: Course, category: string): boolean => {
    if (category === 'All') return true;
    const codeUpper = course.code.toUpperCase();
    const titleUpper = course.title.toUpperCase();
    const catLower = course.category.toLowerCase();

    if (category === 'CCNA') {
      return (
        codeUpper.includes('CCNA') ||
        titleUpper.includes('CCNA') ||
        (course.category === 'Enterprise Routing & Switching' && !codeUpper.includes('CCNP'))
      );
    }
    if (category === 'CCNP') {
      return (
        codeUpper.includes('CCNP') ||
        titleUpper.includes('CCNP') ||
        course.description.toUpperCase().includes('CCNP')
      );
    }
    if (category === 'Security') {
      return (
        catLower.includes('security') ||
        codeUpper.includes('SEC') ||
        titleUpper.includes('FIREWALL') ||
        titleUpper.includes('SECURITY')
      );
    }
    if (category === 'Cloud & SD-WAN') {
      return catLower.includes('cloud') || catLower.includes('sd-wan') || codeUpper.includes('CLOUD');
    }
    if (category === 'Packet Analysis') {
      return (
        catLower.includes('packet') ||
        codeUpper.includes('WIRESHARK') ||
        titleUpper.includes('PACKET')
      );
    }
    return course.category === category;
  };

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = courses.filter(c => {
      const matchesCat = matchesSelectedCategory(c, selectedCategory);
      const matchesLevel = selectedLevel === 'All' || c.level === selectedLevel;
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.instructor.name.toLowerCase().includes(q) ||
        c.modules.some(
          m =>
            m.title.toLowerCase().includes(q) ||
            (m.chapterTitle || '').toLowerCase().includes(q) ||
            (m.mainContentTitle || '').toLowerCase().includes(q)
        );
      return matchesCat && matchesLevel && matchesSearch;
    });

    if (sortBy === 'recommended') return filtered;

    return filtered
      .map((course, idx) => ({ course, idx }))
      .sort((a, b) => {
        if (sortBy === 'recent') {
          const diff = parseCourseDateMs(b.course.updatedAt) - parseCourseDateMs(a.course.updatedAt);
          return diff !== 0 ? diff : a.idx - b.idx;
        }
        if (sortBy === 'popular') {
          return (
            b.course.enrolledCount - a.course.enrolledCount ||
            b.course.rating - a.course.rating ||
            b.course.reviewsCount - a.course.reviewsCount ||
            a.idx - b.idx
          );
        }
        if (sortBy === 'difficulty_asc') {
          return (
            (DIFFICULTY_RANK[a.course.level] ?? 99) - (DIFFICULTY_RANK[b.course.level] ?? 99) ||
            b.course.enrolledCount - a.course.enrolledCount ||
            a.idx - b.idx
          );
        }
        if (sortBy === 'difficulty_desc') {
          return (
            (DIFFICULTY_RANK[b.course.level] ?? 0) - (DIFFICULTY_RANK[a.course.level] ?? 0) ||
            b.course.enrolledCount - a.course.enrolledCount ||
            a.idx - b.idx
          );
        }
        if (sortBy === 'rating') {
          return (
            b.course.rating - a.course.rating ||
            b.course.reviewsCount - a.course.reviewsCount ||
            a.idx - b.idx
          );
        }
        if (sortBy === 'duration') {
          return b.course.durationHours - a.course.durationHours || a.idx - b.idx;
        }
        return a.idx - b.idx;
      })
      .map(entry => entry.course);
  }, [courses, selectedCategory, selectedLevel, searchQuery, sortBy]);

  const sortSummaryLabel = useMemo(() => {
    switch (sortBy) {
      case 'recent':
        return 'Sorted by Recently Added';
      case 'popular':
        return 'Sorted by Popular';
      case 'difficulty_asc':
        return 'Sorted by Difficulty (Beginner → Expert)';
      case 'difficulty_desc':
        return 'Sorted by Difficulty (Expert → Beginner)';
      case 'rating':
        return 'Sorted by Highest Rated';
      case 'duration':
        return 'Sorted by Longest Duration';
      default:
        return 'Recommended Order';
    }
  }, [sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedLevel !== 'All' ||
    searchQuery.trim() !== '' ||
    sortBy !== 'recommended';

  const resetFilters = () => {
    setSelectedCategory('All');
    setSelectedLevel('All');
    setSearchQuery('');
    setSortBy('recommended');
  };

  return (
    <div className="w-full space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 text-white p-8 sm:p-11 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-medium">
            <span className="font-mono text-cyan-300 font-semibold">
              CCIE-Authoritative Curriculum
            </span>
            <span>·</span>
            <span>Enterprise Certifications</span>
            <span>·</span>
            <span className="tabular-nums">{courses.length} Active Tracks</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            High Network Education Academy
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Configure Cisco IOS routers, diagnose live packet captures in Wireshark, deploy Next-Gen firewalls, and earn industry-recognized credentials with automated digital certificates.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onSelectCourse('course-ccna-1')}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>Explore CCNA 200-301 Masterclass</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenPaymentModal}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Unlock All Labs with Pro Tier ($29/mo)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & View Mode Switcher */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search, Level, Sort & Grid/List Switcher */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <div className="relative flex-1 sm:w-56 md:w-64 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses, BGP, OSPF..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              aria-label="Filter by difficulty level"
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
            >
              {levels.map(lvl => (
                <option key={lvl} value={lvl}>
                  {lvl === 'All' ? 'All Levels' : lvl}
                </option>
              ))}
            </select>

            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort courses"
                className="pl-8 pr-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="recommended">Recommended</option>
                <option value="recent">Recently Added</option>
                <option value="popular">Popular</option>
                <option value="difficulty_asc">Difficulty: Beginner → Expert</option>
                <option value="difficulty_desc">Difficulty: Expert → Beginner</option>
                <option value="rating">Highest Rated</option>
                <option value="duration">Longest Duration</option>
              </select>
            </div>

            {/* Thumbnail Grid / List View Segmented Toggle */}
            <div
              role="group"
              aria-label="Course display view"
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                title="Thumbnail view"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Thumbnails</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                title="List view"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Sort & Difficulty Level Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Sort:
            </span>
            <button
              type="button"
              onClick={() => setSortBy('recommended')}
              aria-pressed={sortBy === 'recommended'}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                sortBy === 'recommended'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>Recommended</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('recent')}
              aria-pressed={sortBy === 'recent'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                sortBy === 'recent'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Recently Added</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('popular')}
              aria-pressed={sortBy === 'popular'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                sortBy === 'popular'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Popular</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setSortBy(prev => (prev === 'difficulty_asc' ? 'difficulty_desc' : 'difficulty_asc'))
              }
              aria-pressed={sortBy === 'difficulty_asc' || sortBy === 'difficulty_desc'}
              title="Click to sort by Difficulty Level (toggle Beginner ↔ Expert)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                sortBy === 'difficulty_asc' || sortBy === 'difficulty_desc'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Signal className="w-3.5 h-3.5" />
              <span>Difficulty Level</span>
              {sortBy === 'difficulty_asc' && <ArrowUp className="w-3 h-3" />}
              {sortBy === 'difficulty_desc' && <ArrowDown className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Difficulty:
            </span>
            {levels.map(lvl => (
              <button
                key={`quick-lvl-${lvl}`}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                aria-pressed={selectedLevel === lvl}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedLevel === lvl
                    ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {lvl === 'All' ? 'All Levels' : lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2 tabular-nums">
            <span>
              Showing <strong className="text-slate-900 dark:text-slate-100">{filteredCourses.length}</strong> of{' '}
              <strong className="text-slate-900 dark:text-slate-100">{courses.length}</strong> courses
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {sortSummaryLabel}
            </span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-blue-600 dark:text-cyan-400 font-semibold hover:underline whitespace-nowrap shrink-0"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredCourses.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            No courses match your current filters
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try clearing your search query or switching back to all difficulty levels and tracks.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all"
          >
            Show All Courses
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* THUMBNAIL GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredCourses.map(course => {
            const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);
            const enrollment = resolveCourseEnrollment(currentUser, course);
            const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
            const totalModules = course.modules.length;
            const completedCount = course.modules.filter(m =>
              currentUser.completedModuleIds.includes(m.id)
            ).length;
            const progressPercent =
              totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

            return (
              <div
                key={course.id}
                onClick={() => onSelectCourse(course.id)}
                className="bg-white dark:bg-[#0c1220] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl hover:border-blue-400 dark:hover:border-cyan-500/50 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transform-none motion-reduce:transition-none flex flex-col group cursor-pointer"
              >
                {/* 16:9 Thumbnail Image Header with Scrim & Hover Lift/Scale */}
                <CourseThumbnail
                  course={course}
                  className="aspect-video group/thumb"
                  imgClassName="group-hover:scale-105 group-hover/thumb:scale-[1.07] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transform-none motion-reduce:transition-none"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-cyan-400/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  />
                  <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2 z-10 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 motion-reduce:transform-none">
                    <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300">
                      {course.code}
                    </span>
                    {progressPercent === 100 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </CourseThumbnail>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    {/* Quiet inline category, level & updated date metadata */}
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate tabular-nums">
                      {course.category} · {course.level} · Updated {course.updatedAt}
                    </p>

                    {/* Course Title */}
                    <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                      {course.title}
                    </h3>

                    {/* Instructor & Rating/Enrollment */}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-500 dark:text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {course.rating.toFixed(1)}
                      </span>
                      <span>·</span>
                      <span>{course.enrolledCount.toLocaleString()} students</span>
                      <span>·</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                        {course.instructor.name}
                      </span>
                    </div>

                    {/* Brief Subtitle */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pt-0.5 leading-relaxed">
                      {course.subtitle}
                    </p>

                    {/* Visual Completion Progress Bar */}
                    <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isEnrolled
                            ? `${completedCount}/${totalModules} modules`
                            : `${totalModules} modules · Not enrolled`}
                        </span>
                        <span
                          className={`font-bold ${
                            progressPercent === 100
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : progressPercent > 0
                              ? 'text-blue-600 dark:text-cyan-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {progressPercent}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${course.title} completion ${progressPercent}%`}
                        className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progressPercent === 100
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      {enrollment && expiryInfo ? (
                        <div
                          className={`mt-2 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums ${
                            expiryInfo.status === 'expired'
                              ? 'text-red-600 dark:text-red-400'
                              : expiryInfo.status === 'expiring_soon'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {expiryInfo.status === 'expired' ? (
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                          ) : expiryInfo.status === 'expiring_soon' ? (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="font-medium">
                            {formatEnrollmentDateRange(enrollment)}
                          </span>
                          {(expiryInfo.status === 'expiring_soon' || expiryInfo.status === 'expired') && (
                            <span className="font-semibold">
                              · {expiryInfo.countdownLabel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS}d access upon enrollment</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Metadata & Action Button */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums min-w-0">
                      <span className="inline-flex items-center gap-1 truncate">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {course.durationHours}h · {totalModules}m
                        </span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">
                        {course.price > 0 ? `$${course.price}` : 'Free'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const needsStudentPayment =
                          currentUser.role === 'student' &&
                          course.price > 0 &&
                          (!isEnrolled || expiryInfo?.status === 'expired');

                        if (needsStudentPayment && onOpenCourseCheckout) {
                          onOpenCourseCheckout(course);
                          return;
                        }
                        if (!isEnrolled) {
                          enrollInCourse(course.id);
                        }
                        onSelectCourse(course.id);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                        isEnrolled && expiryInfo?.status === 'expired' && currentUser.role === 'student' && course.price > 0
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                          : isEnrolled
                          ? 'bg-blue-50 text-blue-600 dark:bg-cyan-950/40 dark:text-cyan-300 hover:bg-blue-600 hover:text-white dark:hover:bg-cyan-500 dark:hover:text-slate-950 border border-blue-200/60 dark:border-cyan-800/50'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                      }`}
                    >
                      {isEnrolled && expiryInfo?.status === 'expired' && currentUser.role === 'student' && course.price > 0
                        ? `Renew · $${course.price}`
                        : progressPercent === 100
                        ? 'Review Course'
                        : isEnrolled
                        ? 'Resume Course'
                        : currentUser.role === 'student' && course.price > 0
                        ? `Enroll · $${course.price}`
                        : 'Enroll Now'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-4">
          {filteredCourses.map(course => {
            const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);
            const enrollment = resolveCourseEnrollment(currentUser, course);
            const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
            const totalModules = course.modules.length;
            const completedCount = course.modules.filter(m =>
              currentUser.completedModuleIds.includes(m.id)
            ).length;
            const progressPercent =
              totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

            return (
              <div
                key={course.id}
                onClick={() => onSelectCourse(course.id)}
                className="bg-white dark:bg-[#0c1220] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl hover:border-blue-400 dark:hover:border-cyan-500/50 transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transform-none motion-reduce:transition-none flex flex-col md:flex-row group cursor-pointer"
              >
                {/* Left Thumbnail */}
                <CourseThumbnail
                  course={course}
                  className="w-full md:w-64 lg:w-72 shrink-0 aspect-video md:aspect-auto md:min-h-[176px] group/thumb"
                  imgClassName="group-hover:scale-105 group-hover/thumb:scale-[1.07] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transform-none motion-reduce:transition-none"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-cyan-400/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  />
                  <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2 z-10 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 motion-reduce:transform-none">
                    <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300">
                      {course.code}
                    </span>
                    {progressPercent === 100 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </CourseThumbnail>

                {/* Center Content */}
                <div className="flex-1 p-5 flex flex-col justify-between min-w-0 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {course.category} · {course.level} · Updated {course.updatedAt}
                    </p>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                      {course.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {course.subtitle}
                    </p>

                    {course.learningOutcomes.length > 0 && (
                      <div className="pt-1.5 grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-1">
                        {course.learningOutcomes.slice(0, 2).map((outcome, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 min-w-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{outcome}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Instructor & Stats Inline Line */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {course.instructor.name}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-500 dark:text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {course.rating.toFixed(1)}
                    </span>
                    <span className="text-slate-400">({course.reviewsCount})</span>
                    <span>·</span>
                    <span>{course.enrolledCount.toLocaleString()} enrolled</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {course.durationHours}h
                    </span>
                    <span>·</span>
                    <span className="font-mono">{totalModules} modules</span>
                  </div>
                </div>

                {/* Right Progress & Action Column */}
                <div className="md:w-56 shrink-0 p-5 pt-0 md:pt-5 md:border-l md:border-slate-100 md:dark:border-slate-800/80 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums pb-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400">Tuition</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {course.price > 0 ? `$${course.price}.00` : 'Free'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">Progress</span>
                      <span
                        className={`font-bold ${
                          progressPercent === 100
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : progressPercent > 0
                            ? 'text-blue-600 dark:text-cyan-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {progressPercent}%
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${course.title} completion ${progressPercent}%`}
                      className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progressPercent === 100
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {isEnrolled
                        ? `${completedCount} of ${totalModules} modules done`
                        : `${totalModules} modules · ${course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS}d access`}
                    </p>

                    {enrollment && expiryInfo && (
                      <div
                        className={`pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums ${
                          expiryInfo.status === 'expired'
                            ? 'text-red-600 dark:text-red-400'
                            : expiryInfo.status === 'expiring_soon'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {expiryInfo.status === 'expired' ? (
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : expiryInfo.status === 'expiring_soon' ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                        )}
                        <span className="font-medium">
                          {formatEnrollmentDateRange(enrollment)}
                        </span>
                        {(expiryInfo.status === 'expiring_soon' || expiryInfo.status === 'expired') && (
                          <span className="font-semibold">
                            · {expiryInfo.countdownLabel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const needsStudentPayment =
                        currentUser.role === 'student' &&
                        course.price > 0 &&
                        (!isEnrolled || expiryInfo?.status === 'expired');

                      if (needsStudentPayment && onOpenCourseCheckout) {
                        onOpenCourseCheckout(course);
                        return;
                      }
                      if (!isEnrolled) {
                        enrollInCourse(course.id);
                      }
                      onSelectCourse(course.id);
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                      isEnrolled && expiryInfo?.status === 'expired' && currentUser.role === 'student' && course.price > 0
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                        : isEnrolled
                        ? 'bg-blue-50 text-blue-600 dark:bg-cyan-950/40 dark:text-cyan-300 hover:bg-blue-600 hover:text-white dark:hover:bg-cyan-500 dark:hover:text-slate-950 border border-blue-200/60 dark:border-cyan-800/50'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                    }`}
                  >
                    <span>
                      {isEnrolled && expiryInfo?.status === 'expired' && currentUser.role === 'student' && course.price > 0
                        ? `Renew · $${course.price}`
                        : progressPercent === 100
                        ? 'Review Course'
                        : isEnrolled
                        ? 'Resume Course'
                        : currentUser.role === 'student' && course.price > 0
                        ? `Pay $${course.price} & Enroll`
                        : 'Enroll Now'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

