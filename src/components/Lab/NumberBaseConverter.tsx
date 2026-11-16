import React, { useMemo, useState } from 'react';
import {
  Binary,
  Copy,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Award,
  AlertCircle,
  ArrowLeftRight,
  Cpu
} from 'lucide-react';

type ActiveInputSource = 'bin' | 'dec' | 'hex';
type WorkbenchMode = 'single' | 'ipv4';
type BitWidth = 8 | 16;

interface ParsedValue {
  valid: boolean;
  value: bigint | null;
  error: string | null;
}

interface DrillQuestion {
  prompt: string;
  helper: string;
  options: string[];
  correct: string;
  explanation: string;
}

const PRESETS: { label: string; dec: string; note: string }[] = [
  { label: '0', dec: '0', note: 'All bits zero' },
  { label: '10', dec: '10', note: 'Class A prefix' },
  { label: '128', dec: '128', note: 'MSB (/25 bit)' },
  { label: '172', dec: '172', note: 'RFC1918 start' },
  { label: '192', dec: '192', note: '/26 mask octet' },
  { label: '224', dec: '224', note: '/27 mask / Multicast' },
  { label: '255', dec: '255', note: 'Full 8-bit octet' },
  { label: '65535', dec: '65535', note: 'Max TCP/UDP port' }
];

function formatBinaryGrouped(binStr: string, minBits = 8): string {
  const clean = binStr.replace(/^0+/, '') || '0';
  const targetLen = Math.max(minBits, Math.ceil(clean.length / 4) * 4);
  const padded = clean.padStart(targetLen, '0');
  return padded.replace(/(.{4})(?=.)/g, '$1 ');
}

function parseBaseInput(raw: string, source: ActiveInputSource): ParsedValue {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, value: null, error: 'Enter a value to convert.' };
  }

  if (source === 'bin') {
    const cleaned = trimmed.replace(/^0[bB]/, '').replace(/[\s_.-]/g, '');
    if (!cleaned || !/^[01]+$/.test(cleaned)) {
      return {
        valid: false,
        value: null,
        error: 'Binary accepts only 0 and 1 digits (optional 0b prefix or spaces).'
      };
    }
    try {
      return { valid: true, value: BigInt(`0b${cleaned}`), error: null };
    } catch {
      return { valid: false, value: null, error: 'Unable to parse binary value.' };
    }
  }

  if (source === 'dec') {
    const cleaned = trimmed.replace(/[\s,_]/g, '');
    if (!cleaned || !/^\d+$/.test(cleaned)) {
      return {
        valid: false,
        value: null,
        error: 'Decimal accepts unsigned whole digits 0–9 only.'
      };
    }
    try {
      return { valid: true, value: BigInt(cleaned), error: null };
    } catch {
      return { valid: false, value: null, error: 'Unable to parse decimal value.' };
    }
  }

  const cleaned = trimmed.replace(/^0[xX]/, '').replace(/[\s_:.-]/g, '').toUpperCase();
  if (!cleaned || !/^[0-9A-F]+$/.test(cleaned)) {
    return {
      valid: false,
      value: null,
      error: 'Hexadecimal accepts digits 0–9 and letters A–F (optional 0x prefix).'
    };
  }
  try {
    return { valid: true, value: BigInt(`0x${cleaned}`), error: null };
  } catch {
    return { valid: false, value: null, error: 'Unable to parse hexadecimal value.' };
  }
}

function generateDrillQuestion(): DrillQuestion {
  const kind = Math.floor(Math.random() * 4);
  const num = Math.floor(Math.random() * 240) + 12; // 12..251
  const bin = num.toString(2).padStart(8, '0');
  const hex = num.toString(16).toUpperCase().padStart(2, '0');

  const uniqueWrong = (correct: string, generator: (offset: number) => string): string[] => {
    const set = new Set<string>([correct]);
    const offsets = [1, -1, 2, -2, 4, 8, 16, -8, 12, -4, 3, 5];
    let idx = 0;
    while (set.size < 4 && idx < offsets.length) {
      const candidate = generator(offsets[idx]);
      if (candidate !== correct) set.add(candidate);
      idx += 1;
    }
    return Array.from(set).sort(() => Math.random() - 0.5);
  };

  if (kind === 0) {
    // Binary -> Decimal
    const activePowers = bin
      .split('')
      .map((bit, idx) => (bit === '1' ? `${Math.pow(2, 7 - idx)}` : null))
      .filter(Boolean)
      .join(' + ');
    return {
      prompt: `Convert 8-bit binary ${bin.slice(0, 4)} ${bin.slice(4)} to Decimal:`,
      helper: 'Base-2 → Base-10',
      options: uniqueWrong(String(num), off => String(Math.max(0, Math.min(255, num + off)))),
      correct: String(num),
      explanation: `Add active bit weights: ${activePowers} = ${num}.`
    };
  }

  if (kind === 1) {
    // Decimal -> Binary
    return {
      prompt: `Convert decimal ${num} to an 8-bit Binary byte:`,
      helper: 'Base-10 → Base-2',
      options: uniqueWrong(bin, off =>
        Math.max(0, Math.min(255, num + off))
          .toString(2)
          .padStart(8, '0')
      ),
      correct: bin,
      explanation: `${num} splits into ${bin.slice(0, 4)} ${bin.slice(4)} across powers 128..1.`
    };
  }

  if (kind === 2) {
    // Binary -> Hex
    const highNib = bin.slice(0, 4);
    const lowNib = bin.slice(4);
    return {
      prompt: `Convert binary ${highNib} ${lowNib} to Hexadecimal:`,
      helper: 'Base-2 → Base-16',
      options: uniqueWrong(`0x${hex}`, off =>
        `0x${Math.max(0, Math.min(255, num + off))
          .toString(16)
          .toUpperCase()
          .padStart(2, '0')}`
      ),
      correct: `0x${hex}`,
      explanation: `Left nibble ${highNib} = ${hex[0]}, right nibble ${lowNib} = ${hex[1]} → 0x${hex}.`
    };
  }

  // Hex -> Decimal
  const highVal = parseInt(hex[0], 16) * 16;
  const lowVal = parseInt(hex[1], 16);
  return {
    prompt: `Convert hexadecimal 0x${hex} to Decimal:`,
    helper: 'Base-16 → Base-10',
    options: uniqueWrong(String(num), off => String(Math.max(0, Math.min(255, num + off)))),
    correct: String(num),
    explanation: `(${hex[0]} × 16) + ${hex[1]} = ${highVal} + ${lowVal} = ${num}.`
  };
}

export const NumberBaseConverter: React.FC = () => {
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('single');
  const [bitWidth, setBitWidth] = useState<BitWidth>(8);
  const [groupBinary, setGroupBinary] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Bidirectional synchronized inputs (raw string + which input was last edited)
  const [binInput, setBinInput] = useState('1100 0000');
  const [decInput, setDecInput] = useState('192');
  const [hexInput, setHexInput] = useState('C0');
  const [lastEdited, setLastEdited] = useState<ActiveInputSource>('dec');

  // IPv4 Dotted Mode inputs
  const [ipv4DecInput, setIpv4DecInput] = useState('192.168.10.25');
  const [ipv4BinInput, setIpv4BinInput] = useState('11000000.10101000.00001010.00011001');
  const [ipv4HexInput, setIpv4HexInput] = useState('C0.A8.0A.19');
  const [ipv4Source, setIpv4Source] = useState<ActiveInputSource>('dec');

  // Drill state
  const [drillScore, setDrillScore] = useState(0);
  const [drillStreak, setDrillStreak] = useState(0);
  const [drillQuestion, setDrillQuestion] = useState<DrillQuestion>(() => generateDrillQuestion());
  const [drillSelected, setDrillSelected] = useState<string | null>(null);

  const parsedCurrent = useMemo(() => {
    const raw =
      lastEdited === 'bin' ? binInput : lastEdited === 'dec' ? decInput : hexInput;
    return parseBaseInput(raw, lastEdited);
  }, [binInput, decInput, hexInput, lastEdited]);

  const syncAllFromValue = (val: bigint, source?: ActiveInputSource) => {
    const rawBin = val.toString(2);
    const formattedBin = groupBinary ? formatBinaryGrouped(rawBin, bitWidth) : rawBin;
    const rawDec = val.toString(10);
    const rawHex = val.toString(16).toUpperCase();
    const minHexDigits = bitWidth / 4;
    const paddedHex =
      rawHex.length < minHexDigits
        ? rawHex.padStart(minHexDigits, '0')
        : rawHex.length % 2 === 1
        ? `0${rawHex}`
        : rawHex;

    if (source !== 'bin') setBinInput(formattedBin);
    if (source !== 'dec') setDecInput(rawDec);
    if (source !== 'hex') setHexInput(paddedHex);
  };

  const handleBinChange = (next: string) => {
    setBinInput(next);
    setLastEdited('bin');
    const parsed = parseBaseInput(next, 'bin');
    if (parsed.valid && parsed.value !== null) {
      syncAllFromValue(parsed.value, 'bin');
    }
  };

  const handleDecChange = (next: string) => {
    setDecInput(next);
    setLastEdited('dec');
    const parsed = parseBaseInput(next, 'dec');
    if (parsed.valid && parsed.value !== null) {
      syncAllFromValue(parsed.value, 'dec');
    }
  };

  const handleHexChange = (next: string) => {
    setHexInput(next);
    setLastEdited('hex');
    const parsed = parseBaseInput(next, 'hex');
    if (parsed.valid && parsed.value !== null) {
      syncAllFromValue(parsed.value, 'hex');
    }
  };

  const handlePresetClick = (decVal: string) => {
    const val = BigInt(decVal);
    if (val > 255n && bitWidth === 8) {
      setBitWidth(16);
    }
    setLastEdited('dec');
    setDecInput(decVal);
    const rawBin = val.toString(2);
    const targetBits = val > 255n ? 16 : bitWidth;
    setBinInput(groupBinary ? formatBinaryGrouped(rawBin, targetBits) : rawBin);
    const rawHex = val.toString(16).toUpperCase();
    setHexInput(rawHex.padStart(targetBits / 4, '0'));
  };

  const handleResetAll = () => {
    setBitWidth(8);
    setLastEdited('dec');
    setDecInput('192');
    setBinInput(groupBinary ? '1100 0000' : '11000000');
    setHexInput('C0');
  };

  const handleToggleGrouping = () => {
    const nextGroup = !groupBinary;
    setGroupBinary(nextGroup);
    if (parsedCurrent.valid && parsedCurrent.value !== null) {
      const rawBin = parsedCurrent.value.toString(2);
      setBinInput(nextGroup ? formatBinaryGrouped(rawBin, bitWidth) : rawBin.padStart(bitWidth, '0'));
    }
  };

  // Interactive Bit Array for Bit Matrix (8 or 16 bits)
  const bitMatrix = useMemo(() => {
    const val = parsedCurrent.valid && parsedCurrent.value !== null ? parsedCurrent.value : 0n;
    const mask = (1n << BigInt(bitWidth)) - 1n;
    const fitsWidth = val <= mask;
    const displayVal = fitsWidth ? val : val & mask;

    const bits: { bitIndex: number; weight: number; isOne: boolean }[] = [];
    for (let i = bitWidth - 1; i >= 0; i -= 1) {
      const bitOn = ((displayVal >> BigInt(i)) & 1n) === 1n;
      bits.push({
        bitIndex: i,
        weight: Math.pow(2, i),
        isOne: bitOn
      });
    }

    const nibbleGroups: {
      nibbleIndex: number;
      bitsStr: string;
      hexDigit: string;
      decSubValue: number;
    }[] = [];

    for (let start = 0; start < bits.length; start += 4) {
      const slice = bits.slice(start, start + 4);
      const bitsStr = slice.map(b => (b.isOne ? '1' : '0')).join('');
      const decSubValue = parseInt(bitsStr, 2);
      nibbleGroups.push({
        nibbleIndex: start / 4,
        bitsStr,
        hexDigit: decSubValue.toString(16).toUpperCase(),
        decSubValue
      });
    }

    return { bits, nibbleGroups, fitsWidth, displayVal };
  }, [parsedCurrent, bitWidth]);

  const handleToggleBit = (bitIndex: number) => {
    const baseVal = parsedCurrent.valid && parsedCurrent.value !== null ? parsedCurrent.value : 0n;
    const nextVal = baseVal ^ (1n << BigInt(bitIndex));
    setLastEdited('dec');
    syncAllFromValue(nextVal);
  };

  // Step-by-step mathematical explanation for current number
  const breakdownSteps = useMemo(() => {
    if (!parsedCurrent.valid || parsedCurrent.value === null) return null;
    const val = parsedCurrent.value;
    const rawBin = val.toString(2);
    const paddedBin = rawBin.padStart(Math.max(bitWidth, Math.ceil(rawBin.length / 4) * 4), '0');

    // Positional binary sum (for values <= 65535 so it's readable)
    const activeWeights: string[] = [];
    if (paddedBin.length <= 16) {
      for (let i = 0; i < paddedBin.length; i += 1) {
        if (paddedBin[i] === '1') {
          activeWeights.push(String(Math.pow(2, paddedBin.length - 1 - i)));
        }
      }
    }

    // Nibbles -> Hex mapping
    const nibbles: { bin: string; hex: string }[] = [];
    for (let i = 0; i < paddedBin.length; i += 4) {
      const chunk = paddedBin.slice(i, i + 4);
      nibbles.push({
        bin: chunk,
        hex: parseInt(chunk, 2).toString(16).toUpperCase()
      });
    }

    return {
      val,
      paddedBin,
      activeWeightsText: activeWeights.length > 0 ? activeWeights.join(' + ') : '0',
      nibbles,
      hexFull: nibbles.map(n => n.hex).join('')
    };
  }, [parsedCurrent, bitWidth]);

  // IPv4 4-Octet Conversion Logic
  const ipv4Parsed = useMemo(() => {
    const raw =
      ipv4Source === 'dec'
        ? ipv4DecInput
        : ipv4Source === 'bin'
        ? ipv4BinInput
        : ipv4HexInput;
    const trimmed = raw.trim();

    if (!trimmed) {
      return { valid: false, octets: [] as number[], error: 'Enter 4 octets separated by dots.' };
    }

    const parts = trimmed.split('.').map(s => s.trim());

    if (ipv4Source === 'dec') {
      if (parts.length !== 4 || parts.some(p => !/^\d+$/.test(p) || Number(p) > 255)) {
        return {
          valid: false,
          octets: [] as number[],
          error: 'Enter 4 decimal octets from 0 to 255 (e.g. 192.168.10.25).'
        };
      }
      return { valid: true, octets: parts.map(Number), error: null };
    }

    if (ipv4Source === 'bin') {
      if (parts.length !== 4 || parts.some(p => !/^[01]{1,8}$/.test(p))) {
        return {
          valid: false,
          octets: [] as number[],
          error: 'Enter 4 binary octets of 1–8 bits separated by dots.'
        };
      }
      return { valid: true, octets: parts.map(p => parseInt(p, 2)), error: null };
    }

    // Hex IPv4 (supports C0.A8.0A.19 or compact 8-digit hex C0A80A19)
    const compactHex = trimmed.replace(/^0x/i, '').replace(/[:\s.-]/g, '');
    if (parts.length === 1 && /^[0-9a-fA-F]{8}$/.test(compactHex)) {
      const octets = [0, 2, 4, 6].map(i => parseInt(compactHex.slice(i, i + 2), 16));
      return { valid: true, octets, error: null };
    }
    if (parts.length !== 4 || parts.some(p => !/^[0-9a-fA-F]{1,2}$/.test(p))) {
      return {
        valid: false,
        octets: [] as number[],
        error: 'Enter 4 hex octets (e.g. C0.A8.0A.19) or 8 hex digits (e.g. C0A80A19).'
      };
    }
    return { valid: true, octets: parts.map(p => parseInt(p, 16)), error: null };
  }, [ipv4DecInput, ipv4BinInput, ipv4HexInput, ipv4Source]);

  const handleIpv4Change = (next: string, source: ActiveInputSource) => {
    setIpv4Source(source);
    if (source === 'dec') setIpv4DecInput(next);
    if (source === 'bin') setIpv4BinInput(next);
    if (source === 'hex') setIpv4HexInput(next);

    const parts = next.trim().split('.').map(s => s.trim());
    let octets: number[] | null = null;

    if (
      source === 'dec' &&
      parts.length === 4 &&
      parts.every(p => /^\d+$/.test(p) && Number(p) <= 255)
    ) {
      octets = parts.map(Number);
    } else if (
      source === 'bin' &&
      parts.length === 4 &&
      parts.every(p => /^[01]{1,8}$/.test(p))
    ) {
      octets = parts.map(p => parseInt(p, 2));
    } else if (source === 'hex') {
      const compact = next.trim().replace(/^0x/i, '').replace(/[:\s.-]/g, '');
      if (parts.length === 1 && /^[0-9a-fA-F]{8}$/.test(compact)) {
        octets = [0, 2, 4, 6].map(i => parseInt(compact.slice(i, i + 2), 16));
      } else if (parts.length === 4 && parts.every(p => /^[0-9a-fA-F]{1,2}$/.test(p))) {
        octets = parts.map(p => parseInt(p, 16));
      }
    }

    if (octets) {
      if (source !== 'dec') setIpv4DecInput(octets.join('.'));
      if (source !== 'bin') {
        setIpv4BinInput(octets.map(o => o.toString(2).padStart(8, '0')).join('.'));
      }
      if (source !== 'hex') {
        setIpv4HexInput(octets.map(o => o.toString(16).toUpperCase().padStart(2, '0')).join('.'));
      }
    }
  };

  const copyValue = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSelectDrillOption = (opt: string) => {
    if (drillSelected !== null) return;
    setDrillSelected(opt);
    if (opt === drillQuestion.correct) {
      setDrillScore(prev => prev + 10);
      setDrillStreak(prev => prev + 1);
    } else {
      setDrillStreak(0);
    }
  };

  const handleNextDrill = () => {
    setDrillQuestion(generateDrillQuestion());
    setDrillSelected(null);
  };

  const cleanBinOutput =
    parsedCurrent.valid && parsedCurrent.value !== null
      ? parsedCurrent.value.toString(2).padStart(bitWidth, '0')
      : '';
  const cleanHexOutput =
    parsedCurrent.valid && parsedCurrent.value !== null
      ? `0x${parsedCurrent.value.toString(16).toUpperCase().padStart(bitWidth / 4, '0')}`
      : '';

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white shadow-sm border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-300">
            <span>Hands-on Labs</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span>Base-2 / Base-10 / Base-16</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span>Arbitrary Precision</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <Binary className="w-6 h-6 text-cyan-400 shrink-0" />
            <span>Binary, Decimal &amp; Hexadecimal Converter</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Convert instantaneously across Binary, Decimal, and Hexadecimal, toggle individual bit weights, inspect 4-bit hex nibbles, or break down full 32-bit IPv4 addresses.
          </p>
        </div>

        {/* Mode Switcher & Practice Score */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            role="tablist"
            aria-label="Converter Mode"
            className="inline-flex items-center p-1 rounded-xl bg-slate-950/70 border border-slate-700/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={workbenchMode === 'single'}
              onClick={() => setWorkbenchMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                workbenchMode === 'single'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Single Number
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workbenchMode === 'ipv4'}
              onClick={() => setWorkbenchMode('ipv4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                workbenchMode === 'ipv4'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              IPv4 Dotted Octets
            </button>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/10 text-right tabular-nums">
            <span className="text-[10px] text-slate-300 font-mono block">Drill Score</span>
            <span className="text-sm font-bold font-mono text-cyan-300">
              {drillScore} pts · {drillStreak} streak
            </span>
          </div>
        </div>
      </div>

      {workbenchMode === 'single' ? (
        <div className="space-y-6">
          {/* Toolbar Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1">
                Bit Matrix Width:
              </span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {([8, 16] as BitWidth[]).map(width => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => setBitWidth(width)}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      bitWidth === width
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {width}-Bit
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleToggleGrouping}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  groupBinary
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-cyan-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                4-Bit Spacing: {groupBinary ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
                Presets:
              </span>
              {PRESETS.map(p => (
                <button
                  key={p.dec}
                  type="button"
                  onClick={() => handlePresetClick(p.dec)}
                  title={p.note}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                    parsedCurrent.valid && parsedCurrent.value?.toString() === p.dec
                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleResetAll}
                className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* 3 Synchronized Bidirectional Inputs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Binary (Base 2) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Binary (Base-2)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Digits 0–1 · Bitwise Representation
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!parsedCurrent.valid}
                  onClick={() => copyValue(cleanBinOutput, 'bin')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'bin' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'bin' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <input
                type="text"
                aria-label="Binary value"
                value={binInput}
                onChange={(e) => handleBinChange(e.target.value)}
                placeholder="e.g. 1100 0000"
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums text-base font-bold bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-2 ${
                  lastEdited === 'bin' && !parsedCurrent.valid
                    ? 'border-red-500 focus:ring-red-500/40'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/40'
                }`}
              />

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>Prefixed: {parsedCurrent.valid && parsedCurrent.value !== null ? `0b${parsedCurrent.value.toString(2)}` : '—'}</span>
                <span>{parsedCurrent.valid && parsedCurrent.value !== null ? `${parsedCurrent.value.toString(2).length} min bits` : ''}</span>
              </div>
            </div>

            {/* Decimal (Base 10) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Decimal (Base-10)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Digits 0–9 · Human Readable Integer
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!parsedCurrent.valid}
                  onClick={() => copyValue(decInput, 'dec')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'dec' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'dec' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <input
                type="text"
                aria-label="Decimal value"
                value={decInput}
                onChange={(e) => handleDecChange(e.target.value)}
                placeholder="e.g. 192"
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums text-base font-bold bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                  lastEdited === 'dec' && !parsedCurrent.valid
                    ? 'border-red-500 focus:ring-red-500/40'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/40'
                }`}
              />

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>
                  Formatted:{' '}
                  {parsedCurrent.valid && parsedCurrent.value !== null
                    ? parsedCurrent.value.toLocaleString()
                    : '—'}
                </span>
                <span>Unsigned Int</span>
              </div>
            </div>

            {/* Hexadecimal (Base 16) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Hexadecimal (Base-16)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Digits 0–9, A–F · MAC / IPv6 Nibble Notation
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!parsedCurrent.valid}
                  onClick={() => copyValue(cleanHexOutput, 'hex')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'hex' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'hex' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <input
                type="text"
                aria-label="Hexadecimal value"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="e.g. C0"
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums text-base font-bold bg-slate-50 dark:bg-slate-800/80 border text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 ${
                  lastEdited === 'hex' && !parsedCurrent.valid
                    ? 'border-red-500 focus:ring-red-500/40'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/40'
                }`}
              />

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>Prefixed: {cleanHexOutput || '—'}</span>
                <span>1 Hex Digit = 4 Bits</span>
              </div>
            </div>
          </div>

          {/* Explicit Validation Alert (if invalid characters entered) */}
          {!parsedCurrent.valid && parsedCurrent.error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parsedCurrent.error}</span>
            </div>
          )}

          {/* Interactive Stage: Bit Toggle Matrix & Positional Math Breakdown */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Stage: Interactive Bit Toggles + 4-Bit Hex Nibbles */}
            <div className="xl:col-span-8 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                    <span>Interactive {bitWidth}-Bit Toggle Matrix</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any bit cell below to flip between 0 and 1 and watch Decimal and Hexadecimal recalculate live.
                  </p>
                </div>
                {!bitMatrix.fitsWidth && (
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                    Showing lowest {bitWidth} bits of full value
                  </span>
                )}
              </div>

              {/* Bit Grid */}
              <div
                className={`grid gap-2 ${
                  bitWidth === 8
                    ? 'grid-cols-4 sm:grid-cols-8'
                    : 'grid-cols-4 sm:grid-cols-8'
                }`}
              >
                {bitMatrix.bits.map(bit => (
                  <button
                    key={bit.bitIndex}
                    type="button"
                    onClick={() => handleToggleBit(bit.bitIndex)}
                    aria-pressed={bit.isOne}
                    className={`p-2.5 rounded-xl border text-center transition-colors flex flex-col items-center justify-center gap-1 ${
                      bit.isOne
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        bit.isOne ? 'text-cyan-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {bit.weight.toLocaleString()}
                    </span>
                    <span className="text-lg font-mono font-extrabold tabular-nums leading-none">
                      {bit.isOne ? '1' : '0'}
                    </span>
                    <span
                      className={`text-[9px] font-mono ${
                        bit.isOne ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      2^{bit.bitIndex}
                    </span>
                  </button>
                ))}
              </div>

              {/* 4-Bit Nibble-to-Hex Alignment Strip */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">4-Bit Nibble → Hexadecimal Grouping</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Each 4 bits directly forms 1 hex character
                  </span>
                </div>
                <div
                  className={`grid gap-2 ${
                    bitWidth === 8 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  {bitMatrix.nibbleGroups.map(nib => (
                    <div
                      key={nib.nibbleIndex}
                      className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-2 font-mono tabular-nums text-xs"
                    >
                      <span className="text-slate-700 dark:text-slate-200 font-semibold">
                        {nib.bitsStr}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-300">
                        {nib.hexDigit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel: Step-by-Step Math Explanation */}
            <div className="xl:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  <span>Step-by-Step Conversion Math</span>
                </h3>
              </div>

              {breakdownSteps ? (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      1. Binary → Decimal (Powers of 2)
                    </p>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-200 leading-relaxed break-words">
                      {breakdownSteps.paddedBin.length <= 16 ? (
                        <>
                          {breakdownSteps.activeWeightsText} ={' '}
                          <strong className="text-blue-600 dark:text-cyan-400">
                            {breakdownSteps.val.toLocaleString()}
                          </strong>
                        </>
                      ) : (
                        <>
                          2-based positional expansion ={' '}
                          <strong className="text-blue-600 dark:text-cyan-400">
                            {breakdownSteps.val.toLocaleString()}
                          </strong>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      2. Binary → Hexadecimal (4-Bit Chunks)
                    </p>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-200 space-y-1">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {breakdownSteps.nibbles.map((n, i) => (
                          <span key={i}>
                            {n.bin} → <strong className="text-amber-600 dark:text-amber-300">{n.hex}</strong>
                          </span>
                        ))}
                      </div>
                      <p className="pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        Result:{' '}
                        <strong className="text-amber-700 dark:text-amber-300">
                          0x{breakdownSteps.hexFull}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      3. Hex ↔ Decimal Reference
                    </p>
                    <div className="grid grid-cols-4 gap-1 font-mono text-[11px] tabular-nums text-center">
                      {[
                        ['10', 'A'],
                        ['11', 'B'],
                        ['12', 'C'],
                        ['13', 'D'],
                        ['14', 'E'],
                        ['15', 'F'],
                        ['8', '1000'],
                        ['15', '1111']
                      ].map(([d, h], idx) => (
                        <div
                          key={idx}
                          className="py-1 px-1.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {d}={h}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4">
                  Enter a valid binary, decimal, or hexadecimal number to inspect step-by-step math.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* IPv4 Dotted Octets Mode */
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Dotted Decimal IPv4
                </label>
                <button
                  type="button"
                  disabled={!ipv4Parsed.valid}
                  onClick={() => copyValue(ipv4DecInput, 'ip-dec')}
                  className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  {copiedKey === 'ip-dec' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <input
                type="text"
                value={ipv4DecInput}
                onChange={(e) => handleIpv4Change(e.target.value, 'dec')}
                placeholder="192.168.10.25"
                className="w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Dotted 8-Bit Binary
                </label>
                <button
                  type="button"
                  disabled={!ipv4Parsed.valid}
                  onClick={() => copyValue(ipv4BinInput, 'ip-bin')}
                  className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  {copiedKey === 'ip-bin' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <input
                type="text"
                value={ipv4BinInput}
                onChange={(e) => handleIpv4Change(e.target.value, 'bin')}
                placeholder="11000000.10101000.00001010.00011001"
                className="w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums text-xs sm:text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Hexadecimal IPv4 (Dotted or 32-Bit)
                </label>
                <button
                  type="button"
                  disabled={!ipv4Parsed.valid}
                  onClick={() => copyValue(ipv4HexInput, 'ip-hex')}
                  className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  {copiedKey === 'ip-hex' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <input
                type="text"
                value={ipv4HexInput}
                onChange={(e) => handleIpv4Change(e.target.value, 'hex')}
                placeholder="C0.A8.0A.19 or C0A80A19"
                className="w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {!ipv4Parsed.valid && ipv4Parsed.error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{ipv4Parsed.error}</span>
            </div>
          )}

          {ipv4Parsed.valid && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Per-Octet Breakdown (32 Bits Total)
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Compact Hex: 0x{ipv4Parsed.octets.map(o => o.toString(16).toUpperCase().padStart(2, '0')).join('')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {ipv4Parsed.octets.map((octet, idx) => {
                  const octBin = octet.toString(2).padStart(8, '0');
                  const octHex = octet.toString(16).toUpperCase().padStart(2, '0');
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 space-y-2 font-mono tabular-nums"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Octet {idx + 1}</span>
                        <span>Bits {idx * 8 + 1}–{(idx + 1) * 8}</span>
                      </div>
                      <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {octet}
                      </p>
                      <div className="text-xs text-blue-700 dark:text-cyan-300 font-semibold">
                        {octBin.slice(0, 4)} {octBin.slice(4)}
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                        0x{octHex}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Base Conversion Practice Drill */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Binary, Decimal &amp; Hex Speed Drill
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {drillQuestion.helper}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextDrill}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Next Challenge</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 space-y-3">
          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white font-mono">
            {drillQuestion.prompt}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {drillQuestion.options.map((opt, idx) => {
              const isSelected = drillSelected === opt;
              const isCorrect = opt === drillQuestion.correct;

              let btnClass =
                'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500';
              if (drillSelected !== null) {
                if (isCorrect) {
                  btnClass =
                    'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                } else if (isSelected) {
                  btnClass =
                    'bg-red-50 dark:bg-red-950/60 border-red-500 text-red-800 dark:text-red-300';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={drillSelected !== null}
                  onClick={() => handleSelectDrillOption(opt)}
                  className={`p-3 rounded-xl border text-center text-xs sm:text-sm font-mono tabular-nums transition-colors ${btnClass}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {drillSelected !== null && (
            <div
              className={`text-xs font-medium flex items-start gap-2 pt-1 ${
                drillSelected === drillQuestion.correct
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {drillSelected === drillQuestion.correct ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>
                <strong>
                  {drillSelected === drillQuestion.correct
                    ? 'Correct!'
                    : `Answer: ${drillQuestion.correct}.`}
                </strong>{' '}
                {drillQuestion.explanation}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
