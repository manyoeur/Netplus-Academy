export interface SubnetMathStats {
  networkInt: number;
  broadcastInt: number;
  prefix: number;
  networkStr: string;
  broadcastStr: string;
  maskStr: string;
  wildcardStr: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  cidrLabel: string;
}

export interface VlsmDepartmentDemand {
  id: string;
  name: string;
  hostsRequired: number;
}

export type VlsmNodeStatus = 'split' | 'allocated' | 'free';

export interface VlsmTreeNode {
  id: string;
  networkInt: number;
  prefix: number;
  cidrLabel: string;
  branchBit?: '0' | '1';
  binaryPath: string;
  status: VlsmNodeStatus;
  assignedName?: string;
  hostsRequired?: number;
  stats: SubnetMathStats;
  children?: [VlsmTreeNode, VlsmTreeNode];
}

export interface VlsmAllocationSummary {
  baseCidrLabel: string;
  totalSupernetAddresses: number;
  allocatedAddresses: number;
  freeAddresses: number;
  utilizationPercent: number;
  allocatedLeaves: VlsmTreeNode[];
  freeLeaves: VlsmTreeNode[];
  unassignedDemands: VlsmDepartmentDemand[];
  maxDepth: number;
}

export function intToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

export function prefixToMaskInt(prefix: number): number {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  return ((0xffffffff << (32 - prefix)) >>> 0);
}

export function parseCidrNotation(
  input: string
): { networkInt: number; prefix: number; cleanInputIp: string } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const parts = trimmed.split('/');
  if (parts.length !== 2) return null;

  const ipPart = parts[0].trim();
  const prefixPart = parts[1].trim();
  if (!/^\d{1,2}$/.test(prefixPart)) return null;
  const prefix = Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 8 || prefix > 30) return null;

  const octetsRaw = ipPart.split('.');
  if (octetsRaw.length !== 4 || octetsRaw.some(o => !/^\d{1,3}$/.test(o))) {
    return null;
  }
  const octets = octetsRaw.map(Number);
  if (octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) {
    return null;
  }

  const rawIpInt =
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  const maskInt = prefixToMaskInt(prefix);
  const networkInt = (rawIpInt & maskInt) >>> 0;

  return {
    networkInt,
    prefix,
    cleanInputIp: intToIp(networkInt)
  };
}

export function getSubnetStats(networkInt: number, prefix: number): SubnetMathStats {
  const maskInt = prefixToMaskInt(prefix);
  const wildcardInt = ~maskInt >>> 0;
  const alignedNetwork = (networkInt & maskInt) >>> 0;
  const broadcastInt = (alignedNetwork | wildcardInt) >>> 0;
  const totalAddresses = Math.pow(2, 32 - prefix);
  const usableHosts =
    prefix >= 31 ? (prefix === 31 ? 2 : 1) : Math.max(0, totalAddresses - 2);

  const networkStr = intToIp(alignedNetwork);
  const broadcastStr = intToIp(broadcastInt);
  const firstHost = prefix >= 31 ? networkStr : intToIp((alignedNetwork + 1) >>> 0);
  const lastHost = prefix >= 31 ? broadcastStr : intToIp((broadcastInt - 1) >>> 0);

  return {
    networkInt: alignedNetwork,
    broadcastInt,
    prefix,
    networkStr,
    broadcastStr,
    maskStr: intToIp(maskInt),
    wildcardStr: intToIp(wildcardInt),
    firstHost,
    lastHost,
    totalAddresses,
    usableHosts,
    cidrLabel: `${networkStr}/${prefix}`
  };
}

export function requiredPrefixForHosts(hostsRequired: number): number {
  const safeHosts = Math.max(1, Math.floor(hostsRequired));
  // Reserve 2 addresses for network ID and broadcast
  const neededAddresses = safeHosts + 2;
  let hostBits = 2; // minimum /30 (4 total, 2 usable) for host-bearing subnets
  while (Math.pow(2, hostBits) < neededAddresses && hostBits < 32) {
    hostBits += 1;
  }
  return Math.max(1, 32 - hostBits);
}

function createTreeNode(
  networkInt: number,
  prefix: number,
  binaryPath: string,
  branchBit?: '0' | '1'
): VlsmTreeNode {
  const stats = getSubnetStats(networkInt, prefix);
  return {
    id: `node-${stats.networkStr}-${prefix}`,
    networkInt: stats.networkInt,
    prefix,
    cidrLabel: stats.cidrLabel,
    branchBit,
    binaryPath,
    status: 'free',
    stats
  };
}

function splitNodeInPlace(node: VlsmTreeNode): void {
  if (node.prefix >= 32 || node.children) return;
  const childPrefix = node.prefix + 1;
  const childBlockSize = Math.pow(2, 32 - childPrefix);
  const leftInt = node.networkInt >>> 0;
  const rightInt = (node.networkInt + childBlockSize) >>> 0;

  const basePath = node.binaryPath ? `${node.binaryPath}` : '';
  const leftChild = createTreeNode(leftInt, childPrefix, `${basePath}0`, '0');
  const rightChild = createTreeNode(rightInt, childPrefix, `${basePath}1`, '1');

  node.status = 'split';
  node.assignedName = undefined;
  node.hostsRequired = undefined;
  node.children = [leftChild, rightChild];
}

function findSmallestFittingFreeNode(
  node: VlsmTreeNode,
  targetPrefix: number
): VlsmTreeNode | null {
  if (node.status === 'free') {
    return node.prefix <= targetPrefix ? node : null;
  }
  if (node.status === 'split' && node.children) {
    const leftCandidate = findSmallestFittingFreeNode(node.children[0], targetPrefix);
    const rightCandidate = findSmallestFittingFreeNode(node.children[1], targetPrefix);
    if (!leftCandidate) return rightCandidate;
    if (!rightCandidate) return leftCandidate;
    // Prefer the tighter block (larger prefix) to minimize fragmentation; break ties left-first
    return rightCandidate.prefix > leftCandidate.prefix ? rightCandidate : leftCandidate;
  }
  return null;
}

function cloneTree(node: VlsmTreeNode): VlsmTreeNode {
  return {
    ...node,
    stats: { ...node.stats },
    children: node.children
      ? [cloneTree(node.children[0]), cloneTree(node.children[1])]
      : undefined
  };
}

export function buildVlsmTreeFromDemands(
  baseCidrInput: string,
  demands: VlsmDepartmentDemand[]
): { root: VlsmTreeNode | null; unassignedDemands: VlsmDepartmentDemand[] } {
  const parsed = parseCidrNotation(baseCidrInput);
  if (!parsed) {
    return { root: null, unassignedDemands: demands };
  }

  const root = createTreeNode(parsed.networkInt, parsed.prefix, '');
  const sortedDemands = [...demands]
    .filter(d => d.name.trim().length > 0 && d.hostsRequired > 0)
    .sort((a, b) => b.hostsRequired - a.hostsRequired);

  const unassignedDemands: VlsmDepartmentDemand[] = [];

  for (const demand of sortedDemands) {
    const targetPrefix = requiredPrefixForHosts(demand.hostsRequired);
    if (targetPrefix < parsed.prefix) {
      unassignedDemands.push(demand);
      continue;
    }

    const freeCandidate = findSmallestFittingFreeNode(root, targetPrefix);
    if (!freeCandidate) {
      unassignedDemands.push(demand);
      continue;
    }

    let cursor = freeCandidate;
    while (cursor.prefix < targetPrefix) {
      splitNodeInPlace(cursor);
      if (!cursor.children) break;
      cursor = cursor.children[0];
    }

    cursor.status = 'allocated';
    cursor.assignedName = demand.name.trim();
    cursor.hostsRequired = demand.hostsRequired;
  }

  return { root, unassignedDemands };
}

export function splitVlsmLeafNode(
  root: VlsmTreeNode,
  targetNodeId: string
): VlsmTreeNode {
  const cloned = cloneTree(root);

  const walk = (node: VlsmTreeNode): boolean => {
    if (node.id === targetNodeId) {
      if (node.status === 'free' && node.prefix < 32) {
        splitNodeInPlace(node);
        return true;
      }
      return false;
    }
    if (node.children) {
      return walk(node.children[0]) || walk(node.children[1]);
    }
    return false;
  };

  walk(cloned);
  return cloned;
}

export function mergeVlsmNode(
  root: VlsmTreeNode,
  targetNodeId: string
): VlsmTreeNode {
  const cloned = cloneTree(root);

  const walk = (node: VlsmTreeNode): boolean => {
    if (node.id === targetNodeId) {
      if (node.status === 'split') {
        node.status = 'free';
        node.children = undefined;
        node.assignedName = undefined;
        node.hostsRequired = undefined;
        return true;
      }
      return false;
    }
    if (node.children) {
      return walk(node.children[0]) || walk(node.children[1]);
    }
    return false;
  };

  walk(cloned);
  return cloned;
}

export function assignVlsmLeafNode(
  root: VlsmTreeNode,
  targetNodeId: string,
  name: string,
  hostsRequired?: number
): VlsmTreeNode {
  const cloned = cloneTree(root);
  const cleanName = name.trim() || 'Assigned Subnet';

  const walk = (node: VlsmTreeNode): boolean => {
    if (node.id === targetNodeId && !node.children) {
      node.status = 'allocated';
      node.assignedName = cleanName;
      node.hostsRequired =
        typeof hostsRequired === 'number' && hostsRequired > 0
          ? Math.min(node.stats.usableHosts, Math.floor(hostsRequired))
          : undefined;
      return true;
    }
    if (node.children) {
      return walk(node.children[0]) || walk(node.children[1]);
    }
    return false;
  };

  walk(cloned);
  return cloned;
}

export function unassignVlsmLeafNode(
  root: VlsmTreeNode,
  targetNodeId: string
): VlsmTreeNode {
  const cloned = cloneTree(root);

  const walk = (node: VlsmTreeNode): boolean => {
    if (node.id === targetNodeId && node.status === 'allocated') {
      node.status = 'free';
      node.assignedName = undefined;
      node.hostsRequired = undefined;
      return true;
    }
    if (node.children) {
      return walk(node.children[0]) || walk(node.children[1]);
    }
    return false;
  };

  walk(cloned);
  return cloned;
}

export function findVlsmNodeById(
  root: VlsmTreeNode | null,
  targetId: string | null
): VlsmTreeNode | null {
  if (!root || !targetId) return null;
  if (root.id === targetId) return root;
  if (root.children) {
    return (
      findVlsmNodeById(root.children[0], targetId) ||
      findVlsmNodeById(root.children[1], targetId)
    );
  }
  return null;
}

export function summarizeVlsmTree(
  root: VlsmTreeNode | null,
  unassignedDemands: VlsmDepartmentDemand[] = []
): VlsmAllocationSummary | null {
  if (!root) return null;

  const allocatedLeaves: VlsmTreeNode[] = [];
  const freeLeaves: VlsmTreeNode[] = [];
  let maxDepth = 0;

  const collect = (node: VlsmTreeNode, depth: number) => {
    if (depth > maxDepth) maxDepth = depth;
    if (node.status === 'split' && node.children) {
      collect(node.children[0], depth + 1);
      collect(node.children[1], depth + 1);
      return;
    }
    if (node.status === 'allocated') {
      allocatedLeaves.push(node);
    } else {
      freeLeaves.push(node);
    }
  };

  collect(root, 0);

  const totalSupernetAddresses = root.stats.totalAddresses;
  const allocatedAddresses = allocatedLeaves.reduce(
    (sum, leaf) => sum + leaf.stats.totalAddresses,
    0
  );
  const freeAddresses = Math.max(0, totalSupernetAddresses - allocatedAddresses);
  const utilizationPercent =
    totalSupernetAddresses > 0
      ? Math.round((allocatedAddresses / totalSupernetAddresses) * 1000) / 10
      : 0;

  return {
    baseCidrLabel: root.cidrLabel,
    totalSupernetAddresses,
    allocatedAddresses,
    freeAddresses,
    utilizationPercent,
    allocatedLeaves,
    freeLeaves,
    unassignedDemands,
    maxDepth
  };
}
