import { intToIp, prefixToMaskInt } from './vlsmTree';

export type QuizCategory = 'CIDR' | 'Binary' | 'Hosts';

export interface SubnetQuizQuestion {
  id: string;
  category: QuizCategory;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  referenceIp?: string;
  referenceCidr?: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOptions(correct: string, candidates: string[]): string[] {
  const unique = new Set<string>([correct]);
  for (const candidate of shuffleArray(candidates)) {
    if (unique.size >= 4) break;
    if (candidate && candidate !== correct) {
      unique.add(candidate);
    }
  }
  return shuffleArray(Array.from(unique));
}

function randomPrivateBaseIp(): [number, number, number, number] {
  const family = randomInt(0, 2);
  if (family === 0) {
    return [192, 168, randomInt(1, 240), randomInt(1, 254)];
  }
  if (family === 1) {
    return [172, randomInt(16, 31), randomInt(0, 250), randomInt(1, 254)];
  }
  return [10, randomInt(1, 200), randomInt(0, 250), randomInt(1, 254)];
}

function computeSubnet(ipOctets: [number, number, number, number], prefix: number) {
  const ipInt =
    ((ipOctets[0] << 24) |
      (ipOctets[1] << 16) |
      (ipOctets[2] << 8) |
      ipOctets[3]) >>>
    0;
  const maskInt = prefixToMaskInt(prefix);
  const wildcardInt = ~maskInt >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;
  const totalAddresses = Math.pow(2, 32 - prefix);
  const usableHosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : totalAddresses - 2;

  return {
    ipStr: ipOctets.join('.'),
    maskStr: intToIp(maskInt),
    wildcardStr: intToIp(wildcardInt),
    networkStr: intToIp(networkInt),
    broadcastStr: intToIp(broadcastInt),
    firstHost: prefix >= 31 ? intToIp(networkInt) : intToIp((networkInt + 1) >>> 0),
    lastHost: prefix >= 31 ? intToIp(broadcastInt) : intToIp((broadcastInt - 1) >>> 0),
    networkInt,
    broadcastInt,
    totalAddresses,
    usableHosts
  };
}

function generateCidrQuestion(index: number): SubnetQuizQuestion {
  const variant = randomInt(0, 2);

  if (variant === 0) {
    // Broadcast or Network ID for a random host IP/CIDR
    const prefix = randomInt(25, 30);
    const octets = randomPrivateBaseIp();
    const s = computeSubnet(octets, prefix);
    const blockSize = Math.pow(2, 32 - prefix);
    const askBroadcast = Math.random() >= 0.5;

    if (askBroadcast) {
      const distractors = [
        intToIp((s.broadcastInt + 1) >>> 0),
        intToIp((s.networkInt + Math.max(1, blockSize / 2) - 1) >>> 0),
        s.lastHost,
        `${octets[0]}.${octets[1]}.${octets[2]}.255`,
        s.networkStr
      ];
      return {
        id: `q-cidr-${index}-${Date.now()}`,
        category: 'CIDR',
        prompt: `What is the broadcast address for ${s.ipStr}/${prefix}?`,
        options: buildOptions(s.broadcastStr, distractors),
        correctAnswer: s.broadcastStr,
        explanation: `With /${prefix}, the block size in the 4th octet is ${blockSize}. ${s.ipStr} falls in subnet ${s.networkStr}, whose last address (all host bits = 1) is ${s.broadcastStr}.`,
        referenceIp: s.networkStr,
        referenceCidr: prefix
      };
    }

    const distractors = [
      intToIp((s.networkInt + blockSize) >>> 0),
      s.firstHost,
      s.broadcastStr,
      `${octets[0]}.${octets[1]}.${octets[2]}.0`,
      intToIp(Math.max(0, s.networkInt - blockSize) >>> 0)
    ];
    return {
      id: `q-cidr-${index}-${Date.now()}`,
      category: 'CIDR',
      prompt: `What is the Network ID for host ${s.ipStr}/${prefix}?`,
      options: buildOptions(s.networkStr, distractors),
      correctAnswer: s.networkStr,
      explanation: `A /${prefix} prefix has a block size of ${blockSize} in the 4th octet. The largest multiple of ${blockSize} at or below ${octets[3]} gives Network ID ${s.networkStr}.`,
      referenceIp: s.networkStr,
      referenceCidr: prefix
    };
  }

  if (variant === 1) {
    // Dotted-decimal subnet mask for /prefix
    const prefix = randomInt(19, 30);
    const maskStr = intToIp(prefixToMaskInt(prefix));
    const adjacentPrefixes = [prefix - 2, prefix - 1, prefix + 1, prefix + 2].filter(
      p => p >= 8 && p <= 32
    );
    const distractors = adjacentPrefixes.map(p => intToIp(prefixToMaskInt(p)));

    return {
      id: `q-cidr-${index}-${Date.now()}`,
      category: 'CIDR',
      prompt: `What is the dotted-decimal subnet mask for a /${prefix} CIDR prefix?`,
      options: buildOptions(maskStr, distractors),
      correctAnswer: maskStr,
      explanation: `A /${prefix} mask sets ${prefix} leading bits to 1 and ${32 - prefix} bits to 0, producing ${maskStr}.`,
      referenceIp: '192.168.10.0',
      referenceCidr: prefix
    };
  }

  // Cisco Wildcard Mask
  const prefix = randomInt(22, 30);
  const maskInt = prefixToMaskInt(prefix);
  const wildcardStr = intToIp(~maskInt >>> 0);
  const adjacentPrefixes = [prefix - 2, prefix - 1, prefix + 1, prefix + 2].filter(
    p => p >= 8 && p <= 31
  );
  const distractors = [
    ...adjacentPrefixes.map(p => intToIp(~prefixToMaskInt(p) >>> 0)),
    intToIp(maskInt)
  ];

  return {
    id: `q-cidr-${index}-${Date.now()}`,
    category: 'CIDR',
    prompt: `What is the Cisco OSPF/ACL wildcard mask for a /${prefix} network?`,
    options: buildOptions(wildcardStr, distractors),
    correctAnswer: wildcardStr,
    explanation: `Wildcard mask = 255.255.255.255 minus subnet mask (${intToIp(maskInt)}), which equals ${wildcardStr}.`,
    referenceIp: '10.10.0.0',
    referenceCidr: prefix
  };
}

function generateBinaryQuestion(index: number): SubnetQuizQuestion {
  const variant = randomInt(0, 2);

  if (variant === 0) {
    // Binary representation of interesting octet of subnet mask
    const prefix = randomInt(25, 30);
    const borrowedBits = prefix - 24;
    const maskOctetVal = (0xff << (8 - borrowedBits)) & 0xff;
    const correctBin = maskOctetVal.toString(2).padStart(8, '0');

    const distractors: string[] = [];
    for (let b = 1; b <= 7; b++) {
      if (b !== borrowedBits) {
        distractors.push(((0xff << (8 - b)) & 0xff).toString(2).padStart(8, '0'));
      }
    }
    distractors.push((~maskOctetVal & 0xff).toString(2).padStart(8, '0'));

    return {
      id: `q-bin-${index}-${Date.now()}`,
      category: 'Binary',
      prompt: `What is the 8-bit binary value of the 4th octet in a /${prefix} subnet mask (${maskOctetVal})?`,
      options: buildOptions(correctBin, distractors),
      correctAnswer: correctBin,
      explanation: `/${prefix} leaves ${borrowedBits} network bit${borrowedBits === 1 ? '' : 's'} in the 4th octet (${'1'.repeat(borrowedBits)}${'0'.repeat(8 - borrowedBits)} = ${maskOctetVal}).`,
      referenceIp: '192.168.1.0',
      referenceCidr: prefix
    };
  }

  if (variant === 1) {
    // Decimal octet to 8-bit binary
    const values = [42, 75, 118, 149, 172, 192, 203, 214, 224, 240];
    const target = pickRandom(values);
    const correctBin = target.toString(2).padStart(8, '0');
    const distractors = [
      (target ^ 1).toString(2).padStart(8, '0'),
      (target ^ 2).toString(2).padStart(8, '0'),
      (target ^ 4).toString(2).padStart(8, '0'),
      (target ^ 8).toString(2).padStart(8, '0'),
      (target ^ 16).toString(2).padStart(8, '0')
    ];

    return {
      id: `q-bin-${index}-${Date.now()}`,
      category: 'Binary',
      prompt: `Which 8-bit binary string equals the decimal IPv4 octet ${target}?`,
      options: buildOptions(correctBin, distractors),
      correctAnswer: correctBin,
      explanation: `Summing the active bit weights (128, 64, 32, 16, 8, 4, 2, 1) in ${correctBin} equals ${target}.`
    };
  }

  // How many host bits vs network bits
  const prefix = randomInt(17, 30);
  const hostBits = 32 - prefix;
  const octetNum = Math.min(4, Math.floor(prefix / 8) + (prefix % 8 === 0 ? 0 : 1));
  const bitsInInterestingOctet = prefix % 8 === 0 ? 8 : prefix % 8;

  const distractors = [
    `${Math.max(1, bitsInInterestingOctet - 1)} network bits, ${hostBits + 1} host bits`,
    `${bitsInInterestingOctet + 1} network bits, ${Math.max(1, hostBits - 1)} host bits`,
    `${hostBits} network bits, ${prefix} host bits`,
    `8 network bits, ${hostBits} host bits`
  ];
  const correct = `${bitsInInterestingOctet} network bits in octet ${octetNum}, ${hostBits} total host bits`;

  return {
    id: `q-bin-${index}-${Date.now()}`,
    category: 'Binary',
    prompt: `In binary, how does a /${prefix} prefix split the interesting octet (octet ${octetNum}) and total host bits?`,
    options: buildOptions(correct, distractors),
    correctAnswer: correct,
    explanation: `/${prefix} uses ${bitsInInterestingOctet} network bit${bitsInInterestingOctet === 1 ? '' : 's'} in octet ${octetNum}, leaving 32 - ${prefix} = ${hostBits} total host bits.`,
    referenceIp: '172.16.0.0',
    referenceCidr: prefix
  };
}

function generateHostsQuestion(index: number): SubnetQuizQuestion {
  const variant = randomInt(0, 2);

  if (variant === 0) {
    // Usable host count for a /prefix
    const prefix = randomInt(22, 30);
    const total = Math.pow(2, 32 - prefix);
    const usable = total - 2;

    const distractors = [
      total.toLocaleString(),
      (usable / 2).toLocaleString(),
      Math.max(2, (total * 2) - 2).toLocaleString(),
      Math.max(1, usable - 2).toLocaleString(),
      (total - 1).toLocaleString()
    ];

    return {
      id: `q-hosts-${index}-${Date.now()}`,
      category: 'Hosts',
      prompt: `How many usable host IP addresses are available in a /${prefix} subnet?`,
      options: buildOptions(usable.toLocaleString(), distractors),
      correctAnswer: usable.toLocaleString(),
      explanation: `With ${32 - prefix} host bits, total addresses = 2^${32 - prefix} = ${total.toLocaleString()}. Subtracting network ID and broadcast leaves ${usable.toLocaleString()} usable hosts.`,
      referenceIp: '192.168.10.0',
      referenceCidr: prefix
    };
  }

  if (variant === 1) {
    // Smallest CIDR prefix to support N required hosts
    const prefix = randomInt(23, 29);
    const usable = Math.pow(2, 32 - prefix) - 2;
    const prevUsable = Math.pow(2, 32 - (prefix + 1)) - 2;
    const neededHosts = randomInt(prevUsable + 1, usable);
    const correct = `/${prefix}`;

    const distractors = [
      `/${prefix + 1}`,
      `/${prefix - 1}`,
      `/${Math.max(16, prefix - 2)}`,
      `/${Math.min(30, prefix + 2)}`
    ];

    return {
      id: `q-hosts-${index}-${Date.now()}`,
      category: 'Hosts',
      prompt: `Which CIDR prefix fits ${neededHosts} usable host devices with the least wasted IP addresses?`,
      options: buildOptions(correct, distractors),
      correctAnswer: correct,
      explanation: `/${prefix + 1} only supports ${prevUsable} usable hosts (too small), whereas /${prefix} provides ${usable} usable hosts (2^${32 - prefix} - 2).`,
      referenceIp: '192.168.1.0',
      referenceCidr: prefix
    };
  }

  // First or Last usable host IP
  const prefix = randomInt(25, 29);
  const octets = randomPrivateBaseIp();
  const s = computeSubnet(octets, prefix);
  const askFirst = Math.random() >= 0.5;

  if (askFirst) {
    const distractors = [
      s.networkStr,
      intToIp((s.networkInt + 2) >>> 0),
      s.lastHost,
      s.broadcastStr
    ];
    return {
      id: `q-hosts-${index}-${Date.now()}`,
      category: 'Hosts',
      prompt: `What is the first usable host IP address in subnet ${s.networkStr}/${prefix}?`,
      options: buildOptions(s.firstHost, distractors),
      correctAnswer: s.firstHost,
      explanation: `The first usable host IP is always Network ID + 1: ${s.networkStr} + 1 = ${s.firstHost}.`,
      referenceIp: s.networkStr,
      referenceCidr: prefix
    };
  }

  const distractors = [
    s.broadcastStr,
    intToIp((s.broadcastInt - 2) >>> 0),
    s.firstHost,
    s.networkStr
  ];
  return {
    id: `q-hosts-${index}-${Date.now()}`,
    category: 'Hosts',
    prompt: `What is the last usable host IP address in subnet ${s.networkStr}/${prefix}?`,
    options: buildOptions(s.lastHost, distractors),
    correctAnswer: s.lastHost,
    explanation: `The last usable host IP is Broadcast - 1: ${s.broadcastStr} - 1 = ${s.lastHost}.`,
    referenceIp: s.networkStr,
    referenceCidr: prefix
  };
}

export function generateSubnetPracticeQuiz(count = 5): SubnetQuizQuestion[] {
  const categories: QuizCategory[] = ['CIDR', 'Binary', 'Hosts'];
  const plan: QuizCategory[] = [...categories];

  while (plan.length < count) {
    plan.push(pickRandom(categories));
  }

  const shuffledPlan = shuffleArray(plan.slice(0, count));
  const seenPrompts = new Set<string>();
  const questions: SubnetQuizQuestion[] = [];

  shuffledPlan.forEach((cat, idx) => {
    let candidate: SubnetQuizQuestion;
    let attempts = 0;
    do {
      if (cat === 'CIDR') {
        candidate = generateCidrQuestion(idx);
      } else if (cat === 'Binary') {
        candidate = generateBinaryQuestion(idx);
      } else {
        candidate = generateHostsQuestion(idx);
      }
      attempts += 1;
    } while (seenPrompts.has(candidate.prompt) && attempts < 8);

    seenPrompts.add(candidate.prompt);
    questions.push(candidate);
  });

  return questions;
}
