/**
 * Berry Points System Utilities
 * 
 * Formula:
 * S = 500 * B * (1 + C/10) * (τ / (ε + 1)) * 0.85 * τ
 * 
 * Where:
 * S = Borrowing power
 * B = Fixed Berry points per contribution
 * C = Recurring contribution bonus
 * τ = Available treasury
 * ε = Loan commitment
 */

export interface BerryPointsParams {
  fixedPoints: number; // B
  recurringBonus: number; // C
  treasury: number; // τ
  loanCommitment: number; // ε
}

/**
 * Calculate borrowing power S based on Berry points formula
 */
export function calculateBorrowingPower(params: BerryPointsParams): number {
  const { fixedPoints, recurringBonus, treasury, loanCommitment } = params;
  if (loanCommitment === undefined || loanCommitment === null) {
    // If no loan commitment, consider it as 85% of treasury
    return 500 * fixedPoints * (1 + recurringBonus / 10) * (0.85 * treasury);
  }
  return 500 * fixedPoints * (1 + recurringBonus / 10) * (treasury / (loanCommitment + 1)) * 0.85 * treasury;
}

/**
 * Calculate Berry points bonus based on contribution amount and rules
 */
export function calculateBerryPointsBonus(contribution: number, minContribution: number): number {
  let bonus = 0;
  if (contribution > minContribution * 1.7) {
    bonus += 5; // Bonus for contribution > 70% above minimum
  }
  if (contribution > 0.2 * minContribution) {
    bonus += 10; // Bonus for contribution > 20% of total fund (approximate)
  }
  if (contribution > 50001) {
    bonus += 20; // Additional bonus for contribution > 50,001
  }
  return bonus;
}
