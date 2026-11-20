export type SimDeviceType = 'router' | 'switch' | 'pc' | 'server';

export type SimCableType = 'straight' | 'crossover' | 'fiber' | 'serial';

export type SimCliMode =
  | 'user'
  | 'privileged'
  | 'global'
  | 'interface'
  | 'interface_range'
  | 'router_ospf'
  | 'vlan_db'
  | 'line';

export interface SimPortSecurityConfig {
  enabled: boolean;
  maximum: number;
  violation: 'protect' | 'restrict' | 'shutdown';
  sticky: boolean;
}

export interface SimDeviceInterface {
  name: string;
  shortName: string;
  kind: 'ethernet' | 'fiber' | 'serial' | 'subinterface' | 'loopback' | 'svi';
  ip: string;
  mask: string;
  adminUp: boolean;
  mac: string;
  description?: string;
  duplex?: 'auto' | 'full' | 'half';
  speed?: 'auto' | '10' | '100' | '1000';
  bandwidth?: number;
  clockRate?: number;
  // Switchport fields (for switches)
  switchportMode?: 'access' | 'trunk';
  accessVlan?: number;
  trunkNativeVlan?: number;
  trunkAllowedVlans?: number[];
  portfast?: boolean;
  bpduGuard?: boolean;
  portSecurity?: SimPortSecurityConfig;
  // Router-on-a-stick dot1Q tag (for subinterfaces like GigabitEthernet0/0.10)
  dot1qVlan?: number;
  parentInterface?: string;
}

export interface SimStaticRoute {
  network: string;
  mask: string;
  nextHop: string;
}

export interface SimOspfNetwork {
  network: string;
  wildcard: string;
  area: string;
}

export interface SimOspfConfig {
  processId: string;
  routerId: string;
  networks: SimOspfNetwork[];
  passiveInterfaces?: string[];
  passiveDefault?: boolean;
  defaultInformationOriginate?: boolean;
  referenceBandwidth?: number;
}

export interface SimVlanEntry {
  id: number;
  name: string;
}

export interface SimLineSettings {
  password?: string;
  login?: boolean;
  loginLocal?: boolean;
  transportInput?: string;
  execTimeout?: string;
  loggingSync?: boolean;
}

export interface SimDevice {
  id: string;
  name: string;
  customLabel?: string; // Optional user-defined display label for node organization
  useCustomLabel?: boolean; // Per-device toggle to show customLabel instead of hostname
  type: SimDeviceType;
  model: string;
  x: number; // Canvas coordinate 0..1000
  y: number; // Canvas coordinate 0..580
  rotation?: number; // Orientation in degrees (0..359)
  labelOffsetX?: number; // Relative X offset for device label pill (-220..220)
  labelOffsetY?: number; // Relative Y offset for device label pill (-180..180)
  interfaces: SimDeviceInterface[];
  gateway?: string;
  dns?: string;
  defaultGateway?: string;
  staticRoutes: SimStaticRoute[];
  ospf?: SimOspfConfig;
  vlans: SimVlanEntry[];
  cliHistory: string[];
  cliMode: SimCliMode;
  activeInterfaceName?: string;
  activeInterfaceRange?: string[];
  activeVlanId?: number;
  activeLine?: 'console' | 'vty';
  bannerMotd?: string;
  enableSecret?: string;
  servicePasswordEncryption?: boolean;
  ipDomainLookup?: boolean;
  domainName?: string;
  nameServer?: string;
  users?: Array<{ username: string; secret: string }>;
  lineConfig?: {
    console?: SimLineSettings;
    vty?: SimLineSettings;
  };
  startupConfigLines?: string[];
  startupConfigSavedAt?: string;
}

export interface SimLink {
  id: string;
  cableType: SimCableType;
  fromDeviceId: string;
  fromPort: string;
  toDeviceId: string;
  toPort: string;
}

export type SimShapeKind = 'rectangle' | 'circle';
export type SimShapeLineStyle = 'dashed' | 'dotted' | 'solid';

export interface SimTopologyShape {
  id: string;
  kind: SimShapeKind;
  x: number; // Top-left X in 0..1000 canvas coordinates
  y: number; // Top-left Y in 0..580 canvas coordinates
  width: number;
  height: number;
  fillColor: string; // Hex color or 'transparent'
  fillOpacity: number; // 0..1
  borderColor: string; // Hex color
  lineStyle: SimShapeLineStyle;
  borderWidth?: number; // 1..4
  label?: string;
  labelColor?: string;
}

export interface SimDiagramLabel {
  id: string;
  text: string;
  x: number; // Canvas coordinate 0..1000
  y: number; // Canvas coordinate 0..580
  color?: string;
  bgColor?: string; // 'transparent' or hex
  fontSize?: number; // 10..20
  bold?: boolean;
  italic?: boolean;
}

export interface SimLinkStatus {
  linkId: string;
  isUp: boolean;
  cableValid: boolean;
  reason: string;
}

export interface PacketTraceHop {
  step: number;
  deviceId: string;
  deviceName: string;
  deviceType: SimDeviceType;
  linkId?: string;
  status: 'ok' | 'fail';
  title: string;
  detail: string;
}

export interface PingSimulationResult {
  success: boolean;
  sourceDeviceId: string;
  targetIp: string;
  targetDeviceId?: string;
  targetDeviceName?: string;
  ttl: number;
  rttMs: number;
  hops: PacketTraceHop[];
  summary: string;
}

export interface LabObjective {
  id: string;
  label: string;
  check: (devices: SimDevice[], links: SimLink[]) => boolean;
}

export type LabTemplateCategory = 'Blank' | 'LAN & Star' | 'WAN & Routing' | 'Enterprise & Mesh';

export interface LabScenarioPreset {
  id: string;
  title: string;
  category?: LabTemplateCategory;
  difficulty: 'Free Build' | 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  objectives: LabObjective[];
  buildInitialState: () => { devices: SimDevice[]; links: SimLink[] };
}
