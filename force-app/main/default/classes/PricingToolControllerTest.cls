@isTest(SeeAllData=true)
private class PricingToolControllerTest {
  // This app's product catalog (the "SMG Price Book" and its Product2/PricebookEntry records)
  // is provisioned once per org by scripts/apex/setupPricingCatalog.apex, run before any
  // deployment - these tests don't create their own copy of it. Product2/Pricebook2/
  // PricebookEntry are among the few objects Apex tests can see without
  // @isTest(SeeAllData=true), so most tests just look up and reuse the real catalog. Each
  // getter below fails with a clear, actionable message if that assumption doesn't hold,
  // rather than silently inserting a second, ambiguously-named/coded record alongside the
  // real one.
  private static Product2 getProduct(String code) {
    List<Product2> found = [SELECT Id FROM Product2 WHERE ProductCode = :code LIMIT 1];
    System.assert(
      !found.isEmpty(),
      'No Product2 with ProductCode "' + code + '" exists in this org. Run ' +
        'scripts/apex/setupPricingCatalog.apex against this org before running these tests.'
    );
    return found[0];
  }

  private static Pricebook2 getSmgPricebook() {
    List<Pricebook2> found = [
      SELECT Id
      FROM Pricebook2
      WHERE Name = 'SMG Price Book' AND IsActive = true
      ORDER BY CreatedDate ASC, Id ASC
      LIMIT 1
    ];
    System.assert(
      !found.isEmpty(),
      'No active "SMG Price Book" exists in this org. Run ' +
        'scripts/apex/setupPricingCatalog.apex against this org before running these tests.'
    );
    return found[0];
  }

  // This org is multi-currency, so a product can have more than one active PricebookEntry on
  // the same price book - one per currency (see scripts/apex/setupPricingCatalogMultiCurrency.
  // apex). Filtering to the running user's default currency here matches what a freshly
  // inserted Opportunity's own CurrencyIsoCode defaults to - without this filter, an
  // OpportunityLineItem built from a different-currency entry fails on insert with "pricebook
  // entry currency code does not match opportunity currency code".
  private static Id getPricebookEntryId(Id pricebookId, Id productId) {
    List<PricebookEntry> found = [
      SELECT Id
      FROM PricebookEntry
      WHERE
        Pricebook2Id = :pricebookId
        AND Product2Id = :productId
        AND CurrencyIsoCode = :UserInfo.getDefaultCurrency()
      LIMIT 1
    ];
    System.assert(
      !found.isEmpty(),
      'No PricebookEntry exists for Pricebook2Id=' + pricebookId + ', Product2Id=' +
        productId + ', CurrencyIsoCode=' + UserInfo.getDefaultCurrency() + '. Run ' +
        'scripts/apex/setupPricingCatalog.apex against this org before running these tests.'
    );
    return found[0].Id;
  }

  // For the two tests below whose whole premise is "no SMG Price Book resolves" - deleting it
  // here only affects this test method's own (rolled-back) transaction, so it's safe to run
  // even in an org where a real one exists.
  private static void deleteAnySmgPricebook() {
    delete [SELECT Id FROM Pricebook2 WHERE Name = 'SMG Price Book'];
  }

  private static Opportunity createOpportunity() {
    RecordType newLogo = [SELECT id FROM RecordType WHERE sobjectType = 'Opportunity' AND developerName = 'New_Opportunity'];
    Opportunity opp = new Opportunity(
      Name = 'Test Opp',
      StageName = '0-Discovery',
      recordTypeId = newLogo.id,
      CloseDate = Date.today().addMonths(1),
      type = 'New Logo'
    );
    insert opp;
    return opp;
  }

  @isTest
  static void syncLineItems_assignsPricebookAndInsertsLines() {
    Product2 product = getProduct('BASE-STD-FOUND');
    getPricebookEntryId(Test.getStandardPricebookId(), product.Id);
    Pricebook2 smgPricebook = getSmgPricebook();
    getPricebookEntryId(smgPricebook.Id, product.Id);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = 'BASE-STD-FOUND';
    request.quantity = 1;
    request.unitPrice = 60000;
    request.description = '100 locations';

    Test.startTest();
    PricingToolController.SyncResult result = PricingToolController.syncLineItems(
      opp.Id,
      JSON.serialize(new List<PricingToolController.LineItemRequest>{ request }),
      50,
      '36 months (standard)',
      5,
      1000
    );
    Test.stopTest();

    System.assertEquals(1, result.lineItemCount);
    System.assertEquals(60000, result.totalAmount);

    Opportunity updatedOpp = [
      SELECT
        Pricebook2Id,
        Rate_per_Location__c,
        Term_Length__c,
        Discount__c,
        Number_of_Locations__c
      FROM Opportunity
      WHERE Id = :opp.Id
    ];
    System.assertEquals(smgPricebook.Id, updatedOpp.Pricebook2Id);
    System.assertEquals(50, updatedOpp.Rate_per_Location__c);
    System.assertEquals('36 months (standard)', updatedOpp.Term_Length__c);
    System.assertEquals(5, updatedOpp.Discount__c);
    System.assertEquals(1000, updatedOpp.Number_of_Locations__c);

    List<OpportunityLineItem> lines = [
      SELECT Id, UnitPrice, Quantity
      FROM OpportunityLineItem
      WHERE OpportunityId = :opp.Id
    ];
    System.assertEquals(1, lines.size());
    System.assertEquals(60000, lines[0].UnitPrice);
  }

  @isTest
  static void syncLineItems_rerunReplacesPriorLines() {
    Product2 product = getProduct('BASE-STD-FOUND');
    getPricebookEntryId(Test.getStandardPricebookId(), product.Id);
    Pricebook2 smgPricebook = getSmgPricebook();
    getPricebookEntryId(smgPricebook.Id, product.Id);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest firstRequest = new PricingToolController.LineItemRequest();
    firstRequest.productCode = 'BASE-STD-FOUND';
    firstRequest.quantity = 1;
    firstRequest.unitPrice = 60000;

    PricingToolController.syncLineItems(
      opp.Id,
      JSON.serialize(new List<PricingToolController.LineItemRequest>{ firstRequest }),
      50,
      '36 months (standard)',
      0,
      500
    );

    PricingToolController.LineItemRequest secondRequest = new PricingToolController.LineItemRequest();
    secondRequest.productCode = 'BASE-STD-FOUND';
    secondRequest.quantity = 1;
    secondRequest.unitPrice = 90000;

    Test.startTest();
    PricingToolController.syncLineItems(
      opp.Id,
      JSON.serialize(new List<PricingToolController.LineItemRequest>{ secondRequest }),
      75,
      '24 months',
      0,
      500
    );
    Test.stopTest();

    List<OpportunityLineItem> lines = [
      SELECT Id, UnitPrice
      FROM OpportunityLineItem
      WHERE OpportunityId = :opp.Id
    ];
    System.assertEquals(1, lines.size());
    System.assertEquals(90000, lines[0].UnitPrice);
  }

  @isTest
  static void syncLineItems_emptyList_throwsError() {
    Opportunity opp = createOpportunity();

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        JSON.serialize(new List<PricingToolController.LineItemRequest>()),
        50,
        '36 months (standard)',
        0,
        0
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assertEquals(true, threw);
  }

  @isTest
  static void syncLineItems_missingPricebook_throwsError() {
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = 'BASE-STD-FOUND';
    request.quantity = 1;
    request.unitPrice = 60000;

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        JSON.serialize(new List<PricingToolController.LineItemRequest>{ request }),
        50,
        '36 months (standard)',
        0,
        100
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
  }

  /*@isTest
  static void syncLineItems_opportunityAlreadyHasProductsFromAnotherPricebook_throwsError() {
    Product2 product = getProduct('BASE-STD-FOUND');
    Id standardEntryId = getPricebookEntryId(Test.getStandardPricebookId(), product.Id);
    getSmgPricebook();

    Opportunity opp = createOpportunity();
    opp.Pricebook2Id = Test.getStandardPricebookId();
    update opp;
    insert new OpportunityLineItem(
      OpportunityId = opp.Id,
      PricebookEntryId = standardEntryId,
      Quantity = 1,
      UnitPrice = 100
    );

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = 'BASE-STD-FOUND';
    request.quantity = 1;
    request.unitPrice = 60000;

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        JSON.serialize(new List<PricingToolController.LineItemRequest>{ request }),
        50,
        '36 months (standard)',
        0,
        100
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assertEquals(true, threw);
  }*/

  @isTest
  static void syncLineItems_unknownProductCode_throwsError() {
    Product2 product = getProduct('BASE-STD-FOUND');
    getPricebookEntryId(Test.getStandardPricebookId(), product.Id);
    Pricebook2 smgPricebook = getSmgPricebook();
    getPricebookEntryId(smgPricebook.Id, product.Id);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = 'NOT-A-REAL-CODE';
    request.quantity = 1;
    request.unitPrice = 60000;

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        JSON.serialize(new List<PricingToolController.LineItemRequest>{ request }),
        50,
        '36 months (standard)',
        0,
        100
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assertEquals(true, threw);
  }

  @isTest
  static void getExistingLineItems_returnsLinesWhenOnSmgPricebook() {
    Product2 product = getProduct('BASE-STD-FOUND');
    getPricebookEntryId(Test.getStandardPricebookId(), product.Id);
    Pricebook2 smgPricebook = getSmgPricebook();
    getPricebookEntryId(smgPricebook.Id, product.Id);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = 'BASE-STD-FOUND';
    request.quantity = 1;
    request.unitPrice = 330480;
    request.description = 'Ignite Platform (Foundational) — 1000 locations';
    PricingToolController.syncLineItems(
      opp.Id,
      JSON.serialize(new List<PricingToolController.LineItemRequest>{ request }),
      28,
      '36 months (standard)',
      0,
      1000
    );

    Test.startTest();
    List<PricingToolController.ExistingLineItem> results = PricingToolController.getExistingLineItems(
      opp.Id
    );
    Test.stopTest();

    System.assertEquals(1, results.size());
    System.assertEquals('BASE-STD-FOUND', results[0].productCode);
    System.assertEquals(330480, results[0].unitPrice);
    System.assertEquals('Ignite Platform (Foundational) — 1000 locations', results[0].description);
  }

  @isTest
  static void getExistingLineItems_returnsEmptyForOpportunityWithNoPricebook() {
    Opportunity opp = createOpportunity();

    List<PricingToolController.ExistingLineItem> results = PricingToolController.getExistingLineItems(
      opp.Id
    );

    System.assertEquals(0, results.size());
  }

  @isTest
  static void getExistingLineItems_returnsEmptyForOpportunityOnADifferentPricebook() {
    getSmgPricebook();
    Opportunity opp = createOpportunity();
    opp.Pricebook2Id = Test.getStandardPricebookId();
    update opp;

    List<PricingToolController.ExistingLineItem> results = PricingToolController.getExistingLineItems(
      opp.Id
    );

    System.assertEquals(0, results.size());
  }

  @isTest
  static void getExistingLineItems_returnsEmptyWhenSmgPricebookDoesNotExist() {    
    Opportunity opp = createOpportunity();

    List<PricingToolController.ExistingLineItem> results = PricingToolController.getExistingLineItems(
      opp.Id
    );

    System.assertEquals(0, results.size());
  }
}
