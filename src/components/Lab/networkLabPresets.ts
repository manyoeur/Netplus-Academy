import { createDefaultDevice, evaluateLinkStatus, simulatePing } from './networkSimEngine';
import { LabScenarioPreset, SimDevice, SimLink } from './networkSimTypes';

function configureIface(
  device: SimDevice,
  portName: string,
  patch: Partial<SimDevice['interfaces'][number]>
): SimDevice {
  return {
    ...device,
    interfaces: device.interfaces.map(i =>
      i.name === portName ? { ...i, ...patch } : i
    )
  };
}

export const NETWORK_LAB_PRESETS: LabScenarioPreset[] = [
  {
    id: 'blank-sandbox',
    title: 'Blank Lab Project',
    category: 'Blank',
    difficulty: 'Free Build',
    description:
      'Start with an empty topology canvas. Add Cisco routers, switches, PCs, and servers, wire them with cables, configure IOS CLI & IPv4 settings, and save your completed project file.',
    objectives: [],
    buildInitialState: () => ({ devices: [], links: [] })
  },
  {
    id: 'static-routing-lab',
    title: 'Point-to-Point Serial WAN & Static Routing',
    category: 'WAN & Routing',
    difficulty: 'Beginner',
    description:
      'Bring up the Serial WAN link on R1-HQ, assign PC-2 IPv4 settings, and configure bidirectional static routes so PC-1 can ping PC-2.',
    objectives: [
      {
        id: 'wan-up',
        label: 'Enable R1-HQ Serial0/0/0 ("no shutdown") so WAN link is up/up',
        check: (devices, links) => {
          const wanLink = links.find(l => l.id === 'link-r1-r2');
          return wanLink ? evaluateLinkStatus(wanLink, devices).isUp : false;
        }
      },
      {
        id: 'pc2-ip',
        label: 'Configure PC-2 with IP 192.168.20.10/24 and gateway 192.168.20.1',
        check: (devices) => {
          const pc2 = devices.find(d => d.id === 'pc-2');
          if (!pc2) return false;
          const nic = pc2.interfaces[0];
          return Boolean(
            nic?.ip === '192.168.20.10' &&
              nic?.mask === '255.255.255.0' &&
              pc2.gateway === '192.168.20.1'
          );
        }
      },
      {
        id: 'r1-route',
        label: 'Add static route on R1-HQ for 192.168.20.0/24 via 10.0.0.2',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'r1-hq');
          return Boolean(
            r1?.staticRoutes.some(
              r => r.network === '192.168.20.0' && r.mask === '255.255.255.0' && r.nextHop === '10.0.0.2'
            )
          );
        }
      },
      {
        id: 'e2e-ping',
        label: 'Verify end-to-end ICMP ping from PC-1 to 192.168.20.10',
        check: (devices, links) =>
          simulatePing(devices, links, 'pc-1', '192.168.20.10').success
      }
    ],
    buildInitialState: () => {
      let pc1 = createDefaultDevice('pc', 'PC-1', 120, 440, 'pc-1');
      pc1 = configureIface(pc1, 'FastEthernet0', {
        ip: '192.168.10.10',
        mask: '255.255.255.0',
        adminUp: true
      });
      pc1.gateway = '192.168.10.1';

      const sw1 = createDefaultDevice('switch', 'SW-HQ', 240, 290, 'sw-1');

      let r1 = createDefaultDevice('router', 'R1-HQ', 360, 145, 'r1-hq');
      r1 = configureIface(r1, 'GigabitEthernet0/0', {
        ip: '192.168.10.1',
        mask: '255.255.255.0',
        adminUp: true
      });
      r1 = configureIface(r1, 'Serial0/0/0', {
        ip: '10.0.0.1',
        mask: '255.255.255.252',
        adminUp: false // Student activates with "no shutdown"
      });

      let r2 = createDefaultDevice('router', 'R2-Branch', 640, 145, 'r2-branch');
      r2 = configureIface(r2, 'Serial0/0/0', {
        ip: '10.0.0.2',
        mask: '255.255.255.252',
        adminUp: true
      });
      r2 = configureIface(r2, 'GigabitEthernet0/0', {
        ip: '192.168.20.1',
        mask: '255.255.255.0',
        adminUp: true
      });

      const sw2 = createDefaultDevice('switch', 'SW-Branch', 760, 290, 'sw-2');

      const pc2 = createDefaultDevice('pc', 'PC-2', 880, 440, 'pc-2');
      // PC-2 starts unconfigured so the student sets 192.168.20.10 / 255.255.255.0 / gw 192.168.20.1

      const links: SimLink[] = [
        {
          id: 'link-pc1-sw1',
          cableType: 'straight',
          fromDeviceId: 'pc-1',
          fromPort: 'FastEthernet0',
          toDeviceId: 'sw-1',
          toPort: 'FastEthernet0/1'
        },
        {
          id: 'link-sw1-r1',
          cableType: 'straight',
          fromDeviceId: 'sw-1',
          fromPort: 'GigabitEthernet0/1',
          toDeviceId: 'r1-hq',
          toPort: 'GigabitEthernet0/0'
        },
        {
          id: 'link-r1-r2',
          cableType: 'serial',
          fromDeviceId: 'r1-hq',
          fromPort: 'Serial0/0/0',
          toDeviceId: 'r2-branch',
          toPort: 'Serial0/0/0'
        },
        {
          id: 'link-r2-sw2',
          cableType: 'straight',
          fromDeviceId: 'r2-branch',
          fromPort: 'GigabitEthernet0/0',
          toDeviceId: 'sw-2',
          toPort: 'GigabitEthernet0/1'
        },
        {
          id: 'link-sw2-pc2',
          cableType: 'straight',
          fromDeviceId: 'sw-2',
          fromPort: 'FastEthernet0/1',
          toDeviceId: 'pc-2',
          toPort: 'FastEthernet0'
        }
      ];

      return { devices: [pc1, sw1, r1, r2, sw2, pc2], links };
    }
  },
  {
    id: 'vlan-roas-lab',
    title: 'VLANs & Router-on-a-Stick LAN',
    category: 'LAN & Star',
    difficulty: 'Intermediate',
    description:
      'Isolate Sales (VLAN 10) and Engineering (VLAN 20) on SW-Access, configure GigabitEthernet0/1 as an 802.1Q trunk, and create router subinterfaces on R1-GW.',
    objectives: [
      {
        id: 'sw-vlans',
        label: 'Assign Fa0/1 to VLAN 10 and Fa0/2 to VLAN 20 on SW-Access',
        check: (devices) => {
          const sw = devices.find(d => d.id === 'sw-access');
          if (!sw) return false;
          const f1 = sw.interfaces.find(i => i.name === 'FastEthernet0/1');
          const f2 = sw.interfaces.find(i => i.name === 'FastEthernet0/2');
          return f1?.accessVlan === 10 && f2?.accessVlan === 20;
        }
      },
      {
        id: 'sw-trunk',
        label: 'Set SW-Access GigabitEthernet0/1 to trunk mode',
        check: (devices) => {
          const sw = devices.find(d => d.id === 'sw-access');
          const g1 = sw?.interfaces.find(i => i.name === 'GigabitEthernet0/1');
          return g1?.switchportMode === 'trunk';
        }
      },
      {
        id: 'r1-roas',
        label: 'Create Gig0/0.10 (192.168.10.1) & Gig0/0.20 (192.168.20.1) on R1-GW',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'r1-gw');
          if (!r1) return false;
          const s10 = r1.interfaces.find(
            i => i.dot1qVlan === 10 && i.ip === '192.168.10.1' && i.adminUp
          );
          const s20 = r1.interfaces.find(
            i => i.dot1qVlan === 20 && i.ip === '192.168.20.1' && i.adminUp
          );
          const parent = r1.interfaces.find(i => i.name === 'GigabitEthernet0/0');
          return Boolean(s10 && s20 && parent?.adminUp);
        }
      },
      {
        id: 'roas-ping',
        label: 'Verify inter-VLAN ping from PC-Sales to PC-Eng (192.168.20.10)',
        check: (devices, links) =>
          simulatePing(devices, links, 'pc-sales', '192.168.20.10').success
      }
    ],
    buildInitialState: () => {
      let pcSales = createDefaultDevice('pc', 'PC-Sales', 220, 445, 'pc-sales');
      pcSales = configureIface(pcSales, 'FastEthernet0', {
        ip: '192.168.10.10',
        mask: '255.255.255.0',
        adminUp: true
      });
      pcSales.gateway = '192.168.10.1';

      let pcEng = createDefaultDevice('pc', 'PC-Eng', 780, 445, 'pc-eng');
      pcEng = configureIface(pcEng, 'FastEthernet0', {
        ip: '192.168.20.10',
        mask: '255.255.255.0',
        adminUp: true
      });
      pcEng.gateway = '192.168.20.1';

      const sw = createDefaultDevice('switch', 'SW-Access', 500, 300, 'sw-access');
      let r1 = createDefaultDevice('router', 'R1-GW', 500, 125, 'r1-gw');
      r1 = configureIface(r1, 'GigabitEthernet0/0', { adminUp: true });

      const links: SimLink[] = [
        {
          id: 'link-sales-sw',
          cableType: 'straight',
          fromDeviceId: 'pc-sales',
          fromPort: 'FastEthernet0',
          toDeviceId: 'sw-access',
          toPort: 'FastEthernet0/1'
        },
        {
          id: 'link-eng-sw',
          cableType: 'straight',
          fromDeviceId: 'pc-eng',
          fromPort: 'FastEthernet0',
          toDeviceId: 'sw-access',
          toPort: 'FastEthernet0/2'
        },
        {
          id: 'link-sw-r1',
          cableType: 'straight',
          fromDeviceId: 'sw-access',
          fromPort: 'GigabitEthernet0/1',
          toDeviceId: 'r1-gw',
          toPort: 'GigabitEthernet0/0'
        }
      ];

      return { devices: [pcSales, pcEng, sw, r1], links };
    }
  },
  {
    id: 'ospf-campus-lab',
    title: 'OSPF Area 0 Campus & Web Server',
    category: 'Enterprise & Mesh',
    difficulty: 'Advanced',
    description:
      'Cable R2-DC to Server-Web using a Copper Crossover cable, then advertise all subnets into OSPF Area 0 on both R1-Core and R2-DC.',
    objectives: [
      {
        id: 'cable-server',
        label: 'Connect R2-DC (Gig0/1) to Server-Web (Fa0) with Copper Crossover cable',
        check: (devices, links) =>
          links.some(l => {
            const matchesNodes =
              (l.fromDeviceId === 'r2-dc' && l.toDeviceId === 'srv-web') ||
              (l.fromDeviceId === 'srv-web' && l.toDeviceId === 'r2-dc');
            return matchesNodes && evaluateLinkStatus(l, devices).isUp;
          })
      },
      {
        id: 'ospf-config',
        label: 'Enable OSPF Area 0 on both R1-Core and R2-DC',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'r1-core');
          const r2 = devices.find(d => d.id === 'r2-dc');
          return Boolean(
            r1?.ospf && r1.ospf.networks.length >= 2 && r2?.ospf && r2.ospf.networks.length >= 2
          );
        }
      },
      {
        id: 'srv-ping',
        label: 'Verify PC-Admin can ping Server-Web (172.16.50.10)',
        check: (devices, links) =>
          simulatePing(devices, links, 'pc-admin', '172.16.50.10').success
      }
    ],
    buildInitialState: () => {
      let pcAdmin = createDefaultDevice('pc', 'PC-Admin', 140, 420, 'pc-admin');
      pcAdmin = configureIface(pcAdmin, 'FastEthernet0', {
        ip: '192.168.1.10',
        mask: '255.255.255.0',
        adminUp: true
      });
      pcAdmin.gateway = '192.168.1.1';

      const swCore = createDefaultDevice('switch', 'SW-Core', 290, 280, 'sw-core');

      let r1 = createDefaultDevice('router', 'R1-Core', 410, 150, 'r1-core');
      r1 = configureIface(r1, 'GigabitEthernet0/0', {
        ip: '192.168.1.1',
        mask: '255.255.255.0',
        adminUp: true
      });
      r1 = configureIface(r1, 'GigabitEthernet0/2', {
        ip: '10.10.10.1',
        mask: '255.255.255.252',
        adminUp: true
      });

      let r2 = createDefaultDevice('router', 'R2-DC', 690, 150, 'r2-dc');
      r2 = configureIface(r2, 'GigabitEthernet0/2', {
        ip: '10.10.10.2',
        mask: '255.255.255.252',
        adminUp: true
      });
      r2 = configureIface(r2, 'GigabitEthernet0/1', {
        ip: '172.16.50.1',
        mask: '255.255.255.0',
        adminUp: true
      });

      let srvWeb = createDefaultDevice('server', 'Server-Web', 820, 380, 'srv-web');
      srvWeb = configureIface(srvWeb, 'FastEthernet0', {
        ip: '172.16.50.10',
        mask: '255.255.255.0',
        adminUp: true
      });
      srvWeb.gateway = '172.16.50.1';

      const links: SimLink[] = [
        {
          id: 'link-admin-sw',
          cableType: 'straight',
          fromDeviceId: 'pc-admin',
          fromPort: 'FastEthernet0',
          toDeviceId: 'sw-core',
          toPort: 'FastEthernet0/1'
        },
        {
          id: 'link-sw-r1',
          cableType: 'straight',
          fromDeviceId: 'sw-core',
          fromPort: 'GigabitEthernet0/1',
          toDeviceId: 'r1-core',
          toPort: 'GigabitEthernet0/0'
        },
        {
          id: 'link-r1-r2-fiber',
          cableType: 'fiber',
          fromDeviceId: 'r1-core',
          fromPort: 'GigabitEthernet0/2',
          toDeviceId: 'r2-dc',
          toPort: 'GigabitEthernet0/2'
        }
      ];

      return { devices: [pcAdmin, swCore, r1, r2, srvWeb], links };
    }
  },
  {
    id: 'star-topology-lan',
    title: 'Star Topology Switch LAN',
    category: 'LAN & Star',
    difficulty: 'Beginner',
    description:
      'Classic Star topology radiating from a central Catalyst 2960 switch to four workstations and a file server. Assign PC-3 and PC-4 IPs on 192.168.1.0/24 and test star-switched connectivity.',
    objectives: [
      {
        id: 'star-pc3-ip',
        label: 'Configure PC-3 IPv4 to 192.168.1.13 / 255.255.255.0',
        check: (devices) => {
          const pc3 = devices.find(d => d.id === 'star-pc-3');
          return Boolean(
            pc3?.interfaces[0]?.ip === '192.168.1.13' &&
              pc3?.interfaces[0]?.mask === '255.255.255.0'
          );
        }
      },
      {
        id: 'star-pc4-ip',
        label: 'Configure PC-4 IPv4 to 192.168.1.14 / 255.255.255.0',
        check: (devices) => {
          const pc4 = devices.find(d => d.id === 'star-pc-4');
          return Boolean(
            pc4?.interfaces[0]?.ip === '192.168.1.14' &&
              pc4?.interfaces[0]?.mask === '255.255.255.0'
          );
        }
      },
      {
        id: 'star-ping-srv',
        label: 'Verify PC-3 can ping Server-File (192.168.1.50) through SW-Central',
        check: (devices, links) =>
          simulatePing(devices, links, 'star-pc-3', '192.168.1.50').success
      }
    ],
    buildInitialState: () => {
      const sw = createDefaultDevice('switch', 'SW-Central', 500, 290, 'star-sw-central');

      let pc1 = createDefaultDevice('pc', 'PC-1', 210, 140, 'star-pc-1');
      pc1 = configureIface(pc1, 'FastEthernet0', { ip: '192.168.1.11', mask: '255.255.255.0', adminUp: true });

      let pc2 = createDefaultDevice('pc', 'PC-2', 790, 140, 'star-pc-2');
      pc2 = configureIface(pc2, 'FastEthernet0', { ip: '192.168.1.12', mask: '255.255.255.0', adminUp: true });

      const pc3 = createDefaultDevice('pc', 'PC-3', 210, 445, 'star-pc-3');
      const pc4 = createDefaultDevice('pc', 'PC-4', 790, 445, 'star-pc-4');

      let srv = createDefaultDevice('server', 'Server-File', 500, 105, 'star-srv-file');
      srv = configureIface(srv, 'FastEthernet0', { ip: '192.168.1.50', mask: '255.255.255.0', adminUp: true });

      const links: SimLink[] = [
        { id: 'star-l1', cableType: 'straight', fromDeviceId: 'star-pc-1', fromPort: 'FastEthernet0', toDeviceId: 'star-sw-central', toPort: 'FastEthernet0/1' },
        { id: 'star-l2', cableType: 'straight', fromDeviceId: 'star-pc-2', fromPort: 'FastEthernet0', toDeviceId: 'star-sw-central', toPort: 'FastEthernet0/2' },
        { id: 'star-l3', cableType: 'straight', fromDeviceId: 'star-pc-3', fromPort: 'FastEthernet0', toDeviceId: 'star-sw-central', toPort: 'FastEthernet0/3' },
        { id: 'star-l4', cableType: 'straight', fromDeviceId: 'star-pc-4', fromPort: 'FastEthernet0', toDeviceId: 'star-sw-central', toPort: 'FastEthernet0/4' },
        { id: 'star-l5', cableType: 'straight', fromDeviceId: 'star-srv-file', fromPort: 'FastEthernet0', toDeviceId: 'star-sw-central', toPort: 'FastEthernet0/5' }
      ];

      return { devices: [sw, pc1, pc2, pc3, pc4, srv], links };
    }
  },
  {
    id: 'office-lan-gateway',
    title: 'Small Office LAN & Gateway',
    category: 'LAN & Star',
    difficulty: 'Beginner',
    description:
      'Single-subnet office LAN with a Cisco ISR gateway router, access switch, local NAS server, and three workstations. Bring up R1-Office Gig0/0 and verify gateway reachability.',
    objectives: [
      {
        id: 'office-r1-up',
        label: 'Assign 192.168.10.1/24 to R1-Office GigabitEthernet0/0 and run "no shutdown"',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'lan-r1');
          const g0 = r1?.interfaces.find(i => i.name === 'GigabitEthernet0/0');
          return Boolean(g0?.ip === '192.168.10.1' && g0?.mask === '255.255.255.0' && g0?.adminUp);
        }
      },
      {
        id: 'office-pc-fin',
        label: 'Configure PC-Finance with IP 192.168.10.12/24 and gateway 192.168.10.1',
        check: (devices) => {
          const pc = devices.find(d => d.id === 'lan-pc-fin');
          const nic = pc?.interfaces[0];
          return Boolean(
            nic?.ip === '192.168.10.12' &&
              nic?.mask === '255.255.255.0' &&
              pc?.gateway === '192.168.10.1'
          );
        }
      },
      {
        id: 'office-ping-gw',
        label: 'Verify PC-Finance can ping default gateway 192.168.10.1',
        check: (devices, links) =>
          simulatePing(devices, links, 'lan-pc-fin', '192.168.10.1').success
      }
    ],
    buildInitialState: () => {
      const r1 = createDefaultDevice('router', 'R1-Office', 500, 115, 'lan-r1');
      const sw = createDefaultDevice('switch', 'SW-Office', 500, 275, 'lan-sw');

      let pcAdmin = createDefaultDevice('pc', 'PC-Admin', 180, 445, 'lan-pc-admin');
      pcAdmin = configureIface(pcAdmin, 'FastEthernet0', { ip: '192.168.10.10', mask: '255.255.255.0', adminUp: true });
      pcAdmin.gateway = '192.168.10.1';

      let pcDesign = createDefaultDevice('pc', 'PC-Design', 395, 445, 'lan-pc-design');
      pcDesign = configureIface(pcDesign, 'FastEthernet0', { ip: '192.168.10.11', mask: '255.255.255.0', adminUp: true });
      pcDesign.gateway = '192.168.10.1';

      const pcFin = createDefaultDevice('pc', 'PC-Finance', 605, 445, 'lan-pc-fin');

      let srvNas = createDefaultDevice('server', 'Server-NAS', 820, 445, 'lan-srv-nas');
      srvNas = configureIface(srvNas, 'FastEthernet0', { ip: '192.168.10.50', mask: '255.255.255.0', adminUp: true });
      srvNas.gateway = '192.168.10.1';

      const links: SimLink[] = [
        { id: 'lan-l0', cableType: 'straight', fromDeviceId: 'lan-r1', fromPort: 'GigabitEthernet0/0', toDeviceId: 'lan-sw', toPort: 'GigabitEthernet0/1' },
        { id: 'lan-l1', cableType: 'straight', fromDeviceId: 'lan-pc-admin', fromPort: 'FastEthernet0', toDeviceId: 'lan-sw', toPort: 'FastEthernet0/1' },
        { id: 'lan-l2', cableType: 'straight', fromDeviceId: 'lan-pc-design', fromPort: 'FastEthernet0', toDeviceId: 'lan-sw', toPort: 'FastEthernet0/2' },
        { id: 'lan-l3', cableType: 'straight', fromDeviceId: 'lan-pc-fin', fromPort: 'FastEthernet0', toDeviceId: 'lan-sw', toPort: 'FastEthernet0/3' },
        { id: 'lan-l4', cableType: 'straight', fromDeviceId: 'lan-srv-nas', fromPort: 'FastEthernet0', toDeviceId: 'lan-sw', toPort: 'FastEthernet0/4' }
      ];

      return { devices: [r1, sw, pcAdmin, pcDesign, pcFin, srvNas], links };
    }
  },
  {
    id: 'hub-spoke-wan',
    title: 'Hub-and-Spoke Multi-Branch WAN',
    category: 'WAN & Routing',
    difficulty: 'Intermediate',
    description:
      'Central HQ hub router linked via dual Serial WAN circuits to East and West branch routers. Complete static routes on R1-Hub and R3-West so branch workstations can reach HQ and each other.',
    objectives: [
      {
        id: 'wan-hub-routes',
        label: 'Add static route on R1-Hub for 172.16.20.0/24 via 10.0.2.2',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'hs-r1-hub');
          return Boolean(
            r1?.staticRoutes.some(
              r => r.network === '172.16.20.0' && r.mask === '255.255.255.0' && r.nextHop === '10.0.2.2'
            ) || (r1?.ospf && r1.ospf.networks.length >= 3)
          );
        }
      },
      {
        id: 'wan-west-default',
        label: 'Add default or HQ/East route on R3-West via 10.0.2.1',
        check: (devices) => {
          const r3 = devices.find(d => d.id === 'hs-r3-west');
          return Boolean(
            r3?.staticRoutes.some(
              r =>
                r.nextHop === '10.0.2.1' &&
                (r.network === '0.0.0.0' || r.network === '172.16.10.0' || r.network === '172.16.1.0')
            ) || (r3?.ospf && r3.ospf.networks.length >= 2)
          );
        }
      },
      {
        id: 'wan-east-to-west',
        label: 'Verify PC-East can ping PC-West (172.16.20.10) across HQ Hub',
        check: (devices, links) =>
          simulatePing(devices, links, 'hs-pc-east', '172.16.20.10').success
      }
    ],
    buildInitialState: () => {
      let r1 = createDefaultDevice('router', 'R1-Hub', 500, 120, 'hs-r1-hub');
      r1 = configureIface(r1, 'GigabitEthernet0/0', { ip: '172.16.1.1', mask: '255.255.255.0', adminUp: true });
      r1 = configureIface(r1, 'Serial0/0/0', { ip: '10.0.1.1', mask: '255.255.255.252', adminUp: true });
      r1 = configureIface(r1, 'Serial0/0/1', { ip: '10.0.2.1', mask: '255.255.255.252', adminUp: true });
      r1.staticRoutes = [{ network: '172.16.10.0', mask: '255.255.255.0', nextHop: '10.0.1.2' }];

      const swHq = createDefaultDevice('switch', 'SW-HQ', 500, 290, 'hs-sw-hq');
      let srvHq = createDefaultDevice('server', 'Server-HQ', 500, 455, 'hs-srv-hq');
      srvHq = configureIface(srvHq, 'FastEthernet0', { ip: '172.16.1.50', mask: '255.255.255.0', adminUp: true });
      srvHq.gateway = '172.16.1.1';

      let r2 = createDefaultDevice('router', 'R2-East', 180, 175, 'hs-r2-east');
      r2 = configureIface(r2, 'Serial0/0/0', { ip: '10.0.1.2', mask: '255.255.255.252', adminUp: true });
      r2 = configureIface(r2, 'GigabitEthernet0/0', { ip: '172.16.10.1', mask: '255.255.255.0', adminUp: true });
      r2.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.1.1' }];

      const swEast = createDefaultDevice('switch', 'SW-East', 180, 325, 'hs-sw-east');
      let pcEast = createDefaultDevice('pc', 'PC-East', 180, 465, 'hs-pc-east');
      pcEast = configureIface(pcEast, 'FastEthernet0', { ip: '172.16.10.10', mask: '255.255.255.0', adminUp: true });
      pcEast.gateway = '172.16.10.1';

      let r3 = createDefaultDevice('router', 'R3-West', 820, 175, 'hs-r3-west');
      r3 = configureIface(r3, 'Serial0/0/0', { ip: '10.0.2.2', mask: '255.255.255.252', adminUp: true });
      r3 = configureIface(r3, 'GigabitEthernet0/0', { ip: '172.16.20.1', mask: '255.255.255.0', adminUp: true });

      const swWest = createDefaultDevice('switch', 'SW-West', 820, 325, 'hs-sw-west');
      let pcWest = createDefaultDevice('pc', 'PC-West', 820, 465, 'hs-pc-west');
      pcWest = configureIface(pcWest, 'FastEthernet0', { ip: '172.16.20.10', mask: '255.255.255.0', adminUp: true });
      pcWest.gateway = '172.16.20.1';

      const links: SimLink[] = [
        { id: 'hs-l1', cableType: 'serial', fromDeviceId: 'hs-r1-hub', fromPort: 'Serial0/0/0', toDeviceId: 'hs-r2-east', toPort: 'Serial0/0/0' },
        { id: 'hs-l2', cableType: 'serial', fromDeviceId: 'hs-r1-hub', fromPort: 'Serial0/0/1', toDeviceId: 'hs-r3-west', toPort: 'Serial0/0/0' },
        { id: 'hs-l3', cableType: 'straight', fromDeviceId: 'hs-r1-hub', fromPort: 'GigabitEthernet0/0', toDeviceId: 'hs-sw-hq', toPort: 'GigabitEthernet0/1' },
        { id: 'hs-l4', cableType: 'straight', fromDeviceId: 'hs-sw-hq', fromPort: 'FastEthernet0/1', toDeviceId: 'hs-srv-hq', toPort: 'FastEthernet0' },
        { id: 'hs-l5', cableType: 'straight', fromDeviceId: 'hs-r2-east', fromPort: 'GigabitEthernet0/0', toDeviceId: 'hs-sw-east', toPort: 'GigabitEthernet0/1' },
        { id: 'hs-l6', cableType: 'straight', fromDeviceId: 'hs-sw-east', fromPort: 'FastEthernet0/1', toDeviceId: 'hs-pc-east', toPort: 'FastEthernet0' },
        { id: 'hs-l7', cableType: 'straight', fromDeviceId: 'hs-r3-west', fromPort: 'GigabitEthernet0/0', toDeviceId: 'hs-sw-west', toPort: 'GigabitEthernet0/1' },
        { id: 'hs-l8', cableType: 'straight', fromDeviceId: 'hs-sw-west', fromPort: 'FastEthernet0/1', toDeviceId: 'hs-pc-west', toPort: 'FastEthernet0' }
      ];

      return { devices: [r1, swHq, srvHq, r2, swEast, pcEast, r3, swWest, pcWest], links };
    }
  },
  {
    id: 'hierarchical-tree-lan',
    title: 'Two-Tier Hierarchical Tree LAN',
    category: 'Enterprise & Mesh',
    difficulty: 'Intermediate',
    description:
      'Root core router branching down to two access switches across Floor 1 (192.168.10.0/24) and Floor 2 (192.168.20.0/24). Activate the Floor 2 gateway interface on R1-Core for cross-floor routing.',
    objectives: [
      {
        id: 'tree-r1-g01',
        label: 'Enable R1-Core GigabitEthernet0/1 (192.168.20.1/24) with "no shutdown"',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'tree-r1');
          const g1 = r1?.interfaces.find(i => i.name === 'GigabitEthernet0/1');
          return Boolean(g1?.ip === '192.168.20.1' && g1?.mask === '255.255.255.0' && g1?.adminUp);
        }
      },
      {
        id: 'tree-ping-floors',
        label: 'Verify Floor 1 PC-1A can ping Floor 2 PC-2B (192.168.20.11)',
        check: (devices, links) =>
          simulatePing(devices, links, 'tree-pc-1a', '192.168.20.11').success
      }
    ],
    buildInitialState: () => {
      let r1 = createDefaultDevice('router', 'R1-Core', 500, 105, 'tree-r1');
      r1 = configureIface(r1, 'GigabitEthernet0/0', { ip: '192.168.10.1', mask: '255.255.255.0', adminUp: true });
      r1 = configureIface(r1, 'GigabitEthernet0/1', { ip: '192.168.20.1', mask: '255.255.255.0', adminUp: false });

      const sw1 = createDefaultDevice('switch', 'SW-Floor1', 270, 265, 'tree-sw1');
      const sw2 = createDefaultDevice('switch', 'SW-Floor2', 730, 265, 'tree-sw2');

      let pc1a = createDefaultDevice('pc', 'PC-1A', 135, 450, 'tree-pc-1a');
      pc1a = configureIface(pc1a, 'FastEthernet0', { ip: '192.168.10.10', mask: '255.255.255.0', adminUp: true });
      pc1a.gateway = '192.168.10.1';

      let pc1b = createDefaultDevice('pc', 'PC-1B', 370, 450, 'tree-pc-1b');
      pc1b = configureIface(pc1b, 'FastEthernet0', { ip: '192.168.10.11', mask: '255.255.255.0', adminUp: true });
      pc1b.gateway = '192.168.10.1';

      let pc2a = createDefaultDevice('pc', 'PC-2A', 630, 450, 'tree-pc-2a');
      pc2a = configureIface(pc2a, 'FastEthernet0', { ip: '192.168.20.10', mask: '255.255.255.0', adminUp: true });
      pc2a.gateway = '192.168.20.1';

      let pc2b = createDefaultDevice('pc', 'PC-2B', 865, 450, 'tree-pc-2b');
      pc2b = configureIface(pc2b, 'FastEthernet0', { ip: '192.168.20.11', mask: '255.255.255.0', adminUp: true });
      pc2b.gateway = '192.168.20.1';

      const links: SimLink[] = [
        { id: 'tree-l1', cableType: 'straight', fromDeviceId: 'tree-r1', fromPort: 'GigabitEthernet0/0', toDeviceId: 'tree-sw1', toPort: 'GigabitEthernet0/1' },
        { id: 'tree-l2', cableType: 'straight', fromDeviceId: 'tree-r1', fromPort: 'GigabitEthernet0/1', toDeviceId: 'tree-sw2', toPort: 'GigabitEthernet0/1' },
        { id: 'tree-l3', cableType: 'straight', fromDeviceId: 'tree-sw1', fromPort: 'FastEthernet0/1', toDeviceId: 'tree-pc-1a', toPort: 'FastEthernet0' },
        { id: 'tree-l4', cableType: 'straight', fromDeviceId: 'tree-sw1', fromPort: 'FastEthernet0/2', toDeviceId: 'tree-pc-1b', toPort: 'FastEthernet0' },
        { id: 'tree-l5', cableType: 'straight', fromDeviceId: 'tree-sw2', fromPort: 'FastEthernet0/1', toDeviceId: 'tree-pc-2a', toPort: 'FastEthernet0' },
        { id: 'tree-l6', cableType: 'straight', fromDeviceId: 'tree-sw2', fromPort: 'FastEthernet0/2', toDeviceId: 'tree-pc-2b', toPort: 'FastEthernet0' }
      ];

      return { devices: [r1, sw1, sw2, pc1a, pc1b, pc2a, pc2b], links };
    }
  },
  {
    id: 'mesh-wan-ospf',
    title: 'Redundant Mesh WAN Backbone (OSPF)',
    category: 'Enterprise & Mesh',
    difficulty: 'Advanced',
    description:
      'Three-router triangular mesh WAN combining optical Fiber and Serial links. Advertise subnets into OSPF Area 0 on R1-North, R2-South, and R3-East for automatic shortest-path convergence.',
    objectives: [
      {
        id: 'mesh-ospf-all',
        label: 'Enable OSPF Area 0 on R1-North, R2-South, and R3-East',
        check: (devices) => {
          const r1 = devices.find(d => d.id === 'mesh-r1');
          const r2 = devices.find(d => d.id === 'mesh-r2');
          const r3 = devices.find(d => d.id === 'mesh-r3');
          return Boolean(
            r1?.ospf && r1.ospf.networks.length >= 2 &&
              r2?.ospf && r2.ospf.networks.length >= 2 &&
              r3?.ospf && r3.ospf.networks.length >= 2
          );
        }
      },
      {
        id: 'mesh-ping-srv',
        label: 'Verify PC-North can ping Server-East (10.10.3.50)',
        check: (devices, links) =>
          simulatePing(devices, links, 'mesh-pc-north', '10.10.3.50').success
      }
    ],
    buildInitialState: () => {
      let r1 = createDefaultDevice('router', 'R1-North', 250, 140, 'mesh-r1');
      r1 = configureIface(r1, 'GigabitEthernet0/0', { ip: '10.10.1.1', mask: '255.255.255.0', adminUp: true });
      r1 = configureIface(r1, 'GigabitEthernet0/2', { ip: '172.16.12.1', mask: '255.255.255.252', adminUp: true });
      r1 = configureIface(r1, 'Serial0/0/0', { ip: '172.16.13.1', mask: '255.255.255.252', adminUp: true });

      let r2 = createDefaultDevice('router', 'R2-South', 500, 355, 'mesh-r2');
      r2 = configureIface(r2, 'GigabitEthernet0/2', { ip: '172.16.12.2', mask: '255.255.255.252', adminUp: true });
      r2 = configureIface(r2, 'Serial0/0/0', { ip: '172.16.23.1', mask: '255.255.255.252', adminUp: true });

      let r3 = createDefaultDevice('router', 'R3-East', 750, 140, 'mesh-r3');
      r3 = configureIface(r3, 'Serial0/0/0', { ip: '172.16.13.2', mask: '255.255.255.252', adminUp: true });
      r3 = configureIface(r3, 'Serial0/0/1', { ip: '172.16.23.2', mask: '255.255.255.252', adminUp: true });
      r3 = configureIface(r3, 'GigabitEthernet0/0', { ip: '10.10.3.1', mask: '255.255.255.0', adminUp: true });

      const swNorth = createDefaultDevice('switch', 'SW-North', 145, 295, 'mesh-sw-north');
      let pcNorth = createDefaultDevice('pc', 'PC-North', 145, 455, 'mesh-pc-north');
      pcNorth = configureIface(pcNorth, 'FastEthernet0', { ip: '10.10.1.10', mask: '255.255.255.0', adminUp: true });
      pcNorth.gateway = '10.10.1.1';

      const swEast = createDefaultDevice('switch', 'SW-East', 855, 295, 'mesh-sw-east');
      let srvEast = createDefaultDevice('server', 'Server-East', 855, 455, 'mesh-srv-east');
      srvEast = configureIface(srvEast, 'FastEthernet0', { ip: '10.10.3.50', mask: '255.255.255.0', adminUp: true });
      srvEast.gateway = '10.10.3.1';

      const links: SimLink[] = [
        { id: 'mesh-l1', cableType: 'fiber', fromDeviceId: 'mesh-r1', fromPort: 'GigabitEthernet0/2', toDeviceId: 'mesh-r2', toPort: 'GigabitEthernet0/2' },
        { id: 'mesh-l2', cableType: 'serial', fromDeviceId: 'mesh-r1', fromPort: 'Serial0/0/0', toDeviceId: 'mesh-r3', toPort: 'Serial0/0/0' },
        { id: 'mesh-l3', cableType: 'serial', fromDeviceId: 'mesh-r2', fromPort: 'Serial0/0/0', toDeviceId: 'mesh-r3', toPort: 'Serial0/0/1' },
        { id: 'mesh-l4', cableType: 'straight', fromDeviceId: 'mesh-r1', fromPort: 'GigabitEthernet0/0', toDeviceId: 'mesh-sw-north', toPort: 'GigabitEthernet0/1' },
        { id: 'mesh-l5', cableType: 'straight', fromDeviceId: 'mesh-sw-north', fromPort: 'FastEthernet0/1', toDeviceId: 'mesh-pc-north', toPort: 'FastEthernet0' },
        { id: 'mesh-l6', cableType: 'straight', fromDeviceId: 'mesh-r3', fromPort: 'GigabitEthernet0/0', toDeviceId: 'mesh-sw-east', toPort: 'GigabitEthernet0/1' },
        { id: 'mesh-l7', cableType: 'straight', fromDeviceId: 'mesh-sw-east', fromPort: 'FastEthernet0/1', toDeviceId: 'mesh-srv-east', toPort: 'FastEthernet0' }
      ];

      return { devices: [r1, r2, r3, swNorth, pcNorth, swEast, srvEast], links };
    }
  }
];
