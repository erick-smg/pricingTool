public with sharing class PricingToolController {
  private static final String PRICEBOOK_NAME = "SMG Price Book";

  public class LineItemRequest {
    @AuraEnabled
    public String productCode;
    @AuraEnabled
    public Double quantity;
    @AuraEnabled
    public Double unitPrice;
    @AuraEnabled
    public String description;
  }

  public class SyncResult {
    @AuraEnabled
    public Integer lineItemCount;
    @AuraEnabled
    public Decimal totalAmount;
  }

  @AuraEnabled
  public static SyncResult syncLineItems(
    Id opportunityId,
    List<LineItemRequest> lineItems
  ) {
    try {
      if (lineItems == null || lineItems.isEmpty()) {
        throwError("No pricing selections to add.");
      }

      List<Pricebook2> pricebooks = [
        SELECT Id
        FROM Pricebook2
        WHERE Name = :PRICEBOOK_NAME AND IsActive = TRUE
        LIMIT 1
      ];
      if (pricebooks.isEmpty()) {
        throwError(
          'No active Price Book named "' + PRICEBOOK_NAME + '" was found.'
        );
      }
      Id pricebookId = pricebooks[0].Id;

      Opportunity opp = [
        SELECT Id, Pricebook2Id
        FROM Opportunity
        WHERE Id = :opportunityId
        LIMIT 1
      ];
      if (opp.Pricebook2Id == null) {
        opp.Pricebook2Id = pricebookId;
        update opp;
      } else if (opp.Pricebook2Id != pricebookId) {
        throwError(
          "This Opportunity is on a different Price Book. Switch its Price Book to \"" +
            PRICEBOOK_NAME +
            "\" before adding pricing tool products."
        );
      }

      Set<String> productCodes = new Set<String>();
      for (LineItemRequest item : lineItems) {
        productCodes.add(item.productCode);
      }

      Map<String, Id> pricebookEntryIdByProductCode = new Map<String, Id>();
      for (PricebookEntry entry : [
        SELECT Id, Product2.ProductCode
        FROM PricebookEntry
        WHERE
          Pricebook2Id = :pricebookId
          AND Product2.ProductCode IN :productCodes
          AND IsActive = TRUE
      ]) {
        pricebookEntryIdByProductCode.put(
          entry.Product2.ProductCode,
          entry.Id
        );
      }

      List<OpportunityLineItem> lineItemsToInsert = new List<OpportunityLineItem>();
      Decimal totalAmount = 0;
      for (LineItemRequest item : lineItems) {
        Id pricebookEntryId = pricebookEntryIdByProductCode.get(
          item.productCode
        );
        if (pricebookEntryId == null) {
          throwError(
            'No active Price Book Entry found for product code "' +
              item.productCode +
              '" on ' +
              PRICEBOOK_NAME +
              "."
          );
        }
        OpportunityLineItem lineItem = new OpportunityLineItem();
        lineItem.OpportunityId = opportunityId;
        lineItem.PricebookEntryId = pricebookEntryId;
        lineItem.Quantity = item.quantity;
        lineItem.UnitPrice = item.unitPrice;
        lineItem.Description = item.description;
        lineItemsToInsert.add(lineItem);
        totalAmount += nvl(item.quantity) * nvl(item.unitPrice);
      }

      delete [
        SELECT Id
        FROM OpportunityLineItem
        WHERE
          OpportunityId = :opportunityId
          AND PricebookEntry.Pricebook2Id = :pricebookId
      ];

      insert lineItemsToInsert;

      SyncResult result = new SyncResult();
      result.lineItemCount = lineItemsToInsert.size();
      result.totalAmount = totalAmount;
      return result;
    } catch (AuraHandledException e) {
      throw e;
    } catch (Exception e) {
      throwError("Failed to sync products: " + e.getMessage());
      return null;
    }
  }

  private static Double nvl(Double value) {
    return value == null ? 0 : value;
  }

  private static void throwError(String message) {
    AuraHandledException ex = new AuraHandledException(message);
    ex.setMessage(message);
    throw ex;
  }
}
