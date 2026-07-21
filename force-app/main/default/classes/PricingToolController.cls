public with sharing class PricingToolController {
  private static final String PRICEBOOK_NAME = 'SMG Price Book';

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

  public class ExistingLineItem {
    @AuraEnabled
    public String productCode;
    @AuraEnabled
    public Double quantity;
    @AuraEnabled
    public Double unitPrice;
    @AuraEnabled
    public String description;
  }

  /**
   * Reads back this Opportunity's current SMG Price Book line items, if any, so the LWC can
   * pre-fill the Quote Builder from the Opportunity's existing configuration. Returns an empty
   * list (not an error) whenever there's nothing to pre-fill from - a brand new Opportunity, or
   * one on a different Price Book, is a perfectly normal starting point, not a failure.
   */
  @AuraEnabled(cacheable=true)
  public static List<ExistingLineItem> getExistingLineItems(Id opportunityId) {
    List<Pricebook2> pricebooks = [
      SELECT Id
      FROM Pricebook2
      WHERE Name = :PRICEBOOK_NAME AND IsActive = TRUE
      LIMIT 1
    ];
    if (pricebooks.isEmpty()) {
      return new List<ExistingLineItem>();
    }
    Id pricebookId = pricebooks[0].Id;

    List<Opportunity> opps = [
      SELECT Id, Pricebook2Id
      FROM Opportunity
      WHERE Id = :opportunityId
      LIMIT 1
    ];
    if (opps.isEmpty() || opps[0].Pricebook2Id != pricebookId) {
      return new List<ExistingLineItem>();
    }

    List<ExistingLineItem> results = new List<ExistingLineItem>();
    for (OpportunityLineItem oli : [
      SELECT Quantity, UnitPrice, Description, PricebookEntry.Product2.ProductCode
      FROM OpportunityLineItem
      WHERE OpportunityId = :opportunityId AND PricebookEntry.Pricebook2Id = :pricebookId
    ]) {
      ExistingLineItem item = new ExistingLineItem();
      item.productCode = oli.PricebookEntry.Product2.ProductCode;
      item.quantity = oli.Quantity;
      item.unitPrice = oli.UnitPrice;
      item.description = oli.Description;
      results.add(item);
    }
    return results;
  }

  @AuraEnabled
  public static SyncResult syncLineItems(
    Id opportunityId,
    String lineItemsJson,
    Double ratePerLocation,
    String termLength,
    Decimal discountPercent,
    Double numberOfLocations
  ) {
    try {
      List<LineItemRequest> lineItems = String.isBlank(lineItemsJson)
        ? new List<LineItemRequest>()
        : (List<LineItemRequest>) JSON.deserialize(
            lineItemsJson,
            List<LineItemRequest>.class
          );
      if (lineItems.isEmpty()) {
        throwError('No pricing selections to add.');
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
      opp.Pricebook2Id = pricebookId;
      opp.Rate_per_Location__c = ratePerLocation;
      opp.Term_Length__c = termLength;
      opp.Discount__c = discountPercent;
      opp.Number_of_Locations__c = numberOfLocations;
      update opp;

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
              '.'
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
      throwError('Failed to sync products: ' + e.getMessage());
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
