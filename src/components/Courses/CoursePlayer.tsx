import React, { useState } from 'react';
import { 
  ArrowLeft, 
  CheckCircle, 
  Play, 
  Terminal, 
  FileText, 
  HelpCircle, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Award,
  Video,
  Download,
  ShieldCheck
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course, CourseModule } from '../../types';
import { InteractiveCliTerminal } from '../Lab/InteractiveCliTerminal';

interface CoursePlayerProps {
  courseId: string;
  onBack: () => void;
  onOpenAITutorWithPrompt: (prompt: string) => void;
  onViewCertificates: () => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseId,
  onBack,
  onOpenAITutorWithPrompt,
  onViewCertificates
}) => {
  const { courses, currentUser, completeModule, enrollInCourse } = useAcademy();
  const course = courses.find(c => c.id === courseId) || courses[0];

  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const activeModule = course.modules[activeModuleIndex] || course.modules[0];

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const isModuleCompleted = (modId: string) => currentUser.completedModuleIds.includes(modId);

  const completedCount = course.modules.filter(m => isModuleCompleted(m.id)).length;
  const progressPercent = Math.round((completedCount / course.modules.length) * 100);
  const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);

  const handleNextModule = () => {
    // Complete current module
    completeModule(course.id, activeModule.id);

    if (activeModuleIndex < course.modules.length - 1) {
      setActiveModuleIndex(prev => prev + 1);
      // Reset quiz state for next module
      setSelectedAnswers({});
      setQuizSubmitted(false);
    }
  };

  const handlePrevModule = () => {
    if (activeModuleIndex > 0) {
      setActiveModuleIndex(prev => prev - 1);
      setSelectedAnswers({});
      setQuizSubmitted(false);
    }
  };

  const handleQuizSubmit = () => {
    if (!activeModule.quiz) return;
    let score = 0;
    activeModule.quiz.questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswerIndex) {
        score++;
      }
    });
    const percentage = Math.round((score / activeModule.quiz.questions.length) * 100);
    setQuizScore(percentage);
    setQuizSubmitted(true);

    if (percentage >= activeModule.quiz.passingScore) {
      completeModule(course.id, activeModule.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Top Navigation Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                {course.code}
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-md">
                {course.title}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Module {activeModuleIndex + 1} of {course.modules.length}: {activeModule.title}
            </p>
          </div>
        </div>

        {/* Progress & Actions */}
        <div className="flex items-center gap-4">
          <div className="w-32 hidden sm:block text-right">
            <div className="flex justify-between text-[11px] font-mono font-bold text-slate-500 mb-1">
              <span>Progress</span>
              <span className="text-blue-600 dark:text-cyan-400">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-cyan-400 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {progressPercent === 100 && (
            <button
              onClick={onViewCertificates}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20"
            >
              <Award className="w-3.5 h-3.5" />
              <span>View Certificate</span>
            </button>
          )}

          <button
            onClick={() => onOpenAITutorWithPrompt(`Explain key concepts for ${activeModule.title}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Tutor</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Syllabus Navigation */}
        <div className="lg:col-span-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Course Modules</span>
            <span className="text-[10px] font-mono text-slate-400">{completedCount}/{course.modules.length} Done</span>
          </div>

          <div className="space-y-1.5">
            {course.modules.map((m, idx) => {
              const isActive = idx === activeModuleIndex;
              const isDone = isModuleCompleted(m.id);

              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveModuleIndex(idx);
                    setSelectedAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-2.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-mono ${
                        isActive ? 'border-white text-white' : 'border-slate-400 text-slate-400'
                      }`}>
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs line-clamp-1">{m.title}</p>
                    <span className={`text-[10px] font-mono capitalize ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {m.type} • {m.durationMin}m
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Enrolled status */}
          {!isEnrolled && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
              <p className="font-bold mb-1">Preview Mode</p>
              <button
                onClick={() => enrollInCourse(course.id)}
                className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs mt-1"
              >
                Enroll Free & Track Progress
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Module Learning Workspace */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Theory Module */}
          {activeModule.type === 'theory' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {activeModule.title}
              </h1>

              <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap">
                {activeModule.contentMarkdown}
              </div>
            </div>
          )}

          {/* Video Module */}
          {activeModule.type === 'video' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {activeModule.title}
              </h1>

              {/* Video Player Frame */}
              <div className="relative aspect-video w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-600/80 hover:bg-blue-600 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-blue-500/30 transition-transform hover:scale-105">
                    <Play className="w-8 h-8 ml-1" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Video Walkthrough • Duration: {activeModule.videoDuration || '22:15'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    High-Definition 1080p60 • Stream Encrypted
                  </p>
                </div>
              </div>

              {activeModule.contentMarkdown && (
                <div className="text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                  {activeModule.contentMarkdown}
                </div>
              )}
            </div>
          )}

          {/* Lab Module (Cisco IOS Terminal + Topology) */}
          {activeModule.type === 'lab' && (
            <InteractiveCliTerminal
              module={activeModule}
              courseId={course.id}
              onAskAI={(p) => onOpenAITutorWithPrompt(p)}
              onCompleted={() => {
                completeModule(course.id, activeModule.id);
              }}
            />
          )}

          {/* Wireshark PCAP Module */}
          {activeModule.type === 'pcap' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeModule.title}
                </h1>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono text-[10px] font-bold">
                  Wireshark Packet Dissector
                </span>
              </div>

              {/* Simulated Packet Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2">No.</th>
                      <th className="p-2">Time</th>
                      <th className="p-2">Source</th>
                      <th className="p-2">Destination</th>
                      <th className="p-2">Protocol</th>
                      <th className="p-2">Length</th>
                      <th className="p-2">Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                      <td className="p-2">1</td>
                      <td className="p-2">0.000000</td>
                      <td className="p-2">10.0.0.1</td>
                      <td className="p-2">224.0.0.5</td>
                      <td className="p-2 text-cyan-600 dark:text-cyan-400 font-bold">OSPF</td>
                      <td className="p-2">82</td>
                      <td className="p-2 truncate max-w-xs">Hello Packet (Area 0.0.0.0, Priority 1, Dead 40s)</td>
                    </tr>
                    <tr>
                      <td className="p-2">2</td>
                      <td className="p-2">0.142010</td>
                      <td className="p-2">10.0.0.2</td>
                      <td className="p-2">224.0.0.5</td>
                      <td className="p-2 text-cyan-600 dark:text-cyan-400 font-bold">OSPF</td>
                      <td className="p-2">82</td>
                      <td className="p-2 truncate max-w-xs">Hello Packet (Area 0.0.0.0, Priority 1, Dead 40s)</td>
                    </tr>
                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                      <td className="p-2">3</td>
                      <td className="p-2">0.281944</td>
                      <td className="p-2">10.0.0.1</td>
                      <td className="p-2">10.0.0.2</td>
                      <td className="p-2 text-cyan-600 dark:text-cyan-400 font-bold">OSPF</td>
                      <td className="p-2">66</td>
                      <td className="p-2 truncate max-w-xs">DB Description (Init, More, Master)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {activeModule.contentMarkdown}
              </div>
            </div>
          )}

          {/* Quiz Module */}
          {activeModule.type === 'quiz' && activeModule.quiz && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {activeModule.title}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Passing Benchmark: {activeModule.quiz.passingScore}% • {activeModule.quiz.questions.length} Questions
                  </p>
                </div>

                {quizSubmitted && (
                  <div className={`px-4 py-2 rounded-xl text-xs font-mono font-bold ${
                    quizScore >= activeModule.quiz.passingScore
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  }`}>
                    Score: {quizScore}% {quizScore >= activeModule.quiz.passingScore ? '(Passed!)' : '(Try Again)'}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {activeModule.quiz.questions.map((q, qIndex) => {
                  const userAnswer = selectedAnswers[q.id];
                  const isCorrect = userAnswer === q.correctAnswerIndex;

                  return (
                    <div key={q.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {qIndex + 1}. {q.question}
                      </p>

                      <div className="space-y-2">
                        {q.options.map((opt, optIndex) => {
                          const isSelected = userAnswer === optIndex;
                          let optClass = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400';

                          if (quizSubmitted) {
                            if (optIndex === q.correctAnswerIndex) {
                              optClass = 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                            } else if (isSelected) {
                              optClass = 'bg-red-50 dark:bg-red-950/80 border-red-500 text-red-800 dark:text-red-300';
                            }
                          } else if (isSelected) {
                            optClass = 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-cyan-300 font-medium';
                          }

                          return (
                            <div
                              key={optIndex}
                              onClick={() => {
                                if (!quizSubmitted) {
                                  setSelectedAnswers(prev => ({ ...prev, [q.id]: optIndex }));
                                }
                              }}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${optClass}`}
                            >
                              <span>{opt}</span>
                              {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                            </div>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          💡 <em>Explanation:</em> {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {!quizSubmitted ? (
                <button
                  onClick={handleQuizSubmit}
                  disabled={Object.keys(selectedAnswers).length < activeModule.quiz.questions.length}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition-all"
                >
                  Submit Assessment Answers
                </button>
              ) : (
                <button
                  onClick={() => {
                    setQuizSubmitted(false);
                    setSelectedAnswers({});
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Retake Assessment
                </button>
              )}
            </div>
          )}

          {/* Bottom Next/Previous Step Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <button
              onClick={handlePrevModule}
              disabled={activeModuleIndex === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Module</span>
            </button>

            <button
              onClick={handleNextModule}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <span>{activeModuleIndex === course.modules.length - 1 ? 'Finish & Generate Certificate' : 'Complete & Next Module'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
