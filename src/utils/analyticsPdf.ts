import { jsPDF } from 'jspdf';
import {
  Course,
  LMSConfig,
  RealtimeActivityItem,
  StudentProgressRecord,
} from '../types';

export interface AnalyticsPdfReportInput {
  generatedByName: string;
  generatedByRole: string;
  scopeLabel?: string;
  courses: Course[];
  studentProgressList: StudentProgressRecord[];
  allStudentProgressCount: number;
  activityFeed: RealtimeActivityItem[];
  lmsConfigs: LMSConfig[];
}

function pdfSafeText(value: string): string {
  return (value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateToFit(doc: jsPDF, text: string, maxWidth: number): string {
  const safe = pdfSafeText(text);
  if (doc.getTextWidth(safe) <= maxWidth) return safe;
  let trimmed = safe;
  while (trimmed.length > 3 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

export async function exportAnalyticsReportToPdf(
  input: AnalyticsPdfReportInput
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF export is only available in a browser environment.');
  }

  const {
    generatedByName,
    generatedByRole,
    scopeLabel = 'All Curriculums - All Student Statuses',
    courses,
    studentProgressList,
    allStudentProgressCount,
    activityFeed,
    lmsConfigs,
  } = input;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  const bottomLimit = pageHeight - 18;

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const formattedTimestamp = `${dateStamp} ${now.toTimeString().slice(0, 5)}`;

  doc.setProperties({
    title: `Netplus Academy Analytics Report (${dateStamp})`,
    subject: 'Student Progress and Academy Performance Report',
    author: pdfSafeText(generatedByName || 'Netplus Academy Administrator'),
    keywords: 'analytics,student progress,netplus academy,performance report',
  });

  let y = 0;

  const drawContinuationHeader = (sectionLabel: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 16, 'F');
    doc.setFillColor(8, 145, 178);
    doc.rect(0, 15.2, pageWidth, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('NETPLUS ACADEMY - PERFORMANCE & STUDENT PROGRESS REPORT', marginX, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafeText(sectionLabel), pageWidth - marginX, 10, { align: 'right' });

    y = 24;
  };

  const ensureSpace = (neededHeight: number, continuationTitle: string) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      drawContinuationHeader(continuationTitle);
      return true;
    }
    return false;
  };

  // 1. Page 1 Executive Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 36.5, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(34, 211, 238);
  doc.text('NETPLUS NETWORKING ACADEMY  |  ADMINISTRATOR REPORT', marginX, 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('Academy Performance & Student Progress Report', marginX, 20.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    pdfSafeText(
      `Generated: ${formattedTimestamp}   |   Prepared By: ${generatedByName} (${generatedByRole.toUpperCase()})`
    ),
    marginX,
    28
  );
  doc.setTextColor(148, 163, 184);
  doc.text(pdfSafeText(`Filter Scope: ${scopeLabel}`), marginX, 33.2);

  y = 46;

  // 2. KPI Summary Cards (4 crisp executive KPI blocks)
  const totalEnrollments = courses.reduce((acc, c) => acc + c.enrolledCount, 0);
  const completedCount = studentProgressList.filter(p => p.progressPercent === 100).length;
  const avgProgress = Math.round(
    studentProgressList.reduce((acc, p) => acc + p.progressPercent, 0) /
      (studentProgressList.length || 1)
  );
  const avgQuiz = Math.round(
    studentProgressList.reduce((acc, p) => acc + p.quizAverage, 0) /
      (studentProgressList.length || 1)
  );
  const totalStudyHours = studentProgressList.reduce((acc, p) => acc + p.timeSpentHours, 0);
  const connectedLmsCount = lmsConfigs.filter(c => c.connected).length;

  const kpis = [
    {
      label: 'TOTAL ENROLLMENTS',
      value: totalEnrollments.toLocaleString(),
      sub: `${courses.length} active tracks`,
      accent: [37, 99, 235] as [number, number, number],
    },
    {
      label: 'COHORT AVG PROGRESS',
      value: `${avgProgress}%`,
      sub: `${completedCount}/${studentProgressList.length} completed`,
      accent: [5, 150, 105] as [number, number, number],
    },
    {
      label: 'AVERAGE QUIZ SCORE',
      value: `${avgQuiz}%`,
      sub: 'Assessment benchmark',
      accent: [124, 58, 237] as [number, number, number],
    },
    {
      label: 'LOGGED LAB HOURS',
      value: `${totalStudyHours.toFixed(1)}h`,
      sub: `${connectedLmsCount}/${lmsConfigs.length} LMS synced`,
      accent: [8, 145, 178] as [number, number, number],
    },
  ];

  const cardGap = 3.5;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const cardH = 22;

  kpis.forEach((kpi, idx) => {
    const cx = marginX + idx * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');

    doc.setFillColor(kpi.accent[0], kpi.accent[1], kpi.accent[2]);
    doc.rect(cx, y, cardW, 1.4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cx + 3.5, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, cx + 3.5, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(truncateToFit(doc, kpi.sub, cardW - 7), cx + 3.5, y + 19.2);
  });

  y += cardH + 8;

  // 3. Performance Distribution Summary Bar
  const honorsCount = studentProgressList.filter(p => p.quizAverage >= 90).length;
  const passCount = studentProgressList.filter(
    p => p.quizAverage >= 80 && p.quizAverage < 90
  ).length;
  const assistCount = studentProgressList.filter(p => p.quizAverage < 80).length;
  const cohortTotal = studentProgressList.length || 1;
  const honorsPct = studentProgressList.length
    ? Math.round((honorsCount / cohortTotal) * 100)
    : 0;
  const passPct = studentProgressList.length
    ? Math.round((passCount / cohortTotal) * 100)
    : 0;
  const assistPct = studentProgressList.length
    ? Math.max(0, 100 - honorsPct - passPct)
    : 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Assessment Tier Distribution', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Based on ${studentProgressList.length} of ${allStudentProgressCount} tracked student enrollment records`,
    marginX,
    y + 4.5
  );
  y += 7.5;

  const tierGap = 3.5;
  const tierW = (contentWidth - tierGap * 2) / 3;
  const tiers = [
    {
      title: 'HONORS TIER (>= 90%)',
      val: `${honorsPct}% (${honorsCount} learners)`,
      color: [5, 150, 105] as [number, number, number],
      bg: [236, 253, 245] as [number, number, number],
    },
    {
      title: 'STANDARD PASS (80-89%)',
      val: `${passPct}% (${passCount} learners)`,
      color: [37, 99, 235] as [number, number, number],
      bg: [239, 246, 255] as [number, number, number],
    },
    {
      title: 'LAB ASSISTANCE (< 80%)',
      val: `${assistPct}% (${assistCount} learners)`,
      color: [217, 119, 6] as [number, number, number],
      bg: [255, 251, 235] as [number, number, number],
    },
  ];

  tiers.forEach((tier, idx) => {
    const tx = marginX + idx * (tierW + tierGap);
    doc.setFillColor(tier.bg[0], tier.bg[1], tier.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(tx, y, tierW, 13.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(tier.title, tx + 3.5, y + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(tier.color[0], tier.color[1], tier.color[2]);
    doc.text(tier.val, tx + 3.5, y + 10.6);
  });

  y += 20;

  // 4. Curriculum Enrollment Breakdown
  ensureSpace(26, 'Curriculum Distribution');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Curriculum Enrollment & Completion Breakdown', marginX, y);
  y += 5;

  const drawCourseHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('COURSE CODE', marginX + 2.5, y + 5);
    doc.text('CURRICULUM TITLE', marginX + 34, y + 5);
    doc.text('LEVEL', marginX + 114, y + 5);
    doc.text('ENROLLED', marginX + 150, y + 5, { align: 'right' });
    doc.text('SHARE', marginX + contentWidth - 2.5, y + 5, { align: 'right' });
    y += 7.5;
  };

  drawCourseHeader();

  courses.forEach((course, idx) => {
    if (ensureSpace(9, 'Curriculum Distribution (Continued)')) {
      drawCourseHeader();
    }
    const share = Math.round((course.enrolledCount / (totalEnrollments || 1)) * 100);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, contentWidth, 8.5, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y + 8.5, marginX + contentWidth, y + 8.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text(truncateToFit(doc, course.code, 29), marginX + 2.5, y + 5.6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(truncateToFit(doc, course.title, 77), marginX + 34, y + 5.6);

    doc.setTextColor(71, 85, 105);
    doc.text(truncateToFit(doc, course.level, 22), marginX + 114, y + 5.6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(course.enrolledCount.toLocaleString(), marginX + 150, y + 5.6, {
      align: 'right',
    });

    // Small share bar + percentage
    const barX = marginX + 154;
    const barW = 16;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y + 3.1, barW, 2.3, 1, 1, 'F');
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(barX, y + 3.1, Math.max(1.2, (barW * share) / 100), 2.3, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${share}%`, marginX + contentWidth - 2.5, y + 5.6, { align: 'right' });

    y += 8.5;
  });

  y += 9;

  // 5. Student Progress & Performance Table
  ensureSpace(26, 'Student Progress & Performance Roster');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Student Progress & Performance Roster', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${studentProgressList.length} records included`, marginX + contentWidth, y, {
    align: 'right',
  });
  y += 4.5;

  const drawStudentTableHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text('STUDENT', marginX + 2.5, y + 5.3);
    doc.text('COURSE', marginX + 56, y + 5.3);
    doc.text('MODULES', marginX + 88, y + 5.3);
    doc.text('PROGRESS', marginX + 109, y + 5.3);
    doc.text('QUIZ', marginX + 139, y + 5.3, { align: 'right' });
    doc.text('TIME', marginX + 152, y + 5.3, { align: 'right' });
    doc.text('STATUS', marginX + 162, y + 5.3);
    doc.text('LAST ACTIVE', marginX + contentWidth - 2.5, y + 5.3, { align: 'right' });
    y += 8;
  };

  drawStudentTableHeader();

  if (studentProgressList.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, y, contentWidth, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'No student enrollment progress records match the selected filters.',
      marginX + contentWidth / 2,
      y + 7.5,
      { align: 'center' }
    );
    y += 14;
  } else {
    studentProgressList.forEach((record, idx) => {
      const rowH = 11.5;
      if (ensureSpace(rowH, 'Student Progress & Performance Roster (Continued)')) {
        drawStudentTableHeader();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowH, marginX + contentWidth, y + rowH);

      // Student name + email
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(truncateToFit(doc, record.studentName, 50), marginX + 2.5, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(truncateToFit(doc, record.studentEmail, 50), marginX + 2.5, y + 9);

      // Course code
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(37, 99, 235);
      doc.text(truncateToFit(doc, record.courseCode, 29), marginX + 56, y + 6.7);

      // Modules ratio
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `${record.completedModulesCount}/${record.totalModulesCount}`,
        marginX + 88,
        y + 6.7
      );

      // Progress bar + %
      const pBarX = marginX + 109;
      const pBarW = 14;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(pBarX, y + 4.6, pBarW, 2.2, 0.8, 0.8, 'F');
      if (record.progressPercent === 100) {
        doc.setFillColor(5, 150, 105);
      } else if (record.status === 'behind') {
        doc.setFillColor(217, 119, 6);
      } else {
        doc.setFillColor(37, 99, 235);
      }
      if (record.progressPercent > 0) {
        doc.roundedRect(
          pBarX,
          y + 4.6,
          Math.max(1.2, (pBarW * Math.min(100, record.progressPercent)) / 100),
          2.2,
          0.8,
          0.8,
          'F'
        );
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${record.progressPercent}%`, pBarX + pBarW + 1.8, y + 6.6);

      // Quiz average
      if (record.quizAverage >= 90) {
        doc.setTextColor(5, 150, 105);
      } else if (record.quizAverage >= 80) {
        doc.setTextColor(37, 99, 235);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.text(`${record.quizAverage}%`, marginX + 139, y + 6.7, { align: 'right' });

      // Time spent
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`${record.timeSpentHours.toFixed(1)}h`, marginX + 152, y + 6.7, {
        align: 'right',
      });

      // Status
      const statusLabel =
        record.status.charAt(0).toUpperCase() + record.status.slice(1);
      doc.setFont('helvetica', 'bold');
      if (record.status === 'completed') {
        doc.setTextColor(5, 150, 105);
      } else if (record.status === 'active') {
        doc.setTextColor(37, 99, 235);
      } else if (record.status === 'behind') {
        doc.setTextColor(217, 119, 6);
      } else {
        doc.setTextColor(100, 116, 139);
      }
      doc.text(statusLabel, marginX + 162, y + 6.7);

      // Last active
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(
        truncateToFit(doc, record.lastActive, 20),
        marginX + contentWidth - 2.5,
        y + 6.7,
        { align: 'right' }
      );

      y += rowH;
    });
  }

  // 6. Recent Telemetry & LMS Integrations Snapshot
  if (activityFeed.length > 0 || lmsConfigs.length > 0) {
    y += 8;
    ensureSpace(34, 'Telemetry & LMS Integrations');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Recent Learner Activity & External LMS Summary', marginX, y);
    y += 5;

    const recentItems = activityFeed.slice(0, 5);
    recentItems.forEach((act) => {
      ensureSpace(6, 'Telemetry & LMS Integrations');
      const actionVerb =
        act.action === 'finished_lab'
          ? 'completed lab'
          : act.action === 'passed_quiz'
          ? 'passed assessment'
          : act.action === 'earned_certificate'
          ? 'earned certificate for'
          : act.action === 'completed_module'
          ? 'completed module in'
          : 'enrolled in';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(51, 65, 85);
      doc.text(
        truncateToFit(
          doc,
          `- ${act.studentName} ${actionVerb} ${act.target} (${act.timestamp})`,
          contentWidth
        ),
        marginX + 1,
        y + 3.5
      );
      y += 5.2;
    });

    if (lmsConfigs.length > 0) {
      y += 2;
      ensureSpace(8, 'Telemetry & LMS Integrations');
      const connectedNames = lmsConfigs
        .filter(c => c.connected)
        .map(c => `${c.name} (${c.syncedStudentsCount} synced)`)
        .join(' | ');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        truncateToFit(
          doc,
          `Connected LMS Endpoints: ${connectedNames || 'None currently connected'}`,
          contentWidth
        ),
        marginX + 1,
        y + 3.5
      );
    }
  }

  // Stamp consistent footers with page numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let pageIdx = 1; pageIdx <= totalPages; pageIdx++) {
    doc.setPage(pageIdx);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 13, marginX + contentWidth, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Netplus Academy Analytics Report  |  Generated ${dateStamp}`,
      marginX,
      pageHeight - 8.2
    );
    doc.text(
      `Page ${pageIdx} of ${totalPages}`,
      marginX + contentWidth,
      pageHeight - 8.2,
      { align: 'right' }
    );
  }

  const filename = `Netplus-Academy-Analytics-Report-${dateStamp}.pdf`;
  doc.save(filename);
  return filename;
}
