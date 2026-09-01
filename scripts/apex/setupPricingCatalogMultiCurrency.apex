/**
 * Adds CAD, EUR, and GBP PricebookEntry records - on both the Standard Price Book and the
 * "SMG Price Book" - for every product code the Pricing Tool can sync. Run AFTER
 * scripts/apex/setupPricingCatalog.apex, which must have already created the Product2 records
 * and the "SMG Price Book" itself; this script only adds the additional-currency entries on
 * top of that. Idempotent - safe to re-run, only inserts whatever combination doesn't already
 * exist.
 *
 *   sf apex run --file scripts/apex/setupPricingCatalogMultiCurrency.apex --target-org <alias>
 *
 * Prerequisite: CAD, EUR, and GBP must already be active currencies in this org
 * (Setup > Company Information > Manage Currencies) - this script checks for that and stops
 * with a clear message rather than failing on a cryptic DML error if they aren't.
 *
 * Unit prices here are placeholders (0), same reasoning as setupPricingCatalog.apex -
 * PricingToolController.syncLineItems always overrides OpportunityLineItem.UnitPrice with what
 * the LWC computes at sync time, so the PricebookEntry's own price is never actually charged.
 */

List<String> productCodes = new List<String>{
  'BASE-STD-FOUND',
  'BASE-STD-ADV',
  'BASE-ELITE',
  'ADDON-LANG-SURVEY',
  'ADDON-LANG-REPORT',
  'ADDON-SURVEY',
  'ADDON-SURVEY-REV',
  'ADDON-INTEGRATION',
  'ADDON-BRAND',
  'ADDON-PERFORMANCE',
  'ADDON-AGILE',
  'ADDON-CONSULTATIVE',
  'AGENTTRACK-WEB',
  'AGENTTRACK-IVR',
  'AGENTTRACK-WEBIVR',
  'RR-PREMIUM',
  'RR-PRO',
  'RR-BASIC',
  'EX-ENG1CONSULT',
  'EX-ENG2CONSULT',
  'EX-PULSE',
  'EX-ONBOARD-SETUP',
  'EX-ONBOARD-ANNUAL',
  'EX-ONBOARD-STAGGERED',
  'EX-EXIT-SETUP',
  'EX-EXIT-ANNUAL',
  'EX-ALWAYSON-SETUP',
  'EX-ALWAYSON-ANNUAL',
  'EX-AGILE-PAIR',
  'EX-PERF-INSIGHT',
  'EX-CONSULTATIVE',
  'IGNITE-DIGITAL-MOUSEFLOW',
  'IGNITE-DIGITAL-CONTACTUS',
  'IGNITE-COMMUNITIES',
  'CASE-MANAGEMENT',
  'SETUP'
};

List<String> currencies = new List<String>{ 'CAD', 'EUR', 'GBP' };

// 1. Confirm the currencies are actually active before doing anything else.
Map<String, Boolean> activeByIsoCode = new Map<String, Boolean>();
for (CurrencyType ct : [SELECT IsoCode, IsActive FROM CurrencyType WHERE IsoCode IN :currencies]) {
  activeByIsoCode.put(ct.IsoCode, ct.IsActive);
}
List<String> inactiveCurrencies = new List<String>();
for (String currency : currencies) {
  if (activeByIsoCode.get(currency) != true) {
    inactiveCurrencies.add(currency);
  }
}
if (!inactiveCurrencies.isEmpty()) {
  System.debug(
    LoggingLevel.ERROR,
    'STOP: the following currencies are not active in this org - activate them under ' +
    'Setup > Company Information > Manage Currencies, then re-run this script: ' +
    String.join(inactiveCurrencies, ', ')
  );
  return;
}

// 2. Look up the products - these must already exist (created by setupPricingCatalog.apex).
Map<String, Id> productIdByCode = new Map<String, Id>();
for (Product2 p : [SELECT Id, ProductCode FROM Product2 WHERE ProductCode IN :productCodes]) {
  productIdByCode.put(p.ProductCode, p.Id);
}
List<String> missingProductCodes = new List<String>();
for (String code : productCodes) {
  if (!productIdByCode.containsKey(code)) {
    missingProductCodes.add(code);
  }
}
if (!missingProductCodes.isEmpty()) {
  System.debug(
    LoggingLevel.ERROR,
    'STOP: run scripts/apex/setupPricingCatalog.apex first - these product codes don\'t ' +
    'exist yet: ' + String.join(missingProductCodes, ', ')
  );
  return;
}

// 3. Look up the Standard Price Book and the "SMG Price Book" - both must already exist.
Id standardPricebookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1].Id;

List<Pricebook2> smgPricebooks = [
  SELECT Id
  FROM Pricebook2
  WHERE Name = 'SMG Price Book' AND IsActive = true
  ORDER BY CreatedDate ASC, Id ASC
  LIMIT 1
];
if (smgPricebooks.isEmpty()) {
  System.debug(
    LoggingLevel.ERROR,
    'STOP: no active "SMG Price Book" exists - run scripts/apex/setupPricingCatalog.apex first.'
  );
  return;
}
Id smgPricebookId = smgPricebooks[0].Id;

// 4. Figure out which (Pricebook2, Product2, currency) combinations already exist, so this can
// be safely re-run without hitting a DUPLICATE_VALUE error.
Set<Id> productIds = new Set<Id>(productIdByCode.values());
Set<String> existingKeys = new Set<String>();
for (PricebookEntry entry : [
  SELECT Pricebook2Id, Product2Id, CurrencyIsoCode
  FROM PricebookEntry
  WHERE
    Pricebook2Id IN (:standardPricebookId, :smgPricebookId)
    AND Product2Id IN :productIds
    AND CurrencyIsoCode IN :currencies
]) {
  existingKeys.add(entry.Pricebook2Id + '|' + entry.Product2Id + '|' + entry.CurrencyIsoCode);
}

List<PricebookEntry> entriesToInsert = new List<PricebookEntry>();
for (String code : productCodes) {
  Id productId = productIdByCode.get(code);
  for (String currency : currencies) {
    String standardKey = standardPricebookId + '|' + productId + '|' + currency;
    if (!existingKeys.contains(standardKey)) {
      entriesToInsert.add(
        new PricebookEntry(
          Pricebook2Id = standardPricebookId,
          Product2Id = productId,
          CurrencyIsoCode = currency,
          UnitPrice = 0,
          IsActive = true
        )
      );
    }

    String smgKey = smgPricebookId + '|' + productId + '|' + currency;
    if (!existingKeys.contains(smgKey)) {
      entriesToInsert.add(
        new PricebookEntry(
          Pricebook2Id = smgPricebookId,
          Product2Id = productId,
          CurrencyIsoCode = currency,
          UnitPrice = 0,
          IsActive = true
        )
      );
    }
  }
}

if (!entriesToInsert.isEmpty()) {
  insert entriesToInsert;
}

Integer expectedTotal = productCodes.size() * currencies.size() * 2;
System.debug(
  'Done - ' + entriesToInsert.size() + ' new PricebookEntry record(s) created across ' +
  currencies.size() + ' currencies (' + String.join(currencies, ', ') + ') for ' +
  productCodes.size() + ' product codes on both price books. ' +
  (expectedTotal - entriesToInsert.size()) + ' of ' + expectedTotal + ' already existed.'
);
