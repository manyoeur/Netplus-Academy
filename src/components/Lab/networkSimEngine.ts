import {
  PacketTraceHop,
  PingSimulationResult,
  SimCableType,
  SimCliMode,
  SimDevice,
  SimDeviceInterface,
  SimDeviceType,
  SimLink,
  SimLinkStatus,
  SimOspfConfig,
  SimStaticRoute
} from './networkSimTypes';
import {
  buildRunningConfigLines,
  executeCiscoShowCommand,
  expandInterfaceToken,
  getCliHelpLines,
  getCliTabCompletions,
  parseInterfaceRangeSpec
} from './networkCliHelpers';

export { getCliTabCompletions };

// ---------------------------------------------------------------------------
// IPv4 & Subnet Math Helpers
// ---------------------------------------------------------------------------

export function isValidIp(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

export function ipToInt(ip: string): number {
  const parts = ip.trim().split('.').map(Number);
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

export function intToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

export function isValidMask(mask: string): boolean {
  if (!isValidIp(mask)) return false;
  const val = ipToInt(mask);
  if (val === 0) return true;
  const inv = (~val) >>> 0;
  return ((inv + 1) & inv) === 0;
}

export function maskToPrefix(mask: string): number {
  if (!isValidIp(mask)) return 24;
  let val = ipToInt(mask);
  let bits = 0;
  for (let i = 0; i < 32; i++) {
    if (val & 0x80000000) bits++;
    val = (val << 1) >>> 0;
  }
  return bits;
}

export function wildcardToMask(wildcard: string): string {
  if (!isValidIp(wildcard)) return '255.255.255.0';
  const inv = (~ipToInt(wildcard)) >>> 0;
  return intToIp(inv);
}

export function getNetworkAddress(ip: string, mask: string): string {
  if (!isValidIp(ip) || !isValidIp(mask)) return '';
  return intToIp((ipToInt(ip) & ipToInt(mask)) >>> 0);
}

export function isSameSubnet(
  ipA: string,
  maskA: string,
  ipB: string,
  maskB?: string
): boolean {
  if (!isValidIp(ipA) || !isValidIp(maskA) || !isValidIp(ipB)) return false;
  const effectiveMask = maskB && isValidIp(maskB) ? maskB : maskA;
  const netA = (ipToInt(ipA) & ipToInt(maskA)) >>> 0;
  const netB = (ipToInt(ipB) & ipToInt(effectiveMask)) >>> 0;
  const checkWithA = (ipToInt(ipB) & ipToInt(maskA)) >>> 0;
  return netA === checkWithA && netA === netB;
}

export function matchesPrefix(destIp: string, netIp: string, mask: string): boolean {
  if (!isValidIp(destIp) || !isValidIp(netIp) || !isValidIp(mask)) return false;
  const m = ipToInt(mask);
  return ((ipToInt(destIp) & m) >>> 0) === ((ipToInt(netIp) & m) >>> 0);
}

// ---------------------------------------------------------------------------
// Device & Interface Factories
// ---------------------------------------------------------------------------

function makeMac(seed: number): string {
  const hex = (n: number) => ((n & 0xff) >>> 0).toString(16).padStart(2, '0').toUpperCase();
  return `00:50:56:${hex(seed * 17 + 3)}:${hex(seed * 31 + 7)}:${hex(seed * 43 + 11)}`;
}

let macCounter = 10;

export function createDefaultDevice(
  type: SimDeviceType,
  name: string,
  x: number,
  y: number,
  id?: string
): SimDevice {
  const deviceId = id || `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const seed = macCounter++;

  if (type === 'router') {
    return {
      id: deviceId,
      name,
      type: 'router',
      model: 'Cisco ISR 4331',
      x,
      y,
      interfaces: [
        {
          name: 'GigabitEthernet0/0',
          shortName: 'Gig0/0',
          kind: 'ethernet',
          ip: '',
          mask: '',
          adminUp: false,
          mac: makeMac(seed + 1)
        },
        {
          name: 'GigabitEthernet0/1',
          shortName: 'Gig0/1',
          kind: 'ethernet',
          ip: '',
          mask: '',
          adminUp: false,
          mac: makeMac(seed + 2)
        },
        {
          name: 'GigabitEthernet0/2',
          shortName: 'Gig0/2',
          kind: 'fiber',
          ip: '',
          mask: '',
          adminUp: false,
          mac: makeMac(seed + 3)
        },
        {
          name: 'Serial0/0/0',
          shortName: 'Se0/0/0',
          kind: 'serial',
          ip: '',
          mask: '',
          adminUp: false,
          mac: makeMac(seed + 4)
        },
        {
          name: 'Serial0/0/1',
          shortName: 'Se0/0/1',
          kind: 'serial',
          ip: '',
          mask: '',
          adminUp: false,
          mac: makeMac(seed + 5)
        }
      ],
      staticRoutes: [],
      vlans: [],
      cliMode: 'privileged',
      cliHistory: [
        `Cisco IOS XE Software, ISR 4331 (${name})`,
        `Type "?" or "help" for supported IOS commands.`
      ]
    };
  }

  if (type === 'switch') {
    const fastPorts: SimDeviceInterface[] = Array.from({ length: 6 }, (_, i) => ({
      name: `FastEthernet0/${i + 1}`,
      shortName: `Fa0/${i + 1}`,
      kind: 'ethernet',
      ip: '',
      mask: '',
      adminUp: true,
      mac: makeMac(seed + i + 1),
      switchportMode: 'access',
      accessVlan: 1,
      trunkAllowedVlans: [1, 10, 20, 30, 99]
    }));
    const gigPorts: SimDeviceInterface[] = [
      {
        name: 'GigabitEthernet0/1',
        shortName: 'Gig0/1',
        kind: 'ethernet',
        ip: '',
        mask: '',
        adminUp: true,
        mac: makeMac(seed + 20),
        switchportMode: 'access',
        accessVlan: 1,
        trunkAllowedVlans: [1, 10, 20, 30, 99]
      },
      {
        name: 'GigabitEthernet0/2',
        shortName: 'Gig0/2',
        kind: 'fiber',
        ip: '',
        mask: '',
        adminUp: true,
        mac: makeMac(seed + 21),
        switchportMode: 'trunk',
        accessVlan: 1,
        trunkAllowedVlans: [1, 10, 20, 30, 99]
      }
    ];

    return {
      id: deviceId,
      name,
      type: 'switch',
      model: 'Catalyst 2960-TT',
      x,
      y,
      interfaces: [...fastPorts, ...gigPorts],
      staticRoutes: [],
      vlans: [
        { id: 1, name: 'default' }
      ],
      cliMode: 'privileged',
      cliHistory: [
        `Cisco IOS Software, C2960 Switch (${name})`,
        `All switchports are active by default on VLAN 1. Type "help" for CLI commands.`
      ]
    };
  }

  // PC or Server
  return {
    id: deviceId,
    name,
    type,
    model: type === 'server' ? 'Enterprise Server' : 'Workstation PC',
    x,
    y,
    interfaces: [
      {
        name: 'FastEthernet0',
        shortName: 'Fa0',
        kind: 'ethernet',
        ip: '',
        mask: '255.255.255.0',
        adminUp: true,
        mac: makeMac(seed + 1)
      },
      ...(type === 'server'
        ? [
            {
              name: 'GigabitEthernet1',
              shortName: 'Gig1',
              kind: 'fiber' as const,
              ip: '',
              mask: '255.255.255.0',
              adminUp: true,
              mac: makeMac(seed + 2)
            }
          ]
        : [])
    ],
    gateway: '',
    dns: '8.8.8.8',
    staticRoutes: [],
    vlans: [],
    cliMode: 'user',
    cliHistory: [
      `${type === 'server' ? 'Server' : 'Workstation'} Command Prompt (${name})`,
      `Type "ipconfig", "ping <ip>", or "tracert <ip>".`
    ]
  };
}

// ---------------------------------------------------------------------------
// Cabling Rules & Link Operational State
// ---------------------------------------------------------------------------

export function isPortCompatibleWithCable(
  iface: SimDeviceInterface,
  cableType: SimCableType
): boolean {
  if (iface.kind === 'subinterface') return false;
  if (cableType === 'serial') return iface.kind === 'serial';
  if (cableType === 'fiber') return iface.kind === 'fiber';
  // Straight & crossover copper cables attach to ethernet ports (or non-serial ports)
  return iface.kind === 'ethernet';
}

export function validateCableBetweenDevices(
  cableType: SimCableType,
  fromDevice: SimDevice,
  fromPortName: string,
  toDevice: SimDevice,
  toPortName: string
): { valid: boolean; reason: string } {
  const fromIf = fromDevice.interfaces.find(i => i.name === fromPortName);
  const toIf = toDevice.interfaces.find(i => i.name === toPortName);

  if (!fromIf || !toIf) {
    return { valid: false, reason: 'Missing port on connected device.' };
  }

  if (!isPortCompatibleWithCable(fromIf, cableType) || !isPortCompatibleWithCable(toIf, cableType)) {
    return {
      valid: false,
      reason: `Port media mismatch: ${cableType} cable cannot terminate on ${fromIf.shortName} <-> ${toIf.shortName}.`
    };
  }

  if (cableType === 'serial' || cableType === 'fiber') {
    return { valid: true, reason: `${cableType.toUpperCase()} physical link` };
  }

  // Classic CCNA Copper Ethernet rules:
  // Straight-through connects unlike MDI/MDI-X groups: Switch <-> (Router | PC | Server)
  // Crossover connects like groups: (Router|PC|Server) <-> (Router|PC|Server) OR Switch <-> Switch
  const isFromSwitch = fromDevice.type === 'switch';
  const isToSwitch = toDevice.type === 'switch';
  const isUnlikePair = isFromSwitch !== isToSwitch;

  if (cableType === 'straight' && !isUnlikePair) {
    return {
      valid: false,
      reason: `Cable mismatch: use Copper Crossover between ${fromDevice.type} and ${toDevice.type}.`
    };
  }

  if (cableType === 'crossover' && isUnlikePair) {
    return {
      valid: false,
      reason: `Cable mismatch: use Copper Straight-Through between ${fromDevice.type} and ${toDevice.type}.`
    };
  }

  return { valid: true, reason: 'Link OK' };
}

export function evaluateLinkStatus(
  link: SimLink,
  devices: SimDevice[]
): SimLinkStatus {
  const fromDevice = devices.find(d => d.id === link.fromDeviceId);
  const toDevice = devices.find(d => d.id === link.toDeviceId);

  if (!fromDevice || !toDevice) {
    return {
      linkId: link.id,
      isUp: false,
      cableValid: false,
      reason: 'Disconnected endpoint'
    };
  }

  const fromIf = fromDevice.interfaces.find(i => i.name === link.fromPort);
  const toIf = toDevice.interfaces.find(i => i.name === link.toPort);

  if (!fromIf || !toIf) {
    return {
      linkId: link.id,
      isUp: false,
      cableValid: false,
      reason: 'Port not found'
    };
  }

  const cableCheck = validateCableBetweenDevices(
    link.cableType,
    fromDevice,
    link.fromPort,
    toDevice,
    link.toPort
  );

  if (!cableCheck.valid) {
    return {
      linkId: link.id,
      isUp: false,
      cableValid: false,
      reason: cableCheck.reason
    };
  }

  if (!fromIf.adminUp && !toIf.adminUp) {
    return {
      linkId: link.id,
      isUp: false,
      cableValid: true,
      reason: `Both ${fromDevice.name}:${fromIf.shortName} and ${toDevice.name}:${toIf.shortName} are shutdown`
    };
  }

  if (!fromIf.adminUp) {
    return {
      linkId: link.id,
      isUp: false,
      cableValid: true,
      reason: `${fromDevice.name}:${fromIf.shortName} is administratively down (run "no shutdown")`
    };
  }

  if (!toIf.adminUp) {
    return {
      linkId: link.id,
      isUp: false,
      cableValid: true,
      reason: `${toDevice.name}:${toIf.shortName} is administratively down (run "no shutdown")`
    };
  }

  return {
    linkId: link.id,
    isUp: true,
    cableValid: true,
    reason: 'up/up'
  };
}

export function isInterfaceLineProtocolUp(
  device: SimDevice,
  iface: SimDeviceInterface,
  devices: SimDevice[],
  links: SimLink[]
): boolean {
  if (!iface.adminUp) return false;
  if (iface.kind === 'loopback') return true;
  if (iface.kind === 'svi') {
    const vid = iface.dot1qVlan ?? 1;
    const vlanExists = device.vlans.some(v => v.id === vid);
    if (!vlanExists) return false;
    return device.interfaces.some(p => {
      if (p.kind === 'svi' || !p.adminUp) return false;
      const inVlan =
        p.switchportMode === 'trunk'
          ? (p.trunkAllowedVlans || [1]).includes(vid)
          : (p.accessVlan || 1) === vid;
      if (!inVlan) return false;
      const attachedLink = links.find(
        l =>
          (l.fromDeviceId === device.id && l.fromPort === p.name) ||
          (l.toDeviceId === device.id && l.toPort === p.name)
      );
      return Boolean(attachedLink && evaluateLinkStatus(attachedLink, devices).isUp);
    });
  }
  const targetPort = iface.parentInterface || iface.name;
  const attachedLink = links.find(
    l =>
      (l.fromDeviceId === device.id && l.fromPort === targetPort) ||
      (l.toDeviceId === device.id && l.toPort === targetPort)
  );
  if (!attachedLink) return false;
  return evaluateLinkStatus(attachedLink, devices).isUp;
}

// ---------------------------------------------------------------------------
// Dynamic Routing Table Builder (Connected + Static + OSPF Area Convergence)
// ---------------------------------------------------------------------------

export interface RoutingTableEntry {
  code: 'C' | 'S' | 'O';
  network: string;
  mask: string;
  prefix: number;
  adminDistance: number;
  metric: number;
  nextHop?: string;
  exitInterface: string;
}

function doesOspfAdvertiseInterface(ospf: SimOspfConfig, ifaceIp: string): boolean {
  if (!isValidIp(ifaceIp)) return false;
  return ospf.networks.some(net => {
    const mask = wildcardToMask(net.wildcard);
    return matchesPrefix(ifaceIp, net.network, mask);
  });
}

function computeOspfLearnedRoutes(
  targetRouter: SimDevice,
  devices: SimDevice[],
  links: SimLink[]
): RoutingTableEntry[] {
  if (targetRouter.type !== 'router' || !targetRouter.ospf || targetRouter.ospf.networks.length === 0) {
    return [];
  }

  // BFS across up links where both routers run OSPF and share at least one advertised subnet
  interface BfsNode {
    routerId: string;
    cost: number;
    firstHopIp: string;
    firstExitInterface: string;
  }

  const visitedCost = new Map<string, number>([[targetRouter.id, 0]]);
  const firstHopMap = new Map<string, { nextHop: string; exitIf: string; cost: number }>();
  const queue: BfsNode[] = [
    { routerId: targetRouter.id, cost: 0, firstHopIp: '', firstExitInterface: '' }
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentRouter = devices.find(d => d.id === current.routerId);
    if (!currentRouter || !currentRouter.ospf) continue;

    for (const iface of currentRouter.interfaces) {
      if (!isInterfaceLineProtocolUp(currentRouter, iface, devices, links)) continue;
      if (!isValidIp(iface.ip) || !isValidMask(iface.mask)) continue;
      if (!doesOspfAdvertiseInterface(currentRouter.ospf, iface.ip)) continue;

      // Find L2 neighbors sharing this interface's link/switch domain
      const neighbors = findL2ReachableIpPeers(
        currentRouter,
        iface,
        iface.dot1qVlan ?? 1,
        devices,
        links
      );

      for (const peer of neighbors) {
        if (peer.device.type !== 'router' || !peer.device.ospf) continue;
        if (!isSameSubnet(iface.ip, iface.mask, peer.iface.ip, peer.iface.mask)) continue;
        if (!doesOspfAdvertiseInterface(peer.device.ospf, peer.iface.ip)) continue;

        const nextCost = current.cost + (iface.kind === 'serial' ? 64 : 1);
        const existingCost = visitedCost.get(peer.device.id);
        if (existingCost === undefined || nextCost < existingCost) {
          visitedCost.set(peer.device.id, nextCost);
          const hopIp = current.routerId === targetRouter.id ? peer.iface.ip : current.firstHopIp;
          const exitIf =
            current.routerId === targetRouter.id ? iface.name : current.firstExitInterface;
          firstHopMap.set(peer.device.id, { nextHop: hopIp, exitIf, cost: nextCost });
          queue.push({
            routerId: peer.device.id,
            cost: nextCost,
            firstHopIp: hopIp,
            firstExitInterface: exitIf
          });
        }
      }
    }
  }

  // Own connected networks should not be added as OSPF routes
  const localConnected = new Set<string>();
  targetRouter.interfaces.forEach(i => {
    if (isInterfaceLineProtocolUp(targetRouter, i, devices, links) && isValidIp(i.ip) && isValidMask(i.mask)) {
      localConnected.add(`${getNetworkAddress(i.ip, i.mask)}/${maskToPrefix(i.mask)}`);
    }
  });

  const learned = new Map<string, RoutingTableEntry>();
  firstHopMap.forEach((via, remoteId) => {
    const remoteRouter = devices.find(d => d.id === remoteId);
    if (!remoteRouter || !remoteRouter.ospf) return;

    remoteRouter.interfaces.forEach(rIf => {
      if (!isInterfaceLineProtocolUp(remoteRouter, rIf, devices, links)) return;
      if (!isValidIp(rIf.ip) || !isValidMask(rIf.mask)) return;
      if (!doesOspfAdvertiseInterface(remoteRouter.ospf!, rIf.ip)) return;

      const net = getNetworkAddress(rIf.ip, rIf.mask);
      const prefix = maskToPrefix(rIf.mask);
      const key = `${net}/${prefix}`;
      if (localConnected.has(key)) return;

      const metric = via.cost + 1;
      const prev = learned.get(key);
      if (!prev || metric < prev.metric) {
        learned.set(key, {
          code: 'O',
          network: net,
          mask: rIf.mask,
          prefix,
          adminDistance: 110,
          metric,
          nextHop: via.nextHop,
          exitInterface: via.exitIf
        });
      }
    });
  });

  return Array.from(learned.values());
}

export function computeRoutingTable(
  device: SimDevice,
  devices: SimDevice[],
  links: SimLink[]
): RoutingTableEntry[] {
  if (device.type !== 'router') return [];
  const entries: RoutingTableEntry[] = [];

  // Connected routes
  device.interfaces.forEach(iface => {
    if (
      isInterfaceLineProtocolUp(device, iface, devices, links) &&
      isValidIp(iface.ip) &&
      isValidMask(iface.mask)
    ) {
      const net = getNetworkAddress(iface.ip, iface.mask);
      entries.push({
        code: 'C',
        network: net,
        mask: iface.mask,
        prefix: maskToPrefix(iface.mask),
        adminDistance: 0,
        metric: 0,
        exitInterface: iface.name
      });
    }
  });

  // Static routes (resolve exit interface if nextHop matches a connected subnet)
  device.staticRoutes.forEach(route => {
    if (!isValidIp(route.network) || !isValidMask(route.mask) || !isValidIp(route.nextHop)) return;
    const connectedExit = device.interfaces.find(
      iface =>
        isInterfaceLineProtocolUp(device, iface, devices, links) &&
        isValidIp(iface.ip) &&
        isValidMask(iface.mask) &&
        isSameSubnet(iface.ip, iface.mask, route.nextHop)
    );
    if (connectedExit) {
      entries.push({
        code: 'S',
        network: getNetworkAddress(route.network, route.mask),
        mask: route.mask,
        prefix: maskToPrefix(route.mask),
        adminDistance: 1,
        metric: 0,
        nextHop: route.nextHop,
        exitInterface: connectedExit.name
      });
    }
  });

  // OSPF learned routes
  const ospfEntries = computeOspfLearnedRoutes(device, devices, links);
  ospfEntries.forEach(o => entries.push(o));

  return entries.sort((a, b) => b.prefix - a.prefix || a.adminDistance - b.adminDistance);
}

// ---------------------------------------------------------------------------
// Layer 2 & Layer 3 Forwarding Simulation (Ping / Traceroute)
// ---------------------------------------------------------------------------

interface L2ReachablePeer {
  device: SimDevice;
  iface: SimDeviceInterface;
  switchHops: Array<{ device: SimDevice; linkId: string }>;
  finalLinkId: string;
}

function findL2ReachableIpPeers(
  startDevice: SimDevice,
  startIface: SimDeviceInterface,
  initialVlan: number,
  devices: SimDevice[],
  links: SimLink[]
): L2ReachablePeer[] {
  const results: L2ReachablePeer[] = [];
  const startPort = startIface.parentInterface || startIface.name;

  // Locate link attached to startPort
  const startLink = links.find(
    l =>
      (l.fromDeviceId === startDevice.id && l.fromPort === startPort) ||
      (l.toDeviceId === startDevice.id && l.toPort === startPort)
  );
  if (!startLink || !evaluateLinkStatus(startLink, devices).isUp) {
    return results;
  }

  const firstRemoteId =
    startLink.fromDeviceId === startDevice.id ? startLink.toDeviceId : startLink.fromDeviceId;
  const firstRemotePort =
    startLink.fromDeviceId === startDevice.id ? startLink.toPort : startLink.fromPort;
  const firstRemote = devices.find(d => d.id === firstRemoteId);
  if (!firstRemote) return results;

  // Direct device-to-device (no switch)
  if (firstRemote.type !== 'switch') {
    const candidateIfs = firstRemote.interfaces.filter(i => {
      if (!i.adminUp || !isValidIp(i.ip)) return false;
      if (i.name === firstRemotePort) return initialVlan === 1;
      if (i.parentInterface === firstRemotePort) {
        return (i.dot1qVlan ?? 1) === initialVlan;
      }
      return false;
    });
    candidateIfs.forEach(ci => {
      results.push({
        device: firstRemote,
        iface: ci,
        switchHops: [],
        finalLinkId: startLink.id
      });
    });
    return results;
  }

  // Entered a switch on firstRemotePort
  const entryPortIf = firstRemote.interfaces.find(i => i.name === firstRemotePort);
  if (!entryPortIf || !entryPortIf.adminUp) return results;

  let effectiveVlan = initialVlan;
  if (entryPortIf.switchportMode === 'trunk') {
    const allowed = entryPortIf.trunkAllowedVlans || [1];
    if (!allowed.includes(effectiveVlan)) return results;
  } else {
    effectiveVlan = entryPortIf.accessVlan || 1;
  }

  interface SwState {
    switchDev: SimDevice;
    vlan: number;
    entryPort: string;
    path: Array<{ device: SimDevice; linkId: string }>;
  }

  const visitedSwitches = new Set<string>([`${firstRemote.id}:${effectiveVlan}`]);
  const swQueue: SwState[] = [
    {
      switchDev: firstRemote,
      vlan: effectiveVlan,
      entryPort: firstRemotePort,
      path: [{ device: firstRemote, linkId: startLink.id }]
    }
  ];

  while (swQueue.length > 0) {
    const curr = swQueue.shift()!;

    for (const swPort of curr.switchDev.interfaces) {
      if (swPort.name === curr.entryPort || !swPort.adminUp) continue;

      // Check VLAN permit on egress switchport
      if (swPort.switchportMode === 'trunk') {
        const allowed = swPort.trunkAllowedVlans || [1];
        if (!allowed.includes(curr.vlan)) continue;
      } else {
        if ((swPort.accessVlan || 1) !== curr.vlan) continue;
      }

      const outLink = links.find(
        l =>
          (l.fromDeviceId === curr.switchDev.id && l.fromPort === swPort.name) ||
          (l.toDeviceId === curr.switchDev.id && l.toPort === swPort.name)
      );
      if (!outLink || !evaluateLinkStatus(outLink, devices).isUp) continue;

      const peerId =
        outLink.fromDeviceId === curr.switchDev.id ? outLink.toDeviceId : outLink.fromDeviceId;
      const peerPort =
        outLink.fromDeviceId === curr.switchDev.id ? outLink.toPort : outLink.fromPort;
      const peerDev = devices.find(d => d.id === peerId);
      if (!peerDev) continue;

      if (peerDev.type === 'switch') {
        const peerInIf = peerDev.interfaces.find(i => i.name === peerPort);
        if (!peerInIf || !peerInIf.adminUp) continue;
        let nextVlan = curr.vlan;
        if (peerInIf.switchportMode === 'trunk') {
          if (!(peerInIf.trunkAllowedVlans || [1]).includes(nextVlan)) continue;
        } else {
          // Untagging / native bridge between access ports
          if (swPort.switchportMode === 'trunk') continue;
          nextVlan = peerInIf.accessVlan || 1;
        }
        const vKey = `${peerDev.id}:${nextVlan}`;
        if (!visitedSwitches.has(vKey)) {
          visitedSwitches.add(vKey);
          swQueue.push({
            switchDev: peerDev,
            vlan: nextVlan,
            entryPort: peerPort,
            path: [...curr.path, { device: peerDev, linkId: outLink.id }]
          });
        }
      } else {
        // Reached Router / PC / Server
        const isTrunkOut = swPort.switchportMode === 'trunk';
        peerDev.interfaces.forEach(pIf => {
          if (!pIf.adminUp || !isValidIp(pIf.ip)) return;
          if (isTrunkOut) {
            // Tagged frame matches subinterface dot1qVlan (or native VLAN 1 physical port)
            if (pIf.parentInterface === peerPort && pIf.dot1qVlan === curr.vlan) {
              results.push({
                device: peerDev,
                iface: pIf,
                switchHops: curr.path,
                finalLinkId: outLink.id
              });
            } else if (pIf.name === peerPort && curr.vlan === 1) {
              results.push({
                device: peerDev,
                iface: pIf,
                switchHops: curr.path,
                finalLinkId: outLink.id
              });
            }
          } else if (pIf.name === peerPort) {
            results.push({
              device: peerDev,
              iface: pIf,
              switchHops: curr.path,
              finalLinkId: outLink.id
            });
          }
        });
      }
    }
  }

  return results;
}

function traceForwardPath(
  sourceDevice: SimDevice,
  targetIp: string,
  devices: SimDevice[],
  links: SimLink[]
): {
  reached: boolean;
  targetDevice?: SimDevice;
  hops: PacketTraceHop[];
  failReason?: string;
} {
  const hops: PacketTraceHop[] = [];
  let stepNum = 1;

  // Check self-ping
  const selfIf = sourceDevice.interfaces.find(i => i.adminUp && i.ip === targetIp);
  if (selfIf) {
    hops.push({
      step: stepNum++,
      deviceId: sourceDevice.id,
      deviceName: sourceDevice.name,
      deviceType: sourceDevice.type,
      status: 'ok',
      title: `Local loopback reply on ${sourceDevice.name}`,
      detail: `${targetIp} is assigned to local interface ${selfIf.shortName}.`
    });
    return { reached: true, targetDevice: sourceDevice, hops };
  }

  let currentDevice = sourceDevice;
  const visitedRouters = new Set<string>();
  let ttl = 24;

  while (ttl > 0) {
    ttl--;

    if (currentDevice.type === 'pc' || currentDevice.type === 'server') {
      const activeNic = currentDevice.interfaces.find(
        i => isInterfaceLineProtocolUp(currentDevice, i, devices, links) && isValidIp(i.ip) && isValidMask(i.mask)
      );

      if (!activeNic) {
        const hasIp = currentDevice.interfaces.some(i => isValidIp(i.ip));
        const reason = hasIp
          ? `${currentDevice.name} has no up/up cabled Ethernet link.`
          : `${currentDevice.name} does not have an IPv4 address configured.`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: currentDevice.type,
          status: 'fail',
          title: `Transmission failed on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }

      const peers = findL2ReachableIpPeers(currentDevice, activeNic, 1, devices, links);
      const localTarget = isSameSubnet(activeNic.ip, activeNic.mask, targetIp);

      if (localTarget) {
        const match = peers.find(p => p.iface.ip === targetIp);
        if (!match) {
          const reason = `ARP timeout: ${targetIp} is not reachable on local L2 segment / VLAN from ${currentDevice.name}.`;
          hops.push({
            step: stepNum++,
            deviceId: currentDevice.id,
            deviceName: currentDevice.name,
            deviceType: currentDevice.type,
            status: 'fail',
            title: `ARP Resolution Failed on ${currentDevice.name}`,
            detail: reason
          });
          return { reached: false, hops, failReason: reason };
        }

        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: currentDevice.type,
          status: 'ok',
          title: `${currentDevice.name} sends ICMP Echo`,
          detail: `Same subnet (${activeNic.ip}/${maskToPrefix(activeNic.mask)}) -> L2 frame to ${targetIp}.`
        });

        match.switchHops.forEach(sh => {
          hops.push({
            step: stepNum++,
            deviceId: sh.device.id,
            deviceName: sh.device.name,
            deviceType: sh.device.type,
            linkId: sh.linkId,
            status: 'ok',
            title: `${sh.device.name} forwards L2 frame`,
            detail: `Switched Ethernet frame toward ${match.device.name}.`
          });
        });

        hops.push({
          step: stepNum++,
          deviceId: match.device.id,
          deviceName: match.device.name,
          deviceType: match.device.type,
          linkId: match.finalLinkId,
          status: 'ok',
          title: `${match.device.name} received packet`,
          detail: `Delivered to ${match.iface.shortName} (${match.iface.ip}).`
        });
        return { reached: true, targetDevice: match.device, hops };
      }

      // Remote subnet -> requires default gateway
      if (!currentDevice.gateway || !isValidIp(currentDevice.gateway)) {
        const reason = `${currentDevice.name} needs a Default Gateway to reach remote IP ${targetIp}.`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: currentDevice.type,
          status: 'fail',
          title: `Missing Default Gateway on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }

      if (!isSameSubnet(activeNic.ip, activeNic.mask, currentDevice.gateway)) {
        const reason = `Default gateway ${currentDevice.gateway} is not in ${currentDevice.name}'s subnet (${activeNic.ip}/${maskToPrefix(activeNic.mask)}).`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: currentDevice.type,
          status: 'fail',
          title: `Unreachable Gateway on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }

      const gwMatch = peers.find(
        p => p.iface.ip === currentDevice.gateway && p.device.type === 'router'
      );
      if (!gwMatch) {
        const reason = `Gateway ${currentDevice.gateway} did not respond to ARP from ${currentDevice.name} (check router interface IP, "no shutdown", or VLAN/trunk).`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: currentDevice.type,
          status: 'fail',
          title: `Gateway ARP Failed on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }

      hops.push({
        step: stepNum++,
        deviceId: currentDevice.id,
        deviceName: currentDevice.name,
        deviceType: currentDevice.type,
        status: 'ok',
        title: `${currentDevice.name} forwards to Gateway`,
        detail: `Destination ${targetIp} is remote -> sending to gateway ${currentDevice.gateway}.`
      });

      gwMatch.switchHops.forEach(sh => {
        hops.push({
          step: stepNum++,
          deviceId: sh.device.id,
          deviceName: sh.device.name,
          deviceType: sh.device.type,
          linkId: sh.linkId,
          status: 'ok',
          title: `${sh.device.name} switches frame`,
          detail: `Forwarding Ethernet frame toward ${gwMatch.device.name}.`
        });
      });

      hops.push({
        step: stepNum++,
        deviceId: gwMatch.device.id,
        deviceName: gwMatch.device.name,
        deviceType: gwMatch.device.type,
        linkId: gwMatch.finalLinkId,
        status: 'ok',
        title: `${gwMatch.device.name} receives L3 packet`,
        detail: `Arrived on ${gwMatch.iface.shortName} (${gwMatch.iface.ip}).`
      });

      currentDevice = gwMatch.device;
      continue;
    }

    if (currentDevice.type === 'router') {
      if (visitedRouters.has(currentDevice.id)) {
        const reason = `Routing loop detected at ${currentDevice.name} while routing to ${targetIp}.`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: 'router',
          status: 'fail',
          title: `Routing Loop on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }
      visitedRouters.add(currentDevice.id);

      // Check if targetIp is directly assigned to one of this router's up/up interfaces
      const ownIf = currentDevice.interfaces.find(
        i => isInterfaceLineProtocolUp(currentDevice, i, devices, links) && i.ip === targetIp
      );
      if (ownIf) {
        if (currentDevice.id === sourceDevice.id) {
          hops.push({
            step: stepNum++,
            deviceId: currentDevice.id,
            deviceName: currentDevice.name,
            deviceType: 'router',
            status: 'ok',
            title: `Local interface ${ownIf.shortName} responded`,
            detail: `${targetIp} belongs to ${currentDevice.name}.`
          });
        }
        return { reached: true, targetDevice: currentDevice, hops };
      }

      const rTable = computeRoutingTable(currentDevice, devices, links);
      const bestRoute = rTable.find(entry =>
        matchesPrefix(targetIp, entry.network, entry.mask)
      );

      if (!bestRoute) {
        const reason = `No route to ${targetIp} in ${currentDevice.name}'s routing table (add static route or advertise via OSPF).`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: 'router',
          status: 'fail',
          title: `Route Lookup Failed on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }

      const exitIf = currentDevice.interfaces.find(i => i.name === bestRoute.exitInterface);
      if (!exitIf) {
        return { reached: false, hops, failReason: `Exit interface missing on ${currentDevice.name}.` };
      }

      const peers = findL2ReachableIpPeers(
        currentDevice,
        exitIf,
        exitIf.dot1qVlan ?? 1,
        devices,
        links
      );

      if (bestRoute.code === 'C') {
        const hostMatch = peers.find(p => p.iface.ip === targetIp);
        if (!hostMatch) {
          const reason = `${currentDevice.name} matched connected route ${bestRoute.network}/${bestRoute.prefix} via ${exitIf.shortName}, but ${targetIp} did not reply to ARP.`;
          hops.push({
            step: stepNum++,
            deviceId: currentDevice.id,
            deviceName: currentDevice.name,
            deviceType: 'router',
            status: 'fail',
            title: `Host Unreachable from ${currentDevice.name}`,
            detail: reason
          });
          return { reached: false, hops, failReason: reason };
        }

        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: 'router',
          status: 'ok',
          title: `${currentDevice.name} routes out ${exitIf.shortName}`,
          detail: `Connected subnet ${bestRoute.network}/${bestRoute.prefix} -> delivering to ${targetIp}.`
        });

        hostMatch.switchHops.forEach(sh => {
          hops.push({
            step: stepNum++,
            deviceId: sh.device.id,
            deviceName: sh.device.name,
            deviceType: sh.device.type,
            linkId: sh.linkId,
            status: 'ok',
            title: `${sh.device.name} switches frame`,
            detail: `Delivering on VLAN ${exitIf.dot1qVlan ?? 1} to ${hostMatch.device.name}.`
          });
        });

        hops.push({
          step: stepNum++,
          deviceId: hostMatch.device.id,
          deviceName: hostMatch.device.name,
          deviceType: hostMatch.device.type,
          linkId: hostMatch.finalLinkId,
          status: 'ok',
          title: `${hostMatch.device.name} received packet`,
          detail: `Delivered to ${hostMatch.iface.shortName} (${hostMatch.iface.ip}).`
        });
        return { reached: true, targetDevice: hostMatch.device, hops };
      }

      // Static ('S') or OSPF ('O') next-hop routing
      const nextHopMatch = peers.find(
        p => p.iface.ip === bestRoute.nextHop && p.device.type === 'router'
      );
      if (!nextHopMatch) {
        const reason = `${currentDevice.name} matched ${bestRoute.code === 'S' ? 'static' : 'OSPF'} route via ${bestRoute.nextHop}, but next-hop router is unreachable.`;
        hops.push({
          step: stepNum++,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: 'router',
          status: 'fail',
          title: `Next-Hop Unreachable on ${currentDevice.name}`,
          detail: reason
        });
        return { reached: false, hops, failReason: reason };
      }

      hops.push({
        step: stepNum++,
        deviceId: currentDevice.id,
        deviceName: currentDevice.name,
        deviceType: 'router',
        status: 'ok',
        title: `${currentDevice.name} routes via ${bestRoute.nextHop}`,
        detail: `${bestRoute.code === 'S' ? 'Static' : 'OSPF'} route ${bestRoute.network}/${bestRoute.prefix} out ${exitIf.shortName}.`
      });

      nextHopMatch.switchHops.forEach(sh => {
        hops.push({
          step: stepNum++,
          deviceId: sh.device.id,
          deviceName: sh.device.name,
          deviceType: sh.device.type,
          linkId: sh.linkId,
          status: 'ok',
          title: `${sh.device.name} forwards frame`,
          detail: `Passing link toward ${nextHopMatch.device.name}.`
        });
      });

      hops.push({
        step: stepNum++,
        deviceId: nextHopMatch.device.id,
        deviceName: nextHopMatch.device.name,
        deviceType: 'router',
        linkId: nextHopMatch.finalLinkId,
        status: 'ok',
        title: `${nextHopMatch.device.name} receives packet`,
        detail: `Arrived on ${nextHopMatch.iface.shortName} (${nextHopMatch.iface.ip}).`
      });

      currentDevice = nextHopMatch.device;
      continue;
    }

    return {
      reached: false,
      hops,
      failReason: `Cannot originate IP routing from switch ${currentDevice.name}.`
    };
  }

  return {
    reached: false,
    hops,
    failReason: 'TTL expired in transit.'
  };
}

export function simulatePing(
  devices: SimDevice[],
  links: SimLink[],
  sourceDeviceId: string,
  targetIp: string
): PingSimulationResult {
  const sourceDevice = devices.find(d => d.id === sourceDeviceId);
  if (!sourceDevice) {
    return {
      success: false,
      sourceDeviceId,
      targetIp,
      ttl: 0,
      rttMs: 0,
      hops: [],
      summary: 'Source device not found.'
    };
  }

  if (!isValidIp(targetIp)) {
    return {
      success: false,
      sourceDeviceId,
      targetIp,
      ttl: 0,
      rttMs: 0,
      hops: [],
      summary: `Invalid IPv4 destination address: "${targetIp}".`
    };
  }

  const forward = traceForwardPath(sourceDevice, targetIp, devices, links);
  if (!forward.reached || !forward.targetDevice) {
    return {
      success: false,
      sourceDeviceId,
      targetIp,
      ttl: 0,
      rttMs: 0,
      hops: forward.hops,
      summary: forward.failReason || 'Destination host unreachable.'
    };
  }

  // Verify return path from target back to source's active egress IP
  const srcIp =
    sourceDevice.interfaces.find(
      i => isInterfaceLineProtocolUp(sourceDevice, i, devices, links) && isValidIp(i.ip)
    )?.ip || '';

  if (srcIp && forward.targetDevice.id !== sourceDevice.id) {
    const reverse = traceForwardPath(forward.targetDevice, srcIp, devices, links);
    if (!reverse.reached) {
      const failMsg = `Forward packet reached ${forward.targetDevice.name}, but ICMP reply to ${srcIp} failed: ${reverse.failReason}`;
      return {
        success: false,
        sourceDeviceId,
        targetIp,
        targetDeviceId: forward.targetDevice.id,
        targetDeviceName: forward.targetDevice.name,
        ttl: 0,
        rttMs: 0,
        hops: [
          ...forward.hops,
          {
            step: forward.hops.length + 1,
            deviceId: forward.targetDevice.id,
            deviceName: forward.targetDevice.name,
            deviceType: forward.targetDevice.type,
            status: 'fail',
            title: `Return Path Failed from ${forward.targetDevice.name}`,
            detail: reverse.failReason || `No return route to ${srcIp}`
          }
        ],
        summary: failMsg
      };
    }
  }

  const routerHopCount = forward.hops.filter(h => h.deviceType === 'router').length;
  const ttl = Math.max(1, 64 - routerHopCount);
  const rttMs = Math.max(1, forward.hops.length * 2);

  return {
    success: true,
    sourceDeviceId,
    targetIp,
    targetDeviceId: forward.targetDevice.id,
    targetDeviceName: forward.targetDevice.name,
    ttl,
    rttMs,
    hops: forward.hops,
    summary: `Reply from ${targetIp} (${forward.targetDevice.name}): bytes=32 time=${rttMs}ms TTL=${ttl}`
  };
}

// ---------------------------------------------------------------------------
// Prompt & Interface Resolution Helpers
// ---------------------------------------------------------------------------

export function getCliPrompt(device: SimDevice): string {
  if (device.type === 'pc' || device.type === 'server') {
    return `${device.name}>`;
  }
  switch (device.cliMode) {
    case 'user':
      return `${device.name}>`;
    case 'privileged':
      return `${device.name}#`;
    case 'global':
      return `${device.name}(config)#`;
    case 'interface':
      return `${device.name}(config-if)#`;
    case 'interface_range':
      return `${device.name}(config-if-range)#`;
    case 'router_ospf':
      return `${device.name}(config-router)#`;
    case 'vlan_db':
      return `${device.name}(config-vlan)#`;
    case 'line':
      return `${device.name}(config-line)#`;
    case 'dhcp_pool':
      return `${device.name}(dhcp-config)#`;
    case 'acl': {
      const acl = device.accessLists?.find(a => a.id === device.activeAclName);
      return `${device.name}(config-${acl?.type === 'extended' ? 'ext' : 'std'}-nacl)#`;
    }
    default:
      return `${device.name}#`;
  }
}

function resolveInterfaceInput(
  device: SimDevice,
  token: string,
  createVirtualIfAllowed: boolean
): { iface?: SimDeviceInterface; createdSubIf?: SimDeviceInterface } {
  const norm = token.trim().toLowerCase().replace(/\s+/g, '');

  // Exact or prefix match on existing interfaces
  const exact = device.interfaces.find(
    i => i.name.toLowerCase() === norm || i.shortName.toLowerCase() === norm
  );
  if (exact) return { iface: exact };

  const expanded = expandInterfaceToken(norm);
  const byExpanded = device.interfaces.find(i => i.name.toLowerCase() === expanded);
  if (byExpanded) return { iface: byExpanded };

  // Loopback creation on routers (e.g. lo0, loopback0, loopback 0)
  if (createVirtualIfAllowed && device.type === 'router' && /^loopback\d+$/.test(expanded)) {
    const loNum = Number(expanded.replace('loopback', ''));
    if (Number.isInteger(loNum) && loNum >= 0 && loNum <= 2147483647) {
      const loName = `Loopback${loNum}`;
      const existing = device.interfaces.find(i => i.name === loName);
      if (existing) return { iface: existing };
      const newLo: SimDeviceInterface = {
        name: loName,
        shortName: `Lo${loNum}`,
        kind: 'loopback',
        ip: '',
        mask: '',
        adminUp: true,
        mac: device.interfaces[0]?.mac || '00:50:56:00:00:01'
      };
      return { iface: newLo, createdSubIf: newLo };
    }
  }

  // SVI creation on switches (e.g. vlan1, vlan 10)
  if (createVirtualIfAllowed && device.type === 'switch' && /^vlan\d+$/.test(expanded)) {
    const vid = Number(expanded.replace('vlan', ''));
    if (Number.isInteger(vid) && vid >= 1 && vid <= 4094) {
      const sviName = `Vlan${vid}`;
      const existing = device.interfaces.find(i => i.name === sviName);
      if (existing) return { iface: existing };
      const newSvi: SimDeviceInterface = {
        name: sviName,
        shortName: `Vl${vid}`,
        kind: 'svi',
        ip: '',
        mask: '',
        adminUp: true,
        mac: device.interfaces[0]?.mac || '00:50:56:00:00:01',
        dot1qVlan: vid
      };
      return { iface: newSvi, createdSubIf: newSvi };
    }
  }

  // Router-on-a-stick subinterface creation e.g. gigabitethernet0/0.10
  if (createVirtualIfAllowed && device.type === 'router' && expanded.includes('.')) {
    const [parentRaw, subNumRaw] = expanded.split('.');
    const parentIf = device.interfaces.find(
      i => i.kind !== 'subinterface' && i.name.toLowerCase() === parentRaw
    );
    const subNum = Number(subNumRaw);
    if (parentIf && Number.isInteger(subNum) && subNum > 0) {
      const subName = `${parentIf.name}.${subNum}`;
      const shortSub = `${parentIf.shortName}.${subNum}`;
      const existingSub = device.interfaces.find(i => i.name === subName);
      if (existingSub) return { iface: existingSub };
      const newSub: SimDeviceInterface = {
        name: subName,
        shortName: shortSub,
        kind: 'subinterface',
        ip: '',
        mask: '',
        adminUp: true,
        mac: parentIf.mac,
        parentInterface: parentIf.name,
        dot1qVlan: subNum
      };
      return { iface: newSub, createdSubIf: newSub };
    }
  }

  return {};
}

// ---------------------------------------------------------------------------
// Per-Device CLI Command Execution (Cisco IOS & PC Command Prompt)
// ---------------------------------------------------------------------------

export interface CliExecOutput {
  updatedDevice: SimDevice;
  pingResult?: PingSimulationResult;
}

export function executeDeviceCommand(
  device: SimDevice,
  rawCommand: string,
  allDevices: SimDevice[],
  allLinks: SimLink[]
): CliExecOutput {
  const cmd = rawCommand.trim();
  const prompt = getCliPrompt(device);

  if (!cmd) {
    return { updatedDevice: device };
  }

  const lower = cmd.toLowerCase();

  // Clear terminal screen on any device
  if (lower === 'clear' || lower === 'cls') {
    return {
      updatedDevice: {
        ...device,
        cliHistory: []
      }
    };
  }

  // PC / Server Command Prompt
  if (device.type === 'pc' || device.type === 'server') {
    const out = [...device.cliHistory, `${prompt} ${cmd}`];
    let pingResult: PingSimulationResult | undefined;

    if (lower === 'help' || lower === '?') {
      out.push(
        'Available Workstation Commands:',
        '  ipconfig              - Display IPv4 address, mask, and default gateway',
        '  ipconfig /all         - Display detailed NIC & MAC address info',
        '  ping <ip>             - Send ICMP echo requests across the topology',
        '  tracert <ip>          - Trace Layer 2 & Layer 3 hops to destination',
        '  clear / cls           - Clear terminal output'
      );
    } else if (lower === 'ipconfig' || lower === 'ipconfig /all') {
      const nic = device.interfaces[0];
      const up = nic ? isInterfaceLineProtocolUp(device, nic, allDevices, allLinks) : false;
      out.push(
        '',
        `Ethernet adapter ${nic?.name || 'FastEthernet0'}:`,
        `   Media State . . . . . . . . . . . : ${up ? 'Connected' : 'Media disconnected'}`,
        ...(lower === 'ipconfig /all'
          ? [`   Physical Address. . . . . . . . . : ${nic?.mac || '00:50:56:00:00:01'}`]
          : []),
        `   IPv4 Address. . . . . . . . . . . : ${nic?.ip || '(not configured)'}`,
        `   Subnet Mask . . . . . . . . . . . : ${nic?.mask || '(not configured)'}`,
        `   Default Gateway . . . . . . . . . : ${device.gateway || '(not configured)'}`,
        `   DNS Server. . . . . . . . . . . . : ${device.dns || '8.8.8.8'}`
      );
    } else if (lower.startsWith('ping ')) {
      const target = cmd.split(/\s+/)[1] || '';
      pingResult = simulatePing(allDevices, allLinks, device.id, target);
      out.push('', `Pinging ${target} with 32 bytes of data:`);
      if (pingResult.success) {
        for (let i = 0; i < 4; i++) {
          out.push(
            `Reply from ${target}: bytes=32 time=${pingResult.rttMs + i}ms TTL=${pingResult.ttl}`
          );
        }
        out.push(
          '',
          `Ping statistics for ${target}:`,
          `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`
        );
      } else {
        out.push(`Request timed out — ${pingResult.summary}`);
        out.push(
          '',
          `Ping statistics for ${target}:`,
          `    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`
        );
      }
    } else if (lower.startsWith('tracert ') || lower.startsWith('traceroute ')) {
      const target = cmd.split(/\s+/)[1] || '';
      pingResult = simulatePing(allDevices, allLinks, device.id, target);
      out.push('', `Tracing route to ${target} over a maximum of 24 hops:`);
      pingResult.hops.forEach(h => {
        out.push(
          `  ${String(h.step).padStart(2, ' ')}   ${h.status === 'ok' ? '<2 ms' : '  *  '}   ${h.deviceName.padEnd(14, ' ')} ${h.detail}`
        );
      });
      if (!pingResult.success) {
        out.push(`Trace aborted: ${pingResult.summary}`);
      } else {
        out.push('Trace complete.');
      }
    } else {
      out.push(`'${cmd.split(/\s+/)[0]}' is not recognized. Type "help" for commands.`);
    }

    return {
      updatedDevice: {
        ...device,
        commandHistory: [...(device.commandHistory || []), cmd].slice(-50),
        cliHistory: out
      },
      pingResult
    };
  }

  // Cisco Router / Switch IOS CLI
  let nextDevice: SimDevice = {
    ...device,
    commandHistory: [...(device.commandHistory || []), cmd].slice(-50),
    interfaces: device.interfaces.map(i => ({ ...i })),
    staticRoutes: [...device.staticRoutes],
    vlans: [...device.vlans],
    users: device.users ? device.users.map(u => ({ ...u })) : undefined,
    dhcpExcludedRanges: device.dhcpExcludedRanges
      ? device.dhcpExcludedRanges.map(r => ({ ...r }))
      : undefined,
    dhcpPools: device.dhcpPools
      ? device.dhcpPools.map(p => ({ ...p }))
      : undefined,
    accessLists: device.accessLists
      ? device.accessLists.map(a => ({ ...a, entries: [...a.entries] }))
      : undefined,
    lineConfig: device.lineConfig
      ? {
          console: device.lineConfig.console ? { ...device.lineConfig.console } : undefined,
          vty: device.lineConfig.vty ? { ...device.lineConfig.vty } : undefined
        }
      : undefined,
    ospf: device.ospf
      ? {
          ...device.ospf,
          networks: [...device.ospf.networks],
          passiveInterfaces: device.ospf.passiveInterfaces
            ? [...device.ospf.passiveInterfaces]
            : undefined
        }
      : undefined
  };
  const out = [...device.cliHistory, `${prompt} ${cmd}`];
  let pingResult: PingSimulationResult | undefined;

  const setMode = (mode: SimCliMode) => {
    nextDevice.cliMode = mode;
  };

  const resetSubModeContext = () => {
    nextDevice.activeInterfaceName = undefined;
    nextDevice.activeInterfaceRange = undefined;
    nextDevice.activeVlanId = undefined;
    nextDevice.activeLine = undefined;
    nextDevice.activeDhcpPool = undefined;
    nextDevice.activeAclName = undefined;
  };

  // Helper: active interfaces for either single (config-if) or range (config-if-range)
  const getTargetInterfaces = (): SimDeviceInterface[] => {
    if (nextDevice.cliMode === 'interface' && nextDevice.activeInterfaceName) {
      const one = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      return one ? [one] : [];
    }
    if (
      nextDevice.cliMode === 'interface_range' &&
      nextDevice.activeInterfaceRange &&
      nextDevice.activeInterfaceRange.length > 0
    ) {
      const set = new Set(nextDevice.activeInterfaceRange);
      return nextDevice.interfaces.filter(i => set.has(i.name));
    }
    return [];
  };

  // Strip "do " when running Privileged EXEC commands from any config mode
  const isConfigSubMode =
    nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged';
  const effectiveCmd =
    isConfigSubMode && lower.startsWith('do ') ? cmd.slice(3).trim() : cmd;
  const effectiveLower = effectiveCmd.toLowerCase();
  const execAllowed =
    !(isConfigSubMode && !lower.startsWith('do '));

  const showDeps = {
    isIfUp: (d: SimDevice, iface: SimDeviceInterface) =>
      isInterfaceLineProtocolUp(d, iface, allDevices, allLinks),
    computeRoutes: (d: SimDevice) => computeRoutingTable(d, allDevices, allLinks),
    wildcardToMask,
    matchesPrefix
  };

  const showLines =
    effectiveLower === 'show' || effectiveLower.startsWith('show ') || effectiveLower.startsWith('sh ')
      ? executeCiscoShowCommand(nextDevice, effectiveLower, allDevices, allLinks, showDeps)
      : null;

  if (lower === 'help' || lower === '?' || lower.endsWith(' ?')) {
    out.push(...getCliHelpLines(nextDevice, cmd));
  } else if (showLines !== null && (execAllowed || nextDevice.cliMode === 'user')) {
    out.push(...showLines);
  } else if (lower === 'enable' || lower === 'en' || lower === 'ena') {
    if (nextDevice.bannerMotd && nextDevice.cliMode === 'user') {
      out.push(nextDevice.bannerMotd);
    }
    setMode('privileged');
  } else if (lower === 'disable') {
    setMode('user');
    resetSubModeContext();
  } else if (lower === 'end') {
    if (nextDevice.cliMode !== 'user') {
      setMode('privileged');
      resetSubModeContext();
      out.push('%SYS-5-CONFIG_I: Configured from console by console');
    }
  } else if (lower === 'exit' || lower === 'ex') {
    if (
      nextDevice.cliMode === 'interface' ||
      nextDevice.cliMode === 'interface_range' ||
      nextDevice.cliMode === 'router_ospf' ||
      nextDevice.cliMode === 'vlan_db' ||
      nextDevice.cliMode === 'line' ||
      nextDevice.cliMode === 'dhcp_pool' ||
      nextDevice.cliMode === 'acl'
    ) {
      setMode('global');
      resetSubModeContext();
    } else if (nextDevice.cliMode === 'global') {
      setMode('privileged');
      out.push('%SYS-5-CONFIG_I: Configured from console by console');
    } else if (nextDevice.cliMode === 'privileged') {
      setMode('user');
    }
  } else if (
    /^conf(ig|igure)?\s+t(er|erm|ermi|ermin|ermina|erminal)?$/.test(lower)
  ) {
    if (nextDevice.cliMode === 'user') {
      out.push('% Type "enable" first to enter Privileged EXEC mode.');
    } else {
      resetSubModeContext();
      setMode('global');
      out.push('Enter configuration commands, one per line. End with "end" or CNTL/Z.');
    }
  } else if (
    (effectiveLower === 'write' ||
      effectiveLower === 'wr' ||
      effectiveLower === 'write memory' ||
      effectiveLower === 'write mem' ||
      effectiveLower === 'wr mem' ||
      /^copy\s+r(un|unning-config)?\s+s(tart|tartup-config)?$/.test(effectiveLower)) &&
    execAllowed &&
    nextDevice.cliMode !== 'user'
  ) {
    nextDevice.startupConfigLines = buildRunningConfigLines(nextDevice);
    nextDevice.startupConfigSavedAt = new Date().toISOString();
    out.push('Building configuration...', '[OK]');
  } else if (
    (effectiveLower === 'erase startup-config' || effectiveLower === 'write erase') &&
    execAllowed &&
    nextDevice.cliMode !== 'user'
  ) {
    nextDevice.startupConfigLines = undefined;
    nextDevice.startupConfigSavedAt = undefined;
    out.push('Erasing the nvram filesystem will remove all configuration files! [OK]');
  } else if (
    (effectiveLower === 'clear ip ospf process' || effectiveLower === 'clear ip ospf proc') &&
    execAllowed &&
    nextDevice.cliMode !== 'user'
  ) {
    if (nextDevice.type !== 'router' || !nextDevice.ospf) {
      out.push('% OSPF routing process is not configured on this device.');
    } else {
      out.push(`%OSPF-5-ADJCHG: Process ${nextDevice.ospf.processId}, OSPF adjacencies reset and re-converged`);
    }
  } else if (
    (effectiveLower === 'clear arp-cache' || effectiveLower === 'clear arp') &&
    execAllowed &&
    nextDevice.cliMode !== 'user'
  ) {
    out.push('ARP cache entries cleared.');
  } else if (
    (effectiveLower === 'clear mac address-table dynamic' ||
      effectiveLower === 'clear mac address-table' ||
      effectiveLower === 'clear mac-address-table dynamic' ||
      effectiveLower === 'clear mac-address-table') &&
    execAllowed &&
    nextDevice.cliMode !== 'user'
  ) {
    out.push(
      nextDevice.type === 'switch'
        ? 'Dynamic MAC address table entries cleared.'
        : '% MAC address table applies to Catalyst switches.'
    );
  } else if (effectiveLower.startsWith('terminal length ') || effectiveLower.startsWith('term len ')) {
    out.push('Terminal pagination updated.');
  } else if (effectiveLower === 'reload' && execAllowed && nextDevice.cliMode !== 'user') {
    setMode('privileged');
    resetSubModeContext();
    out.push('% System reloaded.');
  } else if (effectiveLower.startsWith('ping ') && (execAllowed || nextDevice.cliMode === 'user')) {
    const target = effectiveCmd.split(/\s+/)[1] || '';
    pingResult = simulatePing(allDevices, allLinks, nextDevice.id, target);
    out.push('Type escape sequence to abort.');
    out.push(`Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
    if (pingResult.success) {
      out.push('!!!!!');
      out.push(
        `Success rate is 100 percent (5/5), round-trip min/avg/max = 1/${pingResult.rttMs}/${pingResult.rttMs + 2} ms`
      );
    } else {
      out.push('.....');
      out.push(`Success rate is 0 percent (0/5) — ${pingResult.summary}`);
    }
  } else if (
    (effectiveLower.startsWith('traceroute ') || effectiveLower.startsWith('tracert ')) &&
    (execAllowed || nextDevice.cliMode === 'user')
  ) {
    const target = effectiveCmd.split(/\s+/)[1] || '';
    pingResult = simulatePing(allDevices, allLinks, nextDevice.id, target);
    out.push(`Tracing the route to ${target}:`);
    pingResult.hops.forEach(h => {
      out.push(`  ${h.step} ${h.deviceName} (${h.status === 'ok' ? 'OK' : 'FAIL'}) - ${h.detail}`);
    });
  } else if (lower.startsWith('hostname ')) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const newHost = cmd.split(/\s+/)[1];
      if (newHost) nextDevice.name = newHost;
    }
  } else if (lower.startsWith('banner motd ')) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const rawMsg = cmd.slice('banner motd '.length).trim();
      const stripped =
        rawMsg.length >= 2 && rawMsg[0] === rawMsg[rawMsg.length - 1]
          ? rawMsg.slice(1, -1)
          : rawMsg.replace(/^\^C|\^C$/g, '');
      nextDevice.bannerMotd = stripped || rawMsg;
    }
  } else if (lower === 'no banner motd') {
    nextDevice.bannerMotd = undefined;
  } else if (lower.startsWith('enable secret ') || lower.startsWith('enable password ')) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const pw = cmd.split(/\s+/).slice(2).join(' ');
      if (pw) nextDevice.enableSecret = pw;
    }
  } else if (lower === 'no enable secret' || lower === 'no enable password') {
    nextDevice.enableSecret = undefined;
  } else if (lower === 'service password-encryption') {
    if (nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      nextDevice.servicePasswordEncryption = true;
    }
  } else if (lower === 'no service password-encryption') {
    if (nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      nextDevice.servicePasswordEncryption = false;
    }
  } else if (lower === 'no ip domain-lookup' || lower === 'no ip domain lookup') {
    if (nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      nextDevice.ipDomainLookup = false;
    }
  } else if (lower === 'ip domain-lookup' || lower === 'ip domain lookup') {
    if (nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      nextDevice.ipDomainLookup = true;
    }
  } else if (lower.startsWith('ip domain-name ') || lower.startsWith('ip domain name ')) {
    if (nextDevice.cliMode === 'dhcp_pool' && nextDevice.activeDhcpPool) {
      // Handled inside dhcp_pool submode below, unless prefixed with "ip "
      out.push('% In DHCP pool mode, use "domain-name <domain>".');
    } else if (nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      nextDevice.domainName = cmd.split(/\s+/).pop();
    }
  } else if (lower.startsWith('ip name-server ')) {
    const dnsIp = cmd.split(/\s+/)[2];
    if (dnsIp && isValidIp(dnsIp)) nextDevice.nameServer = dnsIp;
    else out.push('% Usage: ip name-server <ipv4-address>');
  } else if (lower.startsWith('crypto key generate rsa')) {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else if (!nextDevice.domainName) {
      out.push('% Please define a domain-name first ("ip domain-name <domain>").');
    } else {
      const parts = cmd.split(/\s+/);
      const modIdx = parts.findIndex(p => p.toLowerCase() === 'modulus');
      const bits = modIdx >= 0 ? Number(parts[modIdx + 1]) : 2048;
      if (!Number.isInteger(bits) || bits < 512 || bits > 4096) {
        out.push('% Usage: crypto key generate rsa [modulus <512-4096>]');
      } else {
        nextDevice.rsaKeyBits = bits;
        nextDevice.sshVersion = nextDevice.sshVersion || 2;
        out.push(
          `The name for the keys will be: ${nextDevice.name}.${nextDevice.domainName}`,
          `% Generating ${bits} bit RSA keys, keys will be non-exportable...[OK]`,
          `*SYS-5-SSH: %SSH-5-ENABLED: SSH ${nextDevice.sshVersion}.0 has been enabled`
        );
      }
    }
  } else if (lower.startsWith('ip ssh version ')) {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const ver = Number(cmd.split(/\s+/)[3]);
      if (ver !== 1 && ver !== 2) {
        out.push('% Usage: ip ssh version <1|2>');
      } else {
        nextDevice.sshVersion = ver;
      }
    }
  } else if (lower === 'cdp run' || lower === 'no cdp run') {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      nextDevice.cdpEnabled = lower === 'cdp run';
    }
  } else if (lower === 'lldp run' || lower === 'no lldp run') {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      nextDevice.lldpEnabled = lower === 'lldp run';
    }
  } else if (lower.startsWith('ntp server ')) {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const ip = cmd.split(/\s+/)[2];
      if (!ip || !isValidIp(ip)) {
        out.push('% Usage: ntp server <ipv4-address>');
      } else {
        nextDevice.ntpServer = ip;
      }
    }
  } else if (lower === 'no ntp server') {
    if (isConfigSubMode) nextDevice.ntpServer = undefined;
  } else if (lower.startsWith('username ')) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const parts = cmd.split(/\s+/);
      const uname = parts[1];
      const secret = parts[3] || parts[2] || 'cisco';
      if (!uname) {
        out.push('% Usage: username <name> secret <password>');
      } else {
        const list = (nextDevice.users || []).filter(u => u.username !== uname);
        list.push({ username: uname, secret });
        nextDevice.users = list;
      }
    }
  } else if (lower.startsWith('no username ')) {
    const uname = cmd.split(/\s+/)[2];
    if (uname && nextDevice.users) {
      nextDevice.users = nextDevice.users.filter(u => u.username !== uname);
    }
  } else if (lower.startsWith('ip default-gateway ')) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const gw = cmd.split(/\s+/)[2];
      if (!gw || !isValidIp(gw)) {
        out.push('% Invalid IPv4 gateway address.');
      } else {
        nextDevice.defaultGateway = gw;
      }
    }
  } else if (lower === 'no ip default-gateway') {
    nextDevice.defaultGateway = undefined;
  } else if (lower.startsWith('ip dhcp excluded-address ')) {
    if (nextDevice.type !== 'router' || !isConfigSubMode) {
      out.push('% Enter Global Configuration mode on a router.');
    } else {
      const parts = cmd.split(/\s+/);
      const startIp = parts[3];
      const endIp = parts[4];
      if (!startIp || !isValidIp(startIp) || (endIp && !isValidIp(endIp))) {
        out.push('% Usage: ip dhcp excluded-address <low-ip> [high-ip]');
      } else {
        const ranges = nextDevice.dhcpExcludedRanges || [];
        const dup = ranges.some(r => r.start === startIp && r.end === endIp);
        if (!dup) {
          nextDevice.dhcpExcludedRanges = [...ranges, { start: startIp, ...(endIp ? { end: endIp } : {}) }];
        }
      }
    }
  } else if (lower.startsWith('no ip dhcp excluded-address ')) {
    if (isConfigSubMode && nextDevice.dhcpExcludedRanges) {
      const parts = cmd.split(/\s+/);
      const startIp = parts[4];
      nextDevice.dhcpExcludedRanges = nextDevice.dhcpExcludedRanges.filter(r => r.start !== startIp);
    }
  } else if (lower.startsWith('ip dhcp pool ')) {
    if (nextDevice.type !== 'router' || !isConfigSubMode) {
      out.push('% Enter Global Configuration mode on a router.');
    } else {
      const poolName = cmd.split(/\s+/).slice(3).join('_').trim();
      if (!poolName) {
        out.push('% Usage: ip dhcp pool <pool-name>');
      } else {
        const pools = nextDevice.dhcpPools || [];
        if (!pools.some(p => p.name === poolName)) {
          nextDevice.dhcpPools = [...pools, { name: poolName }];
        }
        resetSubModeContext();
        nextDevice.activeDhcpPool = poolName;
        setMode('dhcp_pool');
      }
    }
  } else if (lower.startsWith('no ip dhcp pool ')) {
    if (isConfigSubMode && nextDevice.dhcpPools) {
      const poolName = cmd.split(/\s+/).slice(4).join('_').trim();
      nextDevice.dhcpPools = nextDevice.dhcpPools.filter(p => p.name !== poolName);
      if (nextDevice.cliMode === 'dhcp_pool' && nextDevice.activeDhcpPool === poolName) {
        resetSubModeContext();
        setMode('global');
      }
    }
  } else if (nextDevice.cliMode === 'dhcp_pool' && nextDevice.activeDhcpPool) {
    const pool = (nextDevice.dhcpPools || []).find(p => p.name === nextDevice.activeDhcpPool);
    if (!pool) {
      out.push('% Active DHCP pool not found.');
    } else if (lower.startsWith('network ')) {
      const parts = cmd.split(/\s+/);
      const net = parts[1];
      const mask = parts[2];
      if (!net || !mask || !isValidIp(net) || !isValidMask(mask)) {
        out.push('% Usage: network <network-ip> <subnet-mask>');
      } else {
        pool.network = getNetworkAddress(net, mask);
        pool.mask = mask;
      }
    } else if (lower === 'no network') {
      pool.network = undefined;
      pool.mask = undefined;
    } else if (lower.startsWith('default-router ')) {
      const gw = cmd.split(/\s+/)[1];
      if (!gw || !isValidIp(gw)) out.push('% Usage: default-router <gateway-ip>');
      else pool.defaultRouter = gw;
    } else if (lower === 'no default-router') {
      pool.defaultRouter = undefined;
    } else if (lower.startsWith('dns-server ')) {
      const dns = cmd.split(/\s+/)[1];
      if (!dns || !isValidIp(dns)) out.push('% Usage: dns-server <dns-ip>');
      else pool.dnsServer = dns;
    } else if (lower === 'no dns-server') {
      pool.dnsServer = undefined;
    } else if (lower.startsWith('domain-name ')) {
      const dom = cmd.split(/\s+/)[1];
      if (dom) pool.domainName = dom;
    } else if (lower === 'no domain-name') {
      pool.domainName = undefined;
    } else if (lower.startsWith('lease ')) {
      pool.lease = cmd.split(/\s+/).slice(1).join(' ');
    } else if (lower === 'no lease') {
      pool.lease = undefined;
    } else {
      out.push('% Invalid DHCP pool command. Type "?" for options.');
    }
  } else if (lower.startsWith('access-list ')) {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const parts = cmd.split(/\s+/);
      const aclNum = Number(parts[1]);
      const action = (parts[2] || '').toLowerCase();
      const rest = parts.slice(3).join(' ').trim();
      if (
        !Number.isInteger(aclNum) ||
        aclNum < 1 ||
        aclNum > 199 ||
        !['permit', 'deny', 'remark'].includes(action) ||
        !rest
      ) {
        out.push('% Usage: access-list <1-199> <permit|deny|remark> <rule>');
      } else {
        const aclId = String(aclNum);
        const type: 'standard' | 'extended' = aclNum >= 100 ? 'extended' : 'standard';
        const acls = nextDevice.accessLists || [];
        let targetAcl = acls.find(a => a.id === aclId);
        if (!targetAcl) {
          targetAcl = { id: aclId, type, entries: [] };
          nextDevice.accessLists = [...acls, targetAcl];
        }
        const entry = `${action} ${rest}`;
        if (!targetAcl.entries.includes(entry)) {
          targetAcl.entries.push(entry);
        }
      }
    }
  } else if (lower.startsWith('no access-list ')) {
    if (isConfigSubMode && nextDevice.accessLists) {
      const aclId = cmd.split(/\s+/)[2];
      nextDevice.accessLists = nextDevice.accessLists.filter(a => a.id !== aclId);
    }
  } else if (/^ip\s+access-list\s+(std|standard|ext|extended)\s+\S+/i.test(lower)) {
    if (!isConfigSubMode) {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const parts = cmd.split(/\s+/);
      const typeToken = parts[2].toLowerCase();
      const aclType: 'standard' | 'extended' = typeToken.startsWith('ext') ? 'extended' : 'standard';
      const aclName = parts.slice(3).join('_');
      const acls = nextDevice.accessLists || [];
      if (!acls.some(a => a.id === aclName)) {
        nextDevice.accessLists = [...acls, { id: aclName, type: aclType, entries: [] }];
      }
      resetSubModeContext();
      nextDevice.activeAclName = aclName;
      setMode('acl');
    }
  } else if (/^no\s+ip\s+access-list\s+(std|standard|ext|extended)\s+\S+/i.test(lower)) {
    if (isConfigSubMode && nextDevice.accessLists) {
      const parts = cmd.split(/\s+/);
      const aclName = parts.slice(4).join('_');
      nextDevice.accessLists = nextDevice.accessLists.filter(a => a.id !== aclName);
      if (nextDevice.cliMode === 'acl' && nextDevice.activeAclName === aclName) {
        resetSubModeContext();
        setMode('global');
      }
    }
  } else if (nextDevice.cliMode === 'acl' && nextDevice.activeAclName) {
    const targetAcl = (nextDevice.accessLists || []).find(a => a.id === nextDevice.activeAclName);
    if (!targetAcl) {
      out.push('% Active access-list not found.');
    } else if (/^(permit|deny|remark)\s+.+/i.test(lower)) {
      const entry = cmd.replace(/\s+/g, ' ').trim();
      if (!targetAcl.entries.includes(entry)) {
        targetAcl.entries.push(entry);
      }
    } else if (lower.startsWith('no ')) {
      const arg = cmd.slice(3).trim();
      const seqNum = Number(arg);
      if (Number.isInteger(seqNum) && seqNum >= 10 && seqNum % 10 === 0) {
        const idx = seqNum / 10 - 1;
        if (idx >= 0 && idx < targetAcl.entries.length) {
          targetAcl.entries.splice(idx, 1);
        }
      } else {
        targetAcl.entries = targetAcl.entries.filter(
          e => e.toLowerCase() !== arg.toLowerCase()
        );
      }
    } else {
      out.push('% Invalid ACL command. Use "permit <rule>", "deny <rule>", "remark <text>", or "no <rule>".');
    }
  } else if (
    lower.startsWith('line console ') ||
    lower.startsWith('line con ') ||
    lower.startsWith('line vty ')
  ) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      resetSubModeContext();
      nextDevice.activeLine = lower.includes('vty') ? 'vty' : 'console';
      nextDevice.lineConfig = nextDevice.lineConfig || {};
      if (nextDevice.activeLine === 'console' && !nextDevice.lineConfig.console) {
        nextDevice.lineConfig.console = {};
      }
      if (nextDevice.activeLine === 'vty' && !nextDevice.lineConfig.vty) {
        nextDevice.lineConfig.vty = {};
      }
      setMode('line');
    }
  } else if (nextDevice.cliMode === 'line' && nextDevice.activeLine) {
    const targetLine =
      nextDevice.activeLine === 'vty'
        ? (nextDevice.lineConfig!.vty = nextDevice.lineConfig!.vty || {})
        : (nextDevice.lineConfig!.console = nextDevice.lineConfig!.console || {});
    if (lower.startsWith('password ')) {
      targetLine.password = cmd.split(/\s+/).slice(1).join(' ');
    } else if (lower === 'login') {
      targetLine.login = true;
      targetLine.loginLocal = false;
    } else if (lower === 'login local') {
      targetLine.loginLocal = true;
      targetLine.login = true;
    } else if (lower === 'no login') {
      targetLine.login = false;
      targetLine.loginLocal = false;
    } else if (lower.startsWith('transport input ')) {
      targetLine.transportInput = cmd.split(/\s+/).slice(2).join(' ');
    } else if (lower.startsWith('exec-timeout ')) {
      targetLine.execTimeout = cmd.split(/\s+/).slice(1).join(' ');
    } else if (lower === 'logging synchronous' || lower === 'logging sync') {
      targetLine.loggingSync = true;
    } else {
      out.push('% Invalid line configuration command. Type "?" for options.');
    }
  } else if (/^(interface|inter|int)\s+(range|ra|r)\s+/i.test(lower)) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const spec = cmd.replace(/^(interface|inter|int)\s+(range|ra|r)\s+/i, '');
      const matched = parseInterfaceRangeSpec(nextDevice, spec);
      if (matched.length === 0) {
        out.push(`% Invalid interface range "${spec}". Example: int range fa0/1 - 4`);
      } else {
        resetSubModeContext();
        nextDevice.activeInterfaceRange = matched.map(m => m.name);
        setMode('interface_range');
      }
    }
  } else if (/^(interface|inter|int)\s+/i.test(lower)) {
    if (nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode ("conf t") first.');
    } else {
      const targetIf = cmd.split(/\s+/).slice(1).join('');
      const resolved = resolveInterfaceInput(nextDevice, targetIf, true);
      if (!resolved.iface) {
        out.push(`% Invalid interface "${targetIf}". Run "show ip interface brief" to view ports.`);
      } else {
        if (resolved.createdSubIf) {
          nextDevice.interfaces.push(resolved.createdSubIf);
        }
        resetSubModeContext();
        nextDevice.activeInterfaceName = resolved.iface.name;
        setMode('interface');
      }
    }
  } else if (lower.startsWith('description ') || lower.startsWith('desc ')) {
    const targets = getTargetInterfaces();
    if (targets.length === 0) {
      out.push('% Enter interface configuration mode first.');
    } else {
      const text = cmd.split(/\s+/).slice(1).join(' ');
      targets.forEach(t => {
        t.description = text;
      });
    }
  } else if (lower === 'no description' || lower === 'no desc') {
    const targets = getTargetInterfaces();
    if (targets.length > 0) {
      targets.forEach(t => {
        t.description = undefined;
      });
    }
  } else if (lower === 'cdp enable' || lower === 'no cdp enable') {
    const targets = getTargetInterfaces();
    if (targets.length === 0) {
      out.push('% Enter interface configuration mode first.');
    } else {
      targets.forEach(t => {
        t.cdpEnabled = lower === 'cdp enable';
      });
    }
  } else if (/^ip\s+access-group\s+\S+\s+(in|out)$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (targets.length === 0) {
      out.push('% Enter interface configuration mode first.');
    } else {
      const parts = cmd.split(/\s+/);
      const aclName = parts[2];
      const dir = parts[3].toLowerCase();
      targets.forEach(t => {
        if (dir === 'in') t.ipAccessGroupIn = aclName;
        else t.ipAccessGroupOut = aclName;
      });
    }
  } else if (/^no\s+ip\s+access-group\s+\S+\s+(in|out)$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (targets.length > 0) {
      const dir = cmd.split(/\s+/)[4]?.toLowerCase();
      targets.forEach(t => {
        if (dir === 'in') t.ipAccessGroupIn = undefined;
        else if (dir === 'out') t.ipAccessGroupOut = undefined;
      });
    }
  } else if (lower.startsWith('duplex ')) {
    const targets = getTargetInterfaces();
    const val = lower.split(/\s+/)[1];
    if (targets.length === 0) {
      out.push('% Enter interface configuration mode first.');
    } else if (val === 'auto' || val === 'full' || val === 'half') {
      targets.forEach(t => {
        t.duplex = val;
      });
    } else {
      out.push('% Usage: duplex auto | full | half');
    }
  } else if (lower.startsWith('speed ')) {
    const targets = getTargetInterfaces();
    const val = lower.split(/\s+/)[1];
    if (targets.length === 0) {
      out.push('% Enter interface configuration mode first.');
    } else if (val === 'auto' || val === '10' || val === '100' || val === '1000') {
      targets.forEach(t => {
        t.speed = val;
      });
    } else {
      out.push('% Usage: speed auto | 10 | 100 | 1000');
    }
  } else if (lower.startsWith('bandwidth ')) {
    const targets = getTargetInterfaces();
    const bw = Number(cmd.split(/\s+/)[1]);
    if (targets.length === 0) out.push('% Enter interface configuration mode first.');
    else if (!Number.isFinite(bw) || bw <= 0) out.push('% Invalid bandwidth (kbps).');
    else targets.forEach(t => (t.bandwidth = bw));
  } else if (lower.startsWith('clock rate ')) {
    const targets = getTargetInterfaces();
    const rate = Number(cmd.split(/\s+/)[2]);
    if (targets.length === 0) out.push('% Enter serial interface configuration mode first.');
    else if (!Number.isFinite(rate) || rate <= 0) out.push('% Invalid clock rate.');
    else targets.forEach(t => (t.clockRate = rate));
  } else if (/^(encapsulation|encapsul|encap|enc)\s+dot1q\s+/i.test(lower)) {
    if (nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Enter an interface/subinterface first.');
    } else {
      const vlanNum = Number(cmd.split(/\s+/)[2]);
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (!targetIf || !Number.isInteger(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
        out.push('% Invalid IEEE 802.1Q VLAN ID.');
      } else {
        targetIf.dot1qVlan = vlanNum;
      }
    }
  } else if (/^ip\s+(address|addre|addr|add)\s+/i.test(lower)) {
    if (nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Must be inside single interface configuration mode.');
    } else {
      const parts = cmd.split(/\s+/);
      const ip = parts[2];
      const mask = parts[3];
      if (!ip || !mask || !isValidIp(ip) || !isValidMask(mask)) {
        out.push('% Invalid IPv4 address or subnet mask. Usage: ip address <ip> <mask>');
      } else {
        const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
        if (targetIf) {
          targetIf.ip = ip;
          targetIf.mask = mask;
        }
      }
    }
  } else if (/^no\s+ip\s+(address|addre|addr|add)$/i.test(lower)) {
    if (nextDevice.cliMode === 'interface' && nextDevice.activeInterfaceName) {
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf) {
        targetIf.ip = '';
        targetIf.mask = '';
      }
    }
  } else if (/^no\s+sh(u|ut|utd|utdo|utdow|utdown)?$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (targets.length === 0) {
      out.push('% Must be inside interface configuration mode.');
    } else {
      targets.forEach(t => {
        t.adminUp = true;
        out.push(`%LINK-3-UPDOWN: Interface ${t.name}, changed state to up`);
      });
    }
  } else if (/^sh(u|ut|utd|utdo|utdow|utdown)$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (targets.length === 0) {
      out.push('% Must be inside interface configuration mode.');
    } else {
      targets.forEach(t => {
        t.adminUp = false;
        out.push(`%LINK-5-CHANGED: Interface ${t.name}, changed state to administratively down`);
      });
    }
  } else if (lower.startsWith('ip route ')) {
    if (nextDevice.type !== 'router' || nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode on a router.');
    } else {
      const parts = cmd.split(/\s+/);
      const net = parts[2];
      const mask = parts[3];
      const nextHop = parts[4];
      if (!net || !mask || !nextHop || !isValidIp(net) || !isValidMask(mask) || !isValidIp(nextHop)) {
        out.push('% Usage: ip route <network> <mask> <next-hop-ip>');
      } else {
        const cleanNet = getNetworkAddress(net, mask);
        const exists = nextDevice.staticRoutes.some(
          r => r.network === cleanNet && r.mask === mask && r.nextHop === nextHop
        );
        if (!exists) {
          const newRoute: SimStaticRoute = { network: cleanNet, mask, nextHop };
          nextDevice.staticRoutes.push(newRoute);
        }
      }
    }
  } else if (lower.startsWith('no ip route ')) {
    const parts = cmd.split(/\s+/);
    const net = parts[3];
    const mask = parts[4];
    const nextHop = parts[5];
    nextDevice.staticRoutes = nextDevice.staticRoutes.filter(
      r => !(r.network === net && r.mask === mask && (!nextHop || r.nextHop === nextHop))
    );
  } else if (lower.startsWith('router ospf ')) {
    if (nextDevice.type !== 'router' || nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode on a router.');
    } else {
      const pid = cmd.split(/\s+/)[2] || '1';
      if (!nextDevice.ospf) {
        nextDevice.ospf = { processId: pid, routerId: '', networks: [] };
      } else {
        nextDevice.ospf.processId = pid;
      }
      resetSubModeContext();
      setMode('router_ospf');
    }
  } else if (lower.startsWith('no router ospf')) {
    if (nextDevice.type === 'router' && nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      nextDevice.ospf = undefined;
      if (nextDevice.cliMode === 'router_ospf') setMode('global');
    }
  } else if (lower.startsWith('router-id ')) {
    if (nextDevice.cliMode !== 'router_ospf' || !nextDevice.ospf) {
      out.push('% Enter "router ospf <id>" configuration mode first.');
    } else {
      const rid = cmd.split(/\s+/)[1];
      if (!rid || !isValidIp(rid)) {
        out.push('% Invalid Router-ID IPv4 format.');
      } else {
        nextDevice.ospf.routerId = rid;
      }
    }
  } else if (lower.startsWith('network ') && lower.includes(' area ')) {
    if (nextDevice.cliMode !== 'router_ospf' || !nextDevice.ospf) {
      out.push('% Enter "router ospf <id>" configuration mode first.');
    } else {
      const parts = cmd.split(/\s+/);
      const net = parts[1];
      const wildcard = parts[2];
      const area = parts[4] || '0';
      if (!isValidIp(net) || !isValidIp(wildcard)) {
        out.push('% Usage: network <network> <wildcard-mask> area <area-id>');
      } else {
        const exists = nextDevice.ospf.networks.some(
          n => n.network === net && n.wildcard === wildcard && n.area === area
        );
        if (!exists) {
          nextDevice.ospf.networks.push({ network: net, wildcard, area });
        }
      }
    }
  } else if (lower.startsWith('no network ') && lower.includes(' area ')) {
    if (nextDevice.cliMode === 'router_ospf' && nextDevice.ospf) {
      const parts = cmd.split(/\s+/);
      const net = parts[2];
      const wildcard = parts[3];
      const area = parts[5] || '0';
      nextDevice.ospf.networks = nextDevice.ospf.networks.filter(
        n => !(n.network === net && n.wildcard === wildcard && n.area === area)
      );
    }
  } else if (lower.startsWith('passive-interface ')) {
    if (nextDevice.cliMode !== 'router_ospf' || !nextDevice.ospf) {
      out.push('% Enter "router ospf <id>" configuration mode first.');
    } else {
      const arg = cmd.split(/\s+/).slice(1).join('');
      if (arg.toLowerCase() === 'default') {
        nextDevice.ospf.passiveDefault = true;
      } else {
        const resolved = resolveInterfaceInput(nextDevice, arg, false);
        if (!resolved.iface) {
          out.push(`% Invalid interface "${arg}".`);
        } else {
          const list = new Set(nextDevice.ospf.passiveInterfaces || []);
          list.add(resolved.iface.name);
          nextDevice.ospf.passiveInterfaces = Array.from(list);
        }
      }
    }
  } else if (lower.startsWith('no passive-interface ')) {
    if (nextDevice.cliMode === 'router_ospf' && nextDevice.ospf) {
      const arg = cmd.split(/\s+/).slice(2).join('');
      if (arg.toLowerCase() === 'default') {
        nextDevice.ospf.passiveDefault = false;
      } else {
        const resolved = resolveInterfaceInput(nextDevice, arg, false);
        if (resolved.iface && nextDevice.ospf.passiveInterfaces) {
          nextDevice.ospf.passiveInterfaces = nextDevice.ospf.passiveInterfaces.filter(
            n => n !== resolved.iface!.name
          );
        }
      }
    }
  } else if (lower === 'default-information originate') {
    if (nextDevice.cliMode === 'router_ospf' && nextDevice.ospf) {
      nextDevice.ospf.defaultInformationOriginate = true;
    }
  } else if (lower === 'no default-information originate') {
    if (nextDevice.cliMode === 'router_ospf' && nextDevice.ospf) {
      nextDevice.ospf.defaultInformationOriginate = false;
    }
  } else if (lower.startsWith('auto-cost reference-bandwidth ')) {
    if (nextDevice.cliMode === 'router_ospf' && nextDevice.ospf) {
      const mbps = Number(cmd.split(/\s+/)[2]);
      if (Number.isInteger(mbps) && mbps >= 1) {
        nextDevice.ospf.referenceBandwidth = mbps;
      }
    }
  } else if (lower.startsWith('vlan ')) {
    if (nextDevice.type !== 'switch' || nextDevice.cliMode === 'user' || nextDevice.cliMode === 'privileged') {
      out.push('% Enter Global Configuration mode on a switch.');
    } else {
      const vid = Number(cmd.split(/\s+/)[1]);
      if (!Number.isInteger(vid) || vid < 1 || vid > 4094) {
        out.push('% Invalid VLAN ID (1-4094).');
      } else {
        if (!nextDevice.vlans.some(v => v.id === vid)) {
          nextDevice.vlans.push({ id: vid, name: `VLAN${String(vid).padStart(4, '0')}` });
        }
        resetSubModeContext();
        nextDevice.activeVlanId = vid;
        setMode('vlan_db');
      }
    }
  } else if (lower.startsWith('no vlan ')) {
    if (nextDevice.type === 'switch' && nextDevice.cliMode !== 'user' && nextDevice.cliMode !== 'privileged') {
      const vid = Number(cmd.split(/\s+/)[2]);
      if (vid === 1) {
        out.push('% Default VLAN 1 cannot be deleted.');
      } else if (Number.isInteger(vid)) {
        nextDevice.vlans = nextDevice.vlans.filter(v => v.id !== vid);
        nextDevice.interfaces.forEach(i => {
          if (i.accessVlan === vid) i.accessVlan = 1;
        });
      }
    }
  } else if (lower.startsWith('name ')) {
    if (nextDevice.cliMode !== 'vlan_db' || !nextDevice.activeVlanId) {
      out.push('% Enter "vlan <id>" mode first.');
    } else {
      const vName = cmd.split(/\s+/).slice(1).join('_');
      const vObj = nextDevice.vlans.find(v => v.id === nextDevice.activeVlanId);
      if (vObj && vName) vObj.name = vName;
    }
  } else if (/^(switchport|sw)\s+m(o|od|ode)?\s+(a(cc|cce|cces|ccess)?|t(r|ru|run|runk)?)$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (nextDevice.type !== 'switch' || targets.length === 0) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      const isTrunk = /\s+t(r|ru|run|runk)?$/i.test(lower);
      targets.forEach(t => {
        t.switchportMode = isTrunk ? 'trunk' : 'access';
      });
    }
  } else if (/^(switchport|sw)\s+acc(ess)?\s+vlan\s+\d+$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (nextDevice.type !== 'switch' || targets.length === 0) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      const vid = Number(cmd.split(/\s+/)[3]);
      if (Number.isInteger(vid) && vid >= 1 && vid <= 4094) {
        if (!nextDevice.vlans.some(v => v.id === vid)) {
          nextDevice.vlans.push({ id: vid, name: `VLAN${String(vid).padStart(4, '0')}` });
        }
        targets.forEach(t => {
          t.switchportMode = 'access';
          t.accessVlan = vid;
        });
      } else {
        out.push('% Invalid VLAN ID (1-4094).');
      }
    }
  } else if (/^no\s+(switchport|sw)\s+acc(ess)?\s+vlan$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (nextDevice.type === 'switch' && targets.length > 0) {
      targets.forEach(t => {
        t.accessVlan = 1;
      });
    }
  } else if (/^(switchport|sw)\s+tr(unk)?\s+nat(ive)?\s+vlan\s+\d+$/i.test(lower)) {
    const targets = getTargetInterfaces();
    const vid = Number(cmd.split(/\s+/)[4]);
    if (nextDevice.type !== 'switch' || targets.length === 0) {
      out.push('% Enter switch interface configuration mode first.');
    } else if (!Number.isInteger(vid) || vid < 1 || vid > 4094) {
      out.push('% Invalid native VLAN ID (1-4094).');
    } else {
      targets.forEach(t => {
        t.trunkNativeVlan = vid;
      });
    }
  } else if (/^(switchport|sw)\s+tr(unk)?\s+all(owed)?\s+vlan\s+.+$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (nextDevice.type !== 'switch' || targets.length === 0) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      const rest = cmd.split(/\s+/).slice(4).join(' ').trim();
      const restLower = rest.toLowerCase();
      if (restLower === 'all') {
        targets.forEach(t => (t.trunkAllowedVlans = [1, 10, 20, 30, 99]));
      } else if (restLower.startsWith('add ')) {
        const addIds = rest
          .slice(4)
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 4094);
        targets.forEach(t => {
          const merged = new Set([...(t.trunkAllowedVlans || [1]), ...addIds]);
          t.trunkAllowedVlans = Array.from(merged).sort((a, b) => a - b);
        });
      } else if (restLower.startsWith('remove ')) {
        const remIds = new Set(
          rest
            .slice(7)
            .split(',')
            .map(s => Number(s.trim()))
        );
        targets.forEach(t => {
          t.trunkAllowedVlans = (t.trunkAllowedVlans || [1]).filter(v => !remIds.has(v));
        });
      } else {
        const vids = rest
          .replace(/\s+/g, '')
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 4094);
        if (vids.length > 0) {
          targets.forEach(t => {
            t.trunkAllowedVlans = vids;
          });
        } else {
          out.push('% Usage: switchport trunk allowed vlan <list|add <list>|remove <list>|all>');
        }
      }
    }
  } else if (/^(switchport|sw)\s+port-security(\s+.*)?$/i.test(lower)) {
    const targets = getTargetInterfaces();
    if (nextDevice.type !== 'switch' || targets.length === 0) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      targets.forEach(t => {
        t.portSecurity = t.portSecurity || {
          enabled: true,
          maximum: 1,
          violation: 'shutdown',
          sticky: false
        };
        t.portSecurity.enabled = true;
        if (lower.includes('maximum ')) {
          const max = Number(lower.split('maximum ')[1]);
          if (Number.isInteger(max) && max >= 1 && max <= 132) t.portSecurity.maximum = max;
        } else if (lower.includes('violation ')) {
          const v = lower.split('violation ')[1]?.trim();
          if (v === 'protect' || v === 'restrict' || v === 'shutdown') {
            t.portSecurity.violation = v;
          }
        } else if (lower.includes('mac-address sticky')) {
          t.portSecurity.sticky = true;
        }
      });
    }
  } else if (/^no\s+(switchport|sw)\s+port-security$/i.test(lower)) {
    const targets = getTargetInterfaces();
    targets.forEach(t => {
      if (t.portSecurity) t.portSecurity.enabled = false;
    });
  } else if (lower === 'spanning-tree portfast') {
    const targets = getTargetInterfaces();
    if (nextDevice.type !== 'switch' || targets.length === 0) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      targets.forEach(t => {
        t.portfast = true;
      });
      out.push('%Warning: portfast should only be enabled on ports connected to a single host.');
    }
  } else if (lower === 'no spanning-tree portfast') {
    const targets = getTargetInterfaces();
    targets.forEach(t => {
      t.portfast = false;
    });
  } else if (lower === 'spanning-tree bpduguard enable') {
    const targets = getTargetInterfaces();
    if (nextDevice.type === 'switch' && targets.length > 0) {
      targets.forEach(t => {
        t.bpduGuard = true;
      });
    }
  } else if (lower === 'no spanning-tree bpduguard enable') {
    const targets = getTargetInterfaces();
    targets.forEach(t => {
      t.bpduGuard = false;
    });
  } else {
    const caretOffset = `${prompt} `.length;
    out.push(`${' '.repeat(caretOffset)}^`);
    out.push(`% Invalid input detected at '^' marker. Type "?" or press Tab for supported Cisco IOS commands.`);
  }

  return {
    updatedDevice: {
      ...nextDevice,
      cliHistory: out
    },
    pingResult
  };
}

export interface DevicePortAnchor {
  name: string;
  shortName: string;
  kind: 'ethernet' | 'fiber' | 'serial';
  x: number;
  y: number;
  angleDeg: number;
}

export function getDevicePortAnchors(dev: SimDevice): DevicePortAnchor[] {
  const physicalPorts = dev.interfaces.filter(
    (i): i is SimDeviceInterface & { kind: 'ethernet' | 'fiber' | 'serial' } =>
      i.kind === 'ethernet' || i.kind === 'fiber' || i.kind === 'serial'
  );
  if (physicalPorts.length === 0) return [];

  const rotRad = (((typeof dev.rotation === 'number' && Number.isFinite(dev.rotation) ? dev.rotation : 0) * Math.PI) / 180);
  const rx = 31;
  const ry = 25;
  const startDeg = -184;
  const endDeg = 4;
  const count = physicalPorts.length;

  return physicalPorts.map((iface, idx) => {
    const baseDeg =
      count === 1
        ? -90
        : startDeg + ((idx + 0.5) / count) * (endDeg - startDeg);
    const baseRad = (baseDeg * Math.PI) / 180;
    const localX = rx * Math.cos(baseRad);
    const localY = ry * Math.sin(baseRad);
    const rotX = localX * Math.cos(rotRad) - localY * Math.sin(rotRad);
    const rotY = localX * Math.sin(rotRad) + localY * Math.cos(rotRad);
    return {
      name: iface.name,
      shortName: iface.shortName,
      kind: iface.kind,
      x: Math.round((dev.x + rotX) * 10) / 10,
      y: Math.round((dev.y + rotY) * 10) / 10,
      angleDeg: baseDeg + (dev.rotation || 0)
    };
  });
}

export function getDevicePortPosition(
  dev: SimDevice,
  portName: string
): { x: number; y: number } {
  const anchors = getDevicePortAnchors(dev);
  const match = anchors.find(a => a.name === portName);
  if (match) {
    return { x: match.x, y: match.y };
  }
  return { x: dev.x, y: dev.y };
}

export interface LinkConnectorEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fromDownClearance: number;
  toDownClearance: number;
}

function getDownwardLabelClearance(dev: SimDevice): number {
  const ox = typeof dev.labelOffsetX === 'number' && Number.isFinite(dev.labelOffsetX) ? dev.labelOffsetX : 0;
  const oy = typeof dev.labelOffsetY === 'number' && Number.isFinite(dev.labelOffsetY) ? dev.labelOffsetY : 0;
  // If label was manually dragged away from directly below the device icon, use icon clearance
  if (Math.abs(ox) > 42 || oy < -24 || oy > 46) {
    return 38;
  }
  const hasIp = dev.interfaces.some(i => isValidIp(i.ip));
  const hasCustomSub = Boolean(dev.customLabel?.trim() && dev.useCustomLabel !== false && dev.customLabel.trim() !== dev.name);
  const lines = 1 + (hasIp ? 1 : 0) + (hasCustomSub ? 1 : 0);
  return 44 + lines * 14 + Math.max(0, oy);
}

export function getLinkConnectorEndpoints(
  link: SimLink,
  fromDev: SimDevice,
  toDev: SimDevice,
  allLinks: SimLink[]
): LinkConnectorEndpoints {
  const dx = toDev.x - fromDev.x;
  const dy = toDev.y - fromDev.y;
  const len = Math.hypot(dx, dy) || 1;

  // Find parallel links connecting the same device pair (regardless of direction)
  const siblings = allLinks.filter(
    l =>
      (l.fromDeviceId === fromDev.id && l.toDeviceId === toDev.id) ||
      (l.fromDeviceId === toDev.id && l.toDeviceId === fromDev.id)
  );

  let offset = 0;
  if (siblings.length > 1) {
    const idx = siblings.findIndex(l => l.id === link.id);
    if (idx >= 0) {
      offset = (idx - (siblings.length - 1) / 2) * 14;
    }
  }

  // Canonicalize perpendicular normal direction by sorted device IDs so reversed links don't collide
  const flipNormal = fromDev.id > toDev.id ? -1 : 1;
  const nx = (-dy / len) * flipNormal;
  const ny = (dx / len) * flipNormal;

  return {
    x1: fromDev.x + nx * offset,
    y1: fromDev.y + ny * offset,
    x2: toDev.x + nx * offset,
    y2: toDev.y + ny * offset,
    fromDownClearance: getDownwardLabelClearance(fromDev),
    toDownClearance: getDownwardLabelClearance(toDev)
  };
}

export interface CableVisualGeometry {
  pathD: string;
  x1Led: number;
  y1Led: number;
  x2Led: number;
  y2Led: number;
  fromLabelX: number;
  fromLabelY: number;
  toLabelX: number;
  toLabelY: number;
  textAnchor: 'start' | 'middle' | 'end';
}

export function computeCableGeometry(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  options?: {
    anchored?: boolean;
    cableType?: SimCableType;
    fromDownClearance?: number;
    toDownClearance?: number;
  }
): CableVisualGeometry {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const endpointClearance = (rayY: number, downClearance: number) => {
    if (options?.anchored) {
      return Math.min(13, len * 0.28);
    }
    if (rayY > 0.35) {
      // Smoothly clear bottom device label pill along downward vertical/diagonal rays
      const target = 38 + ((rayY - 0.35) / 0.65) * Math.max(0, downClearance - 38);
      return Math.min(target, len * 0.42);
    }
    if (rayY < -0.3) {
      return Math.min(36, len * 0.34);
    }
    return Math.min(40, len * 0.32);
  };

  const fromOffset = endpointClearance(uy, options?.fromDownClearance ?? 76);
  const toOffset = endpointClearance(-uy, options?.toDownClearance ?? 76);

  let pathD = `M ${fromX.toFixed(1)} ${fromY.toFixed(1)} L ${toX.toFixed(1)} ${toY.toFixed(1)}`;
  let x1Led = fromX + ux * fromOffset;
  let y1Led = fromY + uy * fromOffset;
  let x2Led = toX - ux * toOffset;
  let y2Led = toY - uy * toOffset;

  if (options?.cableType === 'serial' && len >= 48) {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    let bnx = -uy;
    let bny = ux;
    if ((Math.abs(bny) > 0.25 && bny > 0) || (Math.abs(bny) <= 0.25 && bnx > 0)) {
      bnx = -bnx;
      bny = -bny;
    }
    const boltAlong = Math.min(9, len * 0.06);
    const boltAmp = Math.min(12, len * 0.10);
    const p1x = midX + ux * boltAlong + bnx * boltAmp;
    const p1y = midY + uy * boltAlong + bny * boltAmp;
    const p2x = midX - ux * boltAlong - bnx * boltAmp;
    const p2y = midY - uy * boltAlong - bny * boltAmp;

    pathD = `M ${fromX.toFixed(1)} ${fromY.toFixed(1)} L ${p1x.toFixed(1)} ${p1y.toFixed(1)} L ${p2x.toFixed(1)} ${p2y.toFixed(1)} L ${toX.toFixed(1)} ${toY.toFixed(1)}`;

    // Keep link LEDs dead-center on the angled serial lightning segments
    const s1dx = p1x - fromX;
    const s1dy = p1y - fromY;
    const s1Len = Math.hypot(s1dx, s1dy) || 1;
    x1Led = fromX + (s1dx / s1Len) * Math.min(fromOffset, s1Len * 0.82);
    y1Led = fromY + (s1dy / s1Len) * Math.min(fromOffset, s1Len * 0.82);

    const s2dx = p2x - toX;
    const s2dy = p2y - toY;
    const s2Len = Math.hypot(s2dx, s2dy) || 1;
    x2Led = toX + (s2dx / s2Len) * Math.min(toOffset, s2Len * 0.82);
    y2Led = toY + (s2dy / s2Len) * Math.min(toOffset, s2Len * 0.82);
  }

  let nx = -uy;
  let ny = ux;
  if (Math.abs(ny) < 0.22) {
    if (nx < 0) {
      nx = -nx;
      ny = -ny;
    }
  } else if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  if (Math.abs(nx) < 0.32) {
    return {
      pathD,
      x1Led,
      y1Led,
      x2Led,
      y2Led,
      fromLabelX: x1Led + ux * 8,
      fromLabelY: y1Led + ny * 11,
      toLabelX: x2Led - ux * 8,
      toLabelY: y2Led + ny * 11,
      textAnchor: 'middle'
    };
  }

  return {
    pathD,
    x1Led,
    y1Led,
    x2Led,
    y2Led,
    fromLabelX: x1Led + nx * 9,
    fromLabelY: y1Led + ny * 9 + 3,
    toLabelX: x2Led + nx * 9,
    toLabelY: y2Led + ny * 9 + 3,
    textAnchor: nx > 0 ? 'start' : 'end'
  };
}


