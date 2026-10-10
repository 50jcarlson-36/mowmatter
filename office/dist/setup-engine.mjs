import { validateCatalog } from "./pricing-engine.mjs";
export function validateSetup(profile) {
  if (!profile || typeof profile.city !== "string" || profile.city.length > 100)
    throw Error("Enter a city of up to 100 characters.");
  for (const [key, min, max] of [
    ["workers", 1, 100],
    ["crewHourlyCostCents", 0, 10000000],
    ["visitCostCents", 0, 10000000],
    ["minutes", 1, 1440],
    ["areaSqft", 1, 10000000],
    ["targetMarginPercent", 0, 70],
  ])
    if (
      typeof profile[key] !== "number" ||
      !Number.isFinite(profile[key]) ||
      profile[key] < min ||
      profile[key] > max
    )
      throw Error(`Check ${key}.`);
  if (
    !Number.isInteger(profile.workers) ||
    !Number.isInteger(profile.crewHourlyCostCents) ||
    !Number.isInteger(profile.visitCostCents)
  )
    throw Error("Crew size must be whole and costs must be whole cents.");
  return profile;
}
export function setupSuggestions(profile, catalog) {
  validateSetup(profile);
  validateCatalog(catalog);
  const denominator = 1 - profile.targetMarginPercent / 100;
  const floor = Math.ceil(profile.visitCostCents / denominator / 100) * 100;
  const crewRate =
    Math.ceil(profile.crewHourlyCostCents / denominator / 100) * 100;
  return {
    visitMinimumCents: floor,
    suggestedCrewHourlyCents: crewRate,
    recommendations: catalog.services.map((s) => ({
      serviceId: s.id,
      mode: s.mode,
      hourBasis: s.hourBasis || "crew",
      reason:
        s.mode === "area"
          ? "Use owner-confirmed grass area, never total lot size."
          : s.mode === "hourly"
            ? "Keep crew-hours and worker-hours distinct. Use actual personnel costs."
            : s.mode === "unit"
              ? "Define the unit and confirm the quantity."
              : "Use an approved scope and price; route uncertain work to review.",
    })),
    checklist: [
      "Cost owner field time even when the owner takes a draw.",
      "Include travel, fuel and nonbillable work in job costs.",
      "Keep recurring service and one-time cleanup separate.",
      "Approve a sample quote before publishing.",
    ],
  };
}
export function applyConfiguration(base, changes, approved) {
  if (approved !== true)
    throw Error("Review and approve this configuration first.");
  const next = structuredClone(base);
  next.visitMinimumCents = changes.visitMinimumCents;
  for (const update of changes.services || []) {
    const service = next.services.find((s) => s.id === update.id);
    if (!service) throw Error("Cannot update an unknown service.");
    Object.assign(service, {
      mode: update.mode,
      priceCents: update.priceCents,
      minimumCents: update.minimumCents,
      hourBasis: update.hourBasis,
    });
  }
  if (changes.package) {
    const index = next.packages.findIndex((p) => p.id === changes.package.id);
    if (index < 0) next.packages.push(changes.package);
    else next.packages[index] = changes.package;
  }
  validateCatalog(next);
  return next;
}
