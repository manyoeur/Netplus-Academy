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
    case 'router_ospf':
      return `${device.name}(config-router)#`;
    case 'vlan_db':
      return `${device.name}(config-vlan)#`;
    default:
      return `${device.name}#`;
  }
}

function resolveInterfaceInput(
  device: SimDevice,
  token: string,
  createSubIfAllowed: boolean
): { iface?: SimDeviceInterface; createdSubIf?: SimDeviceInterface } {
  const norm = token.trim().toLowerCase();

  // Exact or prefix match on existing interfaces
  const exact = device.interfaces.find(
    i => i.name.toLowerCase() === norm || i.shortName.toLowerCase() === norm
  );
  if (exact) return { iface: exact };

  // Expand shorthand like g0/0, gi0/0, fa0/1, s0/0/0, g0/0.10
  let expanded = norm;
  if (/^g(\d)/.test(norm)) expanded = norm.replace(/^g/, 'gigabitethernet');
  else if (/^gi(\d)/.test(norm)) expanded = norm.replace(/^gi/, 'gigabitethernet');
  else if (/^gig(\d)/.test(norm)) expanded = norm.replace(/^gig/, 'gigabitethernet');
  else if (/^f(\d)/.test(norm)) expanded = norm.replace(/^f/, 'fastethernet');
  else if (/^fa(\d)/.test(norm)) expanded = norm.replace(/^fa/, 'fastethernet');
  else if (/^s(\d)/.test(norm)) expanded = norm.replace(/^s/, 'serial');
  else if (/^se(\d)/.test(norm)) expanded = norm.replace(/^se/, 'serial');

  const byExpanded = device.interfaces.find(i => i.name.toLowerCase() === expanded);
  if (byExpanded) return { iface: byExpanded };

  // Router-on-a-stick subinterface creation e.g. gigabitethernet0/0.10
  if (createSubIfAllowed && device.type === 'router' && expanded.includes('.')) {
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
        cliHistory: out
      },
      pingResult
    };
  }

  // Cisco Router / Switch IOS CLI
  let nextDevice: SimDevice = {
    ...device,
    interfaces: device.interfaces.map(i => ({ ...i })),
    staticRoutes: [...device.staticRoutes],
    vlans: [...device.vlans],
    ospf: device.ospf
      ? { ...device.ospf, networks: [...device.ospf.networks] }
      : undefined
  };
  const out = [...device.cliHistory, `${prompt} ${cmd}`];
  let pingResult: PingSimulationResult | undefined;

  const setMode = (mode: SimCliMode) => {
    nextDevice.cliMode = mode;
  };

  if (lower === 'help' || lower === '?') {
    out.push(
      'Supported Cisco IOS Commands:',
      '  enable / disable                    - Switch between User and Privileged EXEC',
      '  configure terminal (conf t)         - Enter Global Configuration mode',
      '  hostname <name>                     - Change device hostname',
      '  interface <name> (int g0/0)         - Configure interface or subinterface',
      '  ip address <ip> <mask>              - Assign IPv4 address (in config-if)',
      '  encapsulation dot1q <vlan-id>       - Set 802.1Q VLAN tag on subinterface',
      '  no shutdown (no shut) / shutdown    - Enable or disable interface',
      ...(device.type === 'router'
        ? [
            '  ip route <net> <mask> <next-hop>    - Add IPv4 static route',
            '  router ospf <pid>                   - Configure OSPF routing process',
            '  router-id <x.x.x.x> / network ...   - Configure OSPF ID & networks'
          ]
        : [
            '  vlan <id> / name <vlan-name>        - Create or name a VLAN',
            '  switchport mode access | trunk      - Set L2 switchport mode',
            '  switchport access vlan <id>         - Assign access port to VLAN'
          ]),
      '  show ip interface brief (sh ip int br)',
      '  show ip route / show running-config / show vlan brief',
      '  ping <ip> / traceroute <ip>         - Test live topology connectivity',
      '  exit / end                          - Exit current configuration level'
    );
  } else if (lower === 'enable' || lower === 'en') {
    setMode('privileged');
  } else if (lower === 'disable') {
    setMode('user');
  } else if (lower === 'end') {
    if (nextDevice.cliMode !== 'user') {
      setMode('privileged');
      nextDevice.activeInterfaceName = undefined;
      nextDevice.activeVlanId = undefined;
    }
  } else if (lower === 'exit') {
    if (
      nextDevice.cliMode === 'interface' ||
      nextDevice.cliMode === 'router_ospf' ||
      nextDevice.cliMode === 'vlan_db'
    ) {
      setMode('global');
      nextDevice.activeInterfaceName = undefined;
      nextDevice.activeVlanId = undefined;
    } else if (nextDevice.cliMode === 'global') {
      setMode('privileged');
    } else if (nextDevice.cliMode === 'privileged') {
      setMode('user');
    }
  } else if (lower === 'configure terminal' || lower === 'conf t' || lower === 'config t') {
    if (nextDevice.cliMode === 'user') {
      out.push('% Type "enable" first to enter Privileged EXEC mode.');
    } else {
      setMode('global');
      out.push('Enter configuration commands, one per line. End with "end".');
    }
  } else if (
    lower === 'show ip interface brief' ||
    lower === 'sh ip int br' ||
    lower === 'do show ip interface brief' ||
    lower === 'do sh ip int br'
  ) {
    out.push(
      'Interface                  IP-Address      OK? Method Status                Protocol'
    );
    nextDevice.interfaces.forEach(iface => {
      const linkUp = isInterfaceLineProtocolUp(nextDevice, iface, allDevices, allLinks);
      const statusText = iface.adminUp ? (linkUp ? 'up' : 'down') : 'administratively down';
      const protoText = iface.adminUp && linkUp ? 'up' : 'down';
      const ipDisplay = iface.ip || 'unassigned';
      out.push(
        `${iface.name.padEnd(27, ' ')}${ipDisplay.padEnd(16, ' ')}YES manual ${statusText.padEnd(22, ' ')}${protoText}`
      );
    });
  } else if (
    lower === 'show ip route' ||
    lower === 'sh ip ro' ||
    lower === 'do show ip route' ||
    lower === 'do sh ip ro'
  ) {
    if (nextDevice.type !== 'router') {
      out.push('% Routing table applies to Layer 3 routers.');
    } else {
      const table = computeRoutingTable(nextDevice, allDevices, allLinks);
      out.push(
        'Codes: C - connected, S - static, O - OSPF',
        ''
      );
      if (table.length === 0) {
        out.push('Routing table is empty. Configure interface IPs and run "no shutdown".');
      } else {
        table.forEach(entry => {
          if (entry.code === 'C') {
            out.push(
              `C        ${entry.network}/${entry.prefix} is directly connected, ${entry.exitInterface}`
            );
          } else {
            out.push(
              `${entry.code}        ${entry.network}/${entry.prefix} [${entry.adminDistance}/${entry.metric}] via ${entry.nextHop}, ${entry.exitInterface}`
            );
          }
        });
      }
    }
  } else if (
    lower === 'show vlan brief' ||
    lower === 'show vlan' ||
    lower === 'sh vlan' ||
    lower === 'sh vlan br'
  ) {
    if (nextDevice.type !== 'switch') {
      out.push('% VLAN database applies to Catalyst switches.');
    } else {
      out.push('VLAN Name                             Status    Ports');
      out.push('---- -------------------------------- --------- -------------------------------');
      nextDevice.vlans.forEach(v => {
        const ports = nextDevice.interfaces
          .filter(
            i => i.switchportMode !== 'trunk' && (i.accessVlan || 1) === v.id
          )
          .map(i => i.shortName)
          .join(', ');
        out.push(
          `${String(v.id).padEnd(5, ' ')}${v.name.padEnd(33, ' ')}active    ${ports}`
        );
      });
    }
  } else if (
    lower === 'show interfaces trunk' ||
    lower === 'sh int trunk' ||
    lower === 'sh int tr'
  ) {
    if (nextDevice.type !== 'switch') {
      out.push('% Trunk status applies to Catalyst switches.');
    } else {
      const trunks = nextDevice.interfaces.filter(i => i.switchportMode === 'trunk');
      if (trunks.length === 0) {
        out.push('No active 802.1Q trunk ports configured.');
      } else {
        out.push('Port        Mode         Encapsulation  Status        Native vlan');
        trunks.forEach(t => {
          const isUp = isInterfaceLineProtocolUp(nextDevice, t, allDevices, allLinks);
          out.push(
            `${t.shortName.padEnd(12, ' ')}on           802.1q         ${(isUp ? 'trunking' : 'notconnect').padEnd(14, ' ')}1`
          );
        });
      }
    }
  } else if (
    lower === 'show running-config' ||
    lower === 'sh run' ||
    lower === 'do show running-config'
  ) {
    out.push('!', `hostname ${nextDevice.name}`, '!');
    if (nextDevice.type === 'switch') {
      nextDevice.vlans
        .filter(v => v.id !== 1)
        .forEach(v => {
          out.push(`vlan ${v.id}`, ` name ${v.name}`, '!');
        });
    }
    nextDevice.interfaces.forEach(iface => {
      out.push(`interface ${iface.name}`);
      if (iface.dot1qVlan) out.push(` encapsulation dot1Q ${iface.dot1qVlan}`);
      if (iface.ip) out.push(` ip address ${iface.ip} ${iface.mask}`);
      if (nextDevice.type === 'switch') {
        if (iface.switchportMode === 'trunk') {
          out.push(' switchport mode trunk');
        } else {
          out.push(' switchport mode access');
          if (iface.accessVlan && iface.accessVlan !== 1) {
            out.push(` switchport access vlan ${iface.accessVlan}`);
          }
        }
      }
      if (!iface.adminUp) out.push(' shutdown');
      out.push('!');
    });
    nextDevice.staticRoutes.forEach(sr => {
      out.push(`ip route ${sr.network} ${sr.mask} ${sr.nextHop}`);
    });
    if (nextDevice.ospf) {
      out.push(`router ospf ${nextDevice.ospf.processId}`);
      if (nextDevice.ospf.routerId) out.push(` router-id ${nextDevice.ospf.routerId}`);
      nextDevice.ospf.networks.forEach(n => {
        out.push(` network ${n.network} ${n.wildcard} area ${n.area}`);
      });
    }
    out.push('end');
  } else if (lower.startsWith('ping ') || lower.startsWith('do ping ')) {
    const clean = lower.startsWith('do ') ? cmd.slice(3).trim() : cmd;
    const target = clean.split(/\s+/)[1] || '';
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
  } else if (lower.startsWith('traceroute ') || lower.startsWith('do traceroute ')) {
    const clean = lower.startsWith('do ') ? cmd.slice(3).trim() : cmd;
    const target = clean.split(/\s+/)[1] || '';
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
      if (newHost) {
        nextDevice.name = newHost;
      }
    }
  } else if (lower.startsWith('interface ') || lower.startsWith('int ')) {
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
        nextDevice.activeInterfaceName = resolved.iface.name;
        setMode('interface');
      }
    }
  } else if (lower.startsWith('encapsulation dot1q ')) {
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
  } else if (lower.startsWith('ip address ')) {
    if (nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Must be inside interface configuration mode.');
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
  } else if (lower === 'no ip address') {
    if (nextDevice.cliMode === 'interface' && nextDevice.activeInterfaceName) {
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf) {
        targetIf.ip = '';
        targetIf.mask = '';
      }
    }
  } else if (lower === 'no shutdown' || lower === 'no shut') {
    if (nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Must be inside interface configuration mode.');
    } else {
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf) {
        targetIf.adminUp = true;
        out.push(`%LINK-3-UPDOWN: Interface ${targetIf.name}, changed state to up`);
      }
    }
  } else if (lower === 'shutdown' || lower === 'shut') {
    if (nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Must be inside interface configuration mode.');
    } else {
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf) {
        targetIf.adminUp = false;
        out.push(`%LINK-5-CHANGED: Interface ${targetIf.name}, changed state to administratively down`);
      }
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
      setMode('router_ospf');
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
        nextDevice.activeVlanId = vid;
        setMode('vlan_db');
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
  } else if (lower === 'switchport mode access' || lower === 'switchport mode trunk') {
    if (nextDevice.type !== 'switch' || nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf) {
        targetIf.switchportMode = lower.endsWith('trunk') ? 'trunk' : 'access';
      }
    }
  } else if (lower.startsWith('switchport access vlan ')) {
    if (nextDevice.type !== 'switch' || nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      const vid = Number(cmd.split(/\s+/)[3]);
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf && Number.isInteger(vid) && vid >= 1 && vid <= 4094) {
        if (!nextDevice.vlans.some(v => v.id === vid)) {
          nextDevice.vlans.push({ id: vid, name: `VLAN${String(vid).padStart(4, '0')}` });
        }
        targetIf.switchportMode = 'access';
        targetIf.accessVlan = vid;
      }
    }
  } else if (lower.startsWith('switchport trunk allowed vlan ')) {
    if (nextDevice.type !== 'switch' || nextDevice.cliMode !== 'interface' || !nextDevice.activeInterfaceName) {
      out.push('% Enter switch interface configuration mode first.');
    } else {
      const rawList = cmd.split(/\s+/).slice(4).join('');
      const vids = rawList
        .split(',')
        .map(s => Number(s.trim()))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 4094);
      const targetIf = nextDevice.interfaces.find(i => i.name === nextDevice.activeInterfaceName);
      if (targetIf && vids.length > 0) {
        targetIf.trunkAllowedVlans = vids;
      }
    }
  } else {
    out.push(`% Invalid input detected. Type "help" to list supported Cisco IOS commands.`);
  }

  return {
    updatedDevice: {
      ...nextDevice,
      cliHistory: out
    },
    pingResult
  };
}

export interface CableVisualGeometry {
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
  toY: number
): CableVisualGeometry {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const endpointClearance = (rayY: number) => {
    const target = rayY > 0.25 ? 42 + rayY * 24 : 44;
    const maxFraction = rayY > 0.25 ? 0.34 : 0.30;
    return Math.min(target, len * maxFraction);
  };

  const fromOffset = endpointClearance(uy);
  const toOffset = endpointClearance(-uy);

  const x1Led = fromX + ux * fromOffset;
  const y1Led = fromY + uy * fromOffset;
  const x2Led = toX - ux * toOffset;
  const y2Led = toY - uy * toOffset;

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

