import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

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
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Netplus Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
