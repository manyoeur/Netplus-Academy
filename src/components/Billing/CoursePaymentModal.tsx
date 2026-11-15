import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Wallet,
  Lock,
  CheckCircle2,
  X,
  Download,
  ArrowRight,
  Clock,
  BookOpen,
  Calendar,
  Tag,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Course, CoursePaymentMethod, CoursePaymentRecord } from '../../types';
import { useAcademy } from '../../context/AcademyContext';
import { CourseThumbnail } from '../Courses/CourseThumbnail';
import { DEFAULT_ENROLLMENT_DAYS } from '../../utils/enrollmentDates';

interface CoursePaymentModalProps {
  course: Course | null;
  initialReceipt?: CoursePaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (course: Course, payment: CoursePaymentRecord) => void;
}

const PROMO_RATES: Record<string, number> = {
  NETPLUS20: 0.2,
  STUDENT10: 0.1,
  CCNA50: 0.5
};

export const CoursePaymentModal: React.FC<CoursePaymentModalProps> = ({
  course,
  initialReceipt = null,
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const { currentUser, completeCoursePaymentAndEnroll } = useAcademy();

  const [paymentMethod, setPaymentMethod] = useState<CoursePaymentMethod>('card');
  const [billingName, setBillingName] = useState(currentUser.name);
  const [billingEmail, setBillingEmail] = useState(currentUser.email);

  // Card inputs
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('883');

  // PayPal / Bank Transfer inputs
  const [paypalEmail, setPaypalEmail] = useState(currentUser.email);
  const [bankReference, setBankReference] = useState('');

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoFeedback, setPromoFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CoursePaymentRecord | null>(initialReceipt);

  useEffect(() => {
    if (isOpen) {
      setReceipt(initialReceipt || null);
      setBillingName(currentUser.name);
      setBillingEmail(currentUser.email);
      setPaypalEmail(currentUser.email);
      setBankReference(`NP-${Math.floor(100000 + Math.random() * 900000)}`);
      setPromoInput('');
      setAppliedPromo(null);
      setPromoFeedback(null);
      setFormError(null);
      setProcessing(false);
    }
  }, [isOpen, course?.id, initialReceipt, currentUser.name, currentUser.email]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, processing, onClose]);

  if (!isOpen || (!course && !receipt)) return null;

  const basePrice = Math.max(0, Number(course?.price ?? receipt?.originalPrice ?? 0));
  const discountRate = appliedPromo ? PROMO_RATES[appliedPromo] || 0 : 0;
  const discountAmount = Math.min(basePrice, Math.round(basePrice * discountRate * 100) / 100);
  const totalDue = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);
  const accessDays = course?.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS;

  const handleApplyPromo = () => {
    const clean = promoInput.trim().toUpperCase();
    if (!clean) {
      setAppliedPromo(null);
      setPromoFeedback(null);
      return;
    }
    if (PROMO_RATES[clean]) {
      const pct = Math.round(PROMO_RATES[clean] * 100);
      setAppliedPromo(clean);
      setPromoFeedback({ type: 'ok', text: `${clean} applied (${pct}% student discount)` });
    } else {
      setAppliedPromo(null);
      setPromoFeedback({
        type: 'err',
        text: 'Code not recognized. Try NETPLUS20, STUDENT10, or CCNA50.'
      });
    }
  };

  const formatCardNumberInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiryInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setFormError(null);

    if (!billingName.trim()) {
      setFormError('Please enter your billing name.');
      return;
    }
    if (!billingEmail.trim() || !billingEmail.includes('@')) {
      setFormError('Please provide a valid receipt email address.');
      return;
    }

    if (totalDue > 0) {
      if (paymentMethod === 'card') {
        const digits = cardNumber.replace(/\D/g, '');
        if (digits.length < 12) {
          setFormError('Enter a valid card number (at least 12 digits).');
          return;
        }
        if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
          setFormError('Enter card expiration in MM/YY format.');
          return;
        }
        if (cardCvc.replace(/\D/g, '').length < 3) {
          setFormError('Enter a valid 3 or 4 digit security code (CVC).');
          return;
        }
      } else if (paymentMethod === 'paypal') {
        if (!paypalEmail.trim() || !paypalEmail.includes('@')) {
          setFormError('Enter the PayPal account email to authorize checkout.');
          return;
        }
      } else if (paymentMethod === 'bank_transfer') {
        if (bankReference.trim().length < 4) {
          setFormError('Enter your bank wire / transfer reference ID.');
          return;
        }
      }
    }

    setProcessing(true);
    try {
      const cardDigits = cardNumber.replace(/\D/g, '');
      const result = await completeCoursePaymentAndEnroll({
        courseId: course.id,
        paymentMethod,
        cardLast4: paymentMethod === 'card' ? (cardDigits.slice(-4) || '4242') : undefined,
        promoCode: appliedPromo || undefined,
        billingName: billingName.trim(),
        billingEmail: billingEmail.trim()
      });

      if (!result.success || !result.payment) {
        setFormError(result.error || 'Unable to process payment. Please try again.');
        return;
      }

      setReceipt(result.payment);
    } catch {
      setFormError('Unexpected error while completing checkout. Please retry.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receipt) return;
    const methodLabel =
      receipt.paymentMethod === 'card'
        ? `Credit / Debit Card (ending in ${receipt.cardLast4 || '4242'})`
        : receipt.paymentMethod === 'paypal'
        ? 'PayPal Digital Wallet'
        : 'Bank Transfer / Wire';

    const content = [
      'NETPLUS ACADEMY — OFFICIAL COURSE ENROLLMENT RECEIPT',
      '======================================================',
      `Invoice Number : ${receipt.invoiceNumber}`,
      `Transaction ID : ${receipt.transactionId}`,
      `Status         : ${receipt.status.toUpperCase()}`,
      `Paid Date      : ${new Date(receipt.paidAt).toLocaleString()}`,
      '',
      'STUDENT DETAILS',
      `Name           : ${receipt.studentName}`,
      `Email          : ${receipt.studentEmail}`,
      '',
      'COURSE ENROLLMENT',
      `Course Code    : ${receipt.courseCode}`,
      `Course Title   : ${receipt.courseTitle}`,
      `Access Window  : ${receipt.accessStartDate} to ${receipt.accessExpiresAt}`,
      '',
      'PAYMENT SUMMARY',
      `Course Tuition : $${receipt.originalPrice.toFixed(2)} USD`,
      ...(receipt.discountAmount > 0
        ? [`Promo (${receipt.promoCode || 'DISCOUNT'}) : -$${receipt.discountAmount.toFixed(2)} USD`]
        : []),
      `Amount Paid    : $${receipt.amountPaid.toFixed(2)} USD`,
      `Payment Method : ${methodLabel}`,
      '======================================================'
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receipt.invoiceNumber}-${receipt.courseCode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-checkout-heading"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-0 bg-white dark:bg-[#0c1220] z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              {receipt ? <CheckCircle2 className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2
                id="course-checkout-heading"
                className="text-base font-bold text-slate-900 dark:text-white truncate"
              >
                {receipt ? 'Course Enrollment Receipt' : 'Complete Course Payment & Enroll'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {receipt
                  ? `Invoice ${receipt.invoiceNumber} · ${receipt.courseCode}`
                  : 'Instant enrollment activation & full lab access upon payment'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Close payment modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!receipt && course ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Left Column: Course Order Summary */}
            <div className="lg:col-span-5 p-6 space-y-5 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="space-y-3">
                <CourseThumbnail
                  course={course}
                  showInstructorPortrait={false}
                  className="aspect-video rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono z-10">
                    <span className="font-bold text-cyan-300">{course.code}</span>
                    <span className="text-slate-200">{course.level}</span>
                  </div>
                </CourseThumbnail>

                <div className="space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {course.category} · {course.instructor.name}
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {course.title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {course.durationHours}h
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    {course.modules.length} modules
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {accessDays}d access
                  </span>
                </div>
              </div>

              {/* Promo Voucher Input */}
              {basePrice > 0 && (
                <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <label
                    htmlFor="course-promo-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Student Promo Code
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="course-promo-input"
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="NETPLUS20 or STUDENT10"
                        className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-mono uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {promoFeedback && (
                    <p
                      className={`text-[11px] font-medium ${
                        promoFeedback.type === 'ok'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {promoFeedback.text}
                    </p>
                  )}
                </div>
              )}

              {/* Itemized Tuition Breakdown */}
              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs tabular-nums">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Course Tuition</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                    ${basePrice.toFixed(2)} USD
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Promo ({appliedPromo})</span>
                    <span className="font-mono font-semibold">
                      -${discountAmount.toFixed(2)} USD
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Lab & Certificate Fee</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    Included
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">Total Due Today</span>
                  <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    ${totalDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Payment Form */}
            <form onSubmit={handleCheckoutSubmit} className="lg:col-span-7 p-6 space-y-5">
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Student Billing Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Student Billing Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Student Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Receipt Email
                    </label>
                    <input
                      type="email"
                      required
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method Tabs */}
              {totalDue > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Payment Method
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <Lock className="w-3 h-3 text-emerald-500" />
                      256-bit SSL Encrypted
                    </span>
                  </div>

                  <div
                    role="group"
                    aria-label="Select payment method"
                    className="grid grid-cols-3 gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        paymentMethod === 'card'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      <span>Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paypal')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        paymentMethod === 'paypal'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5 shrink-0" />
                      <span>PayPal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Bank / QR</span>
                    </button>
                  </div>

                  {paymentMethod === 'card' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Card Number
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            inputMode="numeric"
                            required
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                            placeholder="4242 4242 4242 4242"
                            className="w-full pl-9 pr-3 py-2 rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Expiration (MM/YY)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            required
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiryInput(e.target.value))}
                            placeholder="12/28"
                            className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Security Code (CVC)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            required
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="883"
                            className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'paypal' && (
                    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Confirm your PayPal account email below to authorize instant course enrollment settlement of{' '}
                        <strong className="font-mono tabular-nums">${totalDue.toFixed(2)} USD</strong>.
                      </p>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          PayPal Email
                        </label>
                        <input
                          type="email"
                          required
                          value={paypalEmail}
                          onChange={(e) => setPaypalEmail(e.target.value)}
                          placeholder="student@paypal.com"
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'bank_transfer' && (
                    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          Netplus Academy Treasury Account
                        </p>
                        <p className="font-mono text-[11px]">
                          Bank: ABA / Enterprise Clearing · Account: 001-882-9410 · Swift: ABAAKHPP
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Transfer Reference Number
                        </label>
                        <input
                          type="text"
                          required
                          value={bankReference}
                          onChange={(e) => setBankReference(e.target.value)}
                          placeholder="NP-123456"
                          className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Bar */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Instant course &amp; certificate unlock</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={processing}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    {processing ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Processing Payment...</span>
                      </>
                    ) : totalDue === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Free Enrollment</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span className="tabular-nums">Pay ${totalDue.toFixed(2)} &amp; Enroll</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : receipt ? (
          /* Payment Receipt View */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2 max-w-md mx-auto">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-4 ring-emerald-500/15">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Payment Complete · Enrollment Active
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You are officially enrolled in <strong>{receipt.courseTitle}</strong> ({receipt.courseCode}). Your curriculum, labs, and assessments are now unlocked.
              </p>
            </div>

            <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-800 text-xs tabular-nums">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {receipt.invoiceNumber}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Transaction ID</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {receipt.transactionId}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Course</span>
                <span className="font-semibold text-slate-900 dark:text-white text-right truncate">
                  {receipt.courseCode} · {receipt.courseTitle}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Student</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {receipt.studentName} ({receipt.studentEmail})
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Access Window</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {receipt.accessStartDate} to {receipt.accessExpiresAt}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Payment Method</span>
                <span className="text-slate-800 dark:text-slate-200 capitalize">
                  {receipt.paymentMethod === 'card'
                    ? `Card ending in ${receipt.cardLast4 || '4242'}`
                    : receipt.paymentMethod === 'paypal'
                    ? 'PayPal'
                    : 'Bank Transfer'}
                </span>
              </div>
              <div className="px-4 py-3.5 flex items-center justify-between bg-white/70 dark:bg-slate-900/80 rounded-b-2xl">
                <span className="font-bold text-slate-900 dark:text-white">Amount Paid</span>
                <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                  ${receipt.amountPaid.toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="max-w-lg mx-auto flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Receipt</span>
              </button>

              {course && onPaymentSuccess ? (
                <button
                  type="button"
                  onClick={() => onPaymentSuccess(course, receipt)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 whitespace-nowrap shrink-0 transition-all"
                >
                  <span>Start Course Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all whitespace-nowrap shrink-0"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
