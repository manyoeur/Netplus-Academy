import { Course, CourseModule, QuizQuestion } from '../types';

export interface CheckpointQuizConfig {
  id: string;
  title: string;
  subtitle: string;
  passingScore: number;
  questions: QuizQuestion[];
}

const MODULE_CHECKPOINT_QUESTIONS: Record<string, { title: string; questions: QuizQuestion[] }> = {
  'mod-ccna-1': {
    title: 'IPv4 Addressing & Subnetting Check',
    questions: [
      {
        id: 'cp-ccna-1-q1',
        question: 'Using the Magic Number method, what is the block size (subnet increment) for a /27 prefix (255.255.255.224)?',
        options: ['16', '32', '64', '128'],
        correctAnswerIndex: 1,
        explanation: 'Subtract the interesting octet value from 256: 256 - 224 = 32. Subnets increment by 32 (0, 32, 64, 96, ...).'
      },
      {
        id: 'cp-ccna-1-q2',
        question: 'How many usable host IP addresses are available on a /30 point-to-point router link?',
        options: ['2 usable hosts', '4 usable hosts', '6 usable hosts', '14 usable hosts'],
        correctAnswerIndex: 0,
        explanation: 'A /30 leaves 2 host bits: 2^2 = 4 total addresses minus 2 (network and broadcast) leaves 2 usable host IPs.'
      },
      {
        id: 'cp-ccna-1-q3',
        question: 'Which two components are encoded inside every 32-bit IPv4 address?',
        options: [
          'MAC address and VLAN ID',
          'Network ID and Host ID',
          'AS Number and Port Number',
          'Default Gateway and DNS Resolver'
        ],
        correctAnswerIndex: 1,
        explanation: 'The subnet mask partitions an IPv4 address into the Network ID (identifying the broadcast domain) and the Host ID.'
      }
    ]
  },
  'mod-ccna-2': {
    title: 'Cisco IOS CLI Architecture Check',
    questions: [
      {
        id: 'cp-ccna-2-q1',
        question: 'Which Cisco IOS prompt indicates you are in Privileged EXEC mode with full operational show access?',
        options: ['Router>', 'Router#', 'Router(config)#', 'Router(config-if)#'],
        correctAnswerIndex: 1,
        explanation: 'Privileged EXEC mode displays the "#" prompt (Router#) and enables full inspection commands such as show run and copy run start.'
      },
      {
        id: 'cp-ccna-2-q2',
        question: 'In which IOS configuration mode do you assign an IP address, duplex, or shutdown state to a physical port?',
        options: [
          'User EXEC Mode (Router>)',
          'Global Configuration Mode (Router(config)#)',
          'Interface Configuration Mode (Router(config-if)#)',
          'Line VTY Mode (Router(config-line)#)'
        ],
        correctAnswerIndex: 2,
        explanation: 'Interface-specific parameters such as IP address, MTU, speed/duplex, and no shutdown are entered under Router(config-if)#.'
      },
      {
        id: 'cp-ccna-2-q3',
        question: 'Which command verifies the live running configuration while in Privileged EXEC mode?',
        options: ['show version', 'show running-config', 'configure terminal', 'ping 127.0.0.1'],
        correctAnswerIndex: 1,
        explanation: 'show running-config (or show run) displays the active configuration currently stored in RAM.'
      }
    ]
  },
  'mod-ccna-3': {
    title: 'Multi-Area OSPFv2 Lab Retention Check',
    questions: [
      {
        id: 'cp-ccna-3-q1',
        question: 'What is the correct wildcard mask to match the /30 subnet 10.0.0.0/30 in an OSPF network statement?',
        options: ['0.0.0.255', '0.0.0.3', '255.255.255.252', '0.0.0.1'],
        correctAnswerIndex: 1,
        explanation: 'Subtract 255.255.255.252 from 255.255.255.255 to get the wildcard mask 0.0.0.3.'
      },
      {
        id: 'cp-ccna-3-q2',
        question: 'Which OSPF area acts as the mandatory backbone transit area in a multi-area OSPF design?',
        options: ['Area 1', 'Area 10', 'Area 0', 'Area 255'],
        correctAnswerIndex: 2,
        explanation: 'Area 0 (the backbone area) must connect all non-backbone areas for inter-area LSA exchange.'
      },
      {
        id: 'cp-ccna-3-q3',
        question: 'Which verification command confirms whether R1 and R2 have reached the FULL OSPF neighbor state?',
        options: [
          'show ip route static',
          'show ip ospf neighbor',
          'show vlan brief',
          'show cdp interface'
        ],
        correctAnswerIndex: 1,
        explanation: 'show ip ospf neighbor lists each discovered neighbor Router ID, adjacency state (FULL/2-WAY), Dead Time, and interface.'
      }
    ]
  },
  'mod-sec-1': {
    title: 'Zero Trust & Perimeter Defense Check',
    questions: [
      {
        id: 'cp-sec-1-q1',
        question: 'What is the foundational rule of Zero Trust Network Architecture?',
        options: [
          'Trust all traffic originating inside the corporate LAN',
          'Never Trust, Always Verify regardless of network location',
          'Allow any user once authenticated at the perimeter VPN',
          'Disable internal firewall policies to reduce latency'
        ],
        correctAnswerIndex: 1,
        explanation: 'Zero Trust eliminates implicit trust based on physical or IP location—every flow is authenticated, authorized, and inspected.'
      },
      {
        id: 'cp-sec-1-q2',
        question: 'Why does microsegmentation matter inside an enterprise data center?',
        options: [
          'It increases Layer 2 broadcast domain size',
          'It limits lateral movement if a single workload is compromised',
          'It replaces TLS encryption with plaintext HTTP',
          'It eliminates the need for IP subnetting'
        ],
        correctAnswerIndex: 1,
        explanation: 'Microsegmentation isolates workloads with granular east-west policies so attackers cannot pivot laterally across servers.'
      },
      {
        id: 'cp-sec-1-q3',
        question: 'How does Defense-in-Depth strengthen enterprise security posture?',
        options: [
          'Relying on a single high-throughput edge firewall',
          'Layering independent network, identity, endpoint, and monitoring controls',
          'Exposing management ports directly to the public internet',
          'Replacing encryption with static ACLs only'
        ],
        correctAnswerIndex: 1,
        explanation: 'Defense-in-Depth combines overlapping safeguards so failure of any single control does not result in a full breach.'
      }
    ]
  }
};

const CATEGORY_FALLBACK_QUESTIONS: Record<Course['category'], QuizQuestion[]> = {
  'Enterprise Routing & Switching': [
    {
      id: 'fb-routing-1',
      question: 'Which protocol dynamically computes shortest-path trees inside an enterprise OSPF domain?',
      options: ['Bellman-Ford', 'Dijkstra SPF', 'Spanning Tree', 'ARP'],
      correctAnswerIndex: 1,
      explanation: 'OSPF is a link-state routing protocol that runs Dijkstra Shortest Path First (SPF) against the LSDB.'
    },
    {
      id: 'fb-routing-2',
      question: 'Which IEEE standard tags frames belonging to multiple VLANs across a single switch trunk link?',
      options: ['IEEE 802.1Q', 'IEEE 802.11ax', 'IEEE 802.3af', 'IEEE 802.1X'],
      correctAnswerIndex: 0,
      explanation: 'IEEE 802.1Q inserts a 4-byte VLAN tag header into Ethernet frames traversing trunk links.'
    }
  ],
  'Network Security & Firewalls': [
    {
      id: 'fb-sec-1',
      question: 'In an IPsec VPN, which phase negotiates the encrypted SA used to protect actual user data traffic?',
      options: ['IKE Phase 1', 'IKEv2 / IPsec Phase 2 (Quick / Child SA)', 'ARP Resolution', 'TCP Syn-Flood Mitigation'],
      correctAnswerIndex: 1,
      explanation: 'Phase 1 establishes the secure control channel (ISAKMP/IKE SA), and Phase 2 establishes the IPsec SA that encrypts user payloads.'
    },
    {
      id: 'fb-sec-2',
      question: 'Which encryption cipher provides both confidentiality and integrity authentication in modern IPsec suites?',
      options: ['DES-CBC', 'RC4', 'AES-256-GCM', 'ROT13'],
      correctAnswerIndex: 2,
      explanation: 'AES-GCM is an authenticated encryption (AEAD) cipher recommended for high-throughput IKEv2 IPsec tunnels.'
    }
  ],
  'Cloud & SD-WAN': [
    {
      id: 'fb-sdwan-1',
      question: 'In Cisco Catalyst SD-WAN, which component distributes routing, policy, and security keys across the control plane using OMP?',
      options: ['vEdge', 'vSmart', 'vManage', 'BGP Route Reflector only'],
      correctAnswerIndex: 1,
      explanation: 'vSmart controllers form DTLS/TLS control connections with edge routers and distribute OMP routes and policies.'
    },
    {
      id: 'fb-sdwan-2',
      question: 'What capability allows SD-WAN edge routers to route SaaS traffic locally out to the internet instead of backhauling to HQ?',
      options: ['Direct Internet Access (DIA)', 'Spanning Tree Root Guard', 'Private VLANs', 'Proxy ARP'],
      correctAnswerIndex: 0,
      explanation: 'Direct Internet Access (DIA) breaks out trusted cloud/SaaS flows locally at the branch to reduce latency and WAN congestion.'
    }
  ],
  'Packet Analysis & Forensics': [
    {
      id: 'fb-pcap-1',
      question: 'In Wireshark, which TCP flag sequence represents a healthy three-way handshake?',
      options: ['FIN -> ACK -> RST', 'SYN -> SYN, ACK -> ACK', 'PSH -> URG -> FIN', 'ACK -> SYN -> RST'],
      correctAnswerIndex: 1,
      explanation: 'A standard TCP connection initiates with SYN from client, SYN-ACK from server, and final ACK from client.'
    },
    {
      id: 'fb-pcap-2',
      question: 'What condition is indicated by consecutive TCP ZeroWindow frames in a packet capture?',
      options: [
        'DNS resolution succeeded immediately',
        'The receiving host buffer is full and cannot accept more incoming TCP bytes',
        'A router elected itself as OSPF DR',
        'TLS 1.3 key exchange finished'
      ],
      correctAnswerIndex: 1,
      explanation: 'TCP ZeroWindow signals that the receiver’s receive buffer has reached capacity and the sender must pause transmission.'
    }
  ],
  'Automation & NetDevOps': [
    {
      id: 'fb-auto-1',
      question: 'Why are idempotent automation playbooks essential when pushing changes to production routers?',
      options: [
        'They reboot devices on every run',
        'Running them repeatedly produces the same desired state without unintended drift',
        'They disable SSH and RESTCONF',
        'They require manual CLI copy-paste per device'
      ],
      correctAnswerIndex: 1,
      explanation: 'Idempotency guarantees that applying a playbook multiple times converges to the target configuration safely.'
    },
    {
      id: 'fb-auto-2',
      question: 'Which protocol pairs YANG data models with structured JSON/XML over HTTPS for network device automation?',
      options: ['Telnet', 'TFTP', 'RESTCONF', 'CDP'],
      correctAnswerIndex: 2,
      explanation: 'RESTCONF exposes YANG-modeled configuration and operational data via standard HTTP methods over TLS.'
    }
  ]
};

export function getBetweenModuleQuiz(
  course: Course,
  fromModule: CourseModule | undefined,
  toModule: CourseModule | undefined
): CheckpointQuizConfig | null {
  if (!fromModule || !toModule) return null;

  // Respect explicit removal at module or course level
  if (fromModule.disableCheckpoint === true) {
    return null;
  }
  if (course.disableRetentionChecks && fromModule.disableCheckpoint !== false) {
    return null;
  }

  // Avoid stacking a transition quiz immediately adjacent to a dedicated quiz module
  if (fromModule.type === 'quiz' || toModule.type === 'quiz') {
    return null;
  }

  if (fromModule.checkpointQuiz && fromModule.checkpointQuiz.questions.length > 0) {
    return {
      id: `${course.id}:${fromModule.id}->${toModule.id}`,
      title: fromModule.checkpointQuiz.title || `Retention Check: ${fromModule.title}`,
      subtitle: `Verify key concepts from "${fromModule.title}" before advancing to "${toModule.title}".`,
      passingScore: fromModule.checkpointQuiz.passingScore,
      questions: fromModule.checkpointQuiz.questions
    };
  }

  const mapped = MODULE_CHECKPOINT_QUESTIONS[fromModule.id];
  if (mapped) {
    return {
      id: `${course.id}:${fromModule.id}->${toModule.id}`,
      title: mapped.title,
      subtitle: `Verify retention of ${fromModule.title} before unlocking ${toModule.title}.`,
      passingScore: 67,
      questions: mapped.questions
    };
  }

  const fallback = CATEGORY_FALLBACK_QUESTIONS[course.category] || CATEGORY_FALLBACK_QUESTIONS['Enterprise Routing & Switching'];
  return {
    id: `${course.id}:${fromModule.id}->${toModule.id}`,
    title: `Knowledge Check · ${fromModule.title}`,
    subtitle: `Quick retention check before continuing to ${toModule.title}.`,
    passingScore: 50,
    questions: fallback.map((q, idx) => ({
      ...q,
      id: `${fromModule.id}-cp-${idx + 1}`
    }))
  };
}
