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
      },
      {
        id: 'cp-ccna-1-q4',
        question: 'What is the broadcast address for the subnet 192.168.10.64/26?',
        options: ['192.168.10.95', '192.168.10.127', '192.168.10.128', '192.168.10.255'],
        correctAnswerIndex: 1,
        explanation: 'A /26 mask has a block size of 64 (256 - 192 = 64). Starting at .64, the next subnet is .128, making .127 the broadcast address.'
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
      },
      {
        id: 'cp-ccna-2-q4',
        question: 'Which command saves active RAM changes to NVRAM so they persist across a router reboot?',
        options: [
          'write erase',
          'copy running-config startup-config',
          'reload in 5',
          'no shutdown'
        ],
        correctAnswerIndex: 1,
        explanation: 'copy running-config startup-config (or write memory) writes the active configuration from volatile RAM into non-volatile NVRAM.'
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
  'mod-ccna-4': {
    title: 'Wireshark OSPF Packet Dissection Check',
    questions: [
      {
        id: 'cp-ccna-4-q1',
        question: 'Which multicast IPv4 address do OSPFv2 routers use to send Hello packets to all OSPF speakers on a link?',
        options: ['224.0.0.1', '224.0.0.5', '224.0.0.9', '224.0.0.10'],
        correctAnswerIndex: 1,
        explanation: 'OSPFv2 sends Hello packets to AllSPFRouters multicast address 224.0.0.5 (and uses 224.0.0.6 for AllDRouters).'
      },
      {
        id: 'cp-ccna-4-q2',
        question: 'Which IP protocol number carries OSPFv2 packets directly inside the IPv4 header?',
        options: ['TCP 179', 'UDP 520', 'IP Protocol 89', 'IP Protocol 47'],
        correctAnswerIndex: 2,
        explanation: 'OSPF runs directly over IP using IP Protocol number 89 rather than TCP or UDP.'
      },
      {
        id: 'cp-ccna-4-q3',
        question: 'What are the default OSPFv2 Hello and Dead timers on a standard broadcast Ethernet interface?',
        options: [
          'Hello 5s / Dead 15s',
          'Hello 10s / Dead 40s',
          'Hello 30s / Dead 120s',
          'Hello 60s / Dead 180s'
        ],
        correctAnswerIndex: 1,
        explanation: 'On broadcast and point-to-point links, OSPF defaults to a 10-second Hello interval and 40-second Dead interval (4x Hello).'
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
  },
  'mod-sec-2': {
    title: 'Site-to-Site IPsec VPN Lab Check',
    questions: [
      {
        id: 'cp-sec-2-q1',
        question: 'Which UDP ports are used to establish an IKEv2 Security Association, including NAT-Traversal?',
        options: [
          'TCP 22 and TCP 443',
          'UDP 500 and UDP 4500',
          'UDP 161 and UDP 162',
          'TCP 179 and UDP 520'
        ],
        correctAnswerIndex: 1,
        explanation: 'IKEv2 negotiates Phase 1 over UDP 500 and switches to UDP 4500 when NAT-Traversal (NAT-T) is detected.'
      },
      {
        id: 'cp-sec-2-q2',
        question: 'Which IKEv2 transform option provides both confidentiality and integrity verification in a single AEAD cipher?',
        options: ['DES-CBC', 'AES-256-GCM', 'MD5-HMAC only', 'Telnet Cleartext'],
        correctAnswerIndex: 1,
        explanation: 'AES-GCM is an Authenticated Encryption with Associated Data (AEAD) cipher suite providing encryption and integrity together.'
      },
      {
        id: 'cp-sec-2-q3',
        question: 'What happens if the crypto ACL (interesting traffic) differs between HQ and Remote DC peers?',
        options: [
          'Phase 1 succeeds and traffic flows anyway',
          'Phase 2 Child SA negotiation fails due to proxy ID mismatch',
          'The firewall automatically rewrites both subnet masks',
          'OSPF redistributes the tunnel without encryption'
        ],
        correctAnswerIndex: 1,
        explanation: 'Policy-based IPsec peers must mirror each other’s interesting traffic proxy IDs; mismatches block Phase 2 SA setup.'
      }
    ]
  },
  'mod-ccnp-1': {
    title: 'BGP Best Path Selection Check',
    questions: [
      {
        id: 'cp-ccnp-1-q1',
        question: 'In Cisco BGP best-path selection, which attribute is evaluated first among valid routes?',
        options: ['MED', 'Shortest AS_PATH', 'Highest Weight', 'Lowest Router ID'],
        correctAnswerIndex: 2,
        explanation: 'Cisco IOS evaluates highest Weight first (proprietary and local to the router), followed by highest Local Preference.'
      },
      {
        id: 'cp-ccnp-1-q2',
        question: 'Which BGP attribute is local to a single router and never advertised to iBGP or eBGP peers?',
        options: ['Local Preference', 'Weight', 'AS_PATH', 'Origin'],
        correctAnswerIndex: 1,
        explanation: 'Weight is Cisco-proprietary and strictly local to the router where it is configured.'
      },
      {
        id: 'cp-ccnp-1-q3',
        question: 'How does an operator make an AS path appear less desirable to inbound traffic from a backup ISP?',
        options: [
          'Set Weight to 65535 on the backup link',
          'Use AS_PATH prepending on outbound route advertisements',
          'Disable BGP keepalives',
          'Lower the interface MTU to 576'
        ],
        correctAnswerIndex: 1,
        explanation: 'Prepending your own AS number multiple times lengthens the AS_PATH attribute, discouraging external peers from choosing that path.'
      }
    ]
  },
  'mod-ccnp-2': {
    title: 'VRF-Lite Segmentation Check',
    questions: [
      {
        id: 'cp-ccnp-2-q1',
        question: 'What is the primary purpose of VRF-Lite on a campus distribution router?',
        options: [
          'Combining all tenant routes into a single global RIB',
          'Virtualizing independent routing and forwarding tables on a single physical router',
          'Replacing 802.1Q VLAN tags with ARP broadcasts',
          'Accelerating Spanning Tree convergence'
        ],
        correctAnswerIndex: 1,
        explanation: 'VRF-Lite isolates separate routing tables (RIB/FIB) per tenant or security zone without requiring MPLS.'
      },
      {
        id: 'cp-ccnp-2-q2',
        question: 'Which Cisco IOS command displays the routing table specifically for the VRF named CORP-FINANCE?',
        options: [
          'show ip route',
          'show ip route vrf CORP-FINANCE',
          'show vrf interface global',
          'show ip ospf database'
        ],
        correctAnswerIndex: 1,
        explanation: 'Appending "vrf <NAME>" scopes show and ping commands to that virtual routing instance.'
      },
      {
        id: 'cp-ccnp-2-q3',
        question: 'What happens to an interface’s existing IPv4 address when you bind it to a VRF with `ip vrf forwarding`?',
        options: [
          'It stays unchanged in the global table',
          'Cisco IOS removes the IP address so it must be reapplied inside the VRF',
          'It converts automatically to IPv6',
          'The port enters err-disabled state'
        ],
        correctAnswerIndex: 1,
        explanation: 'Assigning an interface to a VRF clears its previous IP address for safety, requiring re-entry of the `ip address` command.'
      },
      {
        id: 'cp-ccnp-2-q4',
        question: 'How do you test reachability to 10.20.20.1 strictly from inside the CORP-FINANCE VRF routing table?',
        options: [
          'ping 10.20.20.1',
          'ping vrf CORP-FINANCE 10.20.20.1',
          'traceroute global 10.20.20.1',
          'show cdp neighbors CORP-FINANCE'
        ],
        correctAnswerIndex: 1,
        explanation: 'Using `ping vrf <VRF_NAME> <target>` instructs IOS to source and route the ICMP echo using that VRF’s isolated RIB.'
      }
    ]
  },
  'mod-ccnp-3': {
    title: 'eBGP Peering & Route Manipulation Check',
    questions: [
      {
        id: 'cp-ccnp-3-q1',
        question: 'What distinguishes an eBGP peering session from an iBGP peering session?',
        options: [
          'eBGP peers share the same AS number; iBGP peers use different AS numbers',
          'eBGP peers reside in different Autonomous Systems; iBGP peers share the same AS',
          'eBGP uses UDP 520 while iBGP uses TCP 179',
          'iBGP does not require IP reachability'
        ],
        correctAnswerIndex: 1,
        explanation: 'External BGP (eBGP) connects different Autonomous Systems, whereas Internal BGP (iBGP) peers share the same AS number.'
      },
      {
        id: 'cp-ccnp-3-q2',
        question: 'Which IOS verification command provides a quick one-line-per-peer overview of BGP state and received prefixes?',
        options: [
          'show ip bgp summary',
          'show ip interface brief',
          'show arp',
          'show standby brief'
        ],
        correctAnswerIndex: 0,
        explanation: 'show ip bgp summary displays neighbor IPs, AS numbers, uptime, session state, and prefix counts.'
      },
      {
        id: 'cp-ccnp-3-q3',
        question: 'When applying a route-map to adjust Local Preference for outbound traffic steering, in which direction is it applied on an eBGP neighbor?',
        options: ['out', 'in', 'both', 'passive'],
        correctAnswerIndex: 1,
        explanation: 'To influence outbound traffic toward routes learned from an ISP, modify Local Preference inbound (`neighbor ... route-map ... in`) as prefixes arrive.'
      }
    ]
  },
  'mod-sdwan-1': {
    title: 'SD-WAN Fabric Planes Check',
    questions: [
      {
        id: 'cp-sdwan-1-q1',
        question: 'Which Cisco Catalyst SD-WAN component acts as the orchestrator responsible for initial authentication and NAT discovery?',
        options: ['vManage', 'vSmart', 'vBond', 'vEdge'],
        correctAnswerIndex: 2,
        explanation: 'vBond orchestrates initial onboarding, authenticates WAN edge devices, and informs them of vSmart and vManage addresses.'
      },
      {
        id: 'cp-sdwan-1-q2',
        question: 'Which SD-WAN plane provides the centralized GUI, templates, and software lifecycle management?',
        options: ['Data Plane (vEdge)', 'Control Plane (vSmart)', 'Management Plane (vManage)', 'Orchestration Plane (vBond)'],
        correctAnswerIndex: 2,
        explanation: 'vManage is the single-pane-of-glass management plane for configuration templates, monitoring, and policy authoring.'
      },
      {
        id: 'cp-sdwan-1-q3',
        question: 'Does user data traffic pass through vSmart controllers in a healthy SD-WAN fabric?',
        options: [
          'Yes, all branch traffic hairpins through vSmart',
          'No, vSmart handles only the control plane while vEdge/cEdge routers forward data directly',
          'Only ICMP traffic passes through vSmart',
          'Only encrypted IPsec payloads pass through vBond'
        ],
        correctAnswerIndex: 1,
        explanation: 'SD-WAN separates control and data planes: edge routers form direct IPsec tunnels for data traffic while vSmart handles control-plane OMP.'
      }
    ]
  },
  'mod-sdwan-2': {
    title: 'OMP & TLOC Routing Check',
    questions: [
      {
        id: 'cp-sdwan-2-q1',
        question: 'Which three route types are advertised inside Cisco SD-WAN Overlay Management Protocol (OMP)?',
        options: [
          'Static, RIP, and EIGRP routes',
          'OMP (vRoutes), TLOC routes, and Service routes',
          'ARP, RARP, and DHCP leases',
          'BGP MED, Weight, and Local Pref only'
        ],
        correctAnswerIndex: 1,
        explanation: 'OMP carries reachable service-side prefixes (vRoutes), transport locator endpoints (TLOCs), and inserted network services.'
      },
      {
        id: 'cp-sdwan-2-q2',
        question: 'Which three attributes uniquely identify a TLOC (Transport Locator) in SD-WAN?',
        options: [
          'VLAN ID, MAC Address, Port Speed',
          'System IP, Color, and Encapsulation',
          'Area ID, Wildcard Mask, Router Priority',
          'Hostname, Domain Name, DNS Server'
        ],
        correctAnswerIndex: 1,
        explanation: 'A TLOC is defined by the tuple (System IP, Link Color such as mpls/biz-internet, Encapsulation such as ipsec/gre).'
      },
      {
        id: 'cp-sdwan-2-q3',
        question: 'Which protocol continuously measures loss, latency, and jitter across SD-WAN IPsec data tunnels?',
        options: ['CDP', 'BFD (Bidirectional Forwarding Detection)', 'SNMPv2', 'TFTP'],
        correctAnswerIndex: 1,
        explanation: 'BFD probes run continuously inside SD-WAN data tunnels to detect brownouts, SLA violations, and path failures within milliseconds.'
      },
      {
        id: 'cp-sdwan-2-q4',
        question: 'If two OMP routes have equal administrative distance and origin, which OMP attribute breaks ties first in Cisco SD-WAN?',
        options: ['Highest OMP Preference', 'Lowest Interface Bandwidth', 'Oldest DHCP Lease', 'Highest MAC Address'],
        correctAnswerIndex: 0,
        explanation: 'After validity and administrative distance checks, OMP selects the route with the highest OMP Preference value before evaluating origin/TLOC metrics.'
      }
    ]
  },
  'mod-ws-1': {
    title: 'TCP Three-Way Handshake & Sequence Check',
    questions: [
      {
        id: 'cp-ws-1-q1',
        question: 'In a healthy TCP connection setup, what is the exact sequence of TCP flags exchanged?',
        options: ['FIN -> ACK -> RST', 'SYN -> SYN, ACK -> ACK', 'PSH -> URG -> ACK', 'SYN -> RST -> ACK'],
        correctAnswerIndex: 1,
        explanation: 'The client sends SYN, the server replies with SYN+ACK, and the client completes the handshake with ACK.'
      },
      {
        id: 'cp-ws-1-q2',
        question: 'Why does Wireshark default to displaying "Relative" sequence numbers starting at 0?',
        options: [
          'TCP always starts every session at raw ISN 0 on the wire',
          'It makes tracking byte offsets within a single TCP stream much easier for analysts',
          'Raw sequence numbers are encrypted by IPv4',
          'Relative numbers hide packet loss'
        ],
        correctAnswerIndex: 1,
        explanation: 'TCP uses random 32-bit Initial Sequence Numbers (ISN) on the wire; Wireshark normalizes them to 0+ for readability.'
      },
      {
        id: 'cp-ws-1-q3',
        question: 'When is the TCP Window Scale option negotiated between two endpoints?',
        options: [
          'During the FIN teardown packets',
          'Inside the SYN and SYN-ACK packets during connection setup',
          'Only after a TCP ZeroWindow occurs',
          'Via ICMP Type 8 Echo Requests'
        ],
        correctAnswerIndex: 1,
        explanation: 'Window Scale is negotiated strictly in the SYN and SYN-ACK headers to allow receive windows larger than 64 KB.'
      }
    ]
  },
  'mod-ws-2': {
    title: 'Wireshark Display Filter & Triage Check',
    questions: [
      {
        id: 'cp-ws-2-q1',
        question: 'Which Wireshark display filter isolates TCP retransmissions, duplicate ACKs, and zero-window anomalies?',
        options: ['ip.addr == 0.0.0.0', 'tcp.analysis.flags', 'eth.type == 0x0806', 'http.request'],
        correctAnswerIndex: 1,
        explanation: 'tcp.analysis.flags matches Wireshark’s expert TCP analysis flags including retransmissions, fast retransmissions, and window stalls.'
      },
      {
        id: 'cp-ws-2-q2',
        question: 'What does `dns.flags.rcode != 0` help an analyst detect quickly in a capture?',
        options: [
          'Successful TLS 1.3 key exchanges',
          'Failed DNS lookups such as NXDOMAIN (3) or SERVFAIL (2)',
          'OSPF LSA floods',
          'VLAN trunk mismatches'
        ],
        correctAnswerIndex: 1,
        explanation: 'A DNS response code (rcode) of 0 means NOERROR; non-zero codes highlight resolution failures or potential DNS tunneling probes.'
      },
      {
        id: 'cp-ws-2-q3',
        question: 'What is the fundamental difference between a Wireshark Capture Filter and a Display Filter?',
        options: [
          'Capture filters use BPF syntax and drop non-matching frames before saving; display filters only hide frames in the UI',
          'Display filters permanently delete packets from disk',
          'Capture filters only work on IPv6 traffic',
          'There is no syntax difference between them'
        ],
        correctAnswerIndex: 0,
        explanation: 'Capture filters (BPF) limit what libpcap writes to memory/disk, whereas display filters filter an already captured trace non-destructively.'
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
    },
    {
      id: 'fb-routing-3',
      question: 'Which Cisco IOS command provides an immediate summary of interface IP addresses and Layer 1/Layer 2 up/down status?',
      options: ['show ip interface brief', 'show version', 'show arp', 'show vlan id 1'],
      correctAnswerIndex: 0,
      explanation: 'show ip interface brief summarizes every interface’s IP address, physical status, and line protocol state in one table.'
    },
    {
      id: 'fb-routing-4',
      question: 'Which protocol prevents Layer 2 switching loops by placing redundant switch links into a blocking state?',
      options: ['DHCP', 'Rapid Spanning Tree Protocol (802.1w)', 'SNMPv3', 'BGP'],
      correctAnswerIndex: 1,
      explanation: 'RSTP (802.1w) elects a Root Bridge and blocks redundant forwarding paths to prevent broadcast storms and MAC table instability.'
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
    },
    {
      id: 'fb-sec-3',
      question: 'What is the default action at the end of any Cisco Access Control List when a packet matches no prior rules?',
      options: ['Permit any', 'Implicit deny any', 'Forward to default gateway', 'Enable NAT overload'],
      correctAnswerIndex: 1,
      explanation: 'Every Cisco ACL appends an invisible implicit deny any statement at the bottom.'
    },
    {
      id: 'fb-sec-4',
      question: 'Which stateful firewall inspection behavior allows legitimate return traffic back through an untrusted interface?',
      options: [
        'Dynamic session state tracking',
        'Disabling reverse path forwarding',
        'Converting TCP packets to UDP',
        'Static ARP poisoning'
      ],
      correctAnswerIndex: 0,
      explanation: 'Stateful firewalls maintain a connection state table so return packets matching an active outbound flow are permitted dynamically.'
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
    },
    {
      id: 'fb-sdwan-3',
      question: 'Which mechanism allows SD-WAN policies to shift voice traffic off a degraded MPLS link automatically?',
      options: ['Application-Aware Routing with BFD SLA probes', 'Static default routes only', 'Port security sticky MAC', 'Disabling NAT'],
      correctAnswerIndex: 0,
      explanation: 'Application-Aware Routing monitors BFD loss, latency, and jitter metrics to steer SLA-sensitive traffic across healthy transports.'
    },
    {
      id: 'fb-sdwan-4',
      question: 'Which cloud interconnect service provides dedicated private Layer 2/Layer 3 connectivity directly into AWS VPCs?',
      options: ['AWS Direct Connect', 'Amazon S3 Glacier', 'AWS CloudTrail', 'Route 53 Public DNS'],
      correctAnswerIndex: 0,
      explanation: 'AWS Direct Connect establishes a dedicated private physical link between an on-premises network or colocation facility and AWS.'
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
    },
    {
      id: 'fb-pcap-3',
      question: 'Which Wireshark display filter isolates all traffic involving IP host 10.0.0.1 regardless of direction?',
      options: ['ip.addr == 10.0.0.1', 'ip.src != 10.0.0.1', 'tcp.port == 10', 'arp.opcode == 1'],
      correctAnswerIndex: 0,
      explanation: 'ip.addr == 10.0.0.1 matches packets where 10.0.0.1 appears as either source or destination.'
    },
    {
      id: 'fb-pcap-4',
      question: 'Which Wireshark display filter isolates DNS queries that returned a domain-not-found (NXDOMAIN) error?',
      options: ['dns.flags.rcode == 3', 'tcp.port == 53 && tcp.flags.syn == 1', 'http.response.code == 200', 'icmp.type == 8'],
      correctAnswerIndex: 0,
      explanation: 'DNS response code (rcode) 3 corresponds to NXDOMAIN (Non-Existent Domain).'
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
    },
    {
      id: 'fb-auto-3',
      question: 'Which HTTP method in RESTCONF is typically used to retrieve operational state or configuration data without modifying the device?',
      options: ['POST', 'GET', 'DELETE', 'PATCH'],
      correctAnswerIndex: 1,
      explanation: 'GET performs a safe, read-only query of YANG-modeled configuration or operational data.'
    },
    {
      id: 'fb-auto-4',
      question: 'Which protocol runs over SSH (port 830) and supports candidate datastores with atomic commit and rollback operations?',
      options: ['SNMPv1', 'NETCONF', 'TFTP', 'Syslog'],
      correctAnswerIndex: 1,
      explanation: 'NETCONF uses RPCs over SSH (TCP 830) and provides running/candidate/startup datastores with validated commits and rollback.'
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
    passingScore: 67,
    questions: fallback.map((q, idx) => ({
      ...q,
      id: `${fromModule.id}-cp-${idx + 1}`
    }))
  };
}

/**
 * Resolves a multiple-choice quiz for ANY module in Quiz Mode (including dedicated quiz modules
 * and the final module of a course), sharing canonical storage keys with between-module checkpoints
 * so scores stay synchronized across Study Mode and Quiz Mode.
 */
export function getModuleQuiz(
  course: Course,
  module: CourseModule | undefined,
  moduleIndex: number
): CheckpointQuizConfig | null {
  if (!module) return null;

  const defaultPass = course.gradingCriteria?.quizPassingScore ?? 70;

  if (module.type === 'quiz' && module.quiz && module.quiz.questions.length > 0) {
    return {
      id: `module:${module.id}`,
      title: module.title,
      subtitle: module.summary || `Complete this graded assessment for ${course.code}.`,
      passingScore: module.quiz.passingScore || defaultPass,
      questions: module.quiz.questions
    };
  }

  const nextModule =
    moduleIndex >= 0 && moduleIndex < course.modules.length - 1
      ? course.modules[moduleIndex + 1]
      : undefined;

  const sharedBetweenId =
    nextModule && !course.disableRetentionChecks && module.disableCheckpoint !== true && nextModule.type !== 'quiz'
      ? `${course.id}:${module.id}->${nextModule.id}`
      : `module-quiz:${course.id}:${module.id}`;

  if (module.checkpointQuiz && module.checkpointQuiz.questions.length > 0) {
    return {
      id: sharedBetweenId,
      title: module.checkpointQuiz.title || `Module ${moduleIndex + 1} Quiz · ${module.title}`,
      subtitle: `Test your mastery of ${module.title} with ${module.checkpointQuiz.questions.length} multiple-choice questions.`,
      passingScore: module.checkpointQuiz.passingScore || defaultPass,
      questions: module.checkpointQuiz.questions
    };
  }

  const mapped = MODULE_CHECKPOINT_QUESTIONS[module.id];
  if (mapped) {
    return {
      id: sharedBetweenId,
      title: mapped.title,
      subtitle: `Test your knowledge of ${module.title} (${mapped.questions.length} multiple-choice questions).`,
      passingScore: course.gradingCriteria?.quizPassingScore ?? 75,
      questions: mapped.questions
    };
  }

  const fallback =
    CATEGORY_FALLBACK_QUESTIONS[course.category] ||
    CATEGORY_FALLBACK_QUESTIONS['Enterprise Routing & Switching'];

  return {
    id: sharedBetweenId,
    title: `Module ${moduleIndex + 1} Quiz · ${module.title}`,
    subtitle: `Test your understanding of ${module.title} with multiple-choice practice questions.`,
    passingScore: course.gradingCriteria?.quizPassingScore ?? 75,
    questions: fallback.map((q, idx) => ({
      ...q,
      id: `${module.id}-qm-${idx + 1}`
    }))
  };
}

/**
 * Resolves the required post-module mastery quiz for a video lecture module.
 * Shares the canonical storage key with getModuleQuiz/getBetweenModuleQuiz so passing
 * once unlocks the next segment across Study Mode, auto-triggered modal, and Quiz Mode.
 */
export function getPostVideoModuleQuiz(
  course: Course,
  videoModule: CourseModule | undefined,
  moduleIndex: number
): CheckpointQuizConfig | null {
  if (!videoModule || videoModule.type !== 'video') return null;

  const baseQuiz = getModuleQuiz(course, videoModule, moduleIndex);
  if (!baseQuiz) return null;

  const nextModule =
    moduleIndex >= 0 && moduleIndex < course.modules.length - 1
      ? course.modules[moduleIndex + 1]
      : undefined;

  return {
    ...baseQuiz,
    title: `Post-Lecture Mastery Check · ${videoModule.title}`,
    subtitle: nextModule
      ? `Achieve at least ${baseQuiz.passingScore}% to verify lecture mastery and unlock "${nextModule.title}".`
      : `Achieve at least ${baseQuiz.passingScore}% to verify lecture mastery and complete this module.`
  };
}


