export type NetworkDeviceType =
  | 'core-router'
  | 'edge-router'
  | 'l3-switch'
  | 'l2-switch'
  | 'firewall'
  | 'load-balancer'
  | 'vpn-gateway'
  | 'wan-cloud'
  | 'wlc'
  | 'access-point'
  | 'server'
  | 'workstation';

export type DeviceCategory =
  | 'Routing & Switching'
  | 'Security & WAN'
  | 'Wireless & Endpoints';

export type PortSide = 'auto' | 'top' | 'right' | 'bottom' | 'left';
export type ConcretePortSide = 'top' | 'right' | 'bottom' | 'left';

export type CableType = 'ethernet' | 'fiber' | 'serial' | 'wireless' | 'console';
export type CableRoutingStyle = 'orthogonal' | 'curved' | 'straight';
export type DiagramToolMode = 'select' | 'connect' | 'zone';

export type ZoneColorTheme = 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';

export interface NetworkDiagramNode {
  id: string;
  type: NetworkDeviceType;
  label: string;
  ipAddress: string;
  subnetMask: string;
  vlanOrAsn: string;
  notes: string;
  x: number;
  y: number;
}

export interface NetworkDiagramCable {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort: PortSide;
  targetPort: PortSide;
  cableType: CableType;
  routingStyle: CableRoutingStyle;
  bandwidth: string;
  sourceInterface: string;
  targetInterface: string;
  label: string;
}

export interface NetworkDiagramZone {
  id: string;
  title: string;
  subtitle: string;
  color: ZoneColorTheme;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NetworkDiagramDocument {
  name: string;
  nodes: NetworkDiagramNode[];
  cables: NetworkDiagramCable[];
  zones: NetworkDiagramZone[];
}

export interface DeviceStencilMeta {
  type: NetworkDeviceType;
  name: string;
  shortPrefix: string;
  category: DeviceCategory;
  defaultIp: string;
  defaultMask: string;
  defaultVlanOrAsn: string;
  accentHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
}

export const NODE_WIDTH = 132;
export const NODE_HEIGHT = 86;
export const DIAGRAM_CANVAS_WIDTH = 2200;
export const DIAGRAM_CANVAS_HEIGHT = 1400;
export const GRID_SNAP_SIZE = 20;

export const NETWORK_DEVICE_STENCILS: DeviceStencilMeta[] = [
  {
    type: 'core-router',
    name: 'Core Router',
    shortPrefix: 'CR',
    category: 'Routing & Switching',
    defaultIp: '10.0.0.1',
    defaultMask: '/30',
    defaultVlanOrAsn: 'AS 65001',
    accentHex: '#2563eb',
    badgeBgClass: 'bg-blue-50 dark:bg-blue-950/60',
    badgeTextClass: 'text-blue-600 dark:text-cyan-400'
  },
  {
    type: 'edge-router',
    name: 'Edge / WAN Router',
    shortPrefix: 'RTR',
    category: 'Routing & Switching',
    defaultIp: '203.0.113.2',
    defaultMask: '/30',
    defaultVlanOrAsn: 'eBGP Peer',
    accentHex: '#0284c7',
    badgeBgClass: 'bg-sky-50 dark:bg-sky-950/60',
    badgeTextClass: 'text-sky-600 dark:text-sky-400'
  },
  {
    type: 'l3-switch',
    name: 'Layer 3 Switch',
    shortPrefix: 'L3-SW',
    category: 'Routing & Switching',
    defaultIp: '10.10.0.2',
    defaultMask: '/24',
    defaultVlanOrAsn: 'Core SVI',
    accentHex: '#4f46e5',
    badgeBgClass: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeTextClass: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    type: 'l2-switch',
    name: 'Layer 2 Switch',
    shortPrefix: 'SW',
    category: 'Routing & Switching',
    defaultIp: '10.10.10.10',
    defaultMask: '/24',
    defaultVlanOrAsn: 'VLAN 10,20',
    accentHex: '#0891b2',
    badgeBgClass: 'bg-cyan-50 dark:bg-cyan-950/60',
    badgeTextClass: 'text-cyan-600 dark:text-cyan-400'
  },
  {
    type: 'firewall',
    name: 'NGFW Firewall',
    shortPrefix: 'FW',
    category: 'Security & WAN',
    defaultIp: '172.16.0.1',
    defaultMask: '/24',
    defaultVlanOrAsn: 'HA Active',
    accentHex: '#dc2626',
    badgeBgClass: 'bg-red-50 dark:bg-red-950/50',
    badgeTextClass: 'text-red-600 dark:text-red-400'
  },
  {
    type: 'load-balancer',
    name: 'Load Balancer',
    shortPrefix: 'ADC',
    category: 'Security & WAN',
    defaultIp: '172.16.10.5',
    defaultMask: '/24',
    defaultVlanOrAsn: 'DMZ VIP',
    accentHex: '#d97706',
    badgeBgClass: 'bg-amber-50 dark:bg-amber-950/50',
    badgeTextClass: 'text-amber-600 dark:text-amber-400'
  },
  {
    type: 'vpn-gateway',
    name: 'VPN Concentrator',
    shortPrefix: 'VPN',
    category: 'Security & WAN',
    defaultIp: '198.51.100.10',
    defaultMask: '/29',
    defaultVlanOrAsn: 'IPsec IKEv2',
    accentHex: '#7c3aed',
    badgeBgClass: 'bg-violet-50 dark:bg-violet-950/50',
    badgeTextClass: 'text-violet-600 dark:text-violet-400'
  },
  {
    type: 'wan-cloud',
    name: 'WAN / ISP Cloud',
    shortPrefix: 'ISP',
    category: 'Security & WAN',
    defaultIp: '198.51.100.0',
    defaultMask: '/24',
    defaultVlanOrAsn: 'MPLS / DIA',
    accentHex: '#475569',
    badgeBgClass: 'bg-slate-100 dark:bg-slate-800',
    badgeTextClass: 'text-slate-600 dark:text-slate-300'
  },
  {
    type: 'wlc',
    name: 'Wireless Controller',
    shortPrefix: 'WLC',
    category: 'Wireless & Endpoints',
    defaultIp: '10.10.99.5',
    defaultMask: '/24',
    defaultVlanOrAsn: 'CAPWAP Mgmt',
    accentHex: '#0d9488',
    badgeBgClass: 'bg-teal-50 dark:bg-teal-950/50',
    badgeTextClass: 'text-teal-600 dark:text-teal-400'
  },
  {
    type: 'access-point',
    name: 'Wi-Fi Access Point',
    shortPrefix: 'AP',
    category: 'Wireless & Endpoints',
    defaultIp: '10.10.30.15',
    defaultMask: '/24',
    defaultVlanOrAsn: 'SSID Corp',
    accentHex: '#10b981',
    badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
    badgeTextClass: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    type: 'server',
    name: 'Server / Host',
    shortPrefix: 'SRV',
    category: 'Wireless & Endpoints',
    defaultIp: '10.10.50.20',
    defaultMask: '/24',
    defaultVlanOrAsn: 'VLAN 50',
    accentHex: '#334155',
    badgeBgClass: 'bg-slate-100 dark:bg-slate-800',
    badgeTextClass: 'text-slate-700 dark:text-slate-300'
  },
  {
    type: 'workstation',
    name: 'Workstation / PC',
    shortPrefix: 'PC',
    category: 'Wireless & Endpoints',
    defaultIp: '10.10.20.101',
    defaultMask: '/24',
    defaultVlanOrAsn: 'VLAN 20',
    accentHex: '#64748b',
    badgeBgClass: 'bg-slate-100 dark:bg-slate-800',
    badgeTextClass: 'text-slate-600 dark:text-slate-300'
  }
];

export const STENCIL_MAP: Record<NetworkDeviceType, DeviceStencilMeta> =
  NETWORK_DEVICE_STENCILS.reduce((acc, item) => {
    acc[item.type] = item;
    return acc;
  }, {} as Record<NetworkDeviceType, DeviceStencilMeta>);

export interface CableSpec {
  type: CableType;
  label: string;
  shortLabel: string;
  defaultBandwidth: string;
  lightStroke: string;
  darkStroke: string;
  dashArray?: string;
  strokeWidth: number;
}

export const CABLE_SPECS: Record<CableType, CableSpec> = {
  ethernet: {
    type: 'ethernet',
    label: 'Copper Ethernet (Cat6)',
    shortLabel: 'Ethernet',
    defaultBandwidth: '1 Gbps',
    lightStroke: '#2563eb',
    darkStroke: '#38bdf8',
    strokeWidth: 2.25
  },
  fiber: {
    type: 'fiber',
    label: 'Fiber Optic Trunk (SFP+)',
    shortLabel: 'Fiber',
    defaultBandwidth: '10 Gbps',
    lightStroke: '#d97706',
    darkStroke: '#fbbf24',
    strokeWidth: 2.75
  },
  serial: {
    type: 'serial',
    label: 'WAN / Serial / DIA',
    shortLabel: 'WAN Link',
    defaultBandwidth: '500 Mbps',
    lightStroke: '#7c3aed',
    darkStroke: '#a78bfa',
    dashArray: '8 4',
    strokeWidth: 2.25
  },
  wireless: {
    type: 'wireless',
    label: 'Wireless / RF Uplink',
    shortLabel: 'Wireless',
    defaultBandwidth: 'Wi-Fi 6E',
    lightStroke: '#059669',
    darkStroke: '#34d399',
    dashArray: '4 4',
    strokeWidth: 2
  },
  console: {
    type: 'console',
    label: 'Console / OOB Mgmt',
    shortLabel: 'Mgmt/OOB',
    defaultBandwidth: '115.2k / OOB',
    lightStroke: '#0891b2',
    darkStroke: '#22d3ee',
    dashArray: '2 4',
    strokeWidth: 2
  }
};

export interface DiagramTemplate {
  id: string;
  label: string;
  document: NetworkDiagramDocument;
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: 'enterprise-campus',
    label: 'Enterprise 3-Tier Campus',
    document: {
      name: 'Enterprise 3-Tier Campus Topology',
      zones: [
        {
          id: 'zone-wan',
          title: 'Perimeter & Edge',
          subtitle: 'AS 65001 · Public /29',
          color: 'amber',
          x: 220,
          y: 40,
          width: 480,
          height: 150
        },
        {
          id: 'zone-dmz',
          title: 'DMZ Services',
          subtitle: '172.16.10.0/24',
          color: 'violet',
          x: 740,
          y: 190,
          width: 240,
          height: 240
        },
        {
          id: 'zone-core',
          title: 'Core & Distribution',
          subtitle: 'OSPF Area 0 · 10.10.0.0/22',
          color: 'blue',
          x: 180,
          y: 230,
          width: 520,
          height: 210
        },
        {
          id: 'zone-access',
          title: 'Access Layer & Endpoints',
          subtitle: 'VLAN 10 / 20 / 30',
          color: 'emerald',
          x: 180,
          y: 480,
          width: 780,
          height: 160
        }
      ],
      nodes: [
        {
          id: 'nd-isp',
          type: 'wan-cloud',
          label: 'Primary ISP DIA',
          ipAddress: '198.51.100.1',
          subnetMask: '/30',
          vlanOrAsn: 'AS 3356',
          notes: 'Dual-homed fiber handoff',
          x: 260,
          y: 72
        },
        {
          id: 'nd-fw',
          type: 'firewall',
          label: 'Perimeter NGFW-01',
          ipAddress: '198.51.100.2',
          subnetMask: '/30',
          vlanOrAsn: 'Active/Standby',
          notes: 'SSL Inspection & IPS enabled',
          x: 520,
          y: 72
        },
        {
          id: 'nd-core1',
          type: 'l3-switch',
          label: 'CORE-SW-01',
          ipAddress: '10.10.0.1',
          subnetMask: '/24',
          vlanOrAsn: 'OSPF Area 0',
          notes: 'vPC / StackWise Virtual primary',
          x: 260,
          y: 280
        },
        {
          id: 'nd-core2',
          type: 'l3-switch',
          label: 'CORE-SW-02',
          ipAddress: '10.10.0.2',
          subnetMask: '/24',
          vlanOrAsn: 'OSPF Area 0',
          notes: 'Redundant core peer',
          x: 520,
          y: 280
        },
        {
          id: 'nd-adc',
          type: 'load-balancer',
          label: 'DMZ-ADC-01',
          ipAddress: '172.16.10.5',
          subnetMask: '/24',
          vlanOrAsn: 'DMZ VIP',
          notes: 'HTTPS reverse proxy',
          x: 790,
          y: 230
        },
        {
          id: 'nd-web',
          type: 'server',
          label: 'APP-WEB-01',
          ipAddress: '172.16.10.20',
          subnetMask: '/24',
          vlanOrAsn: 'VLAN 110',
          notes: 'Public portal cluster',
          x: 790,
          y: 340
        },
        {
          id: 'nd-acc1',
          type: 'l2-switch',
          label: 'ACC-FL1-SW01',
          ipAddress: '10.10.10.11',
          subnetMask: '/24',
          vlanOrAsn: 'VLAN 10,20',
          notes: 'PoE+ 48-port access switch',
          x: 220,
          y: 520
        },
        {
          id: 'nd-ap1',
          type: 'access-point',
          label: 'AP-NORTH-01',
          ipAddress: '10.10.30.15',
          subnetMask: '/24',
          vlanOrAsn: 'SSID Corp',
          notes: 'Wi-Fi 6E ceiling mount',
          x: 420,
          y: 520
        },
        {
          id: 'nd-pc1',
          type: 'workstation',
          label: 'ENG-WS-104',
          ipAddress: '10.10.20.104',
          subnetMask: '/24',
          vlanOrAsn: 'VLAN 20',
          notes: '802.1X authenticated host',
          x: 620,
          y: 520
        },
        {
          id: 'nd-srv1',
          type: 'server',
          label: 'DC-HYPERV-01',
          ipAddress: '10.10.50.10',
          subnetMask: '/24',
          vlanOrAsn: 'VLAN 50',
          notes: 'Internal Active Directory & DNS',
          x: 800,
          y: 520
        }
      ],
      cables: [
        {
          id: 'cb-1',
          sourceId: 'nd-isp',
          targetId: 'nd-fw',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'serial',
          routingStyle: 'orthogonal',
          bandwidth: '10 Gbps DIA',
          sourceInterface: 'ISP-0/0',
          targetInterface: 'eth1/1',
          label: 'eBGP'
        },
        {
          id: 'cb-2',
          sourceId: 'nd-fw',
          targetId: 'nd-core1',
          sourcePort: 'bottom',
          targetPort: 'top',
          cableType: 'fiber',
          routingStyle: 'orthogonal',
          bandwidth: '10G SFP+',
          sourceInterface: 'eth1/2',
          targetInterface: 'Te1/0/1',
          label: 'Inside'
        },
        {
          id: 'cb-3',
          sourceId: 'nd-fw',
          targetId: 'nd-core2',
          sourcePort: 'bottom',
          targetPort: 'top',
          cableType: 'fiber',
          routingStyle: 'orthogonal',
          bandwidth: '10G SFP+',
          sourceInterface: 'eth1/3',
          targetInterface: 'Te1/0/1',
          label: 'Inside Redundant'
        },
        {
          id: 'cb-4',
          sourceId: 'nd-core1',
          targetId: 'nd-core2',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'fiber',
          routingStyle: 'straight',
          bandwidth: '40G QSFP+',
          sourceInterface: 'Fo1/0/1',
          targetInterface: 'Fo1/0/1',
          label: 'Peer-Link'
        },
        {
          id: 'cb-5',
          sourceId: 'nd-fw',
          targetId: 'nd-adc',
          sourcePort: 'right',
          targetPort: 'top',
          cableType: 'ethernet',
          routingStyle: 'orthogonal',
          bandwidth: '10 Gbps',
          sourceInterface: 'eth1/4',
          targetInterface: '1/1',
          label: 'DMZ'
        },
        {
          id: 'cb-6',
          sourceId: 'nd-adc',
          targetId: 'nd-web',
          sourcePort: 'bottom',
          targetPort: 'top',
          cableType: 'ethernet',
          routingStyle: 'straight',
          bandwidth: '1 Gbps',
          sourceInterface: '1/2',
          targetInterface: 'ens192',
          label: 'VIP Pool'
        },
        {
          id: 'cb-7',
          sourceId: 'nd-core1',
          targetId: 'nd-acc1',
          sourcePort: 'bottom',
          targetPort: 'top',
          cableType: 'fiber',
          routingStyle: 'orthogonal',
          bandwidth: '10G Trunk',
          sourceInterface: 'Te1/0/5',
          targetInterface: 'Te1/1/1',
          label: 'LACP'
        },
        {
          id: 'cb-8',
          sourceId: 'nd-acc1',
          targetId: 'nd-ap1',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'ethernet',
          routingStyle: 'straight',
          bandwidth: '2.5G PoE+',
          sourceInterface: 'Gi1/0/12',
          targetInterface: 'eth0',
          label: 'PoE+'
        },
        {
          id: 'cb-9',
          sourceId: 'nd-core2',
          targetId: 'nd-srv1',
          sourcePort: 'bottom',
          targetPort: 'top',
          cableType: 'fiber',
          routingStyle: 'orthogonal',
          bandwidth: '10G SFP+',
          sourceInterface: 'Te1/0/8',
          targetInterface: 'sfp0',
          label: 'Server Farm'
        },
        {
          id: 'cb-10',
          sourceId: 'nd-ap1',
          targetId: 'nd-pc1',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'wireless',
          routingStyle: 'curved',
          bandwidth: 'Wi-Fi 6E',
          sourceInterface: 'wlan0',
          targetInterface: 'wifi0',
          label: '802.11ax'
        }
      ]
    }
  },
  {
    id: 'site-vpn',
    label: 'Hub & Spoke Site VPN',
    document: {
      name: 'Hub & Spoke IPsec VPN Topology',
      zones: [
        {
          id: 'zone-hq',
          title: 'HQ Data Center',
          subtitle: '10.0.0.0/16',
          color: 'blue',
          x: 120,
          y: 120,
          width: 300,
          height: 360
        },
        {
          id: 'zone-branch',
          title: 'Remote Branch Sites',
          subtitle: '10.20.0.0/16 · 10.30.0.0/16',
          color: 'emerald',
          x: 680,
          y: 120,
          width: 300,
          height: 360
        }
      ],
      nodes: [
        {
          id: 'vpn-hq-rtr',
          type: 'vpn-gateway',
          label: 'HQ-VPN-HUB',
          ipAddress: '198.51.100.10',
          subnetMask: '/29',
          vlanOrAsn: 'IKEv2 Hub',
          notes: 'Primary tunnel terminator',
          x: 200,
          y: 170
        },
        {
          id: 'vpn-hq-sw',
          type: 'l3-switch',
          label: 'HQ-CORE-L3',
          ipAddress: '10.0.1.1',
          subnetMask: '/24',
          vlanOrAsn: 'OSPF Hub',
          notes: 'HQ internal gateway',
          x: 200,
          y: 350
        },
        {
          id: 'vpn-cloud',
          type: 'wan-cloud',
          label: 'Internet IPsec Mesh',
          ipAddress: '0.0.0.0',
          subnetMask: '/0',
          vlanOrAsn: 'GRE / IPsec',
          notes: 'Public transport',
          x: 480,
          y: 255
        },
        {
          id: 'vpn-br1',
          type: 'edge-router',
          label: 'BRANCH-EAST-RTR',
          ipAddress: '10.20.1.1',
          subnetMask: '/24',
          vlanOrAsn: 'Spoke 01',
          notes: 'East regional office',
          x: 750,
          y: 170
        },
        {
          id: 'vpn-br2',
          type: 'edge-router',
          label: 'BRANCH-WEST-RTR',
          ipAddress: '10.30.1.1',
          subnetMask: '/24',
          vlanOrAsn: 'Spoke 02',
          notes: 'West regional office',
          x: 750,
          y: 350
        }
      ],
      cables: [
        {
          id: 'vc-1',
          sourceId: 'vpn-hq-rtr',
          targetId: 'vpn-hq-sw',
          sourcePort: 'bottom',
          targetPort: 'top',
          cableType: 'fiber',
          routingStyle: 'straight',
          bandwidth: '10 Gbps',
          sourceInterface: 'Gi0/0',
          targetInterface: 'Te1/0/1',
          label: 'Inside'
        },
        {
          id: 'vc-2',
          sourceId: 'vpn-hq-rtr',
          targetId: 'vpn-cloud',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'serial',
          routingStyle: 'curved',
          bandwidth: '1 Gbps',
          sourceInterface: 'Tu0',
          targetInterface: 'WAN',
          label: 'IPsec Hub'
        },
        {
          id: 'vc-3',
          sourceId: 'vpn-cloud',
          targetId: 'vpn-br1',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'serial',
          routingStyle: 'curved',
          bandwidth: '500 Mbps',
          sourceInterface: 'WAN',
          targetInterface: 'Tu10',
          label: 'Tunnel 10'
        },
        {
          id: 'vc-4',
          sourceId: 'vpn-cloud',
          targetId: 'vpn-br2',
          sourcePort: 'right',
          targetPort: 'left',
          cableType: 'serial',
          routingStyle: 'curved',
          bandwidth: '500 Mbps',
          sourceInterface: 'WAN',
          targetInterface: 'Tu20',
          label: 'Tunnel 20'
        }
      ]
    }
  },
  {
    id: 'blank',
    label: 'Blank Topology Canvas',
    document: {
      name: 'Untitled Network Topology',
      zones: [],
      nodes: [],
      cables: []
    }
  }
];

export function resolvePortAnchor(
  node: NetworkDiagramNode,
  side: PortSide,
  otherNode?: NetworkDiagramNode
): { x: number; y: number; side: ConcretePortSide } {
  let concrete: ConcretePortSide = 'right';
  if (side !== 'auto') {
    concrete = side;
  } else if (otherNode) {
    const dx = otherNode.x + NODE_WIDTH / 2 - (node.x + NODE_WIDTH / 2);
    const dy = otherNode.y + NODE_HEIGHT / 2 - (node.y + NODE_HEIGHT / 2);
    if (Math.abs(dx) >= Math.abs(dy)) {
      concrete = dx >= 0 ? 'right' : 'left';
    } else {
      concrete = dy >= 0 ? 'bottom' : 'top';
    }
  }

  switch (concrete) {
    case 'top':
      return { x: node.x + NODE_WIDTH / 2, y: node.y, side: 'top' };
    case 'right':
      return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2, side: 'right' };
    case 'bottom':
      return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT, side: 'bottom' };
    case 'left':
      return { x: node.x, y: node.y + NODE_HEIGHT / 2, side: 'left' };
  }
}

function getPortVector(side: ConcretePortSide): { vx: number; vy: number } {
  switch (side) {
    case 'top':
      return { vx: 0, vy: -1 };
    case 'right':
      return { vx: 1, vy: 0 };
    case 'bottom':
      return { vx: 0, vy: 1 };
    case 'left':
      return { vx: -1, vy: 0 };
  }
}

export function computeCableGeometry(
  source: NetworkDiagramNode,
  target: NetworkDiagramNode,
  cable: Pick<NetworkDiagramCable, 'sourcePort' | 'targetPort' | 'routingStyle'>
): {
  pathD: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
} {
  const start = resolvePortAnchor(source, cable.sourcePort, target);
  const end = resolvePortAnchor(target, cable.targetPort, source);

  if (cable.routingStyle === 'straight') {
    return {
      pathD: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      midX: (start.x + end.x) / 2,
      midY: (start.y + end.y) / 2
    };
  }

  if (cable.routingStyle === 'curved') {
    const sv = getPortVector(start.side);
    const ev = getPortVector(end.side);
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const offset = Math.max(48, Math.min(180, dist * 0.42));
    const c1x = start.x + sv.vx * offset;
    const c1y = start.y + sv.vy * offset;
    const c2x = end.x + ev.vx * offset;
    const c2y = end.y + ev.vy * offset;
    const midX = 0.125 * start.x + 0.375 * c1x + 0.375 * c2x + 0.125 * end.x;
    const midY = 0.125 * start.y + 0.375 * c1y + 0.375 * c2y + 0.125 * end.y;

    return {
      pathD: `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      midX,
      midY
    };
  }

  // Orthogonal Visio-style elbow path
  const startHorizontal = start.side === 'left' || start.side === 'right';
  const endHorizontal = end.side === 'left' || end.side === 'right';

  let points: Array<{ x: number; y: number }>;
  if (startHorizontal && endHorizontal) {
    const midX = (start.x + end.x) / 2;
    points = [
      { x: start.x, y: start.y },
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      { x: end.x, y: end.y }
    ];
  } else if (!startHorizontal && !endHorizontal) {
    const midY = (start.y + end.y) / 2;
    points = [
      { x: start.x, y: start.y },
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      { x: end.x, y: end.y }
    ];
  } else if (startHorizontal && !endHorizontal) {
    points = [
      { x: start.x, y: start.y },
      { x: end.x, y: start.y },
      { x: end.x, y: end.y }
    ];
  } else {
    points = [
      { x: start.x, y: start.y },
      { x: start.x, y: end.y },
      { x: end.x, y: end.y }
    ];
  }

  const pathD = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');

  // Midpoint along the middle segment
  const midSegIdx = Math.floor((points.length - 1) / 2);
  const pA = points[midSegIdx];
  const pB = points[midSegIdx + 1] || pA;

  return {
    pathD,
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    midX: (pA.x + pB.x) / 2,
    midY: (pA.y + pB.y) / 2
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export async function exportNetworkDiagramToPng(
  doc: NetworkDiagramDocument,
  isDarkTheme: boolean
): Promise<void> {
  // Compute tight bounding box across zones & nodes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  doc.zones.forEach(z => {
    minX = Math.min(minX, z.x);
    minY = Math.min(minY, z.y);
    maxX = Math.max(maxX, z.x + z.width);
    maxY = Math.max(maxY, z.y + z.height);
  });

  doc.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.y + NODE_HEIGHT);
  });

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 480;
  }

  const pad = 48;
  const headerH = 74;
  const contentW = Math.max(760, maxX - minX + pad * 2);
  const contentH = Math.max(420, maxY - minY + pad * 2);
  const canvasW = contentW;
  const canvasH = headerH + contentH;

  const dpr = Math.max(canvasW, canvasH) * 2 <= 9000 ? 2 : 1.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(canvasW * dpr);
  canvas.height = Math.ceil(canvasH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas export');
  ctx.scale(dpr, dpr);

  const bg = isDarkTheme ? '#070b14' : '#f8fafc';
  const headerBg = isDarkTheme ? '#0c1220' : '#ffffff';
  const borderCol = isDarkTheme ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDarkTheme ? '#f8fafc' : '#0f172a';
  const textMuted = isDarkTheme ? '#94a3b8' : '#64748b';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Grid dots
  ctx.fillStyle = isDarkTheme ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.16)';
  for (let gx = 20; gx < canvasW; gx += 20) {
    for (let gy = headerH + 20; gy < canvasH; gy += 20) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  // Header
  ctx.fillStyle = headerBg;
  ctx.fillRect(0, 0, canvasW, headerH);
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerH - 0.5);
  ctx.lineTo(canvasW, headerH - 0.5);
  ctx.stroke();

  const sansFont = 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif';
  const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  ctx.textBaseline = 'top';
  ctx.fillStyle = textPrimary;
  ctx.font = `700 16px ${sansFont}`;
  ctx.fillText(doc.name || 'Network Topology Diagram', 28, 16);

  ctx.fillStyle = textMuted;
  ctx.font = `500 11px ${monoFont}`;
  ctx.fillText(
    `${doc.nodes.length} Network Devices  ·  ${doc.cables.length} Cables  ·  ${doc.zones.length} Zones`,
    28,
    42
  );

  ctx.save();
  ctx.translate(pad - minX, headerH + pad - minY);

  // Zones
  const zonePalettes: Record<ZoneColorTheme, { fill: string; stroke: string; title: string }> = {
    blue: {
      fill: isDarkTheme ? 'rgba(37,99,235,0.08)' : 'rgba(219,234,254,0.45)',
      stroke: isDarkTheme ? 'rgba(56,189,248,0.35)' : 'rgba(59,130,246,0.45)',
      title: isDarkTheme ? '#67e8f9' : '#1d4ed8'
    },
    emerald: {
      fill: isDarkTheme ? 'rgba(16,185,129,0.08)' : 'rgba(209,250,229,0.45)',
      stroke: isDarkTheme ? 'rgba(52,211,153,0.35)' : 'rgba(16,185,129,0.45)',
      title: isDarkTheme ? '#6ee7b7' : '#047857'
    },
    amber: {
      fill: isDarkTheme ? 'rgba(245,158,11,0.08)' : 'rgba(254,243,199,0.45)',
      stroke: isDarkTheme ? 'rgba(251,191,36,0.35)' : 'rgba(245,158,11,0.45)',
      title: isDarkTheme ? '#fcd34d' : '#b45309'
    },
    violet: {
      fill: isDarkTheme ? 'rgba(139,92,246,0.08)' : 'rgba(237,233,254,0.45)',
      stroke: isDarkTheme ? 'rgba(167,139,250,0.35)' : 'rgba(139,92,246,0.45)',
      title: isDarkTheme ? '#c4b5fd' : '#6d28d9'
    },
    slate: {
      fill: isDarkTheme ? 'rgba(100,116,139,0.1)' : 'rgba(241,245,249,0.65)',
      stroke: isDarkTheme ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.4)',
      title: isDarkTheme ? '#cbd5e1' : '#334155'
    }
  };

  doc.zones.forEach(z => {
    const zp = zonePalettes[z.color] || zonePalettes.blue;
    ctx.save();
    drawRoundedRect(ctx, z.x, z.y, z.width, z.height, 14);
    ctx.fillStyle = zp.fill;
    ctx.fill();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = zp.stroke;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = zp.title;
    ctx.font = `700 11px ${sansFont}`;
    ctx.fillText(z.title, z.x + 12, z.y + 10);
    if (z.subtitle) {
      ctx.fillStyle = textMuted;
      ctx.font = `500 10px ${monoFont}`;
      ctx.fillText(z.subtitle, z.x + 12, z.y + 25);
    }
  });

  // Cables
  const nodeMap = new Map(doc.nodes.map(n => [n.id, n]));
  doc.cables.forEach(cable => {
    const src = nodeMap.get(cable.sourceId);
    const dst = nodeMap.get(cable.targetId);
    if (!src || !dst) return;
    const geom = computeCableGeometry(src, dst, cable);
    const spec = CABLE_SPECS[cable.cableType];
    const stroke = isDarkTheme ? spec.darkStroke : spec.lightStroke;

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = spec.strokeWidth;
    if (spec.dashArray) {
      ctx.setLineDash(spec.dashArray.split(' ').map(Number));
    }
    ctx.stroke(new Path2D(geom.pathD));
    ctx.restore();

    // Endpoints
    [
      { x: geom.startX, y: geom.startY },
      { x: geom.endX, y: geom.endY }
    ].forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
    });

    const badgeText = cable.label || cable.bandwidth || spec.shortLabel;
    if (badgeText) {
      ctx.font = `600 9.5px ${monoFont}`;
      const tw = ctx.measureText(badgeText).width + 10;
      drawRoundedRect(ctx, geom.midX - tw / 2, geom.midY - 9, tw, 18, 5);
      ctx.fillStyle = headerBg;
      ctx.fill();
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = textPrimary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, geom.midX, geom.midY + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }
  });

  // Device Cards
  doc.nodes.forEach(node => {
    const meta = STENCIL_MAP[node.type];
    drawRoundedRect(ctx, node.x, node.y, NODE_WIDTH, NODE_HEIGHT, 12);
    ctx.fillStyle = headerBg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = borderCol;
    ctx.stroke();

    // Top accent bar inside device card
    ctx.fillStyle = meta.accentHex;
    drawRoundedRect(ctx, node.x + 12, node.y + 10, 26, 26, 7);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 9px ${monoFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.shortPrefix.slice(0, 4), node.x + 25, node.y + 23);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textMuted;
    ctx.font = `600 9.5px ${monoFont}`;
    ctx.fillText(meta.name.slice(0, 13), node.x + 44, node.y + 12);

    ctx.fillStyle = textPrimary;
    ctx.font = `700 11px ${sansFont}`;
    ctx.fillText(node.label.slice(0, 17), node.x + 10, node.y + 44);

    ctx.fillStyle = textMuted;
    ctx.font = `500 9.5px ${monoFont}`;
    const ipText = `${node.ipAddress}${node.subnetMask || ''}`;
    ctx.fillText(ipText.slice(0, 19), node.x + 10, node.y + 62);
  });

  ctx.restore();

  const slug = (doc.name || 'network-topology')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `${slug || 'network-topology'}.png`;

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
