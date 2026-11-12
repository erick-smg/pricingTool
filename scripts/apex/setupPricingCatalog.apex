/**
 * Makes sure the "SMG Price Book" has every product the Pricing Tool can sync, in every
 * currency an Opportunity can be written in. This is the only catalog script - run it after
 * deploying the app's metadata, and again whenever a product code or currency is added:
 *
 *   sf apex run --file scripts/apex/setupPricingCatalog.apex --target-org <alias>
 *
 * Idempotent - safe to re-run as often as you like. For each product code below it:
 *   1. creates the Product2 if it is missing, and reactivates it if it was deactivated;
 *   2. finds the "SMG Price Book" the controller uses (the oldest active one), reactivating or
 *      creating it if needed;
 *   3. ensures an active PricebookEntry exists on the Standard Price Book AND on the SMG Price
 *      Book in every currency - Salesforce requires the standard entry in a currency before a
 *      custom price book can have one in that currency.
 * Product names that were edited in the org are left alone.
 *
 * Currencies: every currency that is active in the org gets entries, because the tool converts
 * its USD rate card into whatever currency the Opportunity is in and the controller syncs only
 * to an entry in that exact currency. REQUIRED_CURRENCIES must be active - the script stops
 * before changing anything if one is not (Setup > Company Information > Manage Currencies).
 *
 * Unit prices are placeholders (0). PricingToolController.syncLineItems always overrides
 * OpportunityLineItem.UnitPrice with what the LWC computes, so the entry's own price is never
 * charged - it only has to exist and be active.
 *
 * Product codes: every code the LWC can write (see the *_PRODUCT_CODE(S) constants in
 * force-app/main/default/lwc/pricingTool/pricingTool.js). Legacy read-only codes (BASE-PRO-ADV,
 * BASE-PRO-FOUND, SOLUTION-SUPPORT, IGNITE-EX, IGNITE-DIGITAL, ENT-LOC-SURVEY) are deliberately
 * left out - the tool can parse them back from older Opportunities but never syncs them.
 */

final String PRICEBOOK_NAME = 'SMG Price Book';
final List<String> REQUIRED_CURRENCIES = new List<String>{ 'USD', 'CAD', 'EUR', 'GBP' };

Map<String, String> productNamesByCode = new Map<String, String>{
  // Ignite Platform base package (priced by Service Tier)
  'BASE-STD-FOUND' => 'Ignite Platform - Foundational',
  'BASE-STD-ADV' => 'Ignite Platform - Advanced',
  'BASE-ELITE' => 'Ignite Platform - Elite',

  // Add-ons over the base package
  'ADDON-LANG-SURVEY' => 'Add\'l Language - Survey Translation',
  'ADDON-LANG-REPORT' => 'Add\'l Language - Report Translation',
  'ADDON-SURVEY' => 'Add\'l Survey',
  'ADDON-SURVEY-REV' => 'Add\'l Survey Revision',
  'ADDON-INTEGRATION' => 'Add\'l Integration',
  'ADDON-BRAND' => 'Add\'l Brand',
  'ADDON-PERFORMANCE' => 'Add\'l Performance',
  'ADDON-AGILE' => 'Add\'l Agile',
  'ADDON-CONSULTATIVE' => 'Add\'l Consultative',

  // AgentTrack (only Web is selectable in the UI today; IVR and Web+IVR are supported by the
  // pricing engine)
  'AGENTTRACK-WEB' => 'AgentTrack - Agent Experience (Web)',
  'AGENTTRACK-IVR' => 'AgentTrack - IVR',
  'AGENTTRACK-WEBIVR' => 'AgentTrack - Web + IVR',

  // Reputation Management
  'RR-PREMIUM' => 'Reputation Management - Premium',
  'RR-PRO' => 'Reputation Management - Pro',
  'RR-BASIC' => 'Reputation Management - Basic',

  // Ignite EX
  'EX-ENG1CONSULT' => 'Ignite EX - Long Form Annual Survey (1 Engagement + 1 Consultative)',
  'EX-ENG2CONSULT' => 'Ignite EX - Long Form Annual Survey (2 Engagement + 2 Consultative)',
  'EX-PULSE' => 'Ignite EX - Pulse',
  'EX-ONBOARD-SETUP' => 'Ignite EX - Onboard (Setup Fee)',
  'EX-ONBOARD-ANNUAL' => 'Ignite EX - Onboard (Annual Fee)',
  'EX-ONBOARD-STAGGERED' => 'Ignite EX - Staggered Onboard (4 points)',
  'EX-EXIT-SETUP' => 'Ignite EX - Exit (Setup Fee)',
  'EX-EXIT-ANNUAL' => 'Ignite EX - Exit (Annual Fee)',
  'EX-ALWAYSON-SETUP' => 'Ignite EX - Always-On (Setup Fee)',
  'EX-ALWAYSON-ANNUAL' => 'Ignite EX - Always-On (Annual Fee)',
  'EX-AGILE-PAIR' => 'Ignite EX - 2 Agile Analyses',
  'EX-PERF-INSIGHT' => 'Ignite EX - Performance Insight',
  'EX-CONSULTATIVE' => 'Ignite EX - Consultative',

  // Ignite Digital (no flat/base fee - priced entirely through these two components)
  'IGNITE-DIGITAL-MOUSEFLOW' => 'Ignite Digital - Mouseflow Config',
  'IGNITE-DIGITAL-CONTACTUS' => 'Ignite Digital - Contact Us (Inform)',

  // Other add-ons
  'IGNITE-COMMUNITIES' => 'Ignite Communities',
  'SMS-SURVEY-INVITE' => 'SMS Survey Invite',
  'CASE-MANAGEMENT' => 'Case Premium',
  'SETUP' => 'Setup Fee'
};

// 1. Currencies - stop before any DML if a required one is not active.
Set<String> activeCurrencies = new Set<String>();
for (CurrencyType ct : [SELECT IsoCode FROM CurrencyType WHERE IsActive = TRUE]) {
  activeCurrencies.add(ct.IsoCode);
}
List<String> inactiveRequired = new List<String>();
for (String isoCode : REQUIRED_CURRENCIES) {
  if (!activeCurrencies.contains(isoCode)) {
    inactiveRequired.add(isoCode);
  }
}
if (!inactiveRequired.isEmpty()) {
  System.debug(
    LoggingLevel.ERROR,
    'STOP - nothing was changed. These currencies are not active in this org: ' +
    String.join(inactiveRequired, ', ') +
    '. Activate them under Setup > Company Information > Manage Currencies, then re-run.'
  );
  return;
}
List<String> currencies = new List<String>(activeCurrencies);
currencies.sort();

// 2. Product2 - create what is missing, reactivate what was deactivated.
Map<String, Product2> productsByCode = new Map<String, Product2>();
for (Product2 existing : [
  SELECT Id, ProductCode, IsActive
  FROM Product2
  WHERE ProductCode IN :productNamesByCode.keySet()
  ORDER BY CreatedDate ASC, Id ASC
]) {
  // If a code was duplicated in the org, keep the oldest record.
  if (!productsByCode.containsKey(existing.ProductCode)) {
    productsByCode.put(existing.ProductCode, existing);
  }
}

List<Product2> productsToInsert = new List<Product2>();
List<Product2> productsToReactivate = new List<Product2>();
for (String code : productNamesByCode.keySet()) {
  Product2 existing = productsByCode.get(code);
  if (existing == null) {
    productsToInsert.add(
      new Product2(Name = productNamesByCode.get(code), ProductCode = code, IsActive = true)
    );
  } else if (!existing.IsActive) {
    existing.IsActive = true;
    productsToReactivate.add(existing);
  }
}
insert productsToInsert;
update productsToReactivate;
for (Product2 created : productsToInsert) {
  productsByCode.put(created.ProductCode, created);
}

Set<Id> productIds = new Set<Id>();
for (Product2 p : productsByCode.values()) {
  productIds.add(p.Id);
}

// 3. Price books - the Standard one, and the SMG one the controller resolves (oldest active).
Id standardPricebookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = TRUE LIMIT 1].Id;

String pricebookAction = 'already active';
List<Pricebook2> smgPricebooks = [
  SELECT Id, IsActive
  FROM Pricebook2
  WHERE Name = :PRICEBOOK_NAME
  ORDER BY IsActive DESC, CreatedDate ASC, Id ASC
  LIMIT 1
];
Pricebook2 smgPricebook;
if (smgPricebooks.isEmpty()) {
  smgPricebook = new Pricebook2(Name = PRICEBOOK_NAME, IsActive = true);
  insert smgPricebook;
  pricebookAction = 'created';
} else {
  smgPricebook = smgPricebooks[0];
  if (!smgPricebook.IsActive) {
    smgPricebook.IsActive = true;
    update smgPricebook;
    pricebookAction = 'reactivated';
  }
}

// 4. PricebookEntry - one active entry per (price book, product, currency). Standard entries
// are inserted first because a custom-price-book entry requires one in the same currency.
Map<String, PricebookEntry> entriesByKey = new Map<String, PricebookEntry>();
for (PricebookEntry entry : [
  SELECT Id, Pricebook2Id, Product2Id, CurrencyIsoCode, IsActive
  FROM PricebookEntry
  WHERE
    Pricebook2Id IN (:standardPricebookId, :smgPricebook.Id)
    AND Product2Id IN :productIds
    AND CurrencyIsoCode IN :currencies
]) {
  entriesByKey.put(entry.Pricebook2Id + '|' + entry.Product2Id + '|' + entry.CurrencyIsoCode, entry);
}

List<PricebookEntry> standardToInsert = new List<PricebookEntry>();
List<PricebookEntry> smgToInsert = new List<PricebookEntry>();
List<PricebookEntry> entriesToReactivate = new List<PricebookEntry>();
for (Id productId : productIds) {
  for (String isoCode : currencies) {
    for (Id pricebookId : new List<Id>{ standardPricebookId, smgPricebook.Id }) {
      PricebookEntry existing = entriesByKey.get(pricebookId + '|' + productId + '|' + isoCode);
      if (existing == null) {
        PricebookEntry created = new PricebookEntry(
          Pricebook2Id = pricebookId,
          Product2Id = productId,
          CurrencyIsoCode = isoCode,
          UnitPrice = 0,
          IsActive = true
        );
        if (pricebookId == standardPricebookId) {
          standardToInsert.add(created);
        } else {
          smgToInsert.add(created);
        }
      } else if (!existing.IsActive) {
        existing.IsActive = true;
        entriesToReactivate.add(existing);
      }
    }
  }
}
insert standardToInsert;
update entriesToReactivate;
insert smgToInsert;

// 5. Summary.
Integer expectedEntries = productIds.size() * currencies.size() * 2;
System.debug(
  '\n=== SMG Price Book setup complete ===' +
  '\nCurrencies: ' + String.join(currencies, ', ') +
  '\nProducts: ' + productNamesByCode.size() + ' codes - ' + productsToInsert.size() +
    ' created, ' + productsToReactivate.size() + ' reactivated' +
  '\n' + PRICEBOOK_NAME + ' (' + smgPricebook.Id + '): ' + pricebookAction +
  '\nPrice book entries: ' + expectedEntries + ' needed - ' +
    standardToInsert.size() + ' standard + ' + smgToInsert.size() + ' SMG created, ' +
    entriesToReactivate.size() + ' reactivated'
);
