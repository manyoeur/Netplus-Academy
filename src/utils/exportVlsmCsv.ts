import { VlsmAllocationSummary, VlsmTreeNode } from './vlsmTree';

function escapeCsvField(value: string | number | undefined | null): string {
  const raw = value === undefined || value === null ? '' : String(value);
  // Mitigate spreadsheet formula injection when opening untrusted segment names in Excel/Sheets
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function collectOrderedLeafNodes(root: VlsmTreeNode): VlsmTreeNode[] {
  const leaves: VlsmTreeNode[] = [];
  const walk = (node: VlsmTreeNode) => {
    if (node.status === 'split' && node.children) {
      walk(node.children[0]);
      walk(node.children[1]);
      return;
    }
    leaves.push(node);
  };
  walk(root);
  return leaves;
}

export function buildVlsmHierarchyCsv(root: VlsmTreeNode): string {
  const leaves = collectOrderedLeafNodes(root);

  const headers = [
    'Segment',
    'Status',
    'Subnet Address',
    'CIDR',
    'Subnet Mask',
    'Broadcast',
    'Host Range',
    'Usable Hosts',
    'Required Hosts',
    'Binary Path'
  ];

  const rows = leaves.map(leaf => {
    const segmentLabel =
      leaf.status === 'allocated'
        ? leaf.assignedName || 'Allocated Subnet'
        : 'Available Block';
    const statusLabel = leaf.status === 'allocated' ? 'Allocated' : 'Available';
    const hostRange = `${leaf.stats.firstHost} - ${leaf.stats.lastHost}`;
    const binaryPath = leaf.binaryPath
      ? `Root -> ${leaf.binaryPath.split('').join(' -> ')}`
      : 'Root';

    return [
      segmentLabel,
      statusLabel,
      leaf.stats.networkStr,
      `/${leaf.prefix}`,
      leaf.stats.maskStr,
      leaf.stats.broadcastStr,
      hostRange,
      leaf.stats.usableHosts,
      leaf.hostsRequired ?? '',
      binaryPath
    ]
      .map(escapeCsvField)
      .join(',');
  });

  return '\uFEFF' + [headers.map(escapeCsvField).join(','), ...rows].join('\r\n');
}

export function exportVlsmTreeToCsv(
  root: VlsmTreeNode,
  summary: VlsmAllocationSummary
): void {
  const csvContent = buildVlsmHierarchyCsv(root);
  const safeSlug = summary.baseCidrLabel
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `vlsm-hierarchy-${safeSlug || 'subnet'}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
