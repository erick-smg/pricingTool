/**
 * Creates the "SMG Price Book" and every Product2 / PricebookEntry the Pricing Tool component
 * needs in order to sync line items to an Opportunity. Idempotent - safe to re-run; it only
 * inserts whatever doesn't already exist.
 *
 * Run this once against a target org after deploying the app's metadata:
 *
 *   sf apex run --file scripts/apex/setupPricingCatalog.apex --target-org <alias>
 *
 * The unit prices set here are placeholders (0). PricingToolController.syncLineItems always
 * overrides OpportunityLineItem.UnitPrice with what the LWC computes at sync time, so the
 * PricebookEntry's own price is never actually charged - it only needs to exist and be active
 * so syncLineItems can resolve a PricebookEntryId for each product code.
 *
 * Every code here is a code the LWC can currently sync (see BASE_PACKAGE_PRODUCT_CODES,
 * ADD_ON_PRODUCT_CODES, AGENT_TRACK_PRODUCT_CODES, RATINGS_REVIEWS_PRODUCT_CODES,
 * IGNITE_EX_PRODUCT_CODES, IGNITE_DIGITAL_EXTRA_PRODUCT_CODES, and the standalone product-code
 * constants in force-app/main/default/lwc/pricingTool/pricingTool.js). It does NOT include the
 * legacy, read-only codes (BASE-PRO-ADV, BASE-PRO-FOUND, SOLUTION-SUPPORT, IGNITE-EX,
 * ENT-LOC-SURVEY) that the tool no longer writes but can still parse back from older synced
 * Opportunities - those don't need active catalog entries to be read.
 */

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

  // AgentTrack (only the Web/"Agent Experience" variant is exposed in the UI today; IVR and
  // Web+IVR are supported by the pricing engine but not currently selectable)
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
  'CASE-MANAGEMENT' => 'Case Premium',
  'SETUP' => 'Setup Fee'
};

// 1. Product2 - create whichever of these codes don't already exist.
Map<String, Product2> productsByCode = new Map<String, Product2>();
for (Product2 existing : [
  SELECT Id, ProductCode
  FROM Product2
  WHERE ProductCode IN :productNamesByCode.keySet()
]) {
  productsByCode.put(existing.ProductCode, existing);
}

List<Product2> productsToInsert = new List<Product2>();
for (String code : productNamesByCode.keySet()) {
  if (!productsByCode.containsKey(code)) {
    productsToInsert.add(
      new Product2(Name = productNamesByCode.get(code), ProductCode = code, IsActive = true)
    );
  }
}
if (!productsToInsert.isEmpty()) {
  insert productsToInsert;
  for (Product2 created : productsToInsert) {
    productsByCode.put(created.ProductCode, created);
  }
}
System.debug(
  'Product2: ' + productsToInsert.size() + ' created, ' +
  (productNamesByCode.size() - productsToInsert.size()) + ' already existed.'
);

Set<Id> productIds = new Set<Id>();
for (Product2 p : productsByCode.values()) {
  productIds.add(p.Id);
}

// 2. Standard Price Book entries - a product must have one of these before it can get an
// entry on any custom price book.
Id standardPricebookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1].Id;

Set<Id> productIdsWithStandardEntry = new Set<Id>();
for (PricebookEntry entry : [
  SELECT Product2Id
  FROM PricebookEntry
  WHERE Pricebook2Id = :standardPricebookId AND Product2Id IN :productIds
]) {
  productIdsWithStandardEntry.add(entry.Product2Id);
}

List<PricebookEntry> standardEntriesToInsert = new List<PricebookEntry>();
for (Product2 p : productsByCode.values()) {
  if (!productIdsWithStandardEntry.contains(p.Id)) {
    standardEntriesToInsert.add(
      new PricebookEntry(
        Pricebook2Id = standardPricebookId,
        Product2Id = p.Id,
        UnitPrice = 0,
        IsActive = true
      )
    );
  }
}
if (!standardEntriesToInsert.isEmpty()) {
  insert standardEntriesToInsert;
}
System.debug('Standard Price Book entries created: ' + standardEntriesToInsert.size());

// 3. "SMG Price Book" - find or create.
Pricebook2 smgPricebook;
List<Pricebook2> existingSmgPricebooks = [
  SELECT Id, IsActive
  FROM Pricebook2
  WHERE Name = 'SMG Price Book'
  LIMIT 1
];
if (existingSmgPricebooks.isEmpty()) {
  smgPricebook = new Pricebook2(Name = 'SMG Price Book', IsActive = true);
  insert smgPricebook;
  System.debug('Created SMG Price Book: ' + smgPricebook.Id);
} else {
  smgPricebook = existingSmgPricebooks[0];
  System.debug('SMG Price Book already existed: ' + smgPricebook.Id);
  if (!smgPricebook.IsActive) {
    smgPricebook.IsActive = true;
    update smgPricebook;
    System.debug('Reactivated SMG Price Book.');
  }
}

// 4. SMG Price Book entries - syncLineItems looks one of these up for every product code it
// tries to sync.
Set<Id> productIdsWithSmgEntry = new Set<Id>();
for (PricebookEntry entry : [
  SELECT Product2Id
  FROM PricebookEntry
  WHERE Pricebook2Id = :smgPricebook.Id AND Product2Id IN :productIds
]) {
  productIdsWithSmgEntry.add(entry.Product2Id);
}

List<PricebookEntry> smgEntriesToInsert = new List<PricebookEntry>();
for (Product2 p : productsByCode.values()) {
  if (!productIdsWithSmgEntry.contains(p.Id)) {
    smgEntriesToInsert.add(
      new PricebookEntry(
        Pricebook2Id = smgPricebook.Id,
        Product2Id = p.Id,
        UnitPrice = 0,
        IsActive = true
      )
    );
  }
}
if (!smgEntriesToInsert.isEmpty()) {
  insert smgEntriesToInsert;
}
System.debug('SMG Price Book entries created: ' + smgEntriesToInsert.size());

System.debug(
  'Done - ' + productNamesByCode.size() + ' product codes are active on the SMG Price Book.'
);
