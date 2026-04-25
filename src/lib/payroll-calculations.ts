/**
 * Sri Lanka Payroll Calculation Utility
 * Based on custom enterprise formulas
 */

export interface PayrollInput {
  basicSalary: number;
  budgetaryReliefAllowance: number;
  fixedAllowances: number;
  isEpfApplicable: boolean;
  variables?: {
    // Group 1: Basic Salary Adjustment
    noPayDays?: number;
    salaryArrears?: number;
    
    // Group 2: Additions
    holidayWorks?: number;
    extraDayWorks?: number;
    nightShiftAllowance?: number;
    overNightAllowance?: number;

    overtimeHours?: number;
    allowanceArrears?: number;
    otArrears?: number;
    dynamicAllowances?: Record<string, number>;

    // Group 3: Deductions
    welfare?: number;
    fine?: number;
    loan?: number;
    otherDeductions?: number;
  };
  rates?: {
    epfEmployeeRate?: number;
    epfEmployerRate?: number;
    etfEmployerRate?: number;
    otRate?: number;
    allowanceRates?: Record<string, number>;
  };
}

export interface PayrollResult {
  grossSalary: number;
  epfEmployee: number;
  epfEmployer: number;
  etfEmployer: number;
  taxableIncome: number;
  apitTax: number;
  otPayment: number;
  totalAdditions: number;
  totalDeductions: number;
  netSalary: number;
  employerCost: number;
  noPayDeduction: number;
  // Performance Breakdown
  holidayPay: number;
  extraDayPay: number;
  nightShiftPay: number;
  overnightPay: number;
}

/**
 * Calculates APIT (Advance Personal Income Tax) based on Sri Lanka IRD tables (2025/2026)
 * Reference: https://www.taxadvisor.lk/calculator/cal-2025
 * 
 * Monthly Tax-Free Allowance: LKR 150,000
 */
export const calculateAPIT = (monthlySalary: number): number => {
  const taxFreeThreshold = 150000;
  if (monthlySalary <= taxFreeThreshold) return 0;

  let taxable = monthlySalary - taxFreeThreshold;
  let tax = 0;

  // New 2025 slabs: 1st block 1M annual (83,333/mo) @ 6%, 2nd block 0.5M @ 18%, etc.
  const slabs = [
    { amount: 83333.33, rate: 0.06 },
    { amount: 41666.67, rate: 0.18 },
    { amount: 41666.67, rate: 0.24 },
    { amount: 41666.67, rate: 0.30 },
    { amount: Infinity, rate: 0.36 }
  ];

  for (const slab of slabs) {
    if (taxable <= 0) break;
    const chunk = Math.min(taxable, slab.amount);
    tax += chunk * slab.rate;
    taxable -= chunk;
  }

  return Math.round(tax);
};

/**
 * Main Payroll Calculation for Sri Lanka
 */
export const calculateSriLankaPayroll = (input: PayrollInput): PayrollResult => {
  const { basicSalary, budgetaryReliefAllowance, fixedAllowances, isEpfApplicable, variables, rates } = input;
  
  // Dynamic Rates setup
  const epfEVal = (rates?.epfEmployeeRate || 8) / 100;
  const epfCVal = (rates?.epfEmployerRate || 12) / 100;
  const etfCVal = (rates?.etfEmployerRate || 3) / 100;
  const otRateMultiplier = rates?.otRate || 1.5;
  const allowanceRates = rates?.allowanceRates || {};

  // Part 1: Salary Calculation
  const A = basicSalary + budgetaryReliefAllowance; 
  const noPayDays = variables?.noPayDays || 0;
  const B = (A / 30) * noPayDays;
  const C = variables?.salaryArrears || 0;
  const D = (A + C) - B; // Total for EPF

  // Part 2: Earnings
  const E = fixedAllowances;
  const F = variables?.allowanceArrears || 0;
  const G = (E / 30) * noPayDays; // Less No-Pay Amount (on Allowances)

  const getRateByName = (names: string[]) => {
    for (const n of names) {
      if (allowanceRates[n] !== undefined) return allowanceRates[n];
    }
    return 0;
  };

  const holidayPay = (variables?.holidayWorks || 0) * getRateByName(["Holiday Works - A4", "Holiday Works", "Holiday Work"]);
  const extraDayPay = (variables?.extraDayWorks || 0) * getRateByName(["Extra Day Works - A3", "Extra Day Works", "Extra Day Work"]);
  const nightShiftPay = (variables?.nightShiftAllowance || 0) * getRateByName(["Night Shift Allowance - A1", "Night Shift Allowance", "Nigh Shift Allowance", "Night Shift Allow", "Shift Allowance", "Night Shift"]);
  const overnightPay = (variables?.overNightAllowance || 0) * getRateByName(["Over Night Allowance - A2", "Overnight Allowance", "Over Night Allowance", "Overnight Allow", "Over Night Allow", "Overnight", "Over Night"]);

  const H = holidayPay + extraDayPay + nightShiftPay + overnightPay;
  const otHours = variables?.overtimeHours || 0;
  const I = (A / 240) * otRateMultiplier * otHours; // OT Amount
  const J = variables?.otArrears || 0;

  // Process Dynamic Allowances with Admin Rates
  const dynamicAllowancesObj = variables?.dynamicAllowances || {};
  let totalDynamicAllowanceValue = 0;
  for (const [key, amount] of Object.entries(dynamicAllowancesObj)) {
    const rate = allowanceRates[key] || 1; 
    totalDynamicAllowanceValue += (amount * rate);
  }

  // Salary for PAYE
  const K = (D + E + F + H + I + J + totalDynamicAllowanceValue) - G;

  // Part 3: Deductions
  const L = variables?.welfare || 0;
  const M = variables?.fine || 0;
  const N = variables?.loan || 0;
  const O = variables?.otherDeductions || 0;

  const P = isEpfApplicable ? A * epfEVal : 0; // EPF Employee Contribution
  
  const Q = calculateAPIT(K); // PAYE Tax (Calculated based on salary for PAYE)

  const R = L + M + N + O + P + Q; // Total Deductions

  // Part 4: Net Salary
  const S = K - R; // Net Salary

  // Part 5: Employer Contributions
  const T = isEpfApplicable ? A * epfCVal : 0; // EPF Company Contribution
  const U = isEpfApplicable ? A * etfCVal : 0; // ETF Company Contribution

  // Prepare standard response 
  const totalAdditions = C + F + H + I + J + totalDynamicAllowanceValue;
  const grossSalary = K; 

  return {
    grossSalary,
    epfEmployee: P,
    epfEmployer: T,
    etfEmployer: U,
    taxableIncome: K,
    apitTax: Q,
    otPayment: I + J,
    totalAdditions,
    totalDeductions: R,
    netSalary: S,
    employerCost: grossSalary + T + U,
    noPayDeduction: B + G,
    holidayPay,
    extraDayPay,
    nightShiftPay,
    overnightPay
  };
};
