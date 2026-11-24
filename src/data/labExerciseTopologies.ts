import { createDefaultDevice } from '../components/Lab/networkSimEngine';
import {
  SimDevice,
  SimDeviceInterface,
  SimDiagramLabel,
  SimLink,
  SimTopologyShape
} from '../components/Lab/networkSimTypes';

export interface LabExerciseTopology {
  labId: string;
  canvasWidth: number;
  canvasHeight: number;
  devices: SimDevice[];
  links: SimLink[];
  shapes: SimTopologyShape[];
  labels: SimDiagramLabel[];
  updatedAt?: string;
  updatedByName?: string;
  updatedByRole?: 'admin' | 'instructor';
  isCustomized?: boolean;
}

function patchInterface(
  device: SimDevice,
  portName: string,
  patch: Partial<SimDeviceInterface>
): SimDevice {
  return {
    ...device,
    interfaces: device.interfaces.map(iface =>
      iface.name === portName ? { ...iface, ...patch } : iface
    )
  };
}

function addSubInterface(
  device: SimDevice,
  sub: SimDeviceInterface
): SimDevice {
  return {
    ...device,
    interfaces: [...device.interfaces, sub]
  };
}

function buildLab01Topology(): LabExerciseTopology {
  let pcA = createDefaultDevice('pc', 'PC-A', 140, 320, 'lab1-pca');
  pcA = patchInterface(pcA, 'FastEthernet0', {
    ip: '192.168.10.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcA.gateway = '192.168.10.1';

  let sw1 = createDefaultDevice('switch', 'SW1', 390, 320, 'lab1-sw1');
  sw1.customLabel = 'SW1 · VLAN 1 (192.168.10.2)';
  sw1.useCustomLabel = true;
  sw1.defaultGateway = '192.168.10.1';
  sw1 = patchInterface(sw1, 'FastEthernet0/6', {
    adminUp: true,
    switchportMode: 'access',
    accessVlan: 1
  });
  sw1 = patchInterface(sw1, 'GigabitEthernet0/1', {
    adminUp: true,
    switchportMode: 'access',
    accessVlan: 1
  });
  sw1 = addSubInterface(sw1, {
    name: 'Vlan1',
    shortName: 'Vl1',
    kind: 'svi',
    ip: '192.168.10.2',
    mask: '255.255.255.0',
    adminUp: true,
    mac: '00:50:56:01:01:01',
    description: 'Switch Management SVI'
  });

  let r1 = createDefaultDevice('router', 'R1', 640, 170, 'lab1-r1');
  r1 = patchInterface(r1, 'GigabitEthernet0/0', {
    ip: '192.168.10.1',
    mask: '255.255.255.0',
    adminUp: true,
    description: 'LAN Gateway for Branch Office'
  });
  r1 = patchInterface(r1, 'GigabitEthernet0/1', {
    ip: '10.0.12.1',
    mask: '255.255.255.252',
    adminUp: true,
    description: 'WAN Link to HQ Core'
  });

  let hq = createDefaultDevice('router', 'HQ-CORE', 870, 170, 'lab1-hq');
  hq = patchInterface(hq, 'GigabitEthernet0/1', {
    ip: '10.0.12.2',
    mask: '255.255.255.252',
    adminUp: true,
    description: 'WAN Link from Branch R1'
  });

  const links: SimLink[] = [
    {
      id: 'lab1-link-pca-sw1',
      cableType: 'straight',
      fromDeviceId: 'lab1-pca',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab1-sw1',
      toPort: 'FastEthernet0/6'
    },
    {
      id: 'lab1-link-sw1-r1',
      cableType: 'straight',
      fromDeviceId: 'lab1-sw1',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab1-r1',
      toPort: 'GigabitEthernet0/0'
    },
    {
      id: 'lab1-link-r1-hq',
      cableType: 'crossover',
      fromDeviceId: 'lab1-r1',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab1-hq',
      toPort: 'GigabitEthernet0/1'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab1-zone-lan',
      kind: 'rectangle',
      x: 50,
      y: 225,
      width: 470,
      height: 205,
      fillColor: '#0ea5e9',
      fillOpacity: 0.08,
      borderColor: '#0284c7',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'Branch Office LAN · 192.168.10.0/24',
      labelColor: '#0369a1'
    },
    {
      id: 'lab1-zone-wan',
      kind: 'rectangle',
      x: 560,
      y: 80,
      width: 390,
      height: 175,
      fillColor: '#6366f1',
      fillOpacity: 0.07,
      borderColor: '#4f46e5',
      lineStyle: 'dotted',
      borderWidth: 2,
      label: 'HQ WAN Uplink · 10.0.12.0/30',
      labelColor: '#4338ca'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab1-lbl-1',
      text: 'GW: 192.168.10.1 · enable secret + NVRAM save',
      x: 280,
      y: 120,
      color: '#0f172a',
      bgColor: '#e0f2fe',
      fontSize: 11,
      bold: true
    }
  ];

  return {
    labId: 'lab-01-initial-config',
    canvasWidth: 1000,
    canvasHeight: 470,
    devices: [pcA, sw1, r1, hq],
    links,
    shapes,
    labels
  };
}

function buildLab02Topology(): LabExerciseTopology {
  let pcA = createDefaultDevice('pc', 'PC-A', 170, 260, 'lab2-pca');
  pcA.customLabel = 'Admin PC-A (SSH Client)';
  pcA.useCustomLabel = true;
  pcA = patchInterface(pcA, 'FastEthernet0', {
    ip: '192.168.10.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcA.gateway = '192.168.10.1';

  let sw1 = createDefaultDevice('switch', 'SW1', 500, 260, 'lab2-sw1');
  sw1.domainName = 'netplus.academy';
  sw1.sshVersion = 2;
  sw1.rsaKeyBits = 2048;
  sw1.defaultGateway = '192.168.10.1';
  sw1 = addSubInterface(sw1, {
    name: 'Vlan1',
    shortName: 'Vl1',
    kind: 'svi',
    ip: '192.168.10.2',
    mask: '255.255.255.0',
    adminUp: true,
    mac: '00:50:56:02:02:01'
  });

  let r1 = createDefaultDevice('router', 'R1', 810, 260, 'lab2-r1');
  r1.domainName = 'netplus.academy';
  r1.sshVersion = 2;
  r1.rsaKeyBits = 2048;
  r1 = patchInterface(r1, 'GigabitEthernet0/0', {
    ip: '192.168.10.1',
    mask: '255.255.255.0',
    adminUp: true,
    description: 'SSHv2 Management Gateway'
  });

  const links: SimLink[] = [
    {
      id: 'lab2-link-pca-sw1',
      cableType: 'straight',
      fromDeviceId: 'lab2-pca',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab2-sw1',
      toPort: 'FastEthernet0/6'
    },
    {
      id: 'lab2-link-sw1-r1',
      cableType: 'straight',
      fromDeviceId: 'lab2-sw1',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab2-r1',
      toPort: 'GigabitEthernet0/0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab2-zone-ssh',
      kind: 'rectangle',
      x: 375,
      y: 120,
      width: 550,
      height: 265,
      fillColor: '#10b981',
      fillOpacity: 0.08,
      borderColor: '#059669',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'SSHv2 Encrypted Management Zone (TCP/22 · Telnet Blocked)',
      labelColor: '#047857'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab2-lbl-1',
      text: 'Domain: netplus.academy · RSA 2048-bit · transport input ssh',
      x: 500,
      y: 72,
      color: '#065f46',
      bgColor: '#d1fae5',
      fontSize: 12,
      bold: true
    }
  ];

  return {
    labId: 'lab-02-ssh-remote-mgmt',
    canvasWidth: 1000,
    canvasHeight: 450,
    devices: [pcA, sw1, r1],
    links,
    shapes,
    labels
  };
}

function buildLab03Topology(): LabExerciseTopology {
  let consolePc = createDefaultDevice('pc', 'Console-PC', 160, 290, 'lab3-console');
  consolePc.customLabel = 'Admin Console / Break';
  consolePc.useCustomLabel = true;
  consolePc = patchInterface(consolePc, 'FastEthernet0', {
    ip: '172.16.50.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  consolePc.gateway = '172.16.50.1';

  const swMgmt = createDefaultDevice('switch', 'SW-MGMT', 420, 290, 'lab3-sw');

  let r2 = createDefaultDevice('router', 'R2', 630, 155, 'lab3-r2');
  r2.customLabel = 'R2 · ROMMON 0x2142 → 0x2102';
  r2.useCustomLabel = true;
  r2 = patchInterface(r2, 'GigabitEthernet0/0', {
    ip: '172.16.50.1',
    mask: '255.255.255.0',
    adminUp: true,
    description: 'Management & TFTP Transfer Link'
  });

  let tftp = createDefaultDevice('server', 'TFTP-SRV', 835, 290, 'lab3-tftp');
  tftp.customLabel = 'TFTP-SRV (IOS Image Repo)';
  tftp.useCustomLabel = true;
  tftp = patchInterface(tftp, 'FastEthernet0', {
    ip: '172.16.50.100',
    mask: '255.255.255.0',
    adminUp: true
  });
  tftp.gateway = '172.16.50.1';

  const links: SimLink[] = [
    {
      id: 'lab3-link-pc-sw',
      cableType: 'straight',
      fromDeviceId: 'lab3-console',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab3-sw',
      toPort: 'FastEthernet0/1'
    },
    {
      id: 'lab3-link-sw-r2',
      cableType: 'straight',
      fromDeviceId: 'lab3-sw',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab3-r2',
      toPort: 'GigabitEthernet0/0'
    },
    {
      id: 'lab3-link-sw-tftp',
      cableType: 'straight',
      fromDeviceId: 'lab3-sw',
      fromPort: 'FastEthernet0/2',
      toDeviceId: 'lab3-tftp',
      toPort: 'FastEthernet0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab3-zone-mgmt',
      kind: 'rectangle',
      x: 55,
      y: 75,
      width: 900,
      height: 335,
      fillColor: '#f59e0b',
      fillOpacity: 0.06,
      borderColor: '#d97706',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'IOS Maintenance & Staging Subnet · 172.16.50.0/24',
      labelColor: '#b45309'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab3-lbl-1',
      text: '1) confreg 0x2142  2) copy startup running  3) verify /md5 flash0:',
      x: 345,
      y: 135,
      color: '#92400e',
      bgColor: '#fef3c7',
      fontSize: 11,
      bold: true
    }
  ];

  return {
    labId: 'lab-03-password-recovery-ios',
    canvasWidth: 1000,
    canvasHeight: 460,
    devices: [consolePc, swMgmt, r2, tftp],
    links,
    shapes,
    labels
  };
}

function buildLab04Topology(): LabExerciseTopology {
  let pcEng = createDefaultDevice('pc', 'PC-ENG', 175, 360, 'lab4-pc-eng');
  pcEng = patchInterface(pcEng, 'FastEthernet0', {
    ip: '10.10.10.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcEng.gateway = '10.10.10.1';

  let pcSls = createDefaultDevice('pc', 'PC-SLS', 505, 360, 'lab4-pc-sls');
  pcSls = patchInterface(pcSls, 'FastEthernet0', {
    ip: '10.10.20.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcSls.gateway = '10.10.20.1';

  let sw1 = createDefaultDevice('switch', 'SW1', 340, 195, 'lab4-sw1');
  sw1.vlans = [
    { id: 1, name: 'default' },
    { id: 10, name: 'ENGINEERING' },
    { id: 20, name: 'SALES' },
    { id: 99, name: 'NATIVE_MGMT' }
  ];
  sw1 = patchInterface(sw1, 'FastEthernet0/5', {
    adminUp: true,
    switchportMode: 'access',
    accessVlan: 10
  });
  sw1 = patchInterface(sw1, 'FastEthernet0/6', {
    adminUp: true,
    switchportMode: 'access',
    accessVlan: 20
  });
  sw1 = patchInterface(sw1, 'GigabitEthernet0/1', {
    adminUp: true,
    switchportMode: 'trunk',
    trunkNativeVlan: 99,
    trunkAllowedVlans: [10, 20, 99]
  });
  sw1 = addSubInterface(sw1, {
    name: 'Vlan99',
    shortName: 'Vl99',
    kind: 'svi',
    ip: '10.10.99.2',
    mask: '255.255.255.0',
    adminUp: true,
    mac: '00:50:56:04:04:99'
  });

  let r1 = createDefaultDevice('router', 'R1', 775, 195, 'lab4-r1');
  r1.customLabel = 'R1 · ROAS (.10, .20, .99)';
  r1.useCustomLabel = true;
  r1 = patchInterface(r1, 'GigabitEthernet0/0', {
    adminUp: true,
    description: '802.1Q Trunk Parent Interface'
  });
  r1 = addSubInterface(r1, {
    name: 'GigabitEthernet0/0.10',
    shortName: 'Gi0/0.10',
    kind: 'subinterface',
    parentInterface: 'GigabitEthernet0/0',
    dot1qVlan: 10,
    ip: '10.10.10.1',
    mask: '255.255.255.0',
    adminUp: true,
    mac: '00:50:56:04:10:01'
  });
  r1 = addSubInterface(r1, {
    name: 'GigabitEthernet0/0.20',
    shortName: 'Gi0/0.20',
    kind: 'subinterface',
    parentInterface: 'GigabitEthernet0/0',
    dot1qVlan: 20,
    ip: '10.10.20.1',
    mask: '255.255.255.0',
    adminUp: true,
    mac: '00:50:56:04:20:01'
  });

  const links: SimLink[] = [
    {
      id: 'lab4-link-eng-sw',
      cableType: 'straight',
      fromDeviceId: 'lab4-pc-eng',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab4-sw1',
      toPort: 'FastEthernet0/5'
    },
    {
      id: 'lab4-link-sls-sw',
      cableType: 'straight',
      fromDeviceId: 'lab4-pc-sls',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab4-sw1',
      toPort: 'FastEthernet0/6'
    },
    {
      id: 'lab4-link-sw-r1',
      cableType: 'straight',
      fromDeviceId: 'lab4-sw1',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab4-r1',
      toPort: 'GigabitEthernet0/0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab4-zone-v10',
      kind: 'rectangle',
      x: 60,
      y: 280,
      width: 245,
      height: 170,
      fillColor: '#0284c7',
      fillOpacity: 0.08,
      borderColor: '#0284c7',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'VLAN 10 · ENGINEERING',
      labelColor: '#0369a1'
    },
    {
      id: 'lab4-zone-v20',
      kind: 'rectangle',
      x: 380,
      y: 280,
      width: 245,
      height: 170,
      fillColor: '#8b5cf6',
      fillOpacity: 0.08,
      borderColor: '#7c3aed',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'VLAN 20 · SALES',
      labelColor: '#6d28d9'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab4-lbl-trunk',
      text: '802.1Q Trunk · Allowed: 10,20,99 · Native: 99',
      x: 565,
      y: 135,
      color: '#0f172a',
      bgColor: '#e0f2fe',
      fontSize: 11,
      bold: true
    }
  ];

  return {
    labId: 'lab-04-vlan-trunking-roas',
    canvasWidth: 1000,
    canvasHeight: 490,
    devices: [pcEng, pcSls, sw1, r1],
    links,
    shapes,
    labels
  };
}

function buildLab05Topology(): LabExerciseTopology {
  let dsw1 = createDefaultDevice('switch', 'DSW1', 290, 145, 'lab5-dsw1');
  dsw1.customLabel = 'DSW1 · Root Primary (24576)';
  dsw1.useCustomLabel = true;
  dsw1 = patchInterface(dsw1, 'GigabitEthernet0/1', { adminUp: true, switchportMode: 'trunk' });
  dsw1 = patchInterface(dsw1, 'GigabitEthernet0/2', { adminUp: true, switchportMode: 'trunk' });

  let dsw2 = createDefaultDevice('switch', 'DSW2', 710, 145, 'lab5-dsw2');
  dsw2.customLabel = 'DSW2 · Root Secondary (28672)';
  dsw2.useCustomLabel = true;
  dsw2 = patchInterface(dsw2, 'GigabitEthernet0/1', { adminUp: true, switchportMode: 'trunk' });
  dsw2 = patchInterface(dsw2, 'GigabitEthernet0/2', { adminUp: true, switchportMode: 'trunk' });

  let asw1 = createDefaultDevice('switch', 'ASW1', 500, 305, 'lab5-asw1');
  asw1.customLabel = 'ASW1 · PortFast + BPDU Guard';
  asw1.useCustomLabel = true;
  asw1 = patchInterface(asw1, 'FastEthernet0/1', { adminUp: true, portfast: true, bpduGuard: true });
  asw1 = patchInterface(asw1, 'FastEthernet0/2', { adminUp: true, portfast: true, bpduGuard: true });

  let pc1 = createDefaultDevice('pc', 'PC-1', 330, 430, 'lab5-pc1');
  pc1 = patchInterface(pc1, 'FastEthernet0', {
    ip: '10.10.10.11',
    mask: '255.255.255.0',
    adminUp: true
  });

  let pc2 = createDefaultDevice('pc', 'PC-2', 670, 430, 'lab5-pc2');
  pc2 = patchInterface(pc2, 'FastEthernet0', {
    ip: '10.10.10.12',
    mask: '255.255.255.0',
    adminUp: true
  });

  const links: SimLink[] = [
    {
      id: 'lab5-link-lacp-1',
      cableType: 'crossover',
      fromDeviceId: 'lab5-dsw1',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab5-dsw2',
      toPort: 'GigabitEthernet0/1'
    },
    {
      id: 'lab5-link-lacp-2',
      cableType: 'fiber',
      fromDeviceId: 'lab5-dsw1',
      fromPort: 'GigabitEthernet0/2',
      toDeviceId: 'lab5-dsw2',
      toPort: 'GigabitEthernet0/2'
    },
    {
      id: 'lab5-link-dsw1-asw1',
      cableType: 'crossover',
      fromDeviceId: 'lab5-dsw1',
      fromPort: 'FastEthernet0/1',
      toDeviceId: 'lab5-asw1',
      toPort: 'FastEthernet0/5'
    },
    {
      id: 'lab5-link-dsw2-asw1',
      cableType: 'crossover',
      fromDeviceId: 'lab5-dsw2',
      fromPort: 'FastEthernet0/1',
      toDeviceId: 'lab5-asw1',
      toPort: 'FastEthernet0/6'
    },
    {
      id: 'lab5-link-asw1-pc1',
      cableType: 'straight',
      fromDeviceId: 'lab5-asw1',
      fromPort: 'FastEthernet0/1',
      toDeviceId: 'lab5-pc1',
      toPort: 'FastEthernet0'
    },
    {
      id: 'lab5-link-asw1-pc2',
      cableType: 'straight',
      fromDeviceId: 'lab5-asw1',
      fromPort: 'FastEthernet0/2',
      toDeviceId: 'lab5-pc2',
      toPort: 'FastEthernet0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab5-zone-dist',
      kind: 'rectangle',
      x: 150,
      y: 65,
      width: 700,
      height: 155,
      fillColor: '#2563eb',
      fillOpacity: 0.07,
      borderColor: '#2563eb',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'Distribution Layer · Rapid PVST+ & LACP Po1',
      labelColor: '#1d4ed8'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab5-lbl-po1',
      text: 'Port-Channel 1 (LACP Active · 2 Gbps)',
      x: 500,
      y: 100,
      color: '#0f172a',
      bgColor: '#fef3c7',
      fontSize: 11,
      bold: true
    }
  ];

  return {
    labId: 'lab-05-stp-etherchannel',
    canvasWidth: 1000,
    canvasHeight: 510,
    devices: [dsw1, dsw2, asw1, pc1, pc2],
    links,
    shapes,
    labels
  };
}

function buildLab06Topology(): LabExerciseTopology {
  let isp = createDefaultDevice('router', 'ISP', 120, 175, 'lab6-isp');
  isp = patchInterface(isp, 'GigabitEthernet0/0', {
    ip: '203.0.113.1',
    mask: '255.255.255.252',
    adminUp: true
  });

  let r1 = createDefaultDevice('router', 'R1-HQ', 350, 175, 'lab6-r1');
  r1.customLabel = 'R1-HQ · RID 1.1.1.1';
  r1.useCustomLabel = true;
  r1 = patchInterface(r1, 'GigabitEthernet0/0', {
    ip: '10.0.12.1',
    mask: '255.255.255.252',
    adminUp: true
  });
  r1 = patchInterface(r1, 'GigabitEthernet0/1', {
    ip: '192.168.1.1',
    mask: '255.255.255.0',
    adminUp: true
  });
  r1 = patchInterface(r1, 'Serial0/0/0', {
    ip: '203.0.113.2',
    mask: '255.255.255.252',
    adminUp: true
  });
  r1.ospf = {
    processId: '10',
    routerId: '1.1.1.1',
    networks: [
      { network: '10.0.12.0', wildcard: '0.0.0.3', area: '0' },
      { network: '192.168.1.0', wildcard: '0.0.0.255', area: '0' }
    ],
    passiveInterfaces: ['GigabitEthernet0/1'],
    defaultInformationOriginate: true
  };

  let r2 = createDefaultDevice('router', 'R2-EAST', 610, 175, 'lab6-r2');
  r2.customLabel = 'R2-EAST · RID 2.2.2.2';
  r2.useCustomLabel = true;
  r2 = patchInterface(r2, 'GigabitEthernet0/0', {
    ip: '10.0.12.2',
    mask: '255.255.255.252',
    adminUp: true
  });
  r2 = patchInterface(r2, 'GigabitEthernet0/1', {
    ip: '192.168.2.1',
    mask: '255.255.255.0',
    adminUp: true
  });
  r2 = patchInterface(r2, 'Serial0/0/0', {
    ip: '10.0.23.1',
    mask: '255.255.255.252',
    adminUp: true
  });

  let r3 = createDefaultDevice('router', 'R3-WEST', 865, 175, 'lab6-r3');
  r3.customLabel = 'R3-WEST · RID 3.3.3.3';
  r3.useCustomLabel = true;
  r3 = patchInterface(r3, 'Serial0/0/0', {
    ip: '10.0.23.2',
    mask: '255.255.255.252',
    adminUp: true
  });
  r3 = patchInterface(r3, 'GigabitEthernet0/1', {
    ip: '192.168.3.1',
    mask: '255.255.255.0',
    adminUp: true
  });

  let pcHq = createDefaultDevice('pc', 'PC-HQ', 350, 385, 'lab6-pc1');
  pcHq = patchInterface(pcHq, 'FastEthernet0', {
    ip: '192.168.1.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcHq.gateway = '192.168.1.1';

  let pcEast = createDefaultDevice('pc', 'PC-EAST', 610, 385, 'lab6-pc2');
  pcEast = patchInterface(pcEast, 'FastEthernet0', {
    ip: '192.168.2.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcEast.gateway = '192.168.2.1';

  let pcWest = createDefaultDevice('pc', 'PC-WEST', 865, 385, 'lab6-pc3');
  pcWest = patchInterface(pcWest, 'FastEthernet0', {
    ip: '192.168.3.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcWest.gateway = '192.168.3.1';

  const links: SimLink[] = [
    {
      id: 'lab6-link-isp-r1',
      cableType: 'crossover',
      fromDeviceId: 'lab6-isp',
      fromPort: 'GigabitEthernet0/0',
      toDeviceId: 'lab6-r1',
      toPort: 'GigabitEthernet0/2'
    },
    {
      id: 'lab6-link-r1-r2',
      cableType: 'crossover',
      fromDeviceId: 'lab6-r1',
      fromPort: 'GigabitEthernet0/0',
      toDeviceId: 'lab6-r2',
      toPort: 'GigabitEthernet0/0'
    },
    {
      id: 'lab6-link-r2-r3',
      cableType: 'serial',
      fromDeviceId: 'lab6-r2',
      fromPort: 'Serial0/0/0',
      toDeviceId: 'lab6-r3',
      toPort: 'Serial0/0/0'
    },
    {
      id: 'lab6-link-r1-pc1',
      cableType: 'crossover',
      fromDeviceId: 'lab6-r1',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab6-pc1',
      toPort: 'FastEthernet0'
    },
    {
      id: 'lab6-link-r2-pc2',
      cableType: 'crossover',
      fromDeviceId: 'lab6-r2',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab6-pc2',
      toPort: 'FastEthernet0'
    },
    {
      id: 'lab6-link-r3-pc3',
      cableType: 'crossover',
      fromDeviceId: 'lab6-r3',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab6-pc3',
      toPort: 'FastEthernet0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab6-zone-ospf',
      kind: 'rectangle',
      x: 265,
      y: 75,
      width: 685,
      height: 195,
      fillColor: '#06b6d4',
      fillOpacity: 0.08,
      borderColor: '#0891b2',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'OSPFv2 Process 10 · Area 0 Backbone',
      labelColor: '#0e7490'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab6-lbl-wan1',
      text: '10.0.12.0/30',
      x: 480,
      y: 120,
      color: '#0e7490',
      bgColor: '#cffafe',
      fontSize: 10,
      bold: true
    },
    {
      id: 'lab6-lbl-wan2',
      text: '10.0.23.0/30',
      x: 740,
      y: 120,
      color: '#991b1b',
      bgColor: '#fee2e2',
      fontSize: 10,
      bold: true
    }
  ];

  return {
    labId: 'lab-06-single-area-ospf',
    canvasWidth: 1000,
    canvasHeight: 470,
    devices: [isp, r1, r2, r3, pcHq, pcEast, pcWest],
    links,
    shapes,
    labels
  };
}

function buildLab07Topology(): LabExerciseTopology {
  let pc1 = createDefaultDevice('pc', 'PC-1', 135, 200, 'lab7-pc1');
  pc1.customLabel = 'PC-1 (DHCP Client)';
  pc1.useCustomLabel = true;
  pc1 = patchInterface(pc1, 'FastEthernet0', {
    ip: '192.168.50.21',
    mask: '255.255.255.0',
    adminUp: true
  });
  pc1.gateway = '192.168.50.1';

  let pc2 = createDefaultDevice('pc', 'PC-2', 135, 360, 'lab7-pc2');
  pc2.customLabel = 'PC-2 (DHCP Client)';
  pc2.useCustomLabel = true;
  pc2 = patchInterface(pc2, 'FastEthernet0', {
    ip: '192.168.50.22',
    mask: '255.255.255.0',
    adminUp: true
  });
  pc2.gateway = '192.168.50.1';

  const swLan = createDefaultDevice('switch', 'SW-LAN', 340, 275, 'lab7-sw');

  let r1Edge = createDefaultDevice('router', 'R1-EDGE', 565, 275, 'lab7-r1');
  r1Edge.customLabel = 'R1-EDGE · DHCP & PAT';
  r1Edge.useCustomLabel = true;
  r1Edge = patchInterface(r1Edge, 'GigabitEthernet0/1', {
    ip: '192.168.50.1',
    mask: '255.255.255.0',
    adminUp: true,
    description: 'ip nat inside'
  });
  r1Edge = patchInterface(r1Edge, 'GigabitEthernet0/0', {
    ip: '203.0.113.2',
    mask: '255.255.255.252',
    adminUp: true,
    description: 'ip nat outside'
  });

  let isp = createDefaultDevice('router', 'ISP-GW', 760, 275, 'lab7-isp');
  isp = patchInterface(isp, 'GigabitEthernet0/0', {
    ip: '203.0.113.1',
    mask: '255.255.255.252',
    adminUp: true
  });

  let dns = createDefaultDevice('server', 'PUBLIC-DNS', 910, 275, 'lab7-dns');
  dns = patchInterface(dns, 'FastEthernet0', {
    ip: '1.1.1.1',
    mask: '255.255.255.0',
    adminUp: true
  });

  const links: SimLink[] = [
    {
      id: 'lab7-link-pc1-sw',
      cableType: 'straight',
      fromDeviceId: 'lab7-pc1',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab7-sw',
      toPort: 'FastEthernet0/1'
    },
    {
      id: 'lab7-link-pc2-sw',
      cableType: 'straight',
      fromDeviceId: 'lab7-pc2',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab7-sw',
      toPort: 'FastEthernet0/2'
    },
    {
      id: 'lab7-link-sw-r1',
      cableType: 'straight',
      fromDeviceId: 'lab7-sw',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab7-r1',
      toPort: 'GigabitEthernet0/1'
    },
    {
      id: 'lab7-link-r1-isp',
      cableType: 'crossover',
      fromDeviceId: 'lab7-r1',
      fromPort: 'GigabitEthernet0/0',
      toDeviceId: 'lab7-isp',
      toPort: 'GigabitEthernet0/0'
    },
    {
      id: 'lab7-link-isp-dns',
      cableType: 'crossover',
      fromDeviceId: 'lab7-isp',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab7-dns',
      toPort: 'FastEthernet0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab7-zone-inside',
      kind: 'rectangle',
      x: 45,
      y: 110,
      width: 455,
      height: 330,
      fillColor: '#10b981',
      fillOpacity: 0.08,
      borderColor: '#059669',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'NAT Inside · DHCP Pool OFFICE_LAN (.21–.254)',
      labelColor: '#047857'
    },
    {
      id: 'lab7-zone-outside',
      kind: 'rectangle',
      x: 635,
      y: 155,
      width: 335,
      height: 225,
      fillColor: '#f59e0b',
      fillOpacity: 0.08,
      borderColor: '#d97706',
      lineStyle: 'dotted',
      borderWidth: 2,
      label: 'NAT Outside · Public PAT 203.0.113.2',
      labelColor: '#b45309'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab7-lbl-1',
      text: 'Excluded: .1–.20 · Overload PAT on Gi0/0',
      x: 565,
      y: 110,
      color: '#0f172a',
      bgColor: '#fef3c7',
      fontSize: 11,
      bold: true
    }
  ];

  return {
    labId: 'lab-07-dhcp-nat-pat',
    canvasWidth: 1000,
    canvasHeight: 480,
    devices: [pc1, pc2, swLan, r1Edge, isp, dns],
    links,
    shapes,
    labels
  };
}

function buildLab08Topology(): LabExerciseTopology {
  let pcStaff = createDefaultDevice('pc', 'PC-STAFF', 135, 165, 'lab8-staff');
  pcStaff = patchInterface(pcStaff, 'FastEthernet0', {
    ip: '10.20.10.25',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcStaff.gateway = '10.20.10.1';

  const swStaff = createDefaultDevice('switch', 'SW-STAFF', 320, 165, 'lab8-sw-staff');

  let pcGuest = createDefaultDevice('pc', 'PC-GUEST', 135, 365, 'lab8-guest');
  pcGuest = patchInterface(pcGuest, 'FastEthernet0', {
    ip: '10.20.90.40',
    mask: '255.255.255.0',
    adminUp: true
  });
  pcGuest.gateway = '10.20.90.1';

  const swGuest = createDefaultDevice('switch', 'SW-GUEST', 320, 365, 'lab8-sw-guest');

  let r1 = createDefaultDevice('router', 'R1', 560, 265, 'lab8-r1');
  r1.customLabel = 'R1 · ACL Firewall Router';
  r1.useCustomLabel = true;
  r1 = patchInterface(r1, 'GigabitEthernet0/0', {
    ip: '10.20.10.1',
    mask: '255.255.255.0',
    adminUp: true
  });
  r1 = patchInterface(r1, 'GigabitEthernet0/1', {
    ip: '10.20.90.1',
    mask: '255.255.255.0',
    adminUp: true,
    ipAccessGroupIn: 'GUEST_FILTER_IN'
  });
  r1 = patchInterface(r1, 'GigabitEthernet0/2', {
    ip: '172.16.100.1',
    mask: '255.255.255.0',
    adminUp: true
  });

  const swDmz = createDefaultDevice('switch', 'SW-DMZ', 750, 265, 'lab8-sw-dmz');

  let dmzWeb = createDefaultDevice('server', 'DMZ-WEB', 900, 265, 'lab8-dmz-web');
  dmzWeb.customLabel = 'DMZ-WEB (HTTPS:443 / SSH:22)';
  dmzWeb.useCustomLabel = true;
  dmzWeb = patchInterface(dmzWeb, 'FastEthernet0', {
    ip: '172.16.100.10',
    mask: '255.255.255.0',
    adminUp: true
  });
  dmzWeb.gateway = '172.16.100.1';

  const links: SimLink[] = [
    {
      id: 'lab8-link-st-sw',
      cableType: 'straight',
      fromDeviceId: 'lab8-staff',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab8-sw-staff',
      toPort: 'FastEthernet0/1'
    },
    {
      id: 'lab8-link-swst-r1',
      cableType: 'straight',
      fromDeviceId: 'lab8-sw-staff',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab8-r1',
      toPort: 'GigabitEthernet0/0'
    },
    {
      id: 'lab8-link-gu-sw',
      cableType: 'straight',
      fromDeviceId: 'lab8-guest',
      fromPort: 'FastEthernet0',
      toDeviceId: 'lab8-sw-guest',
      toPort: 'FastEthernet0/1'
    },
    {
      id: 'lab8-link-swgu-r1',
      cableType: 'straight',
      fromDeviceId: 'lab8-sw-guest',
      fromPort: 'GigabitEthernet0/1',
      toDeviceId: 'lab8-r1',
      toPort: 'GigabitEthernet0/1'
    },
    {
      id: 'lab8-link-r1-dmz',
      cableType: 'fiber',
      fromDeviceId: 'lab8-r1',
      fromPort: 'GigabitEthernet0/2',
      toDeviceId: 'lab8-sw-dmz',
      toPort: 'GigabitEthernet0/2'
    },
    {
      id: 'lab8-link-dmz-srv',
      cableType: 'straight',
      fromDeviceId: 'lab8-sw-dmz',
      fromPort: 'FastEthernet0/1',
      toDeviceId: 'lab8-dmz-web',
      toPort: 'FastEthernet0'
    }
  ];

  const shapes: SimTopologyShape[] = [
    {
      id: 'lab8-zone-staff',
      kind: 'rectangle',
      x: 50,
      y: 80,
      width: 375,
      height: 165,
      fillColor: '#10b981',
      fillOpacity: 0.08,
      borderColor: '#059669',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'Trusted Staff LAN · 10.20.10.0/24',
      labelColor: '#047857'
    },
    {
      id: 'lab8-zone-guest',
      kind: 'rectangle',
      x: 50,
      y: 280,
      width: 375,
      height: 165,
      fillColor: '#ef4444',
      fillOpacity: 0.07,
      borderColor: '#dc2626',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: 'Guest Wi-Fi · 10.20.90.0/24 (GUEST_FILTER_IN)',
      labelColor: '#b91c1c'
    },
    {
      id: 'lab8-zone-dmz',
      kind: 'rectangle',
      x: 660,
      y: 165,
      width: 310,
      height: 205,
      fillColor: '#f59e0b',
      fillOpacity: 0.08,
      borderColor: '#d97706',
      lineStyle: 'dotted',
      borderWidth: 2,
      label: 'DMZ Segment · 172.16.100.0/24',
      labelColor: '#b45309'
    }
  ];

  const labels: SimDiagramLabel[] = [
    {
      id: 'lab8-lbl-acl',
      text: 'Deny Guest → Staff · Permit DNS/HTTP/HTTPS',
      x: 560,
      y: 120,
      color: '#991b1b',
      bgColor: '#fee2e2',
      fontSize: 11,
      bold: true
    }
  ];

  return {
    labId: 'lab-08-extended-acls',
    canvasWidth: 1000,
    canvasHeight: 500,
    devices: [pcStaff, swStaff, pcGuest, swGuest, r1, swDmz, dmzWeb],
    links,
    shapes,
    labels
  };
}

const TOPOLOGY_BUILDERS: Record<string, () => LabExerciseTopology> = {
  'lab-01-initial-config': buildLab01Topology,
  'lab-02-ssh-remote-mgmt': buildLab02Topology,
  'lab-03-password-recovery-ios': buildLab03Topology,
  'lab-04-vlan-trunking-roas': buildLab04Topology,
  'lab-05-stp-etherchannel': buildLab05Topology,
  'lab-06-single-area-ospf': buildLab06Topology,
  'lab-07-dhcp-nat-pat': buildLab07Topology,
  'lab-08-extended-acls': buildLab08Topology
};

export function buildDefaultLabExerciseTopology(labId: string): LabExerciseTopology {
  const builder = TOPOLOGY_BUILDERS[labId];
  if (builder) {
    return builder();
  }
  return {
    labId,
    canvasWidth: 1000,
    canvasHeight: 480,
    devices: [],
    links: [],
    shapes: [],
    labels: []
  };
}
