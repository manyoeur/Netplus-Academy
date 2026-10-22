import React, { useState } from 'react';
import { 
  Layers, 
  Search, 
  Star, 
  Clock, 
  Users, 
  CheckCircle, 
  Award, 
  ArrowRight, 
  Filter, 
  Terminal, 
  ShieldCheck, 
  Sparkles,
  BookOpen
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course } from '../../types';

interface CourseCatalogProps {
  onSelectCourse: (courseId: string) => void;
  onOpenPaymentModal: () => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({
  onSelectCourse,
  onOpenPaymentModal
}) => {
  const { courses, currentUser, enrollInCourse } = useAcademy();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    'All',
    'Enterprise Routing & Switching',
    'Network Security & Firewalls',
    'Cloud & SD-WAN',
    'Packet Analysis & Forensics'
  ];

  const filteredCourses = courses.filter(c => {
    const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 text-white p-8 sm:p-12 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-cyan-300 font-mono text-xs font-semibold border border-blue-500/30">
              CCIE-Authoritative Curriculum
            </span>
            <span className="text-xs text-slate-300 font-medium">• Enterprise Certifications</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Master High-Availability Networks & Routing Protocols
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Configure Cisco IOS routers, diagnose live packet captures in Wireshark, deploy Next-Gen firewalls, and earn industry-recognized credentials with automated digital certificates.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onSelectCourse('course-ccna-1')}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
            >
              <span>Explore CCNA 200-301 Masterclass</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenPaymentModal}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Unlock All Labs with Pro Tier ($29/mo)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 text-xs">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses, BGP, OSPF..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {filteredCourses.map(course => {
          const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);
          const completedCount = course.modules.filter(m => currentUser.completedModuleIds.includes(m.id)).length;
          const progressPercent = Math.round((completedCount / (course.modules.length || 1)) * 100);

          return (
            <div
              key={course.id}
              className="group rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-cyan-500/50 transition-all flex flex-col justify-between overflow-hidden"
            >
              <div>
                {/* Course Banner Header */}
                <div className={`p-6 bg-gradient-to-r ${course.bannerColor} text-white relative`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-mono font-bold tracking-wider">
                      {course.code}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-black/30 backdrop-blur-sm">
                      {course.level}
                    </span>
                  </div>

                  <h3 className="text-lg font-black tracking-tight leading-snug">
                    {course.title}
                  </h3>

                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-200">
                    <img
                      src={course.instructor.avatar}
                      alt={course.instructor.name}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-white/50"
                    />
                    <span className="font-medium">{course.instructor.name}</span>
                    <span>• {course.instructor.title}</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-4 text-xs">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {course.subtitle}
                  </p>

                  {/* Highlights */}
                  <div className="space-y-1.5 pt-1">
                    {course.learningOutcomes.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-700 dark:text-slate-300 text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Enrolled Progress Bar if already taking course */}
                  {isEnrolled && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-[11px] font-mono font-semibold mb-1">
                        <span className="text-slate-500">Your Progress</span>
                        <span className="text-blue-600 dark:text-cyan-400">{progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 dark:bg-cyan-400 rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Meta stats */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{course.durationHours}h ({course.modules.length} modules)</span>
                    </span>

                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{course.enrolledCount.toLocaleString()} Enrolled</span>
                    </span>

                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{course.rating}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-6 pt-0">
                {isEnrolled ? (
                  <button
                    onClick={() => onSelectCourse(course.id)}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Continue Course ({progressPercent}% Completed)</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        enrollInCourse(course.id);
                        onSelectCourse(course.id);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <span>Enroll in Course</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onSelectCourse(course.id)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                    >
                      Syllabus
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
