import { getDiagramDeviceInnerSvg } from '../components/Lab/NetworkDeviceGlyph';

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
  | 'ip-phone'
  | 'workstation'
  | 'analog-cctv'
  | 'digital-cctv'
  | 'smart-cctv'
  | 'nvr'
  | 'dvr';

export type DeviceCategory =
  | 'Routing & Switching'
  | 'Security & WAN'
  | 'Wireless & Endpoints'
  | 'CCTV & Surveillance';

export type PortSide = 'auto' | 'top' | 'right' | 'bottom' | 'left';
export type ConcretePortSide = 'top' | 'right' | 'bottom' | 'left';

export type CableType = 'ethernet' | 'fiber' | 'serial' | 'wireless' | 'console';
export type CableRoutingStyle = 'orthogonal' | 'curved' | 'straight';
export type DiagramToolMode = 'select' | 'pan' | 'connect' | 'zone' | 'label';

export type ZoneColorTheme = 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';
export type RackColorTheme = 'slate' | 'blue' | 'cyan' | 'emerald' | 'amber' | 'violet';
export type RackContainerStyle = 'rack' | 'group';
export type LabelColorTheme = 'slate' | 'blue' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'red';
export type LabelSizePreset = 'sm' | 'md' | 'lg' | 'title';

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

export interface NetworkDiagramLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: LabelSizePreset;
  color: LabelColorTheme;
  bold: boolean;
}

export interface NetworkDiagramRack {
  id: string;
  title: string;
  subtitle: string;
  style: RackContainerStyle;
  color: RackColorTheme;
  nodeIds: string[];
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
  labels: NetworkDiagramLabel[];
  racks?: NetworkDiagramRack[];
}

export const LABEL_SIZE_CONFIG: Record<
  LabelSizePreset,
  { label: string; px: number; className: string }
> = {
  sm: { label: 'Small', px: 12, className: 'text-xs leading-snug' },
  md: { label: 'Medium', px: 14, className: 'text-sm leading-snug' },
  lg: { label: 'Large', px: 18, className: 'text-lg leading-snug' },
  title: { label: 'Title', px: 24, className: 'text-2xl leading-tight' }
};

export const LABEL_COLOR_STYLES: Record<
  LabelColorTheme,
  { label: string; className: string; swatchClass: string; lightHex: string; darkHex: string }
> = {
  slate: {
    label: 'Slate',
    className: 'text-slate-900 dark:text-slate-100',
    swatchClass: 'bg-slate-800 dark:bg-slate-200',
    lightHex: '#0f172a',
    darkHex: '#f1f5f9'
  },
  blue: {
    label: 'Blue',
    className: 'text-blue-700 dark:text-blue-300',
    swatchClass: 'bg-blue-600',
    lightHex: '#1d4ed8',
    darkHex: '#93c5fd'
  },
  cyan: {
    label: 'Cyan',
    className: 'text-sky-600 dark:text-cyan-300',
    swatchClass: 'bg-sky-500',
    lightHex: '#0284c7',
    darkHex: '#67e8f9'
  },
  emerald: {
    label: 'Green',
    className: 'text-emerald-700 dark:text-emerald-300',
    swatchClass: 'bg-emerald-600',
    lightHex: '#047857',
    darkHex: '#6ee7b7'
  },
  amber: {
    label: 'Amber',
    className: 'text-amber-700 dark:text-amber-300',
    swatchClass: 'bg-amber-500',
    lightHex: '#b45309',
    darkHex: '#fcd34d'
  },
  violet: {
    label: 'Violet',
    className: 'text-violet-700 dark:text-violet-300',
    swatchClass: 'bg-violet-600',
    lightHex: '#6d28d9',
    darkHex: '#c4b5fd'
  },
  red: {
    label: 'Red',
    className: 'text-red-600 dark:text-red-400',
    swatchClass: 'bg-red-600',
    lightHex: '#dc2626',
    darkHex: '#f87171'
  }
};

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
  keywords?: string;
}

export const NODE_WIDTH = 92;
export const NODE_HEIGHT = 78;
export const DIAGRAM_CANVAS_WIDTH = 2800;
export const DIAGRAM_CANVAS_HEIGHT = 1800;
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
    type: 'ip-phone',
    name: 'IP Phone',
    shortPrefix: 'VOIP',
    category: 'Wireless & Endpoints',
    defaultIp: '10.10.40.25',
    defaultMask: '/24',
    defaultVlanOrAsn: 'Voice VLAN 40',
    accentHex: '#0284c7',
    badgeBgClass: 'bg-sky-50 dark:bg-sky-950/50',
    badgeTextClass: 'text-sky-600 dark:text-sky-400'
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
  },
  {
    type: 'analog-cctv',
    name: 'Analog CCTV Camera',
    shortPrefix: 'CAM-A',
    category: 'CCTV & Surveillance',
    defaultIp: 'Coax CH-1',
    defaultMask: 'BNC',
    defaultVlanOrAsn: 'CVBS / AHD',
    accentHex: '#d97706',
    badgeBgClass: 'bg-amber-50 dark:bg-amber-950/50',
    badgeTextClass: 'text-amber-600 dark:text-amber-400',
    keywords: 'analog analogy cctv camera security coax bnc surveillance'
  },
  {
    type: 'digital-cctv',
    name: 'Digital IP CCTV',
    shortPrefix: 'CAM-IP',
    category: 'CCTV & Surveillance',
    defaultIp: '10.10.60.11',
    defaultMask: '/24',
    defaultVlanOrAsn: 'PoE VLAN 60',
    accentHex: '#0284c7',
    badgeBgClass: 'bg-sky-50 dark:bg-sky-950/50',
    badgeTextClass: 'text-sky-600 dark:text-sky-400',
    keywords: 'digital ip cctv camera security poe dome onvif surveillance'
  },
  {
    type: 'smart-cctv',
    name: 'Smart AI CCTV',
    shortPrefix: 'CAM-AI',
    category: 'CCTV & Surveillance',
    defaultIp: '10.10.60.21',
    defaultMask: '/24',
    defaultVlanOrAsn: 'AI / Wi-Fi',
    accentHex: '#059669',
    badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
    badgeTextClass: 'text-emerald-600 dark:text-emerald-400',
    keywords: 'smart ai cctv camera security ptz wifi analytics surveillance'
  },
  {
    type: 'nvr',
    name: 'NVR Recorder',
    shortPrefix: 'NVR',
    category: 'CCTV & Surveillance',
    defaultIp: '10.10.60.5',
    defaultMask: '/24',
    defaultVlanOrAsn: 'PoE 16-Ch',
    accentHex: '#2563eb',
    badgeBgClass: 'bg-blue-50 dark:bg-blue-950/50',
    badgeTextClass: 'text-blue-600 dark:text-cyan-400',
    keywords: 'nvr network video recorder cctv security storage surveillance'
  },
  {
    type: 'dvr',
    name: 'DVR Recorder',
    shortPrefix: 'DVR',
    category: 'CCTV & Surveillance',
    defaultIp: '10.10.60.6',
    defaultMask: '/24',
    defaultVlanOrAsn: 'BNC 8-Ch',
    accentHex: '#4f46e5',
    badgeBgClass: 'bg-indigo-50 dark:bg-indigo-950/50',
    badgeTextClass: 'text-indigo-600 dark:text-indigo-400',
    keywords: 'dvr digital video recorder analog bnc coax cctv security'
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
      ],
      labels: [
        { id: 'lbl-ent-1', text: 'Primary ISP', x: 268, y: 150, fontSize: 'sm', color: 'slate', bold: true },
        { id: 'lbl-ent-2', text: 'NGFW-01', x: 530, y: 150, fontSize: 'sm', color: 'slate', bold: true },
        { id: 'lbl-ent-3', text: 'CORE-SW-01', x: 266, y: 360, fontSize: 'sm', color: 'blue', bold: true },
        { id: 'lbl-ent-4', text: 'CORE-SW-02', x: 526, y: 360, fontSize: 'sm', color: 'blue', bold: true },
        { id: 'lbl-ent-5', text: 'DMZ-ADC-01', x: 794, y: 308, fontSize: 'sm', color: 'amber', bold: true },
        { id: 'lbl-ent-6', text: 'APP-WEB-01', x: 794, y: 416, fontSize: 'sm', color: 'slate', bold: true },
        { id: 'lbl-ent-7', text: 'ACC-SW01', x: 228, y: 598, fontSize: 'sm', color: 'cyan', bold: true },
        { id: 'lbl-ent-8', text: 'Wi-Fi AP', x: 436, y: 598, fontSize: 'sm', color: 'emerald', bold: true },
        { id: 'lbl-ent-9', text: 'Workstation', x: 626, y: 598, fontSize: 'sm', color: 'slate', bold: true },
        { id: 'lbl-ent-10', text: 'Server Host', x: 806, y: 598, fontSize: 'sm', color: 'slate', bold: true }
      ]
    }
  },
  {
    id: 'lan-fault-tolerance',
    label: 'LAN Fault-Tolerance System',
    document: {
      name: 'LAN Fault-Tolerance System',
      zones: [
        {
          id: 'zone-ft-left',
          title: 'Department Pod A',
          subtitle: '',
          color: 'slate',
          x: 60,
          y: 340,
          width: 340,
          height: 300
        },
        {
          id: 'zone-ft-right',
          title: 'Department Pod B',
          subtitle: '',
          color: 'slate',
          x: 780,
          y: 340,
          width: 340,
          height: 300
        },
        {
          id: 'zone-ft-bottom',
          title: 'Department Pod C',
          subtitle: '',
          color: 'slate',
          x: 380,
          y: 580,
          width: 420,
          height: 240
        }
      ],
      nodes: [
        {
          id: 'ft-pstn',
          type: 'wan-cloud',
          label: 'PSTN',
          ipAddress: '198.51.100.0',
          subnetMask: '/24',
          vlanOrAsn: 'WAN',
          notes: '',
          x: 540,
          y: 80
        },
        {
          id: 'ft-rtr1',
          type: 'core-router',
          label: 'Cisco 3620-A',
          ipAddress: '10.0.0.1',
          subnetMask: '/30',
          vlanOrAsn: 'Edge A',
          notes: '',
          x: 420,
          y: 160
        },
        {
          id: 'ft-rtr2',
          type: 'core-router',
          label: 'Cisco 3620-B',
          ipAddress: '10.0.0.2',
          subnetMask: '/30',
          vlanOrAsn: 'Edge B',
          notes: '',
          x: 660,
          y: 160
        },
        {
          id: 'ft-bb1',
          type: 'l3-switch',
          label: 'Backbone L3-A',
          ipAddress: '10.1.0.1',
          subnetMask: '/24',
          vlanOrAsn: 'Core',
          notes: '',
          x: 420,
          y: 260
        },
        {
          id: 'ft-bb2',
          type: 'l3-switch',
          label: 'Backbone L3-B',
          ipAddress: '10.1.0.2',
          subnetMask: '/24',
          vlanOrAsn: 'Core',
          notes: '',
          x: 660,
          y: 260
        },
        {
          id: 'ft-l3-a1',
          type: 'l3-switch',
          label: 'Pod A L3-1',
          ipAddress: '10.10.1.1',
          subnetMask: '/24',
          vlanOrAsn: 'Pod A',
          notes: '',
          x: 280,
          y: 380
        },
        {
          id: 'ft-l3-a2',
          type: 'l3-switch',
          label: 'Pod A L3-2',
          ipAddress: '10.10.1.2',
          subnetMask: '/24',
          vlanOrAsn: 'Pod A',
          notes: '',
          x: 280,
          y: 500
        },
        {
          id: 'ft-l2-a1',
          type: 'l2-switch',
          label: 'Pod A L2-1',
          ipAddress: '10.10.1.11',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 160,
          y: 380
        },
        {
          id: 'ft-l2-a2',
          type: 'l2-switch',
          label: 'Pod A L2-2',
          ipAddress: '10.10.1.12',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 160,
          y: 500
        },
        {
          id: 'ft-ph-a',
          type: 'ip-phone',
          label: 'IP Phone A',
          ipAddress: '10.10.40.11',
          subnetMask: '/24',
          vlanOrAsn: 'Voice',
          notes: '',
          x: 70,
          y: 380
        },
        {
          id: 'ft-ws-a',
          type: 'workstation',
          label: 'Workstation A',
          ipAddress: '10.10.1.101',
          subnetMask: '/24',
          vlanOrAsn: 'Host',
          notes: '',
          x: 70,
          y: 500
        },
        {
          id: 'ft-l3-b1',
          type: 'l3-switch',
          label: 'Pod B L3-1',
          ipAddress: '10.20.1.1',
          subnetMask: '/24',
          vlanOrAsn: 'Pod B',
          notes: '',
          x: 800,
          y: 380
        },
        {
          id: 'ft-l3-b2',
          type: 'l3-switch',
          label: 'Pod B L3-2',
          ipAddress: '10.20.1.2',
          subnetMask: '/24',
          vlanOrAsn: 'Pod B',
          notes: '',
          x: 800,
          y: 500
        },
        {
          id: 'ft-l2-b1',
          type: 'l2-switch',
          label: 'Pod B L2-1',
          ipAddress: '10.20.1.11',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 920,
          y: 380
        },
        {
          id: 'ft-l2-b2',
          type: 'l2-switch',
          label: 'Pod B L2-2',
          ipAddress: '10.20.1.12',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 920,
          y: 500
        },
        {
          id: 'ft-ph-b',
          type: 'ip-phone',
          label: 'IP Phone B',
          ipAddress: '10.20.40.11',
          subnetMask: '/24',
          vlanOrAsn: 'Voice',
          notes: '',
          x: 1020,
          y: 380
        },
        {
          id: 'ft-ws-b',
          type: 'workstation',
          label: 'Workstation B',
          ipAddress: '10.20.1.101',
          subnetMask: '/24',
          vlanOrAsn: 'Host',
          notes: '',
          x: 1020,
          y: 500
        },
        {
          id: 'ft-l3-c1',
          type: 'l3-switch',
          label: 'Pod C L3-1',
          ipAddress: '10.30.1.1',
          subnetMask: '/24',
          vlanOrAsn: 'Pod C',
          notes: '',
          x: 460,
          y: 620
        },
        {
          id: 'ft-l3-c2',
          type: 'l3-switch',
          label: 'Pod C L3-2',
          ipAddress: '10.30.1.2',
          subnetMask: '/24',
          vlanOrAsn: 'Pod C',
          notes: '',
          x: 620,
          y: 620
        },
        {
          id: 'ft-l2-c1',
          type: 'l2-switch',
          label: 'Pod C L2-1',
          ipAddress: '10.30.1.11',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 420,
          y: 720
        },
        {
          id: 'ft-l2-c2',
          type: 'l2-switch',
          label: 'Pod C L2-2',
          ipAddress: '10.30.1.12',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 540,
          y: 720
        },
        {
          id: 'ft-l2-c3',
          type: 'l2-switch',
          label: 'Pod C L2-3',
          ipAddress: '10.30.1.13',
          subnetMask: '/24',
          vlanOrAsn: 'Access',
          notes: '',
          x: 660,
          y: 720
        }
      ],
      cables: [
        { id: 'ftc-1', sourceId: 'ft-pstn', targetId: 'ft-rtr1', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-2', sourceId: 'ft-pstn', targetId: 'ft-rtr2', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-3', sourceId: 'ft-rtr1', targetId: 'ft-bb1', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-4', sourceId: 'ft-rtr2', targetId: 'ft-bb2', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-5', sourceId: 'ft-bb1', targetId: 'ft-l3-a1', sourcePort: 'bottom', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-6', sourceId: 'ft-bb1', targetId: 'ft-l3-a2', sourcePort: 'bottom', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-7', sourceId: 'ft-bb2', targetId: 'ft-l3-a1', sourcePort: 'bottom', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-8', sourceId: 'ft-bb2', targetId: 'ft-l3-a2', sourcePort: 'bottom', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-9', sourceId: 'ft-bb1', targetId: 'ft-l3-b1', sourcePort: 'bottom', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-10', sourceId: 'ft-bb1', targetId: 'ft-l3-b2', sourcePort: 'bottom', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-11', sourceId: 'ft-bb2', targetId: 'ft-l3-b1', sourcePort: 'bottom', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-12', sourceId: 'ft-bb2', targetId: 'ft-l3-b2', sourcePort: 'bottom', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-13', sourceId: 'ft-bb1', targetId: 'ft-l3-c1', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-14', sourceId: 'ft-bb1', targetId: 'ft-l3-c2', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-15', sourceId: 'ft-bb2', targetId: 'ft-l3-c1', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-16', sourceId: 'ft-bb2', targetId: 'ft-l3-c2', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-17', sourceId: 'ft-l3-a1', targetId: 'ft-l2-a1', sourcePort: 'left', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-18', sourceId: 'ft-l3-a1', targetId: 'ft-l2-a2', sourcePort: 'left', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-19', sourceId: 'ft-l3-a2', targetId: 'ft-l2-a1', sourcePort: 'left', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-20', sourceId: 'ft-l3-a2', targetId: 'ft-l2-a2', sourcePort: 'left', targetPort: 'right', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-21', sourceId: 'ft-l3-b1', targetId: 'ft-l2-b1', sourcePort: 'right', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-22', sourceId: 'ft-l3-b1', targetId: 'ft-l2-b2', sourcePort: 'right', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-23', sourceId: 'ft-l3-b2', targetId: 'ft-l2-b1', sourcePort: 'right', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-24', sourceId: 'ft-l3-b2', targetId: 'ft-l2-b2', sourcePort: 'right', targetPort: 'left', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-25', sourceId: 'ft-l3-c1', targetId: 'ft-l2-c1', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-26', sourceId: 'ft-l3-c1', targetId: 'ft-l2-c2', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-27', sourceId: 'ft-l3-c1', targetId: 'ft-l2-c3', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-28', sourceId: 'ft-l3-c2', targetId: 'ft-l2-c1', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-29', sourceId: 'ft-l3-c2', targetId: 'ft-l2-c2', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' },
        { id: 'ftc-30', sourceId: 'ft-l3-c2', targetId: 'ft-l2-c3', sourcePort: 'bottom', targetPort: 'top', cableType: 'ethernet', routingStyle: 'straight', bandwidth: '', sourceInterface: '', targetInterface: '', label: '' }
      ],
      labels: [
        { id: 'ftl-title', text: 'LAN Fault-tolerance system', x: 430, y: 20, fontSize: 'title', color: 'cyan', bold: true },
        { id: 'ftl-pstn', text: 'PSTN', x: 568, y: 112, fontSize: 'md', color: 'cyan', bold: true },
        { id: 'ftl-r1', text: 'Cisco 3620', x: 340, y: 188, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-r2', text: 'Cisco 3620', x: 760, y: 188, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-bb1', text: 'Layer 3 switch backbone', x: 270, y: 288, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-bb2', text: 'Layer 3 switch backbone', x: 760, y: 288, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-a-ph', text: 'IP Phone', x: 90, y: 458, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-a-ws', text: 'Workstation', x: 82, y: 580, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-b-ph', text: 'IP Phone', x: 1038, y: 458, fontSize: 'sm', color: 'slate', bold: false },
        { id: 'ftl-b-ws', text: 'Workstation', x: 1030, y: 580, fontSize: 'sm', color: 'slate', bold: false }
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
      ],
      labels: [
        { id: 'lbl-vpn-1', text: 'HQ-VPN-HUB', x: 204, y: 248, fontSize: 'sm', color: 'violet', bold: true },
        { id: 'lbl-vpn-2', text: 'HQ-CORE-L3', x: 206, y: 428, fontSize: 'sm', color: 'blue', bold: true },
        { id: 'lbl-vpn-3', text: 'IPsec Internet Mesh', x: 466, y: 334, fontSize: 'sm', color: 'cyan', bold: true },
        { id: 'lbl-vpn-4', text: 'BRANCH-EAST', x: 752, y: 248, fontSize: 'sm', color: 'emerald', bold: true },
        { id: 'lbl-vpn-5', text: 'BRANCH-WEST', x: 752, y: 428, fontSize: 'sm', color: 'emerald', bold: true }
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
      cables: [],
      labels: []
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

export interface AlignmentGuideAnchor {
  x: number;
  y: number;
}

export interface AlignmentGuideLine {
  orientation: 'vertical' | 'horizontal';
  pos: number;
  start: number;
  end: number;
  kind: 'center' | 'edge';
  anchors: AlignmentGuideAnchor[];
}

export interface DeviceAlignmentOptions {
  snapToGrid: boolean;
  gridSize?: number;
  enableGuides: boolean;
  bypassSnap?: boolean;
  threshold?: number;
  maxX?: number;
  maxY?: number;
}

export interface DeviceAlignmentResult {
  x: number;
  y: number;
  snappedXToGuide: boolean;
  snappedYToGuide: boolean;
  guides: AlignmentGuideLine[];
}

export function computeDeviceAlignment(
  rawX: number,
  rawY: number,
  dragWidth: number,
  dragHeight: number,
  stationaryNodes: NetworkDiagramNode[],
  options: DeviceAlignmentOptions
): DeviceAlignmentResult {
  const gridSize = options.gridSize ?? GRID_SNAP_SIZE;
  const threshold = options.threshold ?? 7;
  const maxX = options.maxX ?? Math.max(0, DIAGRAM_CANVAS_WIDTH - dragWidth);
  const maxY = options.maxY ?? Math.max(0, DIAGRAM_CANVAS_HEIGHT - dragHeight);
  const bypass = Boolean(options.bypassSnap);
  const checkEdgesX = Math.abs(dragWidth - NODE_WIDTH) > 1;
  const checkEdgesY = Math.abs(dragHeight - NODE_HEIGHT) > 1;

  let bestAlignX: number | null = null;
  let bestDistX = threshold + 0.001;
  let bestAlignY: number | null = null;
  let bestDistY = threshold + 0.001;

  if (options.enableGuides && !bypass && stationaryNodes.length > 0) {
    const candLeft = rawX;
    const candCenterX = rawX + dragWidth / 2;
    const candRight = rawX + dragWidth;
    const candTop = rawY;
    const candCenterY = rawY + dragHeight / 2;
    const candBottom = rawY + dragHeight;

    for (const other of stationaryNodes) {
      const oLeft = other.x;
      const oCenterX = other.x + NODE_WIDTH / 2;
      const oRight = other.x + NODE_WIDTH;

      const centerDx = oCenterX - candCenterX;
      if (Math.abs(centerDx) < bestDistX) {
        bestDistX = Math.abs(centerDx);
        bestAlignX = rawX + centerDx;
      }
      if (checkEdgesX) {
        const leftDx = oLeft - candLeft;
        if (Math.abs(leftDx) < bestDistX) {
          bestDistX = Math.abs(leftDx);
          bestAlignX = rawX + leftDx;
        }
        const rightDx = oRight - candRight;
        if (Math.abs(rightDx) < bestDistX) {
          bestDistX = Math.abs(rightDx);
          bestAlignX = rawX + rightDx;
        }
      }

      const oTop = other.y;
      const oCenterY = other.y + NODE_HEIGHT / 2;
      const oBottom = other.y + NODE_HEIGHT;

      const centerDy = oCenterY - candCenterY;
      if (Math.abs(centerDy) < bestDistY) {
        bestDistY = Math.abs(centerDy);
        bestAlignY = rawY + centerDy;
      }
      if (checkEdgesY) {
        const topDy = oTop - candTop;
        if (Math.abs(topDy) < bestDistY) {
          bestDistY = Math.abs(topDy);
          bestAlignY = rawY + topDy;
        }
        const bottomDy = oBottom - candBottom;
        if (Math.abs(bottomDy) < bestDistY) {
          bestDistY = Math.abs(bottomDy);
          bestAlignY = rawY + bottomDy;
        }
      }
    }
  }

  const snappedXToGuide = bestAlignX !== null;
  const snappedYToGuide = bestAlignY !== null;

  const rawResolvedX =
    bestAlignX !== null
      ? bestAlignX
      : !bypass && options.snapToGrid
      ? Math.round(rawX / gridSize) * gridSize
      : Math.round(rawX);

  const rawResolvedY =
    bestAlignY !== null
      ? bestAlignY
      : !bypass && options.snapToGrid
      ? Math.round(rawY / gridSize) * gridSize
      : Math.round(rawY);

  const resolvedX = Math.max(0, Math.min(maxX, rawResolvedX));
  const resolvedY = Math.max(0, Math.min(maxY, rawResolvedY));

  const guides: AlignmentGuideLine[] = [];

  if (options.enableGuides && stationaryNodes.length > 0) {
    const MATCH_EPS = 0.8;
    const OVERHANG = 18;

    const dragLeft = resolvedX;
    const dragCenterX = resolvedX + dragWidth / 2;
    const dragRight = resolvedX + dragWidth;
    const dragTop = resolvedY;
    const dragCenterY = resolvedY + dragHeight / 2;
    const dragBottom = resolvedY + dragHeight;

    // Vertical guides
    const vCenterMatches = stationaryNodes.filter(
      n => Math.abs(n.x + NODE_WIDTH / 2 - dragCenterX) <= MATCH_EPS
    );
    if (vCenterMatches.length > 0) {
      const start = Math.max(
        0,
        Math.min(dragTop, ...vCenterMatches.map(m => m.y)) - OVERHANG
      );
      const end = Math.min(
        DIAGRAM_CANVAS_HEIGHT,
        Math.max(dragBottom, ...vCenterMatches.map(m => m.y + NODE_HEIGHT)) + OVERHANG
      );
      guides.push({
        orientation: 'vertical',
        pos: dragCenterX,
        start,
        end,
        kind: 'center',
        anchors: [
          { x: dragCenterX, y: dragCenterY },
          ...vCenterMatches.map(m => ({
            x: m.x + NODE_WIDTH / 2,
            y: m.y + NODE_HEIGHT / 2
          }))
        ]
      });
    }

    if (checkEdgesX) {
      const vLeftMatches = stationaryNodes.filter(n => Math.abs(n.x - dragLeft) <= MATCH_EPS);
      if (vLeftMatches.length > 0) {
        const start = Math.max(
          0,
          Math.min(dragTop, ...vLeftMatches.map(m => m.y)) - OVERHANG
        );
        const end = Math.min(
          DIAGRAM_CANVAS_HEIGHT,
          Math.max(dragBottom, ...vLeftMatches.map(m => m.y + NODE_HEIGHT)) + OVERHANG
        );
        guides.push({
          orientation: 'vertical',
          pos: dragLeft,
          start,
          end,
          kind: 'edge',
          anchors: []
        });
      }

      const vRightMatches = stationaryNodes.filter(
        n => Math.abs(n.x + NODE_WIDTH - dragRight) <= MATCH_EPS
      );
      if (vRightMatches.length > 0) {
        const start = Math.max(
          0,
          Math.min(dragTop, ...vRightMatches.map(m => m.y)) - OVERHANG
        );
        const end = Math.min(
          DIAGRAM_CANVAS_HEIGHT,
          Math.max(dragBottom, ...vRightMatches.map(m => m.y + NODE_HEIGHT)) + OVERHANG
        );
        guides.push({
          orientation: 'vertical',
          pos: dragRight,
          start,
          end,
          kind: 'edge',
          anchors: []
        });
      }
    }

    // Horizontal guides
    const hCenterMatches = stationaryNodes.filter(
      n => Math.abs(n.y + NODE_HEIGHT / 2 - dragCenterY) <= MATCH_EPS
    );
    if (hCenterMatches.length > 0) {
      const start = Math.max(
        0,
        Math.min(dragLeft, ...hCenterMatches.map(m => m.x)) - OVERHANG
      );
      const end = Math.min(
        DIAGRAM_CANVAS_WIDTH,
        Math.max(dragRight, ...hCenterMatches.map(m => m.x + NODE_WIDTH)) + OVERHANG
      );
      guides.push({
        orientation: 'horizontal',
        pos: dragCenterY,
        start,
        end,
        kind: 'center',
        anchors: [
          { x: dragCenterX, y: dragCenterY },
          ...hCenterMatches.map(m => ({
            x: m.x + NODE_WIDTH / 2,
            y: m.y + NODE_HEIGHT / 2
          }))
        ]
      });
    }

    if (checkEdgesY) {
      const hTopMatches = stationaryNodes.filter(n => Math.abs(n.y - dragTop) <= MATCH_EPS);
      if (hTopMatches.length > 0) {
        const start = Math.max(
          0,
          Math.min(dragLeft, ...hTopMatches.map(m => m.x)) - OVERHANG
        );
        const end = Math.min(
          DIAGRAM_CANVAS_WIDTH,
          Math.max(dragRight, ...hTopMatches.map(m => m.x + NODE_WIDTH)) + OVERHANG
        );
        guides.push({
          orientation: 'horizontal',
          pos: dragTop,
          start,
          end,
          kind: 'edge',
          anchors: []
        });
      }

      const hBottomMatches = stationaryNodes.filter(
        n => Math.abs(n.y + NODE_HEIGHT - dragBottom) <= MATCH_EPS
      );
      if (hBottomMatches.length > 0) {
        const start = Math.max(
          0,
          Math.min(dragLeft, ...hBottomMatches.map(m => m.x)) - OVERHANG
        );
        const end = Math.min(
          DIAGRAM_CANVAS_WIDTH,
          Math.max(dragRight, ...hBottomMatches.map(m => m.x + NODE_WIDTH)) + OVERHANG
        );
        guides.push({
          orientation: 'horizontal',
          pos: dragBottom,
          start,
          end,
          kind: 'edge',
          anchors: []
        });
      }
    }
  }

  return {
    x: resolvedX,
    y: resolvedY,
    snappedXToGuide,
    snappedYToGuide,
    guides
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

export function getDiagramSlug(name?: string): string {
  const slug = (name || 'network-topology')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'network-topology';
}

function escapeSvgXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function computeRackBoundsForNodes(
  memberNodes: NetworkDiagramNode[],
  style: RackContainerStyle = 'rack'
): { x: number; y: number; width: number; height: number } {
  if (memberNodes.length === 0) {
    return { x: 180, y: 140, width: 240, height: 220 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  memberNodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.y + NODE_HEIGHT);
  });

  const padLeft = style === 'rack' ? 30 : 24;
  const padRight = style === 'rack' ? 30 : 24;
  const padTop = 48;
  const padBottom = 22;

  const x = Math.max(8, minX - padLeft);
  const y = Math.max(8, minY - padTop);
  const width = Math.max(180, maxX - x + padRight);
  const height = Math.max(140, maxY - y + padBottom);
  return { x, y, width, height };
}

function computeDiagramExportBounds(doc: NetworkDiagramDocument) {
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

  (doc.racks || []).forEach(r => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  });

  doc.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.y + NODE_HEIGHT);
  });

  (doc.labels || []).forEach(l => {
    const lines = (l.text || '').split('\n');
    const maxChars = lines.reduce((m, line) => Math.max(m, line.length), 4);
    const fontPx = LABEL_SIZE_CONFIG[l.fontSize]?.px || 14;
    const estW = Math.max(60, maxChars * fontPx * 0.62);
    const estH = lines.length * fontPx * 1.35;
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + estW);
    maxY = Math.max(maxY, l.y + estH);
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

  return {
    minX,
    minY,
    pad,
    headerH,
    canvasW: contentW,
    canvasH: headerH + contentH
  };
}

export function buildNetworkDiagramSvgString(
  doc: NetworkDiagramDocument,
  isDarkTheme: boolean,
  pixelScale: number = 1
): string {
  const { minX, minY, pad, headerH, canvasW, canvasH } = computeDiagramExportBounds(doc);
  const bg = isDarkTheme ? '#070b14' : '#f8fafc';
  const headerBg = isDarkTheme ? '#0c1220' : '#ffffff';
  const borderCol = isDarkTheme ? '#1e293b' : '#e2e8f0';
  const cardBorder = isDarkTheme ? '#334155' : '#cbd5e1';
  const textPrimary = isDarkTheme ? '#f8fafc' : '#0f172a';
  const textMuted = isDarkTheme ? '#94a3b8' : '#64748b';
  const dotCol = isDarkTheme ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.22)';

  const sansFont = 'Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, sans-serif';
  const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  const zonePalettes: Record<ZoneColorTheme, { fill: string; stroke: string; title: string }> = {
    blue: {
      fill: isDarkTheme ? 'rgba(37,99,235,0.08)' : 'rgba(219,234,254,0.45)',
      stroke: isDarkTheme ? 'rgba(56,189,248,0.45)' : 'rgba(59,130,246,0.5)',
      title: isDarkTheme ? '#67e8f9' : '#1d4ed8'
    },
    emerald: {
      fill: isDarkTheme ? 'rgba(16,185,129,0.08)' : 'rgba(209,250,229,0.45)',
      stroke: isDarkTheme ? 'rgba(52,211,153,0.45)' : 'rgba(16,185,129,0.5)',
      title: isDarkTheme ? '#6ee7b7' : '#047857'
    },
    amber: {
      fill: isDarkTheme ? 'rgba(245,158,11,0.08)' : 'rgba(254,243,199,0.45)',
      stroke: isDarkTheme ? 'rgba(251,191,36,0.45)' : 'rgba(245,158,11,0.5)',
      title: isDarkTheme ? '#fcd34d' : '#b45309'
    },
    violet: {
      fill: isDarkTheme ? 'rgba(139,92,246,0.08)' : 'rgba(237,233,254,0.45)',
      stroke: isDarkTheme ? 'rgba(167,139,250,0.45)' : 'rgba(139,92,246,0.5)',
      title: isDarkTheme ? '#c4b5fd' : '#6d28d9'
    },
    slate: {
      fill: isDarkTheme ? 'rgba(100,116,139,0.12)' : 'rgba(241,245,249,0.7)',
      stroke: isDarkTheme ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.45)',
      title: isDarkTheme ? '#cbd5e1' : '#334155'
    }
  };

  const zonesSvg = doc.zones
    .map(z => {
      const zp = zonePalettes[z.color] || zonePalettes.blue;
      const subtitleSvg = z.subtitle
        ? `<text x="${z.x + 12}" y="${z.y + 35}" fill="${textMuted}" font-family="${monoFont}" font-size="10" font-weight="500">${escapeSvgXml(z.subtitle)}</text>`
        : '';
      return `<g>
        <rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" rx="14" fill="${zp.fill}" stroke="${zp.stroke}" stroke-width="1.5" stroke-dasharray="6 4"/>
        <text x="${z.x + 12}" y="${z.y + 21}" fill="${zp.title}" font-family="${sansFont}" font-size="11" font-weight="700">${escapeSvgXml(z.title)}</text>
        ${subtitleSvg}
      </g>`;
    })
    .join('\n');

  const nodeMap = new Map(doc.nodes.map(n => [n.id, n]));
  const cablesSvg = doc.cables
    .map(cable => {
      const src = nodeMap.get(cable.sourceId);
      const dst = nodeMap.get(cable.targetId);
      if (!src || !dst) return '';
      const geom = computeCableGeometry(src, dst, cable);
      const spec = CABLE_SPECS[cable.cableType];
      const stroke = isDarkTheme ? spec.darkStroke : spec.lightStroke;
      const dashAttr = spec.dashArray ? ` stroke-dasharray="${spec.dashArray}"` : '';
      const badgeText = cable.label;
      const badgeW = Math.max(34, badgeText.length * 6.2 + 14);
      const badgeSvg = badgeText
        ? `<g transform="translate(${geom.midX}, ${geom.midY})">
            <rect x="${-badgeW / 2}" y="-9" width="${badgeW}" height="18" rx="5" fill="${headerBg}" stroke="${cardBorder}" stroke-width="1"/>
            <text x="0" y="3.5" text-anchor="middle" fill="${textPrimary}" font-family="${monoFont}" font-size="9.5" font-weight="600">${escapeSvgXml(badgeText)}</text>
          </g>`
        : '';

      return `<g>
        <path d="${escapeSvgXml(geom.pathD)}" fill="none" stroke="${stroke}" stroke-width="${spec.strokeWidth}"${dashAttr} stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${geom.startX}" cy="${geom.startY}" r="3.5" fill="${stroke}"/>
        <circle cx="${geom.endX}" cy="${geom.endY}" r="3.5" fill="${stroke}"/>
        ${badgeSvg}
      </g>`;
    })
    .join('\n');

  const nodesSvg = doc.nodes
    .map((node, idx) => {
      const symbolW = NODE_WIDTH - 6;
      const symbolH = NODE_HEIGHT - 6;
      return `<g transform="translate(${node.x + 3}, ${node.y + 3})">
        <svg x="0" y="0" width="${symbolW}" height="${symbolH}" viewBox="0 0 64 56">
          ${getDiagramDeviceInnerSvg(node.type, `exp_${idx}`)}
        </svg>
      </g>`;
    })
    .join('\n');

  const labelsSvg = (doc.labels || [])
    .map(lbl => {
      const fontPx = LABEL_SIZE_CONFIG[lbl.fontSize]?.px || 14;
      const colCfg = LABEL_COLOR_STYLES[lbl.color] || LABEL_COLOR_STYLES.slate;
      const fill = isDarkTheme ? colCfg.darkHex : colCfg.lightHex;
      const weight = lbl.bold ? '700' : '500';
      const lines = (lbl.text || '').split('\n');
      const tspans = lines
        .map(
          (line, li) =>
            `<tspan x="${lbl.x}" dy="${li === 0 ? 0 : Math.round(fontPx * 1.28)}">${escapeSvgXml(line || ' ')}</tspan>`
        )
        .join('');
      return `<text x="${lbl.x}" y="${lbl.y + fontPx}" fill="${fill}" font-family="${sansFont}" font-size="${fontPx}" font-weight="${weight}">${tspans}</text>`;
    })
    .join('\n');

  const rackPalettes: Record<
    RackColorTheme,
    { fill: string; headerFill: string; stroke: string; rail: string; title: string }
  > = {
    slate: {
      fill: isDarkTheme ? 'rgba(15,23,42,0.72)' : 'rgba(241,245,249,0.88)',
      headerFill: isDarkTheme ? '#1e293b' : '#334155',
      stroke: isDarkTheme ? '#475569' : '#94a3b8',
      rail: isDarkTheme ? 'rgba(100,116,139,0.35)' : 'rgba(148,163,184,0.38)',
      title: '#f8fafc'
    },
    blue: {
      fill: isDarkTheme ? 'rgba(23,37,84,0.48)' : 'rgba(239,246,255,0.88)',
      headerFill: isDarkTheme ? '#1e3a8a' : '#1d4ed8',
      stroke: isDarkTheme ? '#3b82f6' : '#60a5fa',
      rail: isDarkTheme ? 'rgba(59,130,246,0.28)' : 'rgba(96,165,250,0.28)',
      title: '#ffffff'
    },
    cyan: {
      fill: isDarkTheme ? 'rgba(8,51,68,0.48)' : 'rgba(236,254,255,0.88)',
      headerFill: isDarkTheme ? '#155e75' : '#0284c7',
      stroke: isDarkTheme ? '#22d3ee' : '#38bdf8',
      rail: isDarkTheme ? 'rgba(34,211,238,0.28)' : 'rgba(56,189,248,0.28)',
      title: '#ffffff'
    },
    emerald: {
      fill: isDarkTheme ? 'rgba(6,78,59,0.45)' : 'rgba(236,253,245,0.88)',
      headerFill: isDarkTheme ? '#065f46' : '#059669',
      stroke: isDarkTheme ? '#34d399' : '#10b981',
      rail: isDarkTheme ? 'rgba(52,211,153,0.28)' : 'rgba(16,185,129,0.26)',
      title: '#ffffff'
    },
    amber: {
      fill: isDarkTheme ? 'rgba(69,26,3,0.45)' : 'rgba(255,251,235,0.88)',
      headerFill: isDarkTheme ? '#92400e' : '#d97706',
      stroke: isDarkTheme ? '#fbbf24' : '#f59e0b',
      rail: isDarkTheme ? 'rgba(251,191,36,0.26)' : 'rgba(245,158,11,0.26)',
      title: '#ffffff'
    },
    violet: {
      fill: isDarkTheme ? 'rgba(46,16,101,0.45)' : 'rgba(245,243,255,0.88)',
      headerFill: isDarkTheme ? '#5b21b6' : '#7c3aed',
      stroke: isDarkTheme ? '#a78bfa' : '#8b5cf6',
      rail: isDarkTheme ? 'rgba(167,139,250,0.28)' : 'rgba(139,92,246,0.26)',
      title: '#ffffff'
    }
  };

  const racksSvg = (doc.racks || [])
    .map(rack => {
      const rp = rackPalettes[rack.color] || rackPalettes.slate;
      const isRackStyle = rack.style !== 'group';
      const headerH2 = 30;
      const railsSvg = isRackStyle
        ? `<rect x="${rack.x + 2}" y="${rack.y + headerH2}" width="12" height="${Math.max(20, rack.height - headerH2 - 2)}" fill="${rp.rail}"/>
           <rect x="${rack.x + rack.width - 14}" y="${rack.y + headerH2}" width="12" height="${Math.max(20, rack.height - headerH2 - 2)}" fill="${rp.rail}"/>`
        : '';
      const dashAttr = isRackStyle ? '' : ' stroke-dasharray="5 3"';
      const badgeLabel = isRackStyle ? 'RACK' : 'GROUP';
      const subtitlePart = rack.subtitle ? ` · ${rack.subtitle}` : '';
      return `<g>
        <rect x="${rack.x}" y="${rack.y}" width="${rack.width}" height="${rack.height}" rx="12" fill="${rp.fill}" stroke="${rp.stroke}" stroke-width="1.8"${dashAttr}/>
        ${railsSvg}
        <path d="M ${rack.x + 12} ${rack.y} H ${rack.x + rack.width - 12} Q ${rack.x + rack.width} ${rack.y} ${rack.x + rack.width} ${rack.y + 12} V ${rack.y + headerH2} H ${rack.x} V ${rack.y + 12} Q ${rack.x} ${rack.y} ${rack.x + 12} ${rack.y} Z" fill="${rp.headerFill}"/>
        <text x="${rack.x + 12}" y="${rack.y + 19}" fill="${rp.title}" font-family="${sansFont}" font-size="11" font-weight="700">${escapeSvgXml(rack.title)}${escapeSvgXml(subtitlePart)}</text>
        <text x="${rack.x + rack.width - 12}" y="${rack.y + 19}" text-anchor="end" fill="${rp.title}" fill-opacity="0.85" font-family="${monoFont}" font-size="9" font-weight="700">${badgeLabel} · ${rack.nodeIds.length}</text>
      </g>`;
    })
    .join('\n');

  const tx = pad - minX;
  const ty = headerH + pad - minY;
  const titleText = doc.name || 'Network Topology Diagram';
  const labelCount = (doc.labels || []).length;
  const rackCount = (doc.racks || []).length;
  const summaryText = `${doc.nodes.length} Devices  ·  ${doc.cables.length} Cables  ·  ${doc.zones.length} Zones${rackCount > 0 ? `  ·  ${rackCount} Racks` : ''}${labelCount > 0 ? `  ·  ${labelCount} Labels` : ''}`;
  const outW = Math.round(canvasW * pixelScale);
  const outH = Math.round(canvasH * pixelScale);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <defs>
    <pattern id="netdiag-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="1" fill="${dotCol}"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${bg}"/>
  <rect x="0" y="${headerH}" width="${canvasW}" height="${canvasH - headerH}" fill="url(#netdiag-grid)"/>
  <rect x="0" y="0" width="${canvasW}" height="${headerH}" fill="${headerBg}"/>
  <line x1="0" y1="${headerH - 0.5}" x2="${canvasW}" y2="${headerH - 0.5}" stroke="${borderCol}" stroke-width="1"/>
  <text x="28" y="32" fill="${textPrimary}" font-family="${sansFont}" font-size="16" font-weight="700">${escapeSvgXml(titleText)}</text>
  <text x="28" y="53" fill="${textMuted}" font-family="${monoFont}" font-size="11" font-weight="500">${escapeSvgXml(summaryText)}</text>
  <g transform="translate(${tx}, ${ty})">
    ${zonesSvg}
    ${racksSvg}
    ${cablesSvg}
    ${nodesSvg}
    ${labelsSvg}
  </g>
</svg>`;
}

export function exportNetworkDiagramToSvg(
  doc: NetworkDiagramDocument,
  isDarkTheme: boolean
): void {
  const svgString = buildNetworkDiagramSvgString(doc, isDarkTheme, 1);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getDiagramSlug(doc.name)}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportNetworkDiagramToPng(
  doc: NetworkDiagramDocument,
  isDarkTheme: boolean
): Promise<void> {
  const { canvasW, canvasH } = computeDiagramExportBounds(doc);
  const scale = canvasW > 2000 ? 1.5 : 2;
  const svgString = buildNetworkDiagramSvgString(doc, isDarkTheme, scale);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not rasterize diagram SVG for PNG export'));
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(canvasW * scale);
    canvas.height = Math.round(canvasH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to initialize canvas export');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const filename = `${getDiagramSlug(doc.name)}.png`;
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 1.0));
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
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
