import React, { useState } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  X, 
  Sparkles, 
  FileText, 
  Download,
  AlertCircle
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { SubscriptionTier } from '../../types';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: SubscriptionTier;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  defaultPlan = 'pro'
}) => {
  const { upgradeSubscription, currentUser } = useAcademy();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>(defaultPlan === 'free' ? 'pro' : defaultPlan);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Form Fields
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('883');
  const [cardholderName, setCardholderName] = useState(currentUser.name);
  const [billingZip, setBillingZip] = useState('94107');

  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'pro' as SubscriptionTier,
      name: 'Netplus Pro',
      priceMonthly: 29,
      priceAnnual: 290,
      badge: 'Most Popular',
      features: [
        'Unlimited Interactive Cisco IOS Labs',
        'NetGenius AI Tutor (24/7 CCIE Support)',
        'Automated Verifiable Certificates',
        'Subnetting & VLSM Sandbox',
        'Offline Content Caching'
      ]
    },
    {
      id: 'expert' as SubscriptionTier,
      name: 'Netplus Expert',
      priceMonthly: 59,
      priceAnnual: 590,
      badge: 'Best Value',
      features: [
        'Everything in Pro Tier',
        'Wireshark PCAP Packet Forensics Suite',
        'Multi-Cloud AWS & SD-WAN Topologies',
        'Bi-Weekly CCIE Office Hours Live',
        'Priority Lab Server Hardware'
      ]
    },
    {
      id: 'enterprise' as SubscriptionTier,
      name: 'Academy Team',
      priceMonthly: 199,
      priceAnnual: 1990,
      badge: 'Institutions',
      features: [
        'Everything in Expert Tier',
        'External LMS Integration (Canvas / LTI)',
        'Admin Roster Management & Analytics',
        'Custom Lab Authoring Engine',
        'Dedicated Enterprise SLA'
      ]
    }
  ];

  const currentPlanObj = plans.find(p => p.id === selectedPlan) || plans[0];
  const price = billingCycle === 'annual' ? currentPlanObj.priceAnnual : currentPlanObj.priceMonthly;

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const data = await upgradeSubscription(selectedPlan, billingCycle, cardNumber.slice(-4));
      setReceipt(data);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Secure Subscription Checkout
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                256-bit SSL Encrypted • PCI-DSS Level 1 Gateway
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!receipt ? (
          <>
            {/* Plan selector pills */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Subscription Tier:
                </span>
                
                {/* Billing Cycle Switcher */}
                <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      billingCycle === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      billingCycle === 'annual' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500'
                    }`}
                  >
                    Annual (Save 20%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map(p => {
                  const isSelected = selectedPlan === p.id;
                  const planCost = billingCycle === 'annual' ? p.priceAnnual : p.priceMonthly;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlan(p.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                        {p.badge && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
                        ${planCost}
                        <span className="text-xs font-normal text-slate-500">
                          {billingCycle === 'annual' ? '/yr' : '/mo'}
                        </span>
                      </p>
                      <ul className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {p.features.slice(0, 3).map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="truncate">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Details Form */}
            <form onSubmit={handleProcessPayment} className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Payment Card Information:
                </span>
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>Encrypted end-to-end</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  required
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Card Number (Simulation)
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Expires (MM/YY)
                  </label>
                  <input
                    type="text"
                    required
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="12/28"
                    className="w-full px-3 py-2 rounded-xl font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    CVC / CVV
                  </label>
                  <input
                    type="text"
                    required
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="883"
                    className="w-full px-3 py-2 rounded-xl font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Total & Submit */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-mono">Billed Today</span>
                  <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    ${price}.00 USD
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Authorizing Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Confirm & Activate Subscription</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Payment Receipt Screen */
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-4 ring-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Subscription Successfully Activated!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Welcome to Netplus <strong>{selectedPlan.toUpperCase()}</strong>. Your Cisco CLI lab sessions, AI tutor access, and certificate generation are now active.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left text-xs font-mono space-y-1.5 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{receipt.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice Number:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{receipt.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Charged:</span>
                <span className="font-bold text-emerald-500">${receipt.amount}.00 USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Method:</span>
                <span className="text-slate-800 dark:text-slate-200">Card ending in {receipt.cardLast4}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md"
            >
              Done & Return to Academy
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
