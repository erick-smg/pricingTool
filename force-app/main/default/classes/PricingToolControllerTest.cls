@isTest
private class PricingToolControllerTest {
  private static Product2 createProduct(String code) {
    Product2 product = new Product2(
      Name = code,
      ProductCode = code,
      IsActive = true
    );
    insert product;
    return product;
  }

  private static Pricebook2 createSmgPricebook() {
    Pricebook2 pricebook = new Pricebook2(
      Name = 'SMG Price Book',
      IsActive = true
    );
    insert pricebook;
    return pricebook;
  }

  private static Id createPricebookEntry(
    Id pricebookId,
    Id productId,
    Double price
  ) {
    PricebookEntry entry = new PricebookEntry(
      Pricebook2Id = pricebookId,
      Product2Id = productId,
      UnitPrice = price,
      IsActive = true
    );
    insert entry;
    return entry.Id;
  }

  private static void createStandardPricebookEntry(
    Id productId,
    Double price
  ) {
    insert new PricebookEntry(
      Pricebook2Id = Test.getStandardPricebookId(),
      Product2Id = productId,
      UnitPrice = price,
      IsActive = true
    );
  }

  private static Opportunity createOpportunity() {
    Opportunity opp = new Opportunity(
      Name = 'Test Opp',
      StageName = 'Prospecting',
      CloseDate = Date.today().addMonths(1)
    );
    insert opp;
    return opp;
  }

  @isTest
  static void syncLineItems_assignsPricebookAndInsertsLines() {
    Product2 product = createProduct('BASE-STD-FOUND');
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
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
    Product2 product = createProduct('BASE-STD-FOUND');
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
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
    System.assertEquals(true, threw);
  }

  @isTest
  static void syncLineItems_opportunityAlreadyHasProductsFromAnotherPricebook_throwsError() {
    Product2 product = createProduct('BASE-STD-FOUND');
    Id standardEntryId = createPricebookEntry(
      Test.getStandardPricebookId(),
      product.Id,
      100
    );
    createSmgPricebook();

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
  }

  @isTest
  static void syncLineItems_unknownProductCode_throwsError() {
    Product2 product = createProduct('BASE-STD-FOUND');
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
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
    Product2 product = createProduct('BASE-PRO-ADV');
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = 'BASE-PRO-ADV';
    request.quantity = 1;
    request.unitPrice = 330480;
    request.description = 'Pro/Advanced — 1000 locations';
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
    System.assertEquals('BASE-PRO-ADV', results[0].productCode);
    System.assertEquals(330480, results[0].unitPrice);
    System.assertEquals('Pro/Advanced — 1000 locations', results[0].description);
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
    createSmgPricebook();
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
