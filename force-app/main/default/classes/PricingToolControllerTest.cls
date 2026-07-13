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
      Name = "SMG Price Book",
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
      Name = "Test Opp",
      StageName = "Prospecting",
      CloseDate = Date.today().addMonths(1)
    );
    insert opp;
    return opp;
  }

  @isTest
  static void syncLineItems_assignsPricebookAndInsertsLines() {
    Product2 product = createProduct("BASE-STD-FOUND");
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = "BASE-STD-FOUND";
    request.quantity = 1;
    request.unitPrice = 60000;
    request.description = "100 locations";

    Test.startTest();
    PricingToolController.SyncResult result = PricingToolController.syncLineItems(
      opp.Id,
      new List<PricingToolController.LineItemRequest>{ request }
    );
    Test.stopTest();

    System.assertEquals(1, result.lineItemCount);
    System.assertEquals(60000, result.totalAmount);

    Opportunity updatedOpp = [
      SELECT Pricebook2Id
      FROM Opportunity
      WHERE Id = :opp.Id
    ];
    System.assertEquals(smgPricebook.Id, updatedOpp.Pricebook2Id);

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
    Product2 product = createProduct("BASE-STD-FOUND");
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest firstRequest = new PricingToolController.LineItemRequest();
    firstRequest.productCode = "BASE-STD-FOUND";
    firstRequest.quantity = 1;
    firstRequest.unitPrice = 60000;

    PricingToolController.syncLineItems(
      opp.Id,
      new List<PricingToolController.LineItemRequest>{ firstRequest }
    );

    PricingToolController.LineItemRequest secondRequest = new PricingToolController.LineItemRequest();
    secondRequest.productCode = "BASE-STD-FOUND";
    secondRequest.quantity = 1;
    secondRequest.unitPrice = 90000;

    Test.startTest();
    PricingToolController.syncLineItems(
      opp.Id,
      new List<PricingToolController.LineItemRequest>{ secondRequest }
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
        new List<PricingToolController.LineItemRequest>()
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
    request.productCode = "BASE-STD-FOUND";
    request.quantity = 1;
    request.unitPrice = 60000;

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        new List<PricingToolController.LineItemRequest>{ request }
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assertEquals(true, threw);
  }

  @isTest
  static void syncLineItems_wrongExistingPricebook_throwsError() {
    Product2 product = createProduct("BASE-STD-FOUND");
    createStandardPricebookEntry(product.Id, 100);
    createSmgPricebook();

    Opportunity opp = createOpportunity();
    opp.Pricebook2Id = Test.getStandardPricebookId();
    update opp;

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = "BASE-STD-FOUND";
    request.quantity = 1;
    request.unitPrice = 60000;

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        new List<PricingToolController.LineItemRequest>{ request }
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assertEquals(true, threw);
  }

  @isTest
  static void syncLineItems_unknownProductCode_throwsError() {
    Product2 product = createProduct("BASE-STD-FOUND");
    createStandardPricebookEntry(product.Id, 100);
    Pricebook2 smgPricebook = createSmgPricebook();
    createPricebookEntry(smgPricebook.Id, product.Id, 100);
    Opportunity opp = createOpportunity();

    PricingToolController.LineItemRequest request = new PricingToolController.LineItemRequest();
    request.productCode = "NOT-A-REAL-CODE";
    request.quantity = 1;
    request.unitPrice = 60000;

    Boolean threw = false;
    try {
      PricingToolController.syncLineItems(
        opp.Id,
        new List<PricingToolController.LineItemRequest>{ request }
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assertEquals(true, threw);
  }
}
