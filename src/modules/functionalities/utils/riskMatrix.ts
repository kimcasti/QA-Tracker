import { ImpactLevel, ProbabilityLevel, RiskLevel } from '../../../types';

export function calculateRiskLevel(
  impactLevel: ImpactLevel,
  probabilityLevel: ProbabilityLevel,
): RiskLevel {
  if (impactLevel === ImpactLevel.HIGH && probabilityLevel === ProbabilityLevel.LOW) {
    return RiskLevel.MEDIUM;
  }

  if (
    (impactLevel === ImpactLevel.HIGH &&
      (probabilityLevel === ProbabilityLevel.HIGH ||
        probabilityLevel === ProbabilityLevel.MEDIUM)) ||
    (impactLevel === ImpactLevel.MEDIUM && probabilityLevel === ProbabilityLevel.HIGH)
  ) {
    return RiskLevel.HIGH;
  }

  if (
    (impactLevel === ImpactLevel.MEDIUM && probabilityLevel === ProbabilityLevel.MEDIUM) ||
    (impactLevel === ImpactLevel.LOW && probabilityLevel === ProbabilityLevel.HIGH)
  ) {
    return RiskLevel.MEDIUM;
  }

  return RiskLevel.LOW;
}
