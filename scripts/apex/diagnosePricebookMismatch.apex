/**
 * One-off diagnostic - NOT part of the app. Replicates, outside of any test context, the exact
 * "assign Opportunity to the SMG Price Book, then insert an OpportunityLineItem against one of
 * its PricebookEntries" sequence that's failing in PricingToolControllerTest with
 * FIELD_INTEGRITY_EXCEPTION ("pricebook entry is in a different pricebook than the one assigned
 * to the opportunity"). Everything it touches is rolled back at the end via Database.rollback,
 * so it's safe to run against a real org - it leaves no data behind either way.
 *
 * Run with:
 *   sf apex run --file scripts/apex/diagnosePricebookMismatch.apex --target-org <alias>
 *
 * Paste back everything printed after "DIAG".
 */

Savepoint sp = Database.setSavepoint();
try {
  Id standardPricebookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1].Id;
  System.debug('DIAG standardPricebookId=' + standardPricebookId);

  Id smgPricebookId = [
    SELECT Id
    FROM Pricebook2
    WHERE Name = 'SMG Price Book' AND IsActive = true
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 1
  ].Id;
  System.debug('DIAG smgPricebookId=' + smgPricebookId);

  Id productId = [SELECT Id FROM Product2 WHERE ProductCode = 'BASE-STD-FOUND' LIMIT 1].Id;
  System.debug('DIAG productId=' + productId);

  PricebookEntry standardEntry = [
    SELECT Id, Pricebook2Id, IsActive
    FROM PricebookEntry
    WHERE Pricebook2Id = :standardPricebookId AND Product2Id = :productId
    LIMIT 1
  ];
  System.debug(
    'DIAG standardEntry.Id=' + standardEntry.Id +
    ' standardEntry.Pricebook2Id=' + standardEntry.Pricebook2Id +
    ' standardEntry.IsActive=' + standardEntry.IsActive
  );

  PricebookEntry smgEntry = [
    SELECT Id, Pricebook2Id, IsActive
    FROM PricebookEntry
    WHERE Pricebook2Id = :smgPricebookId AND Product2Id = :productId
    LIMIT 1
  ];
  System.debug(
    'DIAG smgEntry.Id=' + smgEntry.Id +
    ' smgEntry.Pricebook2Id=' + smgEntry.Pricebook2Id +
    ' smgEntry.IsActive=' + smgEntry.IsActive
  );

  Opportunity opp = new Opportunity(
    Name = 'PRICING_DIAG_TEMP - will be rolled back',
    StageName = 'Prospecting',
    CloseDate = Date.today().addMonths(1)
  );
  insert opp;
  System.debug('DIAG created temp opp Id=' + opp.Id);

  opp.Pricebook2Id = smgPricebookId;
  update opp;

  Opportunity reQueried = [SELECT Pricebook2Id FROM Opportunity WHERE Id = :opp.Id];
  System.debug(
    'DIAG re-queried opp.Pricebook2Id=' + reQueried.Pricebook2Id +
    ' (expected smgPricebookId=' + smgPricebookId + ')'
  );

  insert new OpportunityLineItem(
    OpportunityId = opp.Id,
    PricebookEntryId = smgEntry.Id,
    Quantity = 1,
    UnitPrice = 100
  );

  System.debug('DIAG SUCCESS - the insert worked with no error.');
} catch (Exception e) {
  System.debug('DIAG FAILURE: ' + e.getMessage());
} finally {
  Database.rollback(sp);
  System.debug('DIAG rolled back - no data was permanently changed.');
}
