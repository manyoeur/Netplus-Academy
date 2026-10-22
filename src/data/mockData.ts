import { Course, User, ForumPost, StudentProgressRecord, LMSConfig, NotificationItem, RealtimeActivityItem } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-student-1',
    name: 'Alex Rivera',
    email: 'alex.rivera@student.netplus.io',
    role: 'student',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    subscription: {
      tier: 'pro',
      status: 'active',
      renewsAt: '2026-11-20T00:00:00Z',
    },
    enrolledCourseIds: ['course-ccna-1', 'course-sec-1'],
    completedModuleIds: ['mod-ccna-1', 'mod-ccna-2', 'mod-sec-1'],
    certificates: [
      {
        id: 'cert-net-8819',
        certificateNumber: 'NP-CCNA-2026-9921',
        courseId: 'course-ccna-1',
        courseTitle: 'Enterprise Routing, Switching & Network Fundamentals (CCNA)',
        studentId: 'user-student-1',
        studentName: 'Alex Rivera',
        studentEmail: 'alex.rivera@student.netplus.io',
        issueDate: '2026-10-15',
        instructorName: 'Dr. Marcus Vance, CCIE #49281',
        instructorTitle: 'Principal Networking Architect & Dean of Curriculum',
        verificationHash: 'sha256-e9b4d8120fa229c1589178ad30932ccf4',
        grade: '96% (Distinction)',
        skillsAcquired: [
          'OSPFv2 Multi-Area Routing',
          'VLAN Trunking & 802.1Q',
          'Spanning Tree Protocol (RSTP)',
          'IPv4/IPv6 Subnetting & CIDR',
          'Standard & Extended ACLs'
        ]
      }
    ],
    joinedDate: '2026-08-12',
    reputationPoints: 340
  },
  {
    id: 'user-instructor-1',
    name: 'Dr. Marcus Vance',
    email: 'marcus.vance@netplus.academy',
    role: 'instructor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    subscription: {
      tier: 'enterprise',
      status: 'active',
    },
    enrolledCourseIds: ['course-ccna-1', 'course-sec-1', 'course-sdwan-1', 'course-wireshark-1'],
    completedModuleIds: [],
    certificates: [],
    joinedDate: '2024-01-10',
    reputationPoints: 2150
  },
  {
    id: 'user-admin-1',
    name: 'Sarah Chen',
    email: 'sarah.chen@netplus.academy',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    subscription: {
      tier: 'enterprise',
      status: 'active',
    },
    enrolledCourseIds: [],
    completedModuleIds: [],
    certificates: [],
    joinedDate: '2023-05-01',
    reputationPoints: 5000
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course-ccna-1',
    code: 'CCNA-200-301',
    title: 'Enterprise Routing, Switching & Network Fundamentals',
    subtitle: 'Comprehensive preparation for Cisco CCNA certification with hands-on CLI labs and packet simulations.',
    category: 'Enterprise Routing & Switching',
    level: 'Intermediate',
    instructor: {
      name: 'Dr. Marcus Vance',
      title: 'CCIE Enterprise Infrastructure #49281',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    },
    rating: 4.95,
    reviewsCount: 1420,
    durationHours: 42,
    modulesCount: 5,
    enrolledCount: 3840,
    price: 149,
    bannerColor: 'from-blue-600 via-indigo-700 to-slate-900',
    badge: 'Best Seller',
    description: 'Master core networking concepts: IPv4/IPv6 addressing, subnetting, OSPF routing protocol, VLAN segmentation, Spanning Tree Protocol (802.1w), DHCP relay, and first-hop redundancy protocols (HSRP).',
    prerequisites: ['Basic computer hardware understanding', 'Familiarity with IP addresses'],
    learningOutcomes: [
      'Configure and troubleshoot multi-area OSPFv2 on Cisco routers',
      'Deploy VLANs, 802.1Q trunks, and Inter-VLAN routing (Router-on-a-stick / SVI)',
      'Calculate Variable Length Subnet Masks (VLSM) and summarize routing tables',
      'Implement Layer 2 security, Port-Security, and DHCP Snooping',
      'Analyze end-to-end packet flow through switches and routing hops'
    ],
    isPublished: true,
    updatedAt: '2026-10-18',
    modules: [
      {
        id: 'mod-ccna-1',
        title: 'Module 1: IPv4 Addressing, Subnetting & CIDR Mastery',
        type: 'theory',
        durationMin: 35,
        summary: 'Deep dive into IPv4 classes, binary math, subnet masks, slash notation, and calculating network/broadcast addresses.',
        contentMarkdown: `# Module 1: IPv4 Addressing & Subnetting Mechanics

### 1. The Anatomy of an IPv4 Address
An IPv4 address consists of **32 binary bits** partitioned into four 8-bit octets separated by decimals (dotted-decimal notation). Every IPv4 address contains two essential parts:
1. **Network ID**: Identifies the specific broadcast domain or logical network.
2. **Host ID**: Uniquely identifies a specific network interface card (NIC) within that network.

\`\`\`
Decimal: 192 . 168 . 1 . 10
Binary:  11000000.10101000.00000001.00001010
\`\`\`

### 2. Subnet Mask & Prefix Length (CIDR)
A subnet mask separates the network portion from the host portion using continuous 1s followed by continuous 0s:
- **/24 (255.255.255.0)**: 24 bits for network, 8 bits for host. Usable hosts: \`2^8 - 2 = 254\`
- **/26 (255.255.255.192)**: 26 bits for network, 6 bits for host. Usable hosts: \`2^6 - 2 = 62\`
- **/30 (255.255.255.252)**: 30 bits for network, 2 bits for host. Usable hosts: \`2^2 - 2 = 2\` (Point-to-point router links)

### 3. The "Magic Number" Method for Quick Subnetting
To quickly find subnets:
1. Look at the interesting octet (the one where the mask isn't 255 or 0).
2. Subtract the mask value from **256**. For example with \`/27\` (\`255.255.255.224\`):
   \`256 - 224 = 32\` (The block size/magic number).
3. The subnets increment by 32: \`0, 32, 64, 96, 128, 160, 192, 224\`.`
      },
      {
        id: 'mod-ccna-2',
        title: 'Module 2: Cisco IOS Command-Line Architecture & Initial Router Setup',
        type: 'video',
        durationMin: 45,
        summary: 'Hands-on breakdown of User EXEC, Privileged EXEC, and Global Configuration modes with Cisco Best Practices.',
        videoUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', // Placeholder or standard educational embed
        videoDuration: '18:40',
        contentMarkdown: `### Cisco IOS Command Hierarchy
- **User EXEC Mode** (\`Router>\`): Basic monitoring commands (\`ping\`, \`traceroute\`, limited \`show\`).
- **Privileged EXEC Mode** (\`Router#\`): Full operational status inspection (\`show run\`, \`debug\`, \`copy run start\`).
- **Global Configuration Mode** (\`Router(config)#\`): Device-wide system configuration.
- **Interface Configuration Mode** (\`Router(config-if)#\`): IP assignment, speed, duplex, MTU, shutdown toggles.`
      },
      {
        id: 'mod-ccna-3',
        title: 'Module 3: Hands-On Lab - Multi-Area OSPFv2 Adjacency & Area 0 Transit',
        type: 'lab',
        durationMin: 50,
        summary: 'Establish full OSPF neighbor adjacency between Core Router R1 and Branch Router R2 across a /30 WAN link.',
        lab: {
          objective: 'Configure OSPF Process 1 on R1 and R2, advertise interfaces into Area 0, and verify Full Neighbor Adjacency.',
          nodes: [
            { id: 'R1', name: 'R1-HQ-Core', type: 'router', ip: '10.0.0.1', subnet: '/30', status: 'online', x: 120, y: 140 },
            { id: 'R2', name: 'R2-Branch', type: 'router', ip: '10.0.0.2', subnet: '/30', status: 'online', x: 380, y: 140 },
            { id: 'SW1', name: 'SW-Access-01', type: 'switch', ip: '192.168.10.2', subnet: '/24', status: 'online', x: 120, y: 270 },
            { id: 'PC1', name: 'Workstation-A', type: 'pc', ip: '192.168.10.50', subnet: '/24', status: 'online', x: 120, y: 390 }
          ],
          links: [
            { from: 'R1', to: 'R2', interfaceFrom: 'Gig0/0/0', interfaceTo: 'Gig0/0/0', status: 'up' },
            { from: 'R1', to: 'SW1', interfaceFrom: 'Gig0/0/1', interfaceTo: 'Gig0/1', status: 'up' },
            { from: 'SW1', to: 'PC1', interfaceFrom: 'Fast0/1', interfaceTo: 'NIC', status: 'up' }
          ],
          initialConfigPrompt: 'R1-HQ-Core#',
          expectedCommands: [
            'configure terminal',
            'router ospf 1',
            'router-id 1.1.1.1',
            'network 10.0.0.0 0.0.0.3 area 0',
            'network 192.168.10.0 0.0.0.255 area 0'
          ],
          terminalHints: [
            'Type "configure terminal" to enter global configuration mode.',
            'Enter "router ospf 1" to start OSPF routing process 1.',
            'Assign router ID with "router-id 1.1.1.1".',
            'Advertise the point-to-point link: "network 10.0.0.0 0.0.0.3 area 0".'
          ],
          verificationCheck: 'show ip ospf neighbor'
        }
      },
      {
        id: 'mod-ccna-4',
        title: 'Module 4: Wireshark Deep-Dive - Dissecting OSPF Hello & DBD Packets',
        type: 'pcap',
        durationMin: 30,
        summary: 'Examine packet bytes, multicast destination 224.0.0.5, Dead Interval negotiations, and MTU fields in PCAP frames.',
        contentMarkdown: `### OSPF Packet Header Analysis
In this capture, observe the OSPF Header encapsulated directly in IP Protocol 89:
- **Multicast Destination**: \`224.0.0.5\` (AllSPFRouters)
- **Hello Timer**: 10 seconds (default on broadcast/point-to-point)
- **Dead Timer**: 40 seconds (4x Hello timer)
- **Area ID**: \`0.0.0.0\` (Backbone Area)
- **Authentication**: Null / Simple / MD5 cryptographic digest`
      },
      {
        id: 'mod-ccna-5',
        title: 'Module 5: Certification Benchmark Quiz - CCNA Knowledge Assessment',
        type: 'quiz',
        durationMin: 25,
        summary: 'Test your grasp of subnetting, switching loops, OSPF neighbor states, and ACL filtering.',
        quiz: {
          passingScore: 80,
          questions: [
            {
              id: 'q1',
              question: 'Which Cisco command correctly assigns a router-id to an OSPF process?',
              options: [
                'ip ospf router-id 1.1.1.1 under interface configuration',
                'router-id 1.1.1.1 under router ospf configuration mode',
                'set ospf id 1.1.1.1 under global configuration',
                'hostname 1.1.1.1'
              ],
              correctAnswerIndex: 1,
              explanation: 'In Cisco IOS, the router-id is designated inside the router ospf process: "R1(config-router)# router-id 1.1.1.1".'
            },
            {
              id: 'q2',
              question: 'How many usable host IP addresses are available in a /28 subnet?',
              options: ['16', '14', '30', '6'],
              correctAnswerIndex: 1,
              explanation: 'A /28 leaves 32 - 28 = 4 host bits. 2^4 = 16 total addresses minus 2 (network & broadcast) = 14 usable hosts.'
            },
            {
              id: 'q3',
              question: 'What is the default administrative distance of OSPF in Cisco IOS?',
              options: ['90', '100', '110', '120'],
              correctAnswerIndex: 2,
              explanation: 'OSPF administrative distance is 110. (Connected=0, Static=1, EIGRP internal=90, RIP=120, External BGP=20).'
            },
            {
              id: 'q4',
              question: 'Which protocol is used to prevent Layer 2 switching loops?',
              options: ['OSPF', 'BGP', 'Spanning Tree Protocol (STP / 802.1D / 802.1w)', 'ARP'],
              correctAnswerIndex: 2,
              explanation: 'Spanning Tree Protocol (STP) blocks redundant switch ports to eliminate bridge loops and broadcast storms.'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'course-sec-1',
    code: 'SEC-350-701',
    title: 'Network Security Engineering & Next-Gen Firewalls',
    subtitle: 'Zero Trust architecture, Next-Gen Firewalls (NGFW), IPsec/IKEv2 VPN tunnels, and threat prevention.',
    category: 'Network Security & Firewalls',
    level: 'Advanced',
    instructor: {
      name: 'Elena Rostova',
      title: 'Principal Security Architect, CISSP, CCIE Security',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
    },
    rating: 4.92,
    reviewsCount: 880,
    durationHours: 36,
    modulesCount: 4,
    enrolledCount: 2190,
    price: 189,
    bannerColor: 'from-emerald-700 via-teal-800 to-slate-900',
    badge: 'Popular',
    description: 'Learn modern network perimeter defense, stateful inspection, Deep Packet Inspection (DPI), site-to-site IPsec VPNs, SSL/TLS decryption, and hardening edge routers against DDoS attacks.',
    prerequisites: ['CCNA knowledge or equivalent', 'Understanding of TCP/IP handshakes'],
    learningOutcomes: [
      'Architect Zero Trust enterprise network segmentation policies',
      'Configure site-to-site IPsec IKEv2 tunnels with AES-256-GCM encryption',
      'Inspect and mitigate SYN floods, ARP spoofing, and rogue DHCP servers',
      'Deploy and audit stateful access control lists and zone-based firewalls'
    ],
    isPublished: true,
    updatedAt: '2026-10-14',
    modules: [
      {
        id: 'mod-sec-1',
        title: 'Module 1: Zero Trust Architecture & Defense-in-Depth',
        type: 'theory',
        durationMin: 40,
        summary: 'Core principles of "Never Trust, Always Verify", microsegmentation, and identity-driven network access control.'
      },
      {
        id: 'mod-sec-2',
        title: 'Module 2: Cisco ASA / Firepower Site-to-Site IPsec VPN Lab',
        type: 'lab',
        durationMin: 60,
        summary: 'Build an encrypted IKEv2 Phase 1 and Phase 2 IPsec tunnel between HQ Firewall and Remote DC.'
      }
    ]
  },
  {
    id: 'course-sdwan-1',
    code: 'CLOUD-NET-401',
    title: 'Hybrid Multi-Cloud Networking & SD-WAN Architecture',
    subtitle: 'Connecting AWS VPCs, Azure VNets, and branch locations with Cisco Catalyst SD-WAN and BGP EVPN.',
    category: 'Cloud & SD-WAN',
    level: 'Advanced',
    instructor: {
      name: 'Devin Kothari',
      title: 'Senior Cloud Network Architect',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    },
    rating: 4.88,
    reviewsCount: 650,
    durationHours: 32,
    modulesCount: 4,
    enrolledCount: 1670,
    price: 199,
    bannerColor: 'from-purple-700 via-violet-800 to-slate-900',
    badge: 'Trending',
    description: 'Design modern Software-Defined WAN fabrics using vManage, vSmart, and vEdge controllers. Implement dynamic path selection, Direct Internet Access (DIA), and cloud on-ramps.',
    prerequisites: ['BGP fundamentals', 'Enterprise routing knowledge'],
    learningOutcomes: [
      'Build overlay fabrics using Overlay Management Protocol (OMP)',
      'Configure SLA-based application path steering (voice vs data)',
      'Interconnect AWS Direct Connect and Azure ExpressRoute with on-prem data centers'
    ],
    isPublished: true,
    updatedAt: '2026-10-10',
    modules: [
      {
        id: 'mod-sdwan-1',
        title: 'Module 1: SD-WAN Control Plane, Data Plane & Orchestration Planes',
        type: 'theory',
        durationMin: 45,
        summary: 'Deconstructing vManage (management), vBond (orchestration), vSmart (control), and vEdge (forwarding).'
      }
    ]
  },
  {
    id: 'course-wireshark-1',
    code: 'WIRESHARK-101',
    title: 'Deep Packet Forensics & TCP/IP Protocol Analysis',
    subtitle: 'Master Wireshark capture filters, TCP flow graphing, window sizing, retransmissions, and malware traffic analysis.',
    category: 'Packet Analysis & Forensics',
    level: 'Intermediate',
    instructor: {
      name: 'Dr. Marcus Vance',
      title: 'CCIE #49281',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    },
    rating: 4.96,
    reviewsCount: 1890,
    durationHours: 24,
    modulesCount: 3,
    enrolledCount: 4210,
    price: 99,
    bannerColor: 'from-amber-600 via-orange-700 to-slate-900',
    badge: 'Staff Pick',
    description: 'Stop guessing what happens on your network wire. Learn to read raw hex dumps, TCP flag combinations, DNS tunneling, TLS 1.3 handshake negotiations, and diagnose latency bottlenecks.',
    prerequisites: ['Basic networking knowledge'],
    learningOutcomes: [
      'Master Wireshark display filters and complex logical expressions',
      'Diagnose TCP zero-window, packet loss, and duplicate ACKs',
      'Uncover stealthy port scans, DNS exfiltration, and cleartext credential leaks'
    ],
    isPublished: true,
    updatedAt: '2026-10-08',
    modules: [
      {
        id: 'mod-ws-1',
        title: 'Module 1: The Three-Way Handshake & TCP Sequence Mechanics',
        type: 'pcap',
        durationMin: 35,
        summary: 'SYN, SYN-ACK, ACK relative vs raw sequence number dissection and TCP window scaling.'
      }
    ]
  }
];

export const INITIAL_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    title: 'Why is my OSPF neighbor stuck in 2-WAY state on GigabitEthernet0/0?',
    content: `I'm configuring two Cisco Catalyst routers connected to an Ethernet switch. When I run 'show ip ospf neighbor', both routers show state '2-WAY/DROTHER'. Shouldn't it transition to FULL? What am I missing here?`,
    author: {
      name: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      role: 'student'
    },
    category: 'CCNA & Routing',
    tags: ['OSPF', 'NeighborAdjacency', 'CiscoIOS', 'CCNA'],
    upvotes: 18,
    upvotedByUser: false,
    repliesCount: 2,
    isResolved: true,
    createdAt: '2026-10-20T14:32:00Z',
    pinned: true,
    replies: [
      {
        id: 'rep-1',
        author: {
          name: 'Dr. Marcus Vance',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
          role: 'instructor'
        },
        content: `Great question Alex! On a broadcast multiaccess network (like Ethernet), OSPF elects a Designated Router (DR) and a Backup Designated Router (BDR).

Routers that are neither DR nor BDR are labeled **DROTHER**. Between two DROTHER routers, the neighbor state intentionally remains in **2-WAY/DROTHER**! They do NOT form FULL adjacency with each other to reduce LSA flooding overhead. They only form FULL adjacencies with the DR and BDR.

Check with:
\`\`\`cisco
show ip ospf neighbor
show ip ospf interface GigabitEthernet0/0
\`\`\`
If you have a DR on that subnet, your topology is functioning 100% as designed!`,
        codeSnippet: `Router# show ip ospf neighbor\nNeighbor ID     Pri   State           Dead Time   Address         Interface\n192.168.1.1       1   FULL/DR         00:00:36    192.168.1.1     Gig0/0\n192.168.1.3       0   2-WAY/DROTHER   00:00:33    192.168.1.3     Gig0/0`,
        createdAt: '2026-10-20T15:10:00Z',
        upvotes: 24,
        isAcceptedAnswer: true
      }
    ]
  },
  {
    id: 'post-2',
    title: 'Subnetting shortcut: Calculating /29 broadcast address in under 10 seconds?',
    content: `During my CCNA practice tests, I waste too much time converting to binary for /29 and /27 subnets. What is the fastest mental math trick for the exam?`,
    author: {
      name: 'Priya Sharma',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      role: 'student'
    },
    category: 'Subnetting & Addressing',
    tags: ['Subnetting', 'CIDR', 'ExamTips'],
    upvotes: 31,
    repliesCount: 3,
    isResolved: false,
    createdAt: '2026-10-19T09:15:00Z',
    replies: []
  },
  {
    id: 'post-3',
    title: 'Wireshark: How to quickly spot TCP retransmissions causing video buffer spikes?',
    content: `We are diagnosing an enterprise Zoom/Webex jitter issue. What display filter captures TCP dup acks and fast retransmissions without noise?`,
    author: {
      name: 'Carlos Mendez',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
      role: 'student'
    },
    category: 'Packet Analysis',
    tags: ['Wireshark', 'TCP', 'Troubleshooting'],
    upvotes: 14,
    repliesCount: 1,
    isResolved: true,
    createdAt: '2026-10-18T18:00:00Z',
    replies: []
  }
];

export const INITIAL_STUDENT_PROGRESS: StudentProgressRecord[] = [
  {
    studentId: 'user-student-1',
    studentName: 'Alex Rivera',
    studentEmail: 'alex.rivera@student.netpulse.io',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    courseId: 'course-ccna-1',
    courseCode: 'CCNA-200-301',
    courseTitle: 'Enterprise Routing, Switching & Network Fundamentals',
    progressPercent: 80,
    completedModulesCount: 4,
    totalModulesCount: 5,
    quizAverage: 94,
    lastActive: '12 minutes ago',
    status: 'active',
    timeSpentHours: 34.5
  },
  {
    studentId: 'user-student-2',
    studentName: 'Jordan Taylor',
    studentEmail: 'jordan.t@networkpro.dev',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
    courseId: 'course-ccna-1',
    courseCode: 'CCNA-200-301',
    courseTitle: 'Enterprise Routing, Switching & Network Fundamentals',
    progressPercent: 40,
    completedModulesCount: 2,
    totalModulesCount: 5,
    quizAverage: 82,
    lastActive: '3 hours ago',
    status: 'active',
    timeSpentHours: 16.2
  },
  {
    studentId: 'user-student-3',
    studentName: 'Maya Patel',
    studentEmail: 'maya.p@cybersec.org',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    courseId: 'course-sec-1',
    courseCode: 'SEC-350-701',
    courseTitle: 'Network Security Engineering & Next-Gen Firewalls',
    progressPercent: 100,
    completedModulesCount: 4,
    totalModulesCount: 4,
    quizAverage: 98,
    lastActive: '1 day ago',
    status: 'completed',
    timeSpentHours: 38.0
  },
  {
    studentId: 'user-student-4',
    studentName: 'Liam Chen',
    studentEmail: 'liam.chen@techglobal.net',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80',
    courseId: 'course-sdwan-1',
    courseCode: 'CLOUD-NET-401',
    courseTitle: 'Hybrid Multi-Cloud Networking & SD-WAN Architecture',
    progressPercent: 25,
    completedModulesCount: 1,
    totalModulesCount: 4,
    quizAverage: 71,
    lastActive: '5 days ago',
    status: 'behind',
    timeSpentHours: 8.5
  }
];

export const INITIAL_REALTIME_ACTIVITY: RealtimeActivityItem[] = [
  {
    id: 'act-1',
    studentName: 'Alex Rivera',
    action: 'finished_lab',
    target: 'Multi-Area OSPFv2 Adjacency Lab',
    timestamp: 'Just now',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'act-2',
    studentName: 'Maya Patel',
    action: 'earned_certificate',
    target: 'Network Security Engineering',
    timestamp: '4 minutes ago',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'act-3',
    studentName: 'Liam Chen',
    action: 'passed_quiz',
    target: 'CIDR & VLSM Assessment (Score: 92%)',
    timestamp: '18 minutes ago',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'act-4',
    studentName: 'Samantha Wu',
    action: 'enrolled',
    target: 'Deep Packet Forensics & TCP/IP Protocol Analysis',
    timestamp: '32 minutes ago',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80'
  }
];

export const INITIAL_LMS_CONFIGS: LMSConfig[] = [
  {
    provider: 'canvas',
    name: 'Canvas LMS (Instructure)',
    connected: true,
    endpointUrl: 'https://canvas.institution.edu/api/v1',
    clientId: 'canvas_client_9941a87e02',
    apiKey: 'np_live_sec_78941bb2f54a88',
    lastSync: '2026-10-21 19:40 UTC',
    syncedStudentsCount: 1420,
    syncGradesAuto: true,
    syncEnrollmentsAuto: true
  },
  {
    provider: 'blackboard',
    name: 'Blackboard Learn Ultra',
    connected: true,
    endpointUrl: 'https://blackboard.netpulse.edu/learn/api/public/v1',
    clientId: 'bb_prod_551094',
    apiKey: 'np_bb_token_e8a201f9c31',
    lastSync: '2026-10-21 16:15 UTC',
    syncedStudentsCount: 890,
    syncGradesAuto: true,
    syncEnrollmentsAuto: false
  },
  {
    provider: 'moodle',
    name: 'Moodle Workplace 4.3',
    connected: false,
    endpointUrl: 'https://moodle.enterprise.org/webservice/rest/server.php',
    clientId: '',
    apiKey: '',
    lastSync: 'Never',
    syncedStudentsCount: 0,
    syncGradesAuto: false,
    syncEnrollmentsAuto: false
  },
  {
    provider: 'google_classroom',
    name: 'Google Classroom Enterprise',
    connected: true,
    endpointUrl: 'https://classroom.googleapis.com/v1',
    clientId: 'classroom-oauth-netpulse.apps.googleusercontent.com',
    apiKey: 'oauth_bearer_active_scoped',
    lastSync: '2026-10-21 20:05 UTC',
    syncedStudentsCount: 640,
    syncGradesAuto: true,
    syncEnrollmentsAuto: true
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Certificate Issued: CCNA Enterprise Fundamentals',
    message: 'Congratulations Alex! Your verified certificate #NP-CCNA-2026-9921 has been generated and signed by Dr. Vance.',
    type: 'certificate',
    timestamp: '2 hours ago',
    read: false,
    emailSent: true,
    emailPreview: {
      subject: '🎓 Your Netplus Official Certificate is Ready to Download',
      to: 'alex.rivera@student.netplus.io',
      bodyHtml: `<div style="font-family:sans-serif;padding:20px;color:#1e293b;">
        <h2 style="color:#2563eb;">Netplus Academy Certificate of Achievement</h2>
        <p>Dear <strong>Alex Rivera</strong>,</p>
        <p>You have successfully completed <strong>Enterprise Routing, Switching & Network Fundamentals (CCNA)</strong> with a final score of <strong>96% (Distinction)</strong>.</p>
        <p>Certificate Serial: <code>NP-CCNA-2026-9921</code><br>Cryptographic Hash: <code>sha256-e9b4d8120fa229c1589178ad30932ccf4</code></p>
        <p><a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">View & Download Certificate</a></p>
      </div>`
    }
  },
  {
    id: 'notif-2',
    title: 'New Cisco IOS Packet Tracer Sandbox Online',
    message: 'Dr. Marcus Vance published an interactive multi-area OSPF lab module with instant CLI validation.',
    type: 'course',
    timestamp: '5 hours ago',
    read: false,
    emailSent: true,
    emailPreview: {
      subject: '🚀 New Lab Released: Multi-Area OSPFv2 Adjacency',
      to: 'alex.rivera@student.netplus.io',
      bodyHtml: `<div style="font-family:sans-serif;padding:20px;color:#1e293b;">
        <h2>New Course Module Available</h2>
        <p>Jump into the interactive CLI terminal and configure OSPF Process 1 between HQ Core and Branch Routers.</p>
      </div>`
    }
  },
  {
    id: 'notif-3',
    title: 'Pro Subscription Renewal Processed',
    message: 'Your Netplus Pro subscription has been renewed ($29/mo). Receipt #INV-889104 is available in Billing.',
    type: 'billing',
    timestamp: '1 day ago',
    read: true,
    emailSent: true,
    emailPreview: {
      subject: '🧾 Netplus Academy - Invoice #INV-889104',
      to: 'alex.rivera@student.netplus.io',
      bodyHtml: `<p>Payment of $29.00 USD processed successfully via card ending in 4242.</p>`
    }
  }
];
