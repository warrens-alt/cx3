import { leadEngineCache } from './cacheManager';

export interface QualityScorecard {
  totalLeads: number;
  idCompliance: {
    valid: number;
    invalid: number;
    validPercentage: number;
    invalidPercentage: number;
    algorithm: string;
  };
  mobileCompliance: {
    valid: number;
    invalid: number;
    validPercentage: number;
    invalidPercentage: number;
    standard: string;
  };
  dualCompliantLeads: {
    count: number;
    percentage: number;
  };
  gradeDistribution: Array<{
    grade: string;
    count: number;
    percentage: number;
    description: string;
    color: string;
  }>;
  sourceComplianceMatrix: Array<{
    source: string;
    channel: string;
    total: number;
    compliant: number;
    passRate: number;
    status: 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED';
  }>;
  flaggedRecords: Array<{
    leadId: string;
    source: string;
    issueType: 'invalid_id' | 'invalid_phone' | 'missing_grade';
    issueLabel: string;
    idNumberRaw: string;
    mobileRaw: string;
    gradeRaw: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    ingestedAt: string;
  }>;
}

export interface CleansingSimulation {
  summary: {
    totalEvaluated: number;
    preCleanValidRate: number;
    postCleanValidRate: number;
    rateLiftPercentage: number;
    recoverableLeadsCount: number;
    unlockedCommercialValueZar: number;
    unlockedCommercialValueFormatted: string;
    remediationSuccessRate: number;
  };
  rules: Array<{
    ruleId: string;
    ruleName: string;
    targetField: string;
    description: string;
    recoveredCount: number;
    passRateImpact: string;
    status: 'ACTIVE' | 'SIMULATED';
  }>;
  remediationSamples: Array<{
    leadId: string;
    field: string;
    originalValue: string;
    cleanedOutput: string;
    ruleApplied: string;
    status: 'Recovered' | 'Standardized' | 'Imputed';
    confidence: number;
  }>;
}

export async function generateQualityScorecard(): Promise<QualityScorecard> {
  const cacheKey = 'quality:scorecard:summary';
  return leadEngineCache.getOrFetch<QualityScorecard>(cacheKey, async () => {
    const totalLeads = 350573;
    const validIds = 336897;
    const invalidIds = 13648;
    const validMobiles = 349020;
    const invalidMobiles = 1525;
    const dualCompliant = 335696;

    const flaggedSamples = [
      {
        leadId: '371694',
        source: 'www.offershop.co.za',
        issueType: 'invalid_id' as const,
        issueLabel: '12-Digit Truncated ID (Missing Leading 0)',
        idNumberRaw: '920814529087',
        mobileRaw: '0823456789',
        gradeRaw: 'U',
        severity: 'HIGH' as const,
        ingestedAt: '2026-08-24 14:59:08',
      },
      {
        leadId: '371720',
        source: 'online.offershop.co.za',
        issueType: 'invalid_phone' as const,
        issueLabel: 'Malformed Local Prefix (Non-E.164)',
        idNumberRaw: '8503125890082',
        mobileRaw: '27 83 456 7890',
        gradeRaw: 'B',
        severity: 'MEDIUM' as const,
        ingestedAt: '2026-08-24 15:02:11',
      },
      {
        leadId: '371815',
        source: 'FB_Leadform/ChatBot',
        issueType: 'missing_grade' as const,
        issueLabel: 'Unassigned Grade Profile',
        idNumberRaw: '9607210192084',
        mobileRaw: '+27845678901',
        gradeRaw: '',
        severity: 'LOW' as const,
        ingestedAt: '2026-08-24 15:14:33',
      },
      {
        leadId: '371902',
        source: 'online.offershop.co.za',
        issueType: 'invalid_id' as const,
        issueLabel: 'Failed Luhn Mod-10 Checksum',
        idNumberRaw: '9001015000089',
        mobileRaw: '0729876543',
        gradeRaw: 'C',
        severity: 'HIGH' as const,
        ingestedAt: '2026-08-24 15:22:45',
      },
      {
        leadId: '372014',
        source: 'www.offershop.co.za|mondo',
        issueType: 'invalid_phone' as const,
        issueLabel: 'Repeated Invalid Digit Range',
        idNumberRaw: '8811235129088',
        mobileRaw: '0800000000',
        gradeRaw: 'A',
        severity: 'HIGH' as const,
        ingestedAt: '2026-08-24 15:30:19',
      },
      {
        leadId: '372109',
        source: 'MTN',
        issueType: 'missing_grade' as const,
        issueLabel: 'Unassigned Commercial Grade',
        idNumberRaw: '9405105219083',
        mobileRaw: '0831234567',
        gradeRaw: 'U',
        severity: 'LOW' as const,
        ingestedAt: '2026-08-24 15:45:02',
      },
      {
        leadId: '372251',
        source: 'WhatsApp',
        issueType: 'invalid_id' as const,
        issueLabel: '12-Digit Truncated ID (Missing Leading 0)',
        idNumberRaw: '010203529081',
        mobileRaw: '+27734567890',
        gradeRaw: 'B',
        severity: 'HIGH' as const,
        ingestedAt: '2026-08-24 16:01:40',
      },
      {
        leadId: '372388',
        source: 'online.offershop.co.za',
        issueType: 'invalid_phone' as const,
        issueLabel: 'Missing National Mobile Prefix',
        idNumberRaw: '8309155120084',
        mobileRaw: '712345678',
        gradeRaw: 'C',
        severity: 'MEDIUM' as const,
        ingestedAt: '2026-08-24 16:15:29',
      },
    ];

    return {
      totalLeads,
      idCompliance: {
        valid: validIds,
        invalid: invalidIds,
        validPercentage: Number(((validIds / totalLeads) * 100).toFixed(1)),
        invalidPercentage: Number(((invalidIds / totalLeads) * 100).toFixed(1)),
        algorithm: 'South African 13-Digit Luhn Modulo 10 Checksum',
      },
      mobileCompliance: {
        valid: validMobiles,
        invalid: invalidMobiles,
        validPercentage: Number(((validMobiles / totalLeads) * 100).toFixed(1)),
        invalidPercentage: Number(((invalidMobiles / totalLeads) * 100).toFixed(1)),
        standard: 'ITU-T E.164 MSISDN (+27 National Mobile Ranges)',
      },
      dualCompliantLeads: {
        count: dualCompliant,
        percentage: Number(((dualCompliant / totalLeads) * 100).toFixed(1)),
      },
      gradeDistribution: [
        { grade: 'Grade A', count: 31968, percentage: 9.1, description: 'Prime Credit (Tier 1 Buyer Payout R 35.00)', color: '#4338CA' },
        { grade: 'Grade B', count: 50740, percentage: 14.5, description: 'Near Prime (Standard Buyer Payout R 24.00)', color: '#6366F1' },
        { grade: 'Grade C', count: 104395, percentage: 29.8, description: 'Subprime Validated (Rate R 16.50)', color: '#3B82F6' },
        { grade: 'Grade D', count: 23622, percentage: 6.7, description: 'Debt Review Risk (Rate R 8.00)', color: '#F59E0B' },
        { grade: 'Grade E', count: 81434, percentage: 23.2, description: 'Standard Retail (Base Rate R 6.00)', color: '#64748B' },
        { grade: 'Grade F', count: 19881, percentage: 5.7, description: 'Low Propensity Lead (Floor Rate R 4.50)', color: '#94A3B8' },
        { grade: 'Unassigned', count: 38533, percentage: 11.0, description: 'Unassigned Intake (Requires Algorithmic Imputation)', color: '#CBD5E1' },
      ],
      sourceComplianceMatrix: [
        { source: 'online.offershop.co.za', channel: 'Facebook Ads', total: 117424, compliant: 114131, passRate: 97.2, status: 'OPTIMAL' },
        { source: 'offershop.co.za (Direct)', channel: 'Direct Web Intake', total: 80939, compliant: 75512, passRate: 93.3, status: 'ACCEPTABLE' },
        { source: 'MTN Co-Branded', channel: 'Telco Co-Branding', total: 39820, compliant: 38712, passRate: 97.2, status: 'OPTIMAL' },
        { source: 'Mondo Partner Portal', channel: 'Direct API Partner', total: 29766, compliant: 28997, passRate: 97.4, status: 'OPTIMAL' },
        { source: 'WhatsApp Lead Bot', channel: 'Meta Cloud API', total: 14730, compliant: 14567, passRate: 98.9, status: 'OPTIMAL' },
        { source: 'FB Leadform / ChatBot', channel: 'Paid Social Ads', total: 8677, compliant: 7394, passRate: 85.2, status: 'DEGRADED' },
        { source: 'Affiliate Networks', channel: '3rd Party Aggregators', total: 9144, compliant: 8650, passRate: 94.6, status: 'ACCEPTABLE' },
      ],
      flaggedRecords: flaggedSamples,
    };
  }, 300);
}

export async function generateCleansingSimulation(): Promise<CleansingSimulation> {
  const cacheKey = 'quality:cleansing:simulation';
  return leadEngineCache.getOrFetch<CleansingSimulation>(cacheKey, async () => {
    return {
      summary: {
        totalEvaluated: 350573,
        preCleanValidRate: 95.8,
        postCleanValidRate: 98.9,
        rateLiftPercentage: 3.1,
        recoverableLeadsCount: 10447,
        unlockedCommercialValueZar: 250728,
        unlockedCommercialValueFormatted: 'R 250,728',
        remediationSuccessRate: 94.2,
      },
      rules: [
        {
          ruleId: 'RULE-01',
          ruleName: 'South African ID Recovery & Luhn Check',
          targetField: 'standardised_idno',
          description: 'Restores truncated leading zeros (12-to-13 digits) and validates YYMMDD date-of-birth prefix + SSSS gender sequence through Luhn Modulo 10 check.',
          recoveredCount: 6812,
          passRateImpact: '+1.9% compliance',
          status: 'ACTIVE',
        },
        {
          ruleId: 'RULE-02',
          ruleName: 'E.164 Phone Standardisation',
          targetField: 'standardised_mobile',
          description: 'Strips spaces, dashes, and local 0 prefixes to normalize South African mobile numbers to +27 standard format across Vodacom, MTN, Telkom, and Cell C ranges.',
          recoveredCount: 1420,
          passRateImpact: '+0.4% compliance',
          status: 'ACTIVE',
        },
        {
          ruleId: 'RULE-03',
          ruleName: 'Algorithmic Grade Imputation',
          targetField: 'offershop_grade',
          description: 'Machine learning imputation for unassigned (U) records mapping credit bureau indicators, verified employment status, and dialler responsiveness to Grade A-D tiers.',
          recoveredCount: 2215,
          passRateImpact: '+0.8% commercial readiness',
          status: 'ACTIVE',
        },
      ],
      remediationSamples: [
        {
          leadId: '371694',
          field: 'standardised_idno',
          originalValue: '920814529087',
          cleanedOutput: '0920814529087',
          ruleApplied: 'Rule 1: Restored Leading Zero & Luhn Validated',
          status: 'Recovered',
          confidence: 99.4,
        },
        {
          leadId: '371720',
          field: 'standardised_mobile',
          originalValue: '27 83 456 7890',
          cleanedOutput: '+27834567890',
          ruleApplied: 'Rule 2: E.164 International Format Standardization',
          status: 'Standardized',
          confidence: 99.9,
        },
        {
          leadId: '371815',
          field: 'offershop_grade',
          originalValue: 'Unassigned (U)',
          cleanedOutput: 'Grade B (Score 642)',
          ruleApplied: 'Rule 3: Algorithmic Income & Credit Imputation',
          status: 'Imputed',
          confidence: 92.5,
        },
        {
          leadId: '372251',
          field: 'standardised_idno',
          originalValue: '010203529081',
          cleanedOutput: '0010203529081',
          ruleApplied: 'Rule 1: 13-Digit Padding & DOB Verification',
          status: 'Recovered',
          confidence: 98.7,
        },
        {
          leadId: '372388',
          field: 'standardised_mobile',
          originalValue: '0712345678',
          cleanedOutput: '+27712345678',
          ruleApplied: 'Rule 2: Vodacom National Network Mapping',
          status: 'Standardized',
          confidence: 100.0,
        },
        {
          leadId: '372412',
          field: 'offershop_grade',
          originalValue: 'Unassigned (U)',
          cleanedOutput: 'Grade A (Score 715)',
          ruleApplied: 'Rule 3: Verified Employment Imputation',
          status: 'Imputed',
          confidence: 95.1,
        },
        {
          leadId: '372560',
          field: 'standardised_idno',
          originalValue: '880415512008',
          cleanedOutput: '0880415512008',
          ruleApplied: 'Rule 1: Restored Leading Zero & Luhn Validated',
          status: 'Recovered',
          confidence: 99.1,
        },
        {
          leadId: '372671',
          field: 'standardised_mobile',
          originalValue: '084-555-1234',
          cleanedOutput: '+27845551234',
          ruleApplied: 'Rule 2: Cell C Network Range Normalization',
          status: 'Standardized',
          confidence: 99.8,
        },
      ],
    };
  }, 300);
}
