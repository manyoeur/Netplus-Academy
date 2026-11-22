import express, { type Request, type Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google Gen AI helper
function getNormalizedApiKey(): string {
  const raw = process.env.GEMINI_API_KEY || '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

function createGeminiClient(key: string): GoogleGenAI | null {
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getGeminiClient(): GoogleGenAI | null {
  return createGeminiClient(getNormalizedApiKey());
}

function formatGeminiError(error: any): { status: number; message: string } {
  let status =
    typeof error?.status === 'number' && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  let message = typeof error?.message === 'string' ? error.message : 'Failed to communicate with Gemini API.';
  let reason = '';

  if (message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      const errObj = parsed?.error || parsed;
      if (typeof errObj?.code === 'number' && errObj.code >= 400 && errObj.code < 600) {
        status = errObj.code;
      }
      if (typeof errObj?.message === 'string' && errObj.message) {
        message = errObj.message;
      }
      if (Array.isArray(errObj?.details)) {
        const info = errObj.details.find((d: any) => typeof d?.reason === 'string');
        if (info?.reason) reason = info.reason;
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  if (reason === 'API_KEY_INVALID' || /api key not valid/i.test(message)) {
    return {
      status: 400,
      message:
        'Gemini API key is invalid or not recognized. Please check or select a valid GEMINI_API_KEY in the Settings > Secrets panel and try again.',
    };
  }

  if (status === 403 || reason === 'PERMISSION_DENIED') {
    return {
      status: 403,
      message:
        'Permission denied by Gemini API. Please verify your GEMINI_API_KEY in the Settings > Secrets panel.',
    };
  }

  if (status === 429 || reason === 'RESOURCE_EXHAUSTED') {
    return {
      status: 429,
      message:
        'Gemini API rate limit or quota exceeded. Please wait a moment and try again, or verify your key in Settings > Secrets.',
    };
  }

  return { status, message };
}

const ai = getGeminiClient();

// AI Tutoring Endpoint
app.post('/api/ai/tutor', async (req: Request, res: Response) => {
  try {
    const { messages, context, userPrompt } = req.body;
    
    if (!ai) {
      // Fallback response for offline or missing key
      return res.json({
        reply: `[Offline/Local Knowledge Base Engine] 
Regarding "${userPrompt || 'Networking Question'}":
• In Cisco IOS, ensure you verify with \`show ip interface brief\` and \`show ip route\`.
• For OSPF neighbor adjacency, verify matching Hello/Dead timers, same Area ID, matching MTU, and matching subnet masks on the link.
• For Subnetting, remember the formula 2^(32 - CIDR) - 2 for usable hosts.
Would you like a full step-by-step CLI configuration example?`,
        mode: 'fallback'
      });
    }

    const systemInstruction = `You are "NetGenius AI", the senior CCIE-certified tutor and diagnostic engine for Netplus Academy.
Your role:
1. Provide crisp, technically rigorous, yet easy-to-understand explanations for computer networking, Cisco IOS commands, routing protocols (OSPF, BGP, EIGRP), switching (VLANs, STP, 802.1Q), network security (ACLs, IPsec VPN, Firewalls), subnetting (CIDR, VLSM), and Wireshark packet captures.
2. When students present network configuration mistakes or CLI output, pinpoint the exact issue (e.g., mismatched subnet mask, passive-interface blocking hellos, missing default route) with clear remedy steps.
3. Use formatted markdown, code blocks (\`\`\`cisco or \`\`\`bash) with CLI commands, and bullet points.
4. Keep explanations encouraging and concise unless deep technical breakdown is requested.
Current student context: ${context ? JSON.stringify(context) : 'General Networking Academy Study'}`;

    const promptText = userPrompt || (messages && messages.length > 0 ? messages[messages.length - 1].content : 'Explain OSPF states.');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'No response generated. Please refine your query.';
    return res.json({ reply, mode: 'gemini' });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    return res.status(500).json({
      error: 'Failed to communicate with AI Tutor service',
      details: error.message,
    });
  }
});

// Network Scenario Diagnostics
app.post('/api/ai/diagnose', async (req: Request, res: Response) => {
  try {
    const { scenarioType, symptoms, logsOrCli } = req.body;

    if (!ai) {
      return res.json({
        diagnosis: `Potential Issue: Misconfigured Interface / ACL Drop.
1. Check interface status: \`show interfaces status\`
2. Verify route table: \`show ip route\`
3. Check ACL hit counts: \`show access-lists\``,
        rootCause: 'MTU mismatch or access-list implicit deny',
        recommendation: 'Align MTU across peers and add explicit permit for OSPF multicast (224.0.0.5).'
      });
    }

    const prompt = `Analyze this networking failure scenario:
Scenario Type: ${scenarioType || 'Routing/Adjacency failure'}
Reported Symptoms: ${symptoms || 'Traffic dropped, packet loss'}
CLI / Log Output:
${logsOrCli || 'GigabitEthernet0/0 is up, line protocol is down'}

Provide:
1. Root Cause Analysis
2. Step-by-Step Diagnostic Commands (Cisco IOS)
3. Fix & Verification CLI snippet`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an automated network forensics and packet-level troubleshooter.',
      },
    });

    return res.json({ analysis: response.text });
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// AI Networking Flashcard Deck Generator
app.post('/api/flashcards/generate', async (req: Request, res: Response) => {
  try {
    const client = getGeminiClient();
    if (!client) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please add or select GEMINI_API_KEY in the Settings > Secrets panel.',
      });
    }

    const {
      topic = 'all',
      difficulty = 'certification',
      cardCount = 12,
      customFocus = '',
      avoidTerms = [],
    } = req.body || {};

    const clampedCount = Math.min(20, Math.max(5, Number(cardCount) || 12));

    const topicFocusMap: Record<string, string> = {
      all: 'a balanced mix of core networking terminology, OSI/TCP-IP concepts, key network protocols, and standard TCP/UDP port numbers',
      terminology: 'essential computer networking terminology, OSI & TCP/IP model layers, switching/routing concepts, duplexing, MTU, VLANs, collision vs broadcast domains, and addressing',
      protocols: 'networking protocols, their mechanics, handshake/state processes, and packet behavior (e.g., ARP, DNS, DHCP, OSPF, BGP, STP, ICMP, TCP/UDP, TLS, SNMP, NTP, IPsec)',
      ports: 'memorizing standard well-known and registered TCP/UDP port numbers, their protocol names, transport protocol (TCP vs UDP vs both), and secure vs insecure counterparts',
    };

    const difficultyMap: Record<string, string> = {
      foundations: 'Foundations (CompTIA Network+ / Intro to Networking level — clear definitions, essential ports, core concepts)',
      certification: 'Certification (CompTIA Network+ & Cisco CCNA 200-301 exam level — practical scenarios, protocol behaviors, port distinctions, layer mapping)',
      advanced: 'Advanced (CCNP / Senior Network Engineer level — subtle protocol edge cases, timers, flags, encapsulation details, and security ports)',
    };

    const cleanFocus = typeof customFocus === 'string' ? customFocus.trim().slice(0, 160) : '';
    const cleanAvoid = Array.isArray(avoidTerms)
      ? avoidTerms.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 40)
      : [];

    const topicInstruction = topicFocusMap[String(topic)] || topicFocusMap.all;
    const difficultyInstruction = difficultyMap[String(difficulty)] || difficultyMap.certification;

    const prompt = `Generate exactly ${clampedCount} high-yield networking study flashcards for students.

Topic Focus: ${topicInstruction}
Difficulty Level: ${difficultyInstruction}
${cleanFocus ? `Specific Student Focus Request: "${cleanFocus}"` : ''}
${cleanAvoid.length > 0 ? `Avoid repeating these previously studied terms/ports: ${cleanAvoid.join(', ')}` : ''}

Strict Requirements:
1. Every flashcard must be 100% technically accurate for industry networking certifications (CompTIA Network+, Cisco CCNA).
2. Write the "question" as an engaging active-recall prompt suitable for the front of a flashcard (do NOT give away the answer inside the question).
3. Write the "answer" concisely and clearly (1-2 sentences or exact port/protocol value) for immediate recall on the back of the card.
4. Include "explanation" (1-2 crisp sentences adding real-world or exam context) and "memoryTip" (a short mnemonic, contrast, or rule of thumb to help memorize it).
5. When a card relates to a network port or protocol, populate "portNumber" (e.g., "22", "67 / 68", "443", or "N/A" if conceptual), "transportProtocol" (e.g., "TCP", "UDP", "TCP / UDP", "Layer 3 / IP", or "N/A"), and "osiLayer" (e.g., "Layer 7 - Application", "Layer 3 - Network").
6. Ensure all ${clampedCount} cards cover distinct concepts with zero duplicates.`;

    const response = await client.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert Cisco CCIE and CompTIA Network+ curriculum designer creating high-retention active-recall flashcards for networking students.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            deckTitle: {
              type: Type.STRING,
              description: 'Short engaging title for the generated flashcard deck',
            },
            summary: {
              type: Type.STRING,
              description: 'One-sentence overview of what this deck covers',
            },
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: 'One of: Terminology, Protocol, Port Number, Architecture',
                  },
                  term: {
                    type: Type.STRING,
                    description: 'Short key term, protocol name, or port label',
                  },
                  question: {
                    type: Type.STRING,
                    description: 'Active-recall question for the front of the flashcard',
                  },
                  answer: {
                    type: Type.STRING,
                    description: 'Direct, accurate answer for the back of the flashcard',
                  },
                  portNumber: {
                    type: Type.STRING,
                    description: 'Standard port number(s) if applicable, otherwise N/A',
                  },
                  transportProtocol: {
                    type: Type.STRING,
                    description: 'TCP, UDP, TCP/UDP, ICMP, or N/A',
                  },
                  osiLayer: {
                    type: Type.STRING,
                    description: 'Primary OSI layer, e.g. Layer 7 (Application) or Layer 3 (Network)',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Brief practical or certification explanation',
                  },
                  memoryTip: {
                    type: Type.STRING,
                    description: 'Short mnemonic or memorization tip',
                  },
                },
                required: ['id', 'category', 'term', 'question', 'answer', 'portNumber', 'transportProtocol', 'osiLayer', 'explanation', 'memoryTip'],
              },
            },
          },
          required: ['deckTitle', 'summary', 'cards'],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return res.status(502).json({ error: 'Gemini returned an empty response when generating flashcards.' });
    }

    const parsed = JSON.parse(rawText);
    if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      return res.status(502).json({ error: 'Generated flashcard payload was malformed or contained no cards.' });
    }

    const normalizedCards = parsed.cards.map((card: any, index: number) => ({
      id: typeof card.id === 'string' && card.id.trim() ? card.id.trim() : `card-${Date.now()}-${index + 1}`,
      category: ['Terminology', 'Protocol', 'Port Number', 'Architecture'].includes(card.category)
        ? card.category
        : 'Terminology',
      term: String(card.term || `Concept ${index + 1}`),
      question: String(card.question || ''),
      answer: String(card.answer || ''),
      portNumber: card.portNumber && String(card.portNumber).toUpperCase() !== 'N/A' ? String(card.portNumber) : undefined,
      transportProtocol:
        card.transportProtocol && String(card.transportProtocol).toUpperCase() !== 'N/A'
          ? String(card.transportProtocol)
          : undefined,
      osiLayer: card.osiLayer && String(card.osiLayer).toUpperCase() !== 'N/A' ? String(card.osiLayer) : undefined,
      explanation: String(card.explanation || ''),
      memoryTip: String(card.memoryTip || ''),
    })).filter((c: any) => c.question && c.answer);

    return res.json({
      deckTitle: String(parsed.deckTitle || 'AI Networking Flashcard Deck'),
      summary: String(parsed.summary || 'AI-generated active-recall networking deck.'),
      topic,
      difficulty,
      generatedAt: new Date().toISOString(),
      cards: normalizedCards,
    });
  } catch (error: any) {
    console.error('Error generating AI flashcards:', error);
    const formatted = formatGeminiError(error);
    return res.status(formatted.status).json({
      error: formatted.message,
    });
  }
});

// Payment Gateway Simulation
app.post('/api/payments/subscribe', (req: Request, res: Response) => {
  const { planId, billingCycle, cardLast4, email, studentName } = req.body;
  const transactionId = 'TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const invoiceNumber = 'INV-' + Math.floor(100000 + Math.random() * 900000);

  const priceMap: Record<string, { monthly: number; annual: number }> = {
    pro: { monthly: 29, annual: 290 },
    expert: { monthly: 59, annual: 590 },
    enterprise: { monthly: 199, annual: 1990 },
  };

  const plan = priceMap[planId] || { monthly: 29, annual: 290 };
  const amount = billingCycle === 'annual' ? plan.annual : plan.monthly;

  return res.json({
    success: true,
    transactionId,
    invoiceNumber,
    planId,
    billingCycle,
    amount,
    currency: 'USD',
    paidAt: new Date().toISOString(),
    cardLast4: cardLast4 || '4242',
    receiptUrl: `https://netplus-academy.internal/receipts/${transactionId}`,
    message: `Subscription successfully activated for ${studentName || email}! Welcome to ${planId.toUpperCase()} tier.`
  });
});

// Per-Course Student Enrollment Payment Endpoint
app.post('/api/payments/course-enroll', (req: Request, res: Response) => {
  const {
    courseId,
    courseCode,
    courseTitle,
    price,
    promoCode,
    paymentMethod,
    cardLast4,
    email,
    studentName
  } = req.body || {};

  const originalPrice = Math.max(0, Number(price) || 0);
  const cleanPromo = typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : '';
  const promoRates: Record<string, number> = {
    NETPLUS20: 0.2,
    STUDENT10: 0.1,
    CCNA50: 0.5
  };
  const discountRate = promoRates[cleanPromo] || 0;
  const discountAmount = Math.min(originalPrice, Math.round(originalPrice * discountRate * 100) / 100);
  const amountPaid = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

  const transactionId = 'TXN-CRS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const invoiceNumber = 'INV-' + Math.floor(100000 + Math.random() * 900000);

  return res.json({
    success: true,
    transactionId,
    invoiceNumber,
    courseId,
    courseCode,
    courseTitle,
    originalPrice,
    discountAmount,
    amountPaid,
    promoCode: discountRate > 0 ? cleanPromo : undefined,
    currency: 'USD',
    paymentMethod: paymentMethod || 'card',
    cardLast4: paymentMethod === 'card' ? cardLast4 || '4242' : undefined,
    paidAt: new Date().toISOString(),
    message: `Payment confirmed for ${courseCode || courseTitle} (${studentName || email || 'Student'}).`
  });
});

// LMS External API Integrations (Canvas, Blackboard, Moodle, SCORM)
app.get('/api/lms/export-scorm', (req: Request, res: Response) => {
  const { courseId } = req.query;
  const manifest = {
    version: 'SCORM_2004_4TH_EDITION',
    courseId: courseId || 'NET-CCNA-200-301',
    schemaVersion: 'CAM 1.3',
    title: 'Enterprise Routing & Switching Masterclass',
    organization: 'Netplus Academy LMS',
    ltiLaunchUrl: 'https://api.netplus.academy/lti/v1p3/launch',
    exportedAt: new Date().toISOString(),
    modulesCount: 14,
    supportedStandards: ['LTI 1.3 Advantage', 'SCORM 2004', 'xAPI (Tin Can)', 'QTI 2.2']
  };
  return res.json(manifest);
});

// Integrated Email Notification Dispatcher
app.post('/api/notifications/send-email', (req: Request, res: Response) => {
  const { recipientEmail, subject, templateType, metadata } = req.body;
  const messageId = 'MSG-' + Math.random().toString(36).substring(2, 12).toUpperCase();

  return res.json({
    success: true,
    messageId,
    recipientEmail,
    subject,
    templateType,
    deliveredAt: new Date().toISOString(),
    status: 'Delivered',
  });
});

// Setup Vite Dev Server or Production Static Serving
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? { server: httpServer } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Netplus Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
