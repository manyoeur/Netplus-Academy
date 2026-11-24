export type LabDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export type LabExerciseCategory =
  | 'Foundations'
  | 'Security & Access'
  | 'Device Operations'
  | 'Switching & VLANs'
  | 'Routing'
  | 'IP Services';

export interface LabAddressingRow {
  device: string;
  interfaceName: string;
  ipAddress: string;
  subnetMask: string;
  roleOrVlan: string;
}

export interface LabExerciseStep {
  id: string;
  stepNumber: number;
  title: string;
  device: string;
  promptHint: string;
  instructions: string;
  commands: string[];
  expectedOutcome: string;
}

export interface LabVerificationItem {
  command: string;
  device: string;
  whatToVerify: string;
}

export interface LabExercise {
  id: string;
  labNumber: number;
  title: string;
  category: LabExerciseCategory;
  difficulty: LabDifficulty;
  estimatedMinutes: number;
  summary: string;
  scenario: string;
  objectives: string[];
  prerequisites: string[];
  topologySummary: string;
  addressingTable: LabAddressingRow[];
  steps: LabExerciseStep[];
  verificationChecklist: LabVerificationItem[];
}

export const LAB_EXERCISE_CATEGORIES: LabExerciseCategory[] = [
  'Foundations',
  'Security & Access',
  'Device Operations',
  'Switching & VLANs',
  'Routing',
  'IP Services'
];

export const LAB_EXERCISES: LabExercise[] = [
  {
    id: 'lab-01-initial-config',
    labNumber: 1,
    title: 'Initial Router and Switch Configuration',
    category: 'Foundations',
    difficulty: 'Beginner',
    estimatedMinutes: 35,
    summary:
      'Bootstrap a clean Cisco IOS router and Layer 2 switch with hostnames, encrypted passwords, MOTD banners, IP addressing, and persistent NVRAM configuration.',
    scenario:
      'You are provisioning a brand-new branch office rack consisting of gateway router R1, access switch SW1, and an admin workstation PC-A. Both network devices are currently at factory defaults and require baseline hardening and Layer 3 reachability before production rollout.',
    objectives: [
      'Disable unwanted DNS lookups on console errors and configure meaningful device hostnames.',
      'Secure privileged EXEC, console, and VTY access using salted secret hashes and password encryption.',
      'Assign IPv4 addresses to router GigabitEthernet interfaces and the switch SVI management interface.',
      'Save running configurations to NVRAM and verify end-to-end ICMP reachability.'
    ],
    prerequisites: [
      'Basic familiarity with Cisco IOS User EXEC (>), Privileged EXEC (#), and Global Configuration modes.',
      'IPv4 /24 subnetting and default gateway concepts.'
    ],
    topologySummary: 'PC-A (192.168.10.10/24) ── [Fa0/6] SW1 (VLAN 1: 192.168.10.2/24) [Gi0/1] ── [Gi0/0/0] R1 (192.168.10.1/24)',
    addressingTable: [
      {
        device: 'R1',
        interfaceName: 'GigabitEthernet0/0/0',
        ipAddress: '192.168.10.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Branch LAN Default Gateway'
      },
      {
        device: 'R1',
        interfaceName: 'GigabitEthernet0/0/1',
        ipAddress: '10.0.12.1',
        subnetMask: '255.255.255.252 (/30)',
        roleOrVlan: 'WAN Uplink to HQ'
      },
      {
        device: 'SW1',
        interfaceName: 'VLAN 1 (SVI)',
        ipAddress: '192.168.10.2',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Switch Management Interface'
      },
      {
        device: 'PC-A',
        interfaceName: 'NIC0',
        ipAddress: '192.168.10.10',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Gateway: 192.168.10.1'
      }
    ],
    steps: [
      {
        id: 'lab1-step1',
        stepNumber: 1,
        title: 'Enter Privileged Mode & Set Baseline System Parameters on R1',
        device: 'R1',
        promptHint: 'Router> → R1(config)#',
        instructions:
          'Connect via console to R1, enter global configuration mode, set the hostname to R1, disable DNS resolution of mistyped commands, and configure a legal MOTD warning banner.',
        commands: [
          'enable',
          'configure terminal',
          'hostname R1',
          'no ip domain-lookup',
          'banner motd # Authorized Personnel Only - Netplus Branch R1 #'
        ],
        expectedOutcome:
          'The CLI prompt immediately updates to R1(config)# and mistyped commands no longer stall for 30-second DNS timeouts.'
      },
      {
        id: 'lab1-step2',
        stepNumber: 2,
        title: 'Configure Console, VTY, and Encrypted Privileged Passwords',
        device: 'R1',
        promptHint: 'R1(config)#',
        instructions:
          'Set a type-5/type-9 enable secret, enable service password-encryption for legacy line passwords, and configure logging synchronous on the console line so syslog messages never interrupt typing.',
        commands: [
          'enable secret NetPlus@Enable2026',
          'service password-encryption',
          'line console 0',
          ' password Console@Pass01',
          ' login',
          ' logging synchronous',
          'line vty 0 4',
          ' password Vty@Pass01',
          ' login',
          'exit'
        ],
        expectedOutcome:
          'Console and VTY sessions prompt for authentication, and plaintext passwords are obfuscated (type 7) in show running-config.'
      },
      {
        id: 'lab1-step3',
        stepNumber: 3,
        title: 'Assign Interface IPv4 Addresses & Bring Up Router Links',
        device: 'R1',
        promptHint: 'R1(config-if)#',
        instructions:
          'Configure R1 LAN interface GigabitEthernet0/0/0 and WAN interface GigabitEthernet0/0/1 with descriptive labels and administratively enable both interfaces with no shutdown.',
        commands: [
          'interface GigabitEthernet0/0/0',
          ' description LAN Gateway for Branch Office',
          ' ip address 192.168.10.1 255.255.255.0',
          ' no shutdown',
          'interface GigabitEthernet0/0/1',
          ' description WAN Link to HQ Core',
          ' ip address 10.0.12.1 255.255.255.252',
          ' no shutdown',
          'end'
        ],
        expectedOutcome:
          'Syslog confirms %LINK-3-UPDOWN: Interface GigabitEthernet0/0/0, changed state to up.'
      },
      {
        id: 'lab1-step4',
        stepNumber: 4,
        title: 'Configure Switch Management SVI & Default Gateway on SW1',
        device: 'SW1',
        promptHint: 'Switch> → SW1(config)#',
        instructions:
          'Assign hostname SW1, secure privileged access, configure the VLAN 1 Switched Virtual Interface (SVI) with 192.168.10.2/24, and define ip default-gateway so SW1 can be managed across subnets.',
        commands: [
          'enable',
          'configure terminal',
          'hostname SW1',
          'no ip domain-lookup',
          'enable secret NetPlus@Enable2026',
          'service password-encryption',
          'interface vlan 1',
          ' description Switch Management SVI',
          ' ip address 192.168.10.2 255.255.255.0',
          ' no shutdown',
          'exit',
          'ip default-gateway 192.168.10.1',
          'end'
        ],
        expectedOutcome:
          'SW1 VLAN 1 line protocol transitions to up/up and responds to ICMP pings from R1 and PC-A.'
      },
      {
        id: 'lab1-step5',
        stepNumber: 5,
        title: 'Persist Running Configurations to Startup NVRAM',
        device: 'R1 & SW1',
        promptHint: 'R1# / SW1#',
        instructions:
          'Write the active running-config to startup-config on both R1 and SW1 so configurations survive a cold power cycle or reload.',
        commands: ['copy running-config startup-config'],
        expectedOutcome:
          'Output confirms [OK] and startup-config bytes are written to NVRAM.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show ip interface brief',
        device: 'R1 & SW1',
        whatToVerify: 'Confirm GigabitEthernet0/0/0 (192.168.10.1) and VLAN 1 (192.168.10.2) report Status: up and Protocol: up.'
      },
      {
        command: 'show running-config',
        device: 'R1',
        whatToVerify: 'Verify enable secret uses hashed output ($1$/$9$), banner motd is present, and service password-encryption is active.'
      },
      {
        command: 'ping 192.168.10.2',
        device: 'R1',
        whatToVerify: 'Verify 5/5 ICMP echo replies (100% success rate) between R1 and SW1.'
      }
    ]
  },
  {
    id: 'lab-02-ssh-remote-mgmt',
    labNumber: 2,
    title: 'Secure Remote Management with SSH',
    category: 'Security & Access',
    difficulty: 'Beginner',
    estimatedMinutes: 30,
    summary:
      'Replace cleartext Telnet administration with encrypted SSHv2 remote management using local AAA user accounts, 2048-bit RSA keys, and VTY transport locking.',
    scenario:
      'Security audit findings flagged cleartext Telnet on core router R1 and access switch SW1. Your objective is to generate cryptographic RSA keys, enforce SSH version 2, bind local privilege-15 administrator accounts, and block all unencrypted Telnet sessions.',
    objectives: [
      'Configure an FQDN identity (hostname + ip domain-name) required for RSA key generation.',
      'Create local privileged administrator accounts using salted secret hashing.',
      'Generate 2048-bit RSA keys and enforce SSHv2 with authentication retry and idle timeouts.',
      'Restrict VTY lines strictly to SSH (transport input ssh) and validate remote SSH login.'
    ],
    prerequisites: [
      'Completion of Lab 1 (Initial Router and Switch Configuration).',
      'IP reachability between management workstation PC-A and target devices.'
    ],
    topologySummary: 'Admin PC-A (192.168.10.10/24) ── [SSH TCP/22] ──▶ SW1 (192.168.10.2) ──▶ R1 (192.168.10.1)',
    addressingTable: [
      {
        device: 'R1',
        interfaceName: 'GigabitEthernet0/0/0',
        ipAddress: '192.168.10.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'SSH Server Target 1'
      },
      {
        device: 'SW1',
        interfaceName: 'VLAN 1 (SVI)',
        ipAddress: '192.168.10.2',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'SSH Server Target 2'
      },
      {
        device: 'PC-A',
        interfaceName: 'NIC0',
        ipAddress: '192.168.10.10',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'SSH Client Workstation'
      }
    ],
    steps: [
      {
        id: 'lab2-step1',
        stepNumber: 1,
        title: 'Configure Hostname and DNS Domain Identity',
        device: 'R1',
        promptHint: 'R1(config)#',
        instructions:
          'Cisco IOS refuses to generate RSA keys if the device still uses the default hostname or lacks an IP domain name. Set an explicit corporate domain name on R1.',
        commands: [
          'configure terminal',
          'hostname R1',
          'ip domain-name netplus.academy'
        ],
        expectedOutcome:
          'Device FQDN becomes R1.netplus.academy, ready to serve as the RSA key label.'
      },
      {
        id: 'lab2-step2',
        stepNumber: 2,
        title: 'Create Local Admin Account & Generate 2048-bit RSA Keypair',
        device: 'R1',
        promptHint: 'R1(config)#',
        instructions:
          'Provision a local privilege-15 administrator account with secret encryption, then generate a 2048-bit RSA modulus (minimum required for SSHv2 security compliance).',
        commands: [
          'username netadmin privilege 15 secret SshAdmin#2026',
          'crypto key generate rsa general-keys modulus 2048'
        ],
        expectedOutcome:
          'IOS outputs: %SSH-5-ENABLED: SSH 1.99 has been enabled (upgraded to SSH 2.0 in next step).'
      },
      {
        id: 'lab2-step3',
        stepNumber: 3,
        title: 'Enforce SSHv2 Policy & Hardened Timeouts',
        device: 'R1',
        promptHint: 'R1(config)#',
        instructions:
          'Force SSH version 2 only (disabling vulnerable SSHv1), limit authentication retries to 3 attempts, and set a 60-second login negotiation timeout.',
        commands: [
          'ip ssh version 2',
          'ip ssh authentication-retries 3',
          'ip ssh time-out 60'
        ],
        expectedOutcome:
          'SSH server only negotiates SSHv2 sessions and drops brute-force attempts after 3 failures.'
      },
      {
        id: 'lab2-step4',
        stepNumber: 4,
        title: 'Lock VTY Lines to SSH-Only & Local Authentication',
        device: 'R1',
        promptHint: 'R1(config-line)#',
        instructions:
          'Configure all VTY lines (0 through 15) to authenticate against the local user database (login local), reject Telnet via transport input ssh, and enforce an exec-timeout of 5 minutes.',
        commands: [
          'line vty 0 15',
          ' login local',
          ' transport input ssh',
          ' exec-timeout 5 0',
          'end',
          'copy running-config startup-config'
        ],
        expectedOutcome:
          'Telnet connections on TCP/23 are refused while SSH connections on TCP/22 authenticate with username netadmin.'
      },
      {
        id: 'lab2-step5',
        stepNumber: 5,
        title: 'Apply Matching SSHv2 Hardening to SW1',
        device: 'SW1',
        promptHint: 'SW1(config)#',
        instructions:
          'Repeat the domain-name, local admin account, 2048-bit RSA keypair, SSHv2 enforcement, and VTY locking on access switch SW1.',
        commands: [
          'configure terminal',
          'ip domain-name netplus.academy',
          'username netadmin privilege 15 secret SshAdmin#2026',
          'crypto key generate rsa general-keys modulus 2048',
          'ip ssh version 2',
          'line vty 0 15',
          ' login local',
          ' transport input ssh',
          ' exec-timeout 5 0',
          'end',
          'copy running-config startup-config'
        ],
        expectedOutcome:
          'Both R1 and SW1 accept encrypted SSHv2 administration and reject cleartext Telnet.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show ip ssh',
        device: 'R1 & SW1',
        whatToVerify: 'Confirm "SSH Enabled - version 2.0", Authentication timeout: 60 secs, Authentication retries: 3.'
      },
      {
        command: 'ssh -l netadmin 192.168.10.2',
        device: 'R1',
        whatToVerify: 'Test live SSH session from R1 to SW1; verify prompt switches to SW1# upon authentication.'
      },
      {
        command: 'show ssh',
        device: 'SW1',
        whatToVerify: 'Observe active incoming SSHv2 session version, AES encryption cipher, and authenticated user netadmin.'
      }
    ]
  },
  {
    id: 'lab-03-password-recovery-ios',
    labNumber: 3,
    title: 'Password Recovery and IOS Image Management',
    category: 'Device Operations',
    difficulty: 'Intermediate',
    estimatedMinutes: 40,
    summary:
      'Recover locked Cisco routers via ROMMON configuration register 0x2142 without erasing production configs, and perform MD5-verified Cisco IOS image backups and upgrades.',
    scenario:
      'An inherited branch router R2 has an unknown enable secret and is running an outdated Cisco IOS image with known security advisories. You must regain privileged access while preserving the existing startup-config, reset the boot register back to 0x2102, back up the current IOS image, and stage a verified upgrade from a TFTP server.',
    objectives: [
      'Use ROMMON (confreg 0x2142) to bypass NVRAM startup-config during boot.',
      'Restore startup-config into running-config safely without overwriting interfaces in shutdown state.',
      'Replace the lost enable secret and return the configuration register to 0x2102.',
      'Inspect flash storage, verify image integrity using MD5 checksums, and configure boot system fallback.'
    ],
    prerequisites: [
      'Physical console access knowledge and understanding of Cisco router boot sequence (ROM → Flash → NVRAM).',
      'Basic TFTP/SCP file transfer IP reachability concepts.'
    ],
    topologySummary: 'Admin Console ──▶ R2 (Gi0/0/0: 172.16.50.1/24) ──▶ TFTP Server (172.16.50.100/24)',
    addressingTable: [
      {
        device: 'R2',
        interfaceName: 'GigabitEthernet0/0/0',
        ipAddress: '172.16.50.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Management / TFTP Transfer Link'
      },
      {
        device: 'TFTP-SRV',
        interfaceName: 'eth0',
        ipAddress: '172.16.50.100',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'IOS Image Repository'
      }
    ],
    steps: [
      {
        id: 'lab3-step1',
        stepNumber: 1,
        title: 'Interrupt Boot Sequence & Set ROMMON Register 0x2142',
        device: 'R2 (ROMMON)',
        promptHint: 'rommon 1 >',
        instructions:
          'Power-cycle R2 and send a console Break signal within the first 60 seconds to enter ROMMON mode. Change the configuration register to 0x2142 so the router ignores startup-config, then reset.',
        commands: ['confreg 0x2142', 'reset'],
        expectedOutcome:
          'R2 reboots into the initial setup dialog ("Would you like to enter the initial configuration dialog? [yes/no]: no") with blank running-config.'
      },
      {
        id: 'lab3-step2',
        stepNumber: 2,
        title: 'Merge Startup-Config & Reset Enable Secret',
        device: 'R2',
        promptHint: 'Router> → R2(config)#',
        instructions:
          'Enter privileged mode (no password required), merge startup-config into running-config (do NOT overwrite startup-config yet!), set a new enable secret, and re-enable any active interfaces.',
        commands: [
          'enable',
          'copy startup-config running-config',
          'configure terminal',
          'enable secret Recovered@2026',
          'interface GigabitEthernet0/0/0',
          ' no shutdown',
          'exit'
        ],
        expectedOutcome:
          'Original hostname, routing, and interface IPs are restored in RAM with the new enable secret active.'
      },
      {
        id: 'lab3-step3',
        stepNumber: 3,
        title: 'Restore Configuration Register 0x2102 & Save Config',
        device: 'R2',
        promptHint: 'R2(config)# → R2#',
        instructions:
          'Change config-register back to 0x2102 so future reboots load startup-config normally, then save the updated configuration to NVRAM.',
        commands: [
          'config-register 0x2102',
          'end',
          'copy running-config startup-config'
        ],
        expectedOutcome:
          'show version displays "Configuration register is 0x2142 (will be 0x2102 at next reload)".'
      },
      {
        id: 'lab3-step4',
        stepNumber: 4,
        title: 'Inspect Flash & Back Up Existing IOS Image to TFTP',
        device: 'R2',
        promptHint: 'R2#',
        instructions:
          'Verify available flash capacity before uploading a new IOS image, then back up the current running image to the TFTP server for disaster rollback.',
        commands: [
          'show flash0:',
          'copy flash0:isr4300-universalk9.16.09.04.SPA.bin tftp://172.16.50.100/isr4300-backup.bin'
        ],
        expectedOutcome:
          'IOS displays exclamation marks (!!!) during transfer and reports bytes copied successfully.'
      },
      {
        id: 'lab3-step5',
        stepNumber: 5,
        title: 'Stage New IOS Image, Verify MD5 Hash & Set Boot System',
        device: 'R2',
        promptHint: 'R2# → R2(config)#',
        instructions:
          'Download the new IOS image from TFTP to flash0:, verify its MD5 cryptographic digest against the vendor checksum, and set the boot system pointer with fallback.',
        commands: [
          'copy tftp://172.16.50.100/isr4300-universalk9.17.06.05.SPA.bin flash0:',
          'verify /md5 flash0:isr4300-universalk9.17.06.05.SPA.bin',
          'configure terminal',
          'no boot system',
          'boot system flash0:isr4300-universalk9.17.06.05.SPA.bin',
          'boot system flash0:isr4300-universalk9.16.09.04.SPA.bin',
          'end',
          'copy running-config startup-config'
        ],
        expectedOutcome:
          'The MD5 checksum matches vendor release notes and R2 is configured to boot the upgraded image safely.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show version',
        device: 'R2',
        whatToVerify: 'Confirm System image file, available DRAM/flash, and config-register set to 0x2102 for next reload.'
      },
      {
        command: 'show bootvar',
        device: 'R2',
        whatToVerify: 'Confirm BOOT variable lists the upgraded .bin image first and fallback image second.'
      },
      {
        command: 'verify /md5 flash0:isr4300-universalk9.17.06.05.SPA.bin',
        device: 'R2',
        whatToVerify: 'Ensure 128-bit MD5 output matches expected vendor hash before scheduling reload.'
      }
    ]
  },
  {
    id: 'lab-04-vlan-trunking-roas',
    labNumber: 4,
    title: 'VLAN Segmentation and 802.1Q Trunking',
    category: 'Switching & VLANs',
    difficulty: 'Intermediate',
    estimatedMinutes: 45,
    summary:
      'Segment department broadcast domains using IEEE 802.1Q VLANs, hardened trunk links with a dedicated native VLAN, and Router-on-a-Stick inter-VLAN routing.',
    scenario:
      'Engineering and Sales hosts share switch SW1 and must be isolated at Layer 2 while communicating securely through router R1 subinterfaces. Native VLAN 1 must be replaced with dedicated unused Native VLAN 99.',
    objectives: [
      'Create named VLANs 10 (ENGINEERING), 20 (SALES), and 99 (NATIVE_MGMT) on SW1.',
      'Bind access switchports with PortFast and disable DTP negotiation on trunks.',
      'Configure an IEEE 802.1Q trunk between SW1 and R1 with Native VLAN 99.',
      'Configure Router-on-a-Stick subinterfaces on R1 Gi0/0/0 for inter-VLAN routing.'
    ],
    prerequisites: [
      'Completion of Lab 1.',
      'Understanding of Layer 2 broadcast domains and 802.1Q 4-byte frame tagging.'
    ],
    topologySummary: 'PC-ENG (VLAN 10) + PC-SLS (VLAN 20) ──▶ SW1 [Trunk Gi0/1: VLAN 10,20,99] ──▶ R1 [Gi0/0/0.10, .20, .99]',
    addressingTable: [
      {
        device: 'R1',
        interfaceName: 'Gi0/0/0.10',
        ipAddress: '10.10.10.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'VLAN 10 Gateway (Engineering)'
      },
      {
        device: 'R1',
        interfaceName: 'Gi0/0/0.20',
        ipAddress: '10.10.20.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'VLAN 20 Gateway (Sales)'
      },
      {
        device: 'SW1',
        interfaceName: 'VLAN 99 (SVI)',
        ipAddress: '10.10.99.2',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Native / Mgmt VLAN 99'
      },
      {
        device: 'PC-ENG',
        interfaceName: 'NIC0',
        ipAddress: '10.10.10.10',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'SW1 Fa0/5 (VLAN 10)'
      },
      {
        device: 'PC-SLS',
        interfaceName: 'NIC0',
        ipAddress: '10.10.20.10',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'SW1 Fa0/6 (VLAN 20)'
      }
    ],
    steps: [
      {
        id: 'lab4-step1',
        stepNumber: 1,
        title: 'Create Departmental and Native VLANs on SW1',
        device: 'SW1',
        promptHint: 'SW1(config-vlan)#',
        instructions:
          'Define VLANs 10, 20, and 99 in the switch VLAN database with clear descriptive names.',
        commands: [
          'configure terminal',
          'vlan 10',
          ' name ENGINEERING',
          'vlan 20',
          ' name SALES',
          'vlan 99',
          ' name NATIVE_MGMT',
          'exit'
        ],
        expectedOutcome:
          'VLANs 10, 20, and 99 appear as active in show vlan brief.'
      },
      {
        id: 'lab4-step2',
        stepNumber: 2,
        title: 'Assign Access Ports for Engineering & Sales',
        device: 'SW1',
        promptHint: 'SW1(config-if)#',
        instructions:
          'Lock access interfaces statically with switchport mode access (preventing DTP trunk spoofing) and assign them to their corresponding VLANs.',
        commands: [
          'interface FastEthernet0/5',
          ' description Engineering Workstation',
          ' switchport mode access',
          ' switchport access vlan 10',
          'interface FastEthernet0/6',
          ' description Sales Workstation',
          ' switchport mode access',
          ' switchport access vlan 20',
          'exit'
        ],
        expectedOutcome:
          'Fa0/5 belongs to VLAN 10 and Fa0/6 belongs to VLAN 20.'
      },
      {
        id: 'lab4-step3',
        stepNumber: 3,
        title: 'Configure Hardened 802.1Q Trunk Uplink to R1',
        device: 'SW1',
        promptHint: 'SW1(config-if)#',
        instructions:
          'Configure GigabitEthernet0/1 as an unconditional 802.1Q trunk carrying only VLANs 10, 20, and 99, with Native VLAN 99 and DTP disabled.',
        commands: [
          'interface GigabitEthernet0/1',
          ' description 802.1Q Trunk to R1',
          ' switchport mode trunk',
          ' switchport nonegotiate',
          ' switchport trunk native vlan 99',
          ' switchport trunk allowed vlan 10,20,99',
          'end'
        ],
        expectedOutcome:
          'Gi0/1 operates in 802.1q trunking mode with Native VLAN 99.'
      },
      {
        id: 'lab4-step4',
        stepNumber: 4,
        title: 'Configure Router-on-a-Stick Subinterfaces on R1',
        device: 'R1',
        promptHint: 'R1(config-subif)#',
        instructions:
          'Enable parent interface Gi0/0/0 without an IP address, then create 802.1Q subinterfaces .10, .20, and .99 matching the switch trunk configuration.',
        commands: [
          'configure terminal',
          'interface GigabitEthernet0/0/0',
          ' no shutdown',
          'interface GigabitEthernet0/0/0.10',
          ' encapsulation dot1Q 10',
          ' ip address 10.10.10.1 255.255.255.0',
          'interface GigabitEthernet0/0/0.20',
          ' encapsulation dot1Q 20',
          ' ip address 10.10.20.1 255.255.255.0',
          'interface GigabitEthernet0/0/0.99',
          ' encapsulation dot1Q 99 native',
          ' ip address 10.10.99.1 255.255.255.0',
          'end'
        ],
        expectedOutcome:
          'R1 routing table shows directly connected routes for 10.10.10.0/24, 10.10.20.0/24, and 10.10.99.0/24.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show vlan brief',
        device: 'SW1',
        whatToVerify: 'Confirm VLANs 10, 20, and 99 are active with Fa0/5 and Fa0/6 mapped accurately.'
      },
      {
        command: 'show interfaces trunk',
        device: 'SW1',
        whatToVerify: 'Verify Gi0/1 Mode=on, Encapsulation=802.1q, Native vlan=99, Allowed vlans=10,20,99.'
      },
      {
        command: 'ping 10.10.20.10',
        device: 'PC-ENG',
        whatToVerify: 'Verify inter-VLAN routing succeeds between Engineering (10.10.10.10) and Sales (10.10.20.10).'
      }
    ]
  },
  {
    id: 'lab-05-stp-etherchannel',
    labNumber: 5,
    title: 'Rapid PVST+ Spanning Tree & LACP EtherChannel',
    category: 'Switching & VLANs',
    difficulty: 'Intermediate',
    estimatedMinutes: 45,
    summary:
      'Eliminate Layer 2 switching loops deterministically with Rapid PVST+, PortFast/BPDU Guard edge protection, and 802.3ad LACP EtherChannel link aggregation.',
    scenario:
      'Distribution switches DSW1 and DSW2 connect via dual redundant Gigabit uplinks to access switch ASW1. Without tuning, STP blocks one uplink and leaves root election to the lowest MAC address. You will make DSW1 the deterministic Root Bridge, bundle parallel links with LACP, and harden edge ports.',
    objectives: [
      'Enable Rapid PVST+ across all switches for sub-second convergence.',
      'Configure primary and secondary STP Root Bridges deterministically.',
      'Bundle parallel inter-switch links into an IEEE 802.3ad LACP Port-Channel.',
      'Enable PortFast and BPDU Guard on end-host access interfaces.'
    ],
    prerequisites: [
      'Understanding of STP Root Bridge election (Bridge ID = Priority + Sys-ID-Ext + MAC).',
      'Basic familiarity with trunking and VLANs.'
    ],
    topologySummary: 'DSW1 (Root Primary) ═══ [Po1 LACP] ═══ DSW2 (Root Secondary) ──▶ ASW1 (Access + PortFast/BPDU Guard)',
    addressingTable: [
      {
        device: 'DSW1',
        interfaceName: 'Port-Channel 1 (Gi0/1-2)',
        ipAddress: 'L2 Trunk',
        subnetMask: 'VLANs 10,20,99',
        roleOrVlan: 'Primary Root Bridge (Priority 24576)'
      },
      {
        device: 'DSW2',
        interfaceName: 'Port-Channel 1 (Gi0/1-2)',
        ipAddress: 'L2 Trunk',
        subnetMask: 'VLANs 10,20,99',
        roleOrVlan: 'Secondary Root Bridge (Priority 28672)'
      },
      {
        device: 'ASW1',
        interfaceName: 'Fa0/1 - Fa0/10',
        ipAddress: 'L2 Access',
        subnetMask: 'VLAN 10',
        roleOrVlan: 'PortFast + BPDU Guard'
      }
    ],
    steps: [
      {
        id: 'lab5-step1',
        stepNumber: 1,
        title: 'Switch STP Mode to Rapid PVST+ & Set Root Priorities',
        device: 'DSW1 & DSW2',
        promptHint: 'DSW1(config)# / DSW2(config)#',
        instructions:
          'Enable rapid-pvst on DSW1 and DSW2. Set DSW1 as root primary and DSW2 as root secondary for VLANs 1, 10, 20, and 99.',
        commands: [
          '! On DSW1:',
          'configure terminal',
          'spanning-tree mode rapid-pvst',
          'spanning-tree vlan 1,10,20,99 root primary',
          '! On DSW2:',
          'configure terminal',
          'spanning-tree mode rapid-pvst',
          'spanning-tree vlan 1,10,20,99 root secondary'
        ],
        expectedOutcome:
          'DSW1 becomes Root Bridge with priority 24576 (+VLAN ID); DSW2 serves as hot standby root at 28672.'
      },
      {
        id: 'lab5-step2',
        stepNumber: 2,
        title: 'Bundle Dual Uplinks into an LACP Port-Channel',
        device: 'DSW1 & DSW2',
        promptHint: 'DSW1(config-if-range)#',
        instructions:
          'Configure interfaces Gi0/1 and Gi0/2 on both distribution switches into active LACP channel-group 1, then configure Port-channel 1 as an 802.1Q trunk.',
        commands: [
          'interface range GigabitEthernet0/1 - 2',
          ' switchport trunk encapsulation dot1q',
          ' switchport mode trunk',
          ' channel-group 1 mode active',
          'exit',
          'interface Port-channel1',
          ' switchport mode trunk',
          ' switchport trunk native vlan 99'
        ],
        expectedOutcome:
          'Port-channel 1 forms an operational 2 Gbps bundled trunk (SU flags in EtherChannel summary) without STP blocking either member link.'
      },
      {
        id: 'lab5-step3',
        stepNumber: 3,
        title: 'Harden Access Ports with PortFast & BPDU Guard',
        device: 'ASW1',
        promptHint: 'ASW1(config-if-range)#',
        instructions:
          'Configure host-facing ports Fa0/1–10 on ASW1 to skip 30-second Listening/Learning delays via PortFast, and automatically err-disable any port that receives rogue switch BPDUs.',
        commands: [
          'configure terminal',
          'spanning-tree mode rapid-pvst',
          'interface range FastEthernet0/1 - 10',
          ' switchport mode access',
          ' spanning-tree portfast',
          ' spanning-tree bpduguard enable',
          'end'
        ],
        expectedOutcome:
          'Workstations obtain DHCP addresses immediately on link-up while unauthorized switches plugged into edge jacks trigger err-disable protection.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show spanning-tree vlan 10',
        device: 'DSW1',
        whatToVerify: 'Confirm "This bridge is the root" and verify Po1 is in Forwarding (FWD) state.'
      },
      {
        command: 'show etherchannel summary',
        device: 'DSW1 & DSW2',
        whatToVerify: 'Verify Po1 shows (SU) Layer2 Up and member ports Gi0/1(P) and Gi0/2(P) are bundled with Protocol: LACP.'
      }
    ]
  },
  {
    id: 'lab-06-single-area-ospf',
    labNumber: 6,
    title: 'Single-Area OSPFv2 Dynamic Routing',
    category: 'Routing',
    difficulty: 'Intermediate',
    estimatedMinutes: 45,
    summary:
      'Deploy Single-Area OSPF (Area 0) across three routers with explicit Router IDs, wildcard-masked network statements, passive LAN interfaces, and default route propagation.',
    scenario:
      'A three-site enterprise WAN (HQ, Branch-East, Branch-West) currently relies on manual static routes. You will migrate the backbone to OSPFv2 Area 0 so link failures reconverge dynamically and HQ propagates its ISP default gateway to both branch routers.',
    objectives: [
      'Initialize OSPF process 10 with deterministic 32-bit Router IDs (1.1.1.1, 2.2.2.2, 3.3.3.3).',
      'Advertise WAN point-to-point /30 subnets and LAN /24 networks into Area 0 using precise wildcard masks.',
      'Suppress unnecessary OSPF Hello broadcasts on user-facing LAN ports with passive-interface.',
      'Propagate a static default route from HQ using default-information originate.'
    ],
    prerequisites: [
      'IPv4 wildcard mask calculation (255.255.255.255 minus subnet mask).',
      'Interface IP configuration across multiple routers.'
    ],
    topologySummary: 'ISP ──▶ R1-HQ (1.1.1.1) ── [10.0.12.0/30] ──▶ R2-EAST (2.2.2.2) ── [10.0.23.0/30] ──▶ R3-WEST (3.3.3.3)',
    addressingTable: [
      {
        device: 'R1-HQ',
        interfaceName: 'Gi0/0/0 (WAN to R2)',
        ipAddress: '10.0.12.1',
        subnetMask: '255.255.255.252 (/30)',
        roleOrVlan: 'Router-ID 1.1.1.1 · Area 0'
      },
      {
        device: 'R1-HQ',
        interfaceName: 'Gi0/0/1 (HQ LAN)',
        ipAddress: '192.168.1.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Passive OSPF Interface'
      },
      {
        device: 'R2-EAST',
        interfaceName: 'Gi0/0/0 (WAN to R1)',
        ipAddress: '10.0.12.2',
        subnetMask: '255.255.255.252 (/30)',
        roleOrVlan: 'Router-ID 2.2.2.2 · Area 0'
      },
      {
        device: 'R2-EAST',
        interfaceName: 'Gi0/0/1 (Branch LAN)',
        ipAddress: '192.168.2.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Passive OSPF Interface'
      },
      {
        device: 'R3-WEST',
        interfaceName: 'Gi0/0/0 (WAN to R2)',
        ipAddress: '10.0.23.2',
        subnetMask: '255.255.255.252 (/30)',
        roleOrVlan: 'Router-ID 3.3.3.3 · Area 0'
      }
    ],
    steps: [
      {
        id: 'lab6-step1',
        stepNumber: 1,
        title: 'Configure OSPF Process 10 & Default Route Injection on R1-HQ',
        device: 'R1-HQ',
        promptHint: 'R1-HQ(config-router)#',
        instructions:
          'Configure a static default route toward the ISP next-hop on R1-HQ, then enable OSPF process 10, set router-id 1.1.1.1, mark Gi0/0/1 passive, and distribute the default route via default-information originate.',
        commands: [
          'configure terminal',
          'ip route 0.0.0.0 0.0.0.0 203.0.113.1',
          'router ospf 10',
          ' router-id 1.1.1.1',
          ' passive-interface GigabitEthernet0/0/1',
          ' network 10.0.12.0 0.0.0.3 area 0',
          ' network 192.168.1.0 0.0.0.255 area 0',
          ' default-information originate',
          'end'
        ],
        expectedOutcome:
          'R1-HQ injects an O*E2 0.0.0.0/0 default route into the Area 0 LSDB.'
      },
      {
        id: 'lab6-step2',
        stepNumber: 2,
        title: 'Enable OSPF Area 0 Adjacency on R2-EAST',
        device: 'R2-EAST',
        promptHint: 'R2-EAST(config-router)#',
        instructions:
          'Configure OSPF process 10 on R2-EAST with router-id 2.2.2.2 and advertise both WAN transit links and its local Branch LAN into Area 0.',
        commands: [
          'configure terminal',
          'router ospf 10',
          ' router-id 2.2.2.2',
          ' passive-interface GigabitEthernet0/0/1',
          ' network 10.0.12.0 0.0.0.3 area 0',
          ' network 10.0.23.0 0.0.0.3 area 0',
          ' network 192.168.2.0 0.0.0.255 area 0',
          'end'
        ],
        expectedOutcome:
          'Syslog reports %OSPF-5-ADJCHG: Process 10, Nbr 1.1.1.1 on GigabitEthernet0/0/0 from LOADING to FULL.'
      },
      {
        id: 'lab6-step3',
        stepNumber: 3,
        title: 'Complete Backbone Adjacency on R3-WEST',
        device: 'R3-WEST',
        promptHint: 'R3-WEST(config-router)#',
        instructions:
          'Configure OSPF process 10 on R3-WEST with router-id 3.3.3.3, passive LAN interface, and Area 0 advertisements.',
        commands: [
          'configure terminal',
          'router ospf 10',
          ' router-id 3.3.3.3',
          ' passive-interface GigabitEthernet0/0/1',
          ' network 10.0.23.0 0.0.0.3 area 0',
          ' network 192.168.3.0 0.0.0.255 area 0',
          'end'
        ],
        expectedOutcome:
          'R3-WEST forms FULL adjacency with 2.2.2.2 and learns both 192.168.1.0/24 (O) and 0.0.0.0/0 (O*E2).'
      }
    ],
    verificationChecklist: [
      {
        command: 'show ip ospf neighbor',
        device: 'R2-EAST',
        whatToVerify: 'Confirm FULL neighbor states with both 1.1.1.1 (R1-HQ) and 3.3.3.3 (R3-WEST).'
      },
      {
        command: 'show ip route ospf',
        device: 'R3-WEST',
        whatToVerify: 'Verify O routes for 192.168.1.0/24, 192.168.2.0/24, and O*E2 0.0.0.0/0 default route.'
      }
    ]
  },
  {
    id: 'lab-07-dhcp-nat-pat',
    labNumber: 7,
    title: 'DHCPv4 Server & NAT/PAT Edge Translation',
    category: 'IP Services',
    difficulty: 'Intermediate',
    estimatedMinutes: 40,
    summary:
      'Automate internal LAN IP leasing with Cisco IOS DHCPv4 pools and translate RFC 1918 private addresses to a public WAN IP using Port Address Translation (PAT).',
    scenario:
      'Edge router R1-EDGE serves a 192.168.50.0/24 office LAN that requires dynamic IP leases (reserving .1–.20 for infrastructure) and outbound internet connectivity via a single public ISP interface IP (203.0.113.2/30) using PAT overload.',
    objectives: [
      'Reserve static infrastructure addresses with ip dhcp excluded-address.',
      'Build a DHCPv4 pool assigning gateway, DNS server, and lease duration.',
      'Mark inside and outside NAT boundaries on router interfaces.',
      'Configure dynamic PAT (NAT overload) matching internal LAN traffic via an ACL.'
    ],
    prerequisites: [
      'Understanding of RFC 1918 private addressing vs public routable IPv4.',
      'Basic familiarity with standard Access Control Lists.'
    ],
    topologySummary: 'Office LAN (192.168.50.0/24) ── [NAT Inside Gi0/0/1] R1-EDGE [NAT Outside Gi0/0/0: 203.0.113.2] ──▶ ISP',
    addressingTable: [
      {
        device: 'R1-EDGE',
        interfaceName: 'GigabitEthernet0/0/1',
        ipAddress: '192.168.50.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'ip nat inside · DHCP Gateway'
      },
      {
        device: 'R1-EDGE',
        interfaceName: 'GigabitEthernet0/0/0',
        ipAddress: '203.0.113.2',
        subnetMask: '255.255.255.252 (/30)',
        roleOrVlan: 'ip nat outside · Public PAT IP'
      }
    ],
    steps: [
      {
        id: 'lab7-step1',
        stepNumber: 1,
        title: 'Configure Excluded Addresses & Office DHCPv4 Pool',
        device: 'R1-EDGE',
        promptHint: 'R1-EDGE(dhcp-config)#',
        instructions:
          'Exclude 192.168.50.1–192.168.50.20 from dynamic assignment, then create DHCP pool OFFICE_LAN with default-router and DNS settings.',
        commands: [
          'configure terminal',
          'ip dhcp excluded-address 192.168.50.1 192.168.50.20',
          'ip dhcp pool OFFICE_LAN',
          ' network 192.168.50.0 255.255.255.0',
          ' default-router 192.168.50.1',
          ' dns-server 1.1.1.1 8.8.8.8',
          ' domain-name office.local',
          ' lease 1 0 0',
          'exit'
        ],
        expectedOutcome:
          'Workstations on the LAN dynamically receive leases starting at 192.168.50.21/24.'
      },
      {
        id: 'lab7-step2',
        stepNumber: 2,
        title: 'Tag NAT Inside & Outside Boundaries on Interfaces',
        device: 'R1-EDGE',
        promptHint: 'R1-EDGE(config-if)#',
        instructions:
          'Assign ip nat inside on the LAN gateway interface and ip nat outside on the public ISP uplink interface.',
        commands: [
          'interface GigabitEthernet0/0/1',
          ' ip nat inside',
          'interface GigabitEthernet0/0/0',
          ' ip nat outside',
          'exit'
        ],
        expectedOutcome:
          'NAT translation engine recognizes packets crossing from inside Gi0/0/1 to outside Gi0/0/0.'
      },
      {
        id: 'lab7-step3',
        stepNumber: 3,
        title: 'Define PAT Overload Rule with Standard ACL',
        device: 'R1-EDGE',
        promptHint: 'R1-EDGE(config)#',
        instructions:
          'Create standard ACL 10 matching 192.168.50.0/24 and bind it to interface GigabitEthernet0/0/0 using the overload keyword for PAT.',
        commands: [
          'access-list 10 permit 192.168.50.0 0.0.0.255',
          'ip nat inside source list 10 interface GigabitEthernet0/0/0 overload',
          'end',
          'copy running-config startup-config'
        ],
        expectedOutcome:
          'All inside hosts share 203.0.113.2 using unique translated source TCP/UDP port numbers.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show ip dhcp binding',
        device: 'R1-EDGE',
        whatToVerify: 'Confirm active client IP leases (192.168.50.21+) mapped to client MAC addresses.'
      },
      {
        command: 'show ip nat translations',
        device: 'R1-EDGE',
        whatToVerify: 'Verify Inside Local (192.168.50.x:port) translates to Inside Global (203.0.113.2:port).'
      },
      {
        command: 'show ip nat statistics',
        device: 'R1-EDGE',
        whatToVerify: 'Confirm Total active translations, Hits incrementing, and Misses remaining low.'
      }
    ]
  },
  {
    id: 'lab-08-extended-acls',
    labNumber: 8,
    title: 'Extended Access Control Lists & DMZ Filtering',
    category: 'Security & Access',
    difficulty: 'Advanced',
    estimatedMinutes: 50,
    summary:
      'Enforce least-privilege network segmentation using named Extended ACLs placed close to traffic sources to allow specific web/DNS flows while blocking lateral movement.',
    scenario:
      'Your enterprise router R1 separates the Internal Staff LAN (10.20.10.0/24), Guest Wi-Fi (10.20.90.0/24), and DMZ Web Server (172.16.100.10/24). You must allow Guest users internet HTTPS/DNS access while strictly blocking them from reaching Internal Staff hosts, and allow Staff SSH management to the DMZ.',
    objectives: [
      'Apply Cisco ACL placement rules (Extended ACLs closest to source; Standard ACLs closest to destination).',
      'Write granular named extended ACL rules specifying protocol, source, destination, and TCP/UDP port.',
      'Permit established/return flows or stateless return rules cleanly and log policy violations.',
      'Audit hit counters with show access-lists without disrupting active sessions.'
    ],
    prerequisites: [
      'TCP vs UDP port numbers (DNS 53, HTTP 80, HTTPS 443, SSH 22).',
      'Wildcard mask syntax and understanding of implicit deny any at the end of every ACL.'
    ],
    topologySummary: 'Staff LAN (10.20.10.0/24) + Guest Wi-Fi (10.20.90.0/24) ──▶ R1 ──▶ DMZ (172.16.100.0/24) & ISP',
    addressingTable: [
      {
        device: 'R1',
        interfaceName: 'Gi0/0/0 (Staff LAN)',
        ipAddress: '10.20.10.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Trusted Internal Subnet'
      },
      {
        device: 'R1',
        interfaceName: 'Gi0/0/1 (Guest Wi-Fi)',
        ipAddress: '10.20.90.1',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Untrusted Guest Subnet (ACL Inbound)'
      },
      {
        device: 'DMZ-WEB',
        interfaceName: 'eth0',
        ipAddress: '172.16.100.10',
        subnetMask: '255.255.255.0 (/24)',
        roleOrVlan: 'Public HTTPS Server'
      }
    ],
    steps: [
      {
        id: 'lab8-step1',
        stepNumber: 1,
        title: 'Create Named Extended ACL for Guest Wi-Fi Isolation',
        device: 'R1',
        promptHint: 'R1(config-ext-nacl)#',
        instructions:
          'Define a named extended ACL GUEST_FILTER_IN that explicitly denies Guest access to RFC 1918 internal subnets (Staff LAN and DMZ private admin), allows DNS/HTTP/HTTPS outbound, and logs denied attempts.',
        commands: [
          'configure terminal',
          'ip access-list extended GUEST_FILTER_IN',
          ' remark Block Guest lateral access to internal Staff LAN',
          ' deny ip 10.20.90.0 0.0.0.255 10.20.10.0 0.0.0.255 log',
          ' permit udp 10.20.90.0 0.0.0.255 any eq domain',
          ' permit tcp 10.20.90.0 0.0.0.255 any eq 80',
          ' permit tcp 10.20.90.0 0.0.0.255 any eq 443',
          ' permit icmp 10.20.90.0 0.0.0.255 any echo',
          ' deny ip any any log',
          'exit'
        ],
        expectedOutcome:
          'ACL GUEST_FILTER_IN blocks lateral RFC1918 traffic while permitting DNS and web browsing.'
      },
      {
        id: 'lab8-step2',
        stepNumber: 2,
        title: 'Bind Extended ACL Inbound Closest to Guest Source',
        device: 'R1',
        promptHint: 'R1(config-if)#',
        instructions:
          'Apply GUEST_FILTER_IN inbound on GigabitEthernet0/0/1 so blocked packets are dropped immediately before R1 performs routing lookups.',
        commands: [
          'interface GigabitEthernet0/0/1',
          ' ip access-group GUEST_FILTER_IN in',
          'exit'
        ],
        expectedOutcome:
          'Packets from Guest Wi-Fi destined to 10.20.10.0/24 are dropped at Gi0/0/1 and logged to syslog.'
      },
      {
        id: 'lab8-step3',
        stepNumber: 3,
        title: 'Restrict DMZ Server Management to Admin Staff via ACL',
        device: 'R1',
        promptHint: 'R1(config-ext-nacl)#',
        instructions:
          'Create DMZ_OUTBOUND_POLICY to allow any client to reach HTTPS (443) on DMZ-WEB (172.16.100.10), allow SSH (22) solely from Staff LAN 10.20.10.0/24, and block all other inbound DMZ traffic.',
        commands: [
          'ip access-list extended DMZ_OUTBOUND_POLICY',
          ' permit tcp any host 172.16.100.10 eq 443',
          ' permit tcp 10.20.10.0 0.0.0.255 host 172.16.100.10 eq 22',
          ' deny ip any host 172.16.100.10 log',
          ' permit ip any any',
          'interface GigabitEthernet0/0/2',
          ' ip access-group DMZ_OUTBOUND_POLICY out',
          'end',
          'copy running-config startup-config'
        ],
        expectedOutcome:
          'DMZ-WEB only accepts HTTPS publicly and SSH from Staff LAN.'
      }
    ],
    verificationChecklist: [
      {
        command: 'show access-lists',
        device: 'R1',
        whatToVerify: 'Check sequence numbers (10, 20, 30...) and verify (X matches) counters increment on permitted and denied rules.'
      },
      {
        command: 'show ip interface GigabitEthernet0/0/1',
        device: 'R1',
        whatToVerify: 'Confirm "Inbound access list is GUEST_FILTER_IN" is actively bound.'
      }
    ]
  }
];
