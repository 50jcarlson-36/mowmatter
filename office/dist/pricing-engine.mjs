/** Pure pricing rules. Server must reload the company's approved catalog before use. */
export const PLATFORM_FEE_BPS = Object.freeze({ starter: 350, growth: 250, scale: 150 });
const max = 100_000_000;
function number(value, label, upper = max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > upper) throw new Error(`${label} must be a valid nonnegative number.`);
  return value;
}
function cents(value, label = 'Price') {
  number(value, label);
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be whole cents.`);
  return value;
}
function positive(value, label, upper = max) {
  number(value, label, upper);
  if (!value) throw new Error(`${label} must be greater than zero.`);
  return value;
}
export function validateCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.services) || !catalog.services.length || catalog.services.length > 100 || !Array.isArray(catalog.packages || [])) throw new Error('Add a valid service catalog.');
  cents(catalog.visitMinimumCents ?? 0, 'Visit minimum');
  const services = new Set();
  for (const service of catalog.services) {
    if (typeof service.id !== 'string' || !service.id || service.id.length > 80 || services.has(service.id)) throw new Error('Service IDs must be unique.');
    services.add(service.id);
    if (typeof service.name !== 'string' || !service.name.trim() || service.name.length > 80) throw new Error('Each service needs a name of up to 80 characters.');
    if (!['fixed','area','bands','hourly','unit','inspection'].includes(service.mode)) throw new Error('Unsupported service pricing method.');
    cents(service.priceCents ?? 0); cents(service.minimumCents ?? 0, 'Service minimum');
    if (service.mode === 'hourly' && !['worker','crew'].includes(service.hourBasis)) throw new Error('Choose worker-hour or crew-hour pricing.');
    if (service.mode === 'bands') {
      if (!Array.isArray(service.bands) || !service.bands.length || service.bands.length > 50) throw new Error('Add lawn-size bands.');
      let previous=0;
      for (const band of service.bands) {
        positive(band.upToSqft,'Band maximum'); cents(band.priceCents,'Band price');
        if (band.upToSqft <= previous) throw new Error('Lawn-size bands must increase without overlap.');
        previous=band.upToSqft;
      }
    }
  }
  const packages=new Set();
  if ((catalog.packages || []).length > 50) throw new Error('Use no more than 50 packages.');
  for (const pkg of catalog.packages || []) {
    if (typeof pkg.id !== 'string' || !pkg.id || pkg.id.length > 80 || packages.has(pkg.id)) throw new Error('Package IDs must be unique.');
    packages.add(pkg.id);
    if (typeof pkg.name !== 'string' || !pkg.name.trim() || pkg.name.length > 80) throw new Error('Each package needs a name of up to 80 characters.');
    if (!Array.isArray(pkg.serviceIds) || !pkg.serviceIds.length || new Set(pkg.serviceIds).size !== pkg.serviceIds.length || pkg.serviceIds.some(id=>!services.has(id))) throw new Error('Packages need unique included services from this catalog.');
    if (pkg.mode === 'fixed') cents(pkg.priceCents,'Package price');
    else if (pkg.mode === 'discount') {number(pkg.discountBps ?? 0,'Package discount',10000);if(!Number.isInteger(pkg.discountBps ?? 0)) throw new Error('Discount must be whole basis points.');}
    else throw new Error('Choose fixed or discounted package pricing.');
  }
  return catalog;
}
export function priceService(service, inputs) {
  const minimum = cents(service.minimumCents ?? 0, 'Service minimum');
  const rate = cents(service.priceCents ?? 0);
  let amount;
  let basis;
  if (service.mode === 'fixed') {
    amount = rate; basis = 'Flat price per visit';
  } else if (service.mode === 'area') {
    if (inputs.areaConfirmed !== true) throw new Error('Confirm mowable lawn area before using area pricing.');
    const area = positive(inputs.areaSqft, 'Mowable lawn area', 10_000_000);
    amount = Math.round(area / 1000 * rate); basis = `${area.toLocaleString('en-US')} sq ft of confirmed lawn`;
  } else if (service.mode === 'bands') {
    if (inputs.areaConfirmed !== true) throw new Error('Confirm mowable lawn area before using area pricing.');
    const area = positive(inputs.areaSqft, 'Mowable lawn area', 10_000_000);
    if (!Array.isArray(service.bands) || !service.bands.length) throw new Error('Add lawn-size bands.');
    let previous = 0;
    for (const band of service.bands) {
      positive(band.upToSqft, 'Band maximum'); cents(band.priceCents, 'Band price');
      if (band.upToSqft <= previous) throw new Error('Lawn-size bands must increase without overlap.');
      previous = band.upToSqft;
    }
    const band = service.bands.find(b => area <= b.upToSqft);
    if (!band) throw new Error('This lawn is larger than your largest pricing band. Review it manually.');
    amount = band.priceCents; basis = `Lawn-size band: up to ${band.upToSqft.toLocaleString('en-US')} sq ft`;
  } else if (service.mode === 'hourly') {
    const minutes = positive(inputs.minutes, 'Estimated on-site minutes', 1440);
    if (!['worker', 'crew'].includes(service.hourBasis)) throw new Error('Choose worker-hour or crew-hour pricing.');
    const workers = positive(inputs.workers, 'Crew size', 100);
    if (!Number.isInteger(workers)) throw new Error('Crew size must be a whole number.');
    amount = Math.round(rate * minutes / 60 * (service.hourBasis === 'worker' ? workers : 1));
    basis = `${minutes} minutes × ${service.hourBasis === 'worker' ? `${workers} worker(s)` : 'one crew'} at the hourly rate`;
  } else if (service.mode === 'unit') {
    const quantity = positive(inputs.units?.[service.id] ?? 1, 'Unit quantity', 100_000);
    amount = Math.round(rate * quantity); basis = `${quantity} ${service.unitLabel || 'unit(s)'}`;
  } else if (service.mode === 'inspection') {
    throw new Error(`${service.name} needs an owner review before a price can be issued.`);
  } else throw new Error('Unsupported service pricing method.');
  return { serviceId: service.id, name: service.name, amountCents: cents(Math.max(amount, minimum)), basis };
}

/** Deterministic quote. All amounts are cents; monthly figure is a planning average. */
export function calculateQuote(catalog, request, fees = {}) {
  validateCatalog(catalog);
  const ids = catalog.services.map(s => s.id);
  if (new Set(ids).size !== ids.length) throw new Error('Service IDs must be unique.');
  const get = id => {
    const s = catalog.services.find(v => v.id === id && v.active !== false);
    if (!s) throw new Error('A selected service is missing or inactive.');
    return s;
  };
  const inputs = request.inputs || {};
  const packageItem = request.packageId ? (catalog.packages || []).find(p => p.id === request.packageId && p.active !== false) : null;
  if (request.packageId && !packageItem) throw new Error('Choose an active package.');
  const included = packageItem?.serviceIds || [];
  if (packageItem && (!included.length || new Set(included).size !== included.length)) throw new Error('Packages need unique included services.');
  const selected = request.serviceIds || [];
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length) throw new Error('Do not select a service twice.');
  if (selected.some(id => included.includes(id))) throw new Error('This add-on is already included in the package.');
  if (!included.length && !selected.length) throw new Error('Choose a service or package.');
  let lines = [];
  let packageDiscountCents = 0;
  if (packageItem) {
    // Verify included services exist even when a package has a fixed price.
    included.forEach(get);
    if (packageItem.mode === 'fixed') {
      lines.push({ packageId: packageItem.id, name: packageItem.name, amountCents: cents(packageItem.priceCents), basis: 'Package price per visit', includedNames: included.map(id => get(id).name) });
    } else if (packageItem.mode === 'discount') {
      const componentLines = included.map(id => priceService(get(id), inputs));
      const subtotal = componentLines.reduce((n, l) => n + l.amountCents, 0);
      const discount = number(packageItem.discountBps ?? 0, 'Package discount', 10000);
      if (!Number.isInteger(discount)) throw new Error('Discount must be whole basis points.');
      packageDiscountCents = Math.round(subtotal * discount / 10000);
      lines.push({ packageId: packageItem.id, name: packageItem.name, amountCents: subtotal - packageDiscountCents, basis: 'Combined services less package discount', includedNames: componentLines.map(l => l.name), componentLines });
    } else throw new Error('Choose fixed or discounted package pricing.');
  }
  lines.push(...selected.map(id => priceService(get(id), inputs)));
  let subtotal = lines.reduce((n, l) => n + l.amountCents, 0);
  const adjustment = cents(request.accessAdjustmentCents ?? 0, 'Access adjustment');
  if (adjustment) { lines.push({name:'Access / extra work adjustment', amountCents: adjustment, basis:'Owner-entered adjustment'}); subtotal += adjustment; }
  const visitMinimum = cents(catalog.visitMinimumCents ?? 0, 'Visit minimum');
  const minimumAdjustment = Math.max(0, visitMinimum - subtotal);
  if (minimumAdjustment) lines.push({name:'Minimum visit adjustment', amountCents: minimumAdjustment, basis:'Company minimum visit price'});
  const beforeTax = cents(subtotal + minimumAdjustment);
  const taxBps = number(request.taxBps ?? 0, 'Tax rate', 10000);
  if (!Number.isInteger(taxBps)) throw new Error('Tax rate must be whole basis points.');
  const tax = Math.round(beforeTax * taxBps / 10000);
  const total = cents(beforeTax + tax);
  const visits = positive(request.visitsPerYear ?? 26, 'Visits per year', 366);
  if (!Number.isInteger(visits)) throw new Error('Visits per year must be a whole number.');
  const tier = fees.tier || 'starter';
  if (!Object.hasOwn(PLATFORM_FEE_BPS,tier)) throw new Error('Unknown subscription tier.');
  const processingBps = number(fees.processingBps ?? 0, 'Processing rate', 10000);
  const processingFixed = cents(fees.processingFixedCents ?? 0, 'Processing fixed fee');
  const platformFee = Math.round(beforeTax * PLATFORM_FEE_BPS[tier] / 10000);
  const processingFee = Math.round(total * processingBps / 10000) + processingFixed;
  const cost = cents(request.estimatedCostCents ?? 0, 'Estimated service costs');
  const contribution = beforeTax - platformFee - processingFee - cost;
  return {
    status: 'owner_review', catalogVersion: catalog.version,
    lines, packageDiscountCents, minimumAdjustmentCents: minimumAdjustment,
    subtotalCents: beforeTax, taxCents: tax, perVisitCents: total,
    visitsPerYear: visits, annualCents: cents(total * visits), monthlyAverageCents: Math.round(total * visits / 12),
    ownerOnly: { platformFeeCents: platformFee, processingFeeCents: processingFee, estimatedCostCents: cost, contributionCents: contribution, contributionMarginPercent: beforeTax ? contribution / beforeTax * 100 : null },
    warnings: ['Planning estimate only. Owner approval is required.', 'Monthly average is not a monthly invoice or automatic charge.'],
  };
}

/** Public payload deliberately excludes cost, contribution and platform estimates. */
export function homeownerQuote(quote) {
  return { status: quote.status, catalogVersion: quote.catalogVersion,
    lines: quote.lines.map(({name,amountCents,includedNames}) => ({name,amountCents,...(includedNames ? {includedNames} : {})})),
    subtotalCents: quote.subtotalCents, taxCents: quote.taxCents, perVisitCents: quote.perVisitCents,
    visitsPerYear: quote.visitsPerYear, warnings: quote.warnings };
}
