import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { ArrowRight, CheckCircle2, Disc, LayoutGrid } from 'lucide-react';
import { Course } from '../../types';

export interface CourseCompletionDatum {
  course: Course;
  completedCount: number;
  totalModules: number;
  progressPercent: number;
  nextModuleTitle: string | null;
  color: string;
}

interface CourseRadialProgressChartProps {
  courses: Course[];
  completedModuleIds: string[];
  onSelectCourse: (courseId: string) => void;
}

type RadialDisplayMode = 'concentric' | 'individual';

const RING_PALETTE = [
  '#2563eb', // Blue 600
  '#0891b2', // Cyan 600
  '#4f46e5', // Indigo 600
  '#d97706', // Amber 600
  '#7c3aed', // Violet 600
  '#db2777'  // Pink 600
];

const COMPLETED_COLOR = '#059669'; // Emerald 600

interface SingleCourseMiniGaugeProps {
  item: CourseCompletionDatum;
  onSelect: (courseId: string) => void;
}

const SingleCourseMiniGauge: React.FC<SingleCourseMiniGaugeProps> = ({ item, onSelect }) => {
  const size = 128;
  const center = size / 2;
  const outerRadius = 54;
  const innerRadius = 40;

  const { trackPath, progressPath } = useMemo(() => {
    const angleScale = d3.scaleLinear().domain([0, 100]).range([0, 2 * Math.PI]).clamp(true);

    const trackGen = d3
      .arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    const progressGen = d3
      .arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(angleScale(item.progressPercent))
      .cornerRadius((outerRadius - innerRadius) / 2);

    return {
      trackPath: trackGen({}) || '',
      progressPath: item.progressPercent > 0 ? progressGen({}) || '' : ''
    };
  }, [item.progressPercent]);

  const statusLabel =
    item.progressPercent === 100
      ? 'Completed'
      : item.progressPercent > 0
      ? 'In Progress'
      : 'Not Started';

  return (
    <button
      type="button"
      onClick={() => onSelect(item.course.id)}
      className="group p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-blue-400 dark:hover:border-cyan-500/50 hover:bg-white dark:hover:bg-slate-900 transition-all text-left flex flex-col items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${item.course.title}: ${item.progressPercent}% complete`}
          className="overflow-visible"
        >
          <g transform={`translate(${center}, ${center})`}>
            <path d={trackPath} className="fill-slate-200/90 dark:fill-slate-800" />
            {progressPath && (
              <path
                d={progressPath}
                fill={item.color}
                className="transition-opacity duration-200 group-hover:opacity-90"
              />
            )}
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
            {item.progressPercent}%
          </span>
          <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
            {item.completedCount}/{item.totalModules} mod
          </span>
        </div>
      </div>

      <div className="w-full text-center space-y-1">
        <p className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate">
          {item.course.code} · {statusLabel}
        </p>
        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
          {item.course.title}
        </h4>
      </div>
    </button>
  );
};

export const CourseRadialProgressChart: React.FC<CourseRadialProgressChartProps> = ({
  courses,
  completedModuleIds,
  onSelectCourse
}) => {
  const [displayMode, setDisplayMode] = useState<RadialDisplayMode>('concentric');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  const courseData = useMemo<CourseCompletionDatum[]>(() => {
    return courses.map((course, idx) => {
      const totalModules = course.modules.length;
      const completedCount = course.modules.filter(m =>
        completedModuleIds.includes(m.id)
      ).length;
      const progressPercent =
        totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
      const nextModule = course.modules.find(m => !completedModuleIds.includes(m.id));
      const color =
        progressPercent === 100
          ? COMPLETED_COLOR
          : RING_PALETTE[idx % RING_PALETTE.length];

      return {
        course,
        completedCount,
        totalModules,
        progressPercent,
        nextModuleTitle: nextModule ? nextModule.title : null,
        color
      };
    });
  }, [courses, completedModuleIds]);

  const aggregateStats = useMemo(() => {
    const totalMods = courseData.reduce((sum, d) => sum + d.totalModules, 0);
    const completedMods = courseData.reduce((sum, d) => sum + d.completedCount, 0);
    const overallPercent =
      totalMods > 0 ? Math.round((completedMods / totalMods) * 100) : 0;
    const completedCourses = courseData.filter(d => d.progressPercent === 100).length;
    return { totalMods, completedMods, overallPercent, completedCourses };
  }, [courseData]);

  const activeDatum = useMemo(() => {
    if (!activeCourseId) return null;
    return courseData.find(d => d.course.id === activeCourseId) || null;
  }, [activeCourseId, courseData]);

  // D3 concentric arc geometry
  const svgSize = 280;
  const svgCenter = svgSize / 2;

  const concentricRings = useMemo(() => {
    const count = courseData.length;
    if (count === 0) return [];

    const maxRadius = 126;
    const minInnerRadius = count > 4 ? 46 : 56;
    const availableSpan = maxRadius - minInnerRadius;
    const gap = count > 4 ? 5 : 7;
    const strokeWidth = Math.max(8, Math.min(18, (availableSpan - gap * (count - 1)) / count));
    const angleScale = d3.scaleLinear().domain([0, 100]).range([0, 2 * Math.PI]).clamp(true);

    return courseData.map((datum, idx) => {
      const outerR = maxRadius - idx * (strokeWidth + gap);
      const innerR = Math.max(24, outerR - strokeWidth);

      const trackArc = d3
        .arc<unknown>()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(0)
        .endAngle(2 * Math.PI);

      const valueArc = d3
        .arc<unknown>()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(0)
        .endAngle(angleScale(datum.progressPercent))
        .cornerRadius(strokeWidth / 2);

      return {
        datum,
        innerR,
        outerR,
        trackPath: trackArc({}) || '',
        progressPath: datum.progressPercent > 0 ? valueArc({}) || '' : ''
      };
    });
  }, [courseData]);

  return (
    <section
      aria-label="Course Completion Radial Analytics"
      className="p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Course Completion Overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {aggregateStats.completedMods} of {aggregateStats.totalMods} total modules completed ·{' '}
            {aggregateStats.completedCourses} of {courseData.length} courses certified
          </p>
        </div>

        {courseData.length > 0 && (
          <div
            role="group"
            aria-label="Radial chart layout"
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto shrink-0"
          >
            <button
              type="button"
              onClick={() => setDisplayMode('concentric')}
              aria-pressed={displayMode === 'concentric'}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                displayMode === 'concentric'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Concentric</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('individual')}
              aria-pressed={displayMode === 'individual'}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                displayMode === 'individual'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Individual Rings</span>
            </button>
          </div>
        )}
      </div>

      {courseData.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
          Enroll in a course from the catalog to track radial completion progress here.
        </div>
      ) : displayMode === 'concentric' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-1">
          {/* D3 Concentric Radial SVG */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center w-[280px] h-[280px]">
              <svg
                width={svgSize}
                height={svgSize}
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                role="img"
                aria-label="Concentric radial progress chart showing course completion percentages"
                className="overflow-visible"
              >
                <g transform={`translate(${svgCenter}, ${svgCenter})`}>
                  {concentricRings.map(({ datum, trackPath, progressPath }) => {
                    const isHovered = activeCourseId === datum.course.id;
                    const isDimmed = activeCourseId !== null && !isHovered;

                    return (
                      <g
                        key={datum.course.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${datum.course.title}: ${datum.progressPercent}% complete`}
                        onMouseEnter={() => setActiveCourseId(datum.course.id)}
                        onMouseLeave={() => setActiveCourseId(null)}
                        onFocus={() => setActiveCourseId(datum.course.id)}
                        onBlur={() => setActiveCourseId(null)}
                        onClick={() => onSelectCourse(datum.course.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectCourse(datum.course.id);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                        style={{
                          opacity: isDimmed ? 0.35 : 1,
                          transition: 'opacity 180ms ease'
                        }}
                      >
                        <path
                          d={trackPath}
                          className="fill-slate-100 dark:fill-slate-800/90"
                        />
                        {progressPath && (
                          <path
                            d={progressPath}
                            fill={datum.color}
                            style={{
                              transform: isHovered ? 'scale(1.015)' : 'scale(1)',
                              transformOrigin: '0px 0px',
                              transition: 'transform 180ms ease'
                            }}
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Center Metric Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-12">
                {activeDatum ? (
                  <>
                    <span
                      className="text-[11px] font-mono font-bold tracking-wider uppercase"
                      style={{ color: activeDatum.color }}
                    >
                      {activeDatum.course.code}
                    </span>
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5">
                      {activeDatum.progressPercent}%
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {activeDatum.completedCount}/{activeDatum.totalModules} modules
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Overall
                    </span>
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5">
                      {aggregateStats.overallPercent}%
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {aggregateStats.completedMods}/{aggregateStats.totalMods} mod
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Course Legend & Completion Breakdown */}
          <div className="lg:col-span-7 divide-y divide-slate-100 dark:divide-slate-800/80 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            {courseData.map(item => {
              const isHighlighted = activeCourseId === item.course.id;
              const statusText =
                item.progressPercent === 100
                  ? 'Completed'
                  : item.progressPercent > 0
                  ? 'In Progress'
                  : 'Not Started';

              return (
                <button
                  key={item.course.id}
                  type="button"
                  onMouseEnter={() => setActiveCourseId(item.course.id)}
                  onMouseLeave={() => setActiveCourseId(null)}
                  onFocus={() => setActiveCourseId(item.course.id)}
                  onBlur={() => setActiveCourseId(null)}
                  onClick={() => onSelectCourse(item.course.id)}
                  className={`w-full py-3 px-3 -mx-3 rounded-xl flex items-center justify-between gap-4 text-left transition-colors ${
                    isHighlighted
                      ? 'bg-slate-50 dark:bg-slate-800/60'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {item.course.code}
                        </span>
                        <span>·</span>
                        <span>{item.completedCount}/{item.totalModules} modules</span>
                        <span>·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-sans font-semibold ${
                            item.progressPercent === 100
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.progressPercent > 0
                              ? 'text-blue-600 dark:text-cyan-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.progressPercent === 100 && (
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                          )}
                          {statusText}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {item.course.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.nextModuleTitle
                          ? `Next: ${item.nextModuleTitle}`
                          : 'All curriculum modules completed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="text-sm font-bold font-mono tabular-nums"
                      style={{ color: item.progressPercent > 0 ? item.color : undefined }}
                    >
                      {item.progressPercent}%
                    </span>
                    <ArrowRight
                      className={`w-4 h-4 transition-transform ${
                        isHighlighted
                          ? 'translate-x-0.5 text-blue-600 dark:text-cyan-400'
                          : 'text-slate-400'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* INDIVIDUAL RADIAL GAUGES GRID */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
          {courseData.map(item => (
            <SingleCourseMiniGauge
              key={item.course.id}
              item={item}
              onSelect={onSelectCourse}
            />
          ))}
        </div>
      )}
    </section>
  );
};
