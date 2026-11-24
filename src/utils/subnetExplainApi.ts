export interface SubnetExplainRequest {
  ipAddress: string;
  cidr: number;
  subnetMask: string;
  wildcardMask: string;
  networkId: string;
  broadcastAddress: string;
  firstHost: string;
  lastHost: string;
  usableHosts: number;
  totalAddresses: number;
  binaryIp: string;
  binaryMask: string;
}

export interface SubnetExplainStep {
  stepNumber: number;
  title: string;
  concept: string;
  binaryOperation: string;
  resultLabel: string;
}

export interface SubnetExplainResponse {
  targetCidr: string;
  summary: string;
  interestingOctet: number;
  blockSizeFormula: string;
  steps: SubnetExplainStep[];
  examTip: string;
  generatedAt: string;
}

export async function explainSubnetCalculation(
  params: SubnetExplainRequest,
  signal?: AbortSignal
): Promise<SubnetExplainResponse> {
  const response = await fetch('/api/ai/explain-subnet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Failed to generate subnet explanation (HTTP ${response.status})`;
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.steps) || payload.steps.length === 0) {
    throw new Error('The AI service returned an incomplete subnet breakdown. Please try again.');
  }

  return payload as SubnetExplainResponse;
}
