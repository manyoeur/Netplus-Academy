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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map(course => {
          const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);
          const completedCount = course.modules.filter(m => currentUser.completedModuleIds.includes(m.id)).length;
          const progressPercent = Math.round((completedCount / (course.modules.length || 1)) * 100);
          const isInstructor = currentUser.role === 'admin' || currentUser.role === 'instructor';
          const defaultThumb = 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800';

          return (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              className="bg-white dark:bg-[#0c1220] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-cyan-500/50 transition-all flex flex-col group cursor-pointer"
            >
              {/* Course Thumbnail Image Header */}
              <div className="relative overflow-hidden aspect-video bg-slate-950">
                <img
                  src={course.thumbnail || defaultThumb}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                
                {/* Top-Left Category Badge */}
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900/80 dark:bg-[#070b14]/85 backdrop-blur-md text-white border border-white/10 shadow-sm">
                  {course.category}
                </span>

                {/* Top-Right Badges */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-600 text-white shadow-sm">
                    {course.level}
                  </span>
                </div>

                {/* Bottom Overlay Pill for Course Code */}
                <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-[10px] font-mono text-cyan-300 font-bold border border-cyan-500/30">
                  {course.code}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  {/* Star Rating & Enrolled Count */}
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold mb-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{course.rating.toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">
                      ({course.enrolledCount.toLocaleString()} students)
                    </span>
                  </div>

                  {/* Course Title */}
                  <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                    {course.title}
                  </h3>

                  {/* Instructor Name */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Instructor: <span className="font-medium text-slate-700 dark:text-slate-300">{course.instructor.name}</span>
                  </p>

                  {/* Brief Subtitle */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {course.subtitle}
                  </p>

                  {/* Enrolled Progress Bar */}
                  {isEnrolled && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex justify-between text-[11px] font-mono font-semibold mb-1">
                        <span className="text-slate-500 dark:text-slate-400">Progress</span>
                        <span className="text-blue-600 dark:text-cyan-400">{progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Metadata & Action Button */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{course.durationHours} Hours</span>
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEnrolled) {
                        enrollInCourse(course.id);
                      }
                      onSelectCourse(course.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isEnrolled
                        ? 'bg-blue-50 text-blue-600 dark:bg-cyan-950/40 dark:text-cyan-300 hover:bg-blue-600 hover:text-white dark:hover:bg-cyan-500 dark:hover:text-slate-950 border border-blue-200/60 dark:border-cyan-800/50'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                    }`}
                  >
                    {isEnrolled ? 'Resume Course' : 'Enroll Now'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
