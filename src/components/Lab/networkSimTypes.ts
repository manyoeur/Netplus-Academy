export type SimDeviceType = 'router' | 'switch' | 'pc' | 'server';

export type SimCableType = 'straight' | 'crossover' | 'fiber' | 'serial';

export type SimCliMode =
  | 'user'
  | 'privileged'
  | 'global'
  | 'interface'
  | 'router_ospf'
  | 'vlan_db';

export interface SimDeviceInterface {
  name: string;
  shortName: string;
  kind: 'ethernet' | 'fiber' | 'serial' | 'subinterface';
  ip: string;
  mask: string;
  adminUp: boolean;
  mac: string;
  description?: string;
  // Switchport fields (for switches)
  switchportMode?: 'access' | 'trunk';
  accessVlan?: number;
  trunkAllowedVlans?: number[];
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
}

export interface SimVlanEntry {
  id: number;
  name: string;
}

export interface SimDevice {
  id: string;
  name: string;
  type: SimDeviceType;
  model: string;
  x: number; // Canvas coordinate 0..1000
  y: number; // Canvas coordinate 0..580
  interfaces: SimDeviceInterface[];
  gateway?: string;
  dns?: string;
  staticRoutes: SimStaticRoute[];
  ospf?: SimOspfConfig;
  vlans: SimVlanEntry[];
  cliHistory: string[];
  cliMode: SimCliMode;
  activeInterfaceName?: string;
  activeVlanId?: number;
}

export interface SimLink {
  id: string;
  cableType: SimCableType;
  fromDeviceId: string;
  fromPort: string;
  toDeviceId: string;
  toPort: string;
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
