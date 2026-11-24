import React, { useEffect, useMemo, useState } from 'react';
import { Binary, BookOpen, Check, Copy, Search, Table2, X } from 'lucide-react';
import { intToIp, prefixToMaskInt } from '../../utils/vlsmTree';

interface SubnetQuickReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCidr: number;
  onApplyCidr?: (cidr: number) => void;
}

type ReferenceTab = 'cidr' | 'binary';

interface CidrRow {
  prefix: number;
  mask: string;
  wildcard: string;
  blockSizeLabel: string;
  totalAddresses: number;
  usableHosts: number;
  classLabel: string;
}

interface BinaryOctetRow {
  networkBits: number;
  hostBits: number;
  binary: string;
  decimalValue: number;
  blockSize: number;
  classCCidr: string;
}

const BIT_WEIGHTS = [
  { bitPos: 7, value: 128 },
  { bitPos: 6, value: 64 },
  { bitPos: 5, value: 32 },
  { bitPos: 4, value: 16 },
  { bitPos: 3, value: 8 },
  { bitPos: 2, value: 4 },
  { bitPos: 1, value: 2 },
  { bitPos: 0, value: 1 }
];

const BINARY_OCTET_ROWS: BinaryOctetRow[] = Array.from({ length: 9 }, (_, bits) => {
  const decimalValue = bits === 0 ? 0 : (0xff << (8 - bits)) & 0xff;
  return {
    networkBits: bits,
    hostBits: 8 - bits,
    binary: '1'.repeat(bits) + '0'.repeat(8 - bits),
    decimalValue,
    blockSize: 256 - decimalValue,
    classCCidr: `/${24 + bits}`
  };
});

const POWER_OF_TWO_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16].map(exp => {
  const total = Math.pow(2, exp);
  return {
    exp,
    total,
    usable: Math.max(0, total - 2),
    cidr: 32 - exp
  };
});

export const SubnetQuickReferenceModal: React.FC<SubnetQuickReferenceModalProps> = ({
  isOpen,
  onClose,
  activeCidr,
  onApplyCidr
}) => {
  const [activeTab, setActiveTab] = useState<ReferenceTab>('cidr');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMask, setCopiedMask] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cidrRows = useMemo<CidrRow[]>(() => {
    const prefixes = [
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
      29, 30, 31, 32
    ];

    return prefixes.map(prefix => {
      const maskInt = prefixToMaskInt(prefix);
      const wildcardInt = ~maskInt >>> 0;
      const totalAddresses = Math.pow(2, 32 - prefix);
      const usableHosts =
        prefix === 32 ? 1 : prefix === 31 ? 2 : Math.max(0, totalAddresses - 2);
      const interestingOctet =
        Math.min(4, Math.floor(prefix / 8) + (prefix % 8 === 0 ? 0 : 1)) || 1;
      const bitsInOctet = prefix % 8 === 0 ? 8 : prefix % 8;
      const blockSizeInOctet = Math.pow(2, 8 - bitsInOctet);

      let classLabel = 'Class C / Host';
      if (prefix < 16) classLabel = 'Class A / Supernet';
      else if (prefix < 24) classLabel = 'Class B / Campus';

      return {
        prefix,
        mask: intToIp(maskInt),
        wildcard: intToIp(wildcardInt),
        blockSizeLabel: `${blockSizeInOctet} (Octet ${interestingOctet})`,
        totalAddresses,
        usableHosts,
        classLabel
      };
    });
  }, []);

  const filteredCidrRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cidrRows;
    return cidrRows.filter(
      row =>
        `/${row.prefix}`.includes(q) ||
        String(row.prefix) === q ||
        row.mask.includes(q) ||
        row.wildcard.includes(q) ||
        row.usableHosts.toString().includes(q)
    );
  }, [cidrRows, searchQuery]);

  const handleCopyMask = (mask: string) => {
    navigator.clipboard.writeText(mask);
    setCopiedMask(mask);
    window.setTimeout(() => setCopiedMask(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subnet-quick-ref-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="subnet-quick-ref-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Subnetting Quick Reference
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instant CIDR mask conversions, wildcard masks, and 8-bit binary octet lookup values.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Subnetting Quick Reference"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs & Filter Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Quick reference sections"
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cidr'}
              onClick={() => setActiveTab('cidr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'cidr'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>CIDR Mask Table</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'binary'}
              onClick={() => setActiveTab('binary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'binary'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              <span>Binary Octet Values</span>
            </button>
          </div>

          {activeTab === 'cidr' && (
            <div className="relative flex-1 sm:flex-none sm:w-64 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter /26, 255.255.255.192..."
                aria-label="Filter CIDR table"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'cidr' ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/70 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">CIDR</th>
                      <th className="py-2.5 px-3 font-semibold">Subnet Mask</th>
                      <th className="py-2.5 px-3 font-semibold">Wildcard Mask</th>
                      <th className="py-2.5 px-3 font-semibold">Block Size</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Usable Hosts</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCidrRows.map(row => {
                      const isActive = row.prefix === activeCidr;
                      return (
                        <tr
                          key={row.prefix}
                          className={
                            isActive
                              ? 'bg-blue-50/80 dark:bg-blue-950/35'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                          }
                        >
                          <td className="py-2 px-3 font-mono font-bold tabular-nums text-blue-600 dark:text-cyan-400 whitespace-nowrap">
                            /{row.prefix}
                            {isActive && (
                              <span className="ml-2 text-[10px] font-sans font-semibold text-emerald-600 dark:text-emerald-400">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <span>{row.mask}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyMask(row.mask)}
                                aria-label={`Copy mask ${row.mask}`}
                                className="p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400"
                              >
                                {copiedMask === row.mask ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {row.wildcard}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {row.blockSizeLabel}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {row.usableHosts.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {onApplyCidr && (
                              <button
                                type="button"
                                onClick={() => {
                                  onApplyCidr(row.prefix);
                                  onClose();
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                  isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-cyan-400'
                                }`}
                              >
                                Apply /{row.prefix}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCidrRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                        >
                          No CIDR entries match "{searchQuery}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 8-Bit Place Value Strip */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    8-Bit Octet Place Values (MSB to LSB)
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Sum of all 8 bits = 255
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {BIT_WEIGHTS.map(bit => (
                    <div
                      key={bit.bitPos}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center"
                    >
                      <span className="text-[10px] font-mono text-slate-400 block">
                        2^{bit.bitPos}
                      </span>
                      <span className="text-sm font-mono font-bold tabular-nums text-blue-600 dark:text-cyan-400">
                        {bit.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Binary Subnet Mask Octet Progression */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Contiguous Subnet Mask Octet Values
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-900/40 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Network Bits</th>
                        <th className="py-2 px-3 font-semibold">Host Bits</th>
                        <th className="py-2 px-3 font-semibold">8-Bit Binary</th>
                        <th className="py-2 px-3 font-semibold text-right">Decimal</th>
                        <th className="py-2 px-3 font-semibold text-right">Block Size</th>
                        <th className="py-2 px-3 font-semibold text-right">Class C CIDR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {BINARY_OCTET_ROWS.map(row => (
                        <tr key={row.networkBits} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-mono font-semibold tabular-nums text-blue-600 dark:text-cyan-400">
                            {row.networkBits}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-amber-600 dark:text-amber-400">
                            {row.hostBits}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                            <span className="text-blue-700 dark:text-cyan-300 font-bold">
                              {row.binary.slice(0, row.networkBits)}
                            </span>
                            <span className="text-amber-600 dark:text-amber-400">
                              {row.binary.slice(row.networkBits)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                            {row.decimalValue}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {row.blockSize}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                            {row.classCCidr}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Powers of 2 Quick Table */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Powers of 2 (Host Capacity Shortcut: 2^h - 2)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {POWER_OF_TWO_ROWS.map(item => (
                    <div
                      key={item.exp}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>2^{item.exp}</span>
                        <span>/{item.cidr}</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {item.total.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {item.usable.toLocaleString()} hosts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Tip: Click <strong className="text-slate-700 dark:text-slate-200">Apply</strong> on any CIDR row to load that mask directly into the calculator.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
