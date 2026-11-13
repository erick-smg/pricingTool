public with sharing class PricingToolController {
  private static final String PRICEBOOK_NAME = 'SMG Price Book';
  // On a Renewal the tool only records which products the customer has - the deal value is the
  // prior contract's, held in Preceding_Amount__c ("GRR Baseline"). The synced product total is
  // forced to that amount whatever the tool priced the products at.
  @TestVisible
  private static final String RENEWAL_OPPORTUNITY_TYPE = 'Renewal';

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
    // True when the line totals were overridden to match the Renewal's Preceding_Amount__c.
    @AuraEnabled
    public Boolean matchedPrecedingAmount = false;
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
   * Active currency conversion rates, keyed by ISO code, as maintained under Setup > Company
   * Information > Manage Currencies. Each rate is the number of units of that currency per one
   * unit of the corporate currency, so a USD rate card converts to the Opportunity currency by
   * multiplying. The corporate currency itself is always 1.
   *
   * Dated exchange rates (Advanced Currency Management) are deliberately not used: a quote is
   * priced at today's rate, not at the rate on the Opportunity close date.
   */
  @AuraEnabled(cacheable=true)
  public static Map<String, Decimal> getCurrencyConversionRates() {
    Map<String, Decimal> ratesByIsoCode = new Map<String, Decimal>();
    for (CurrencyType currencyType : [
      SELECT IsoCode, ConversionRate
      FROM CurrencyType
      WHERE IsActive = TRUE
    ]) {
      ratesByIsoCode.put(currencyType.IsoCode, currencyType.ConversionRate);
    }
    return ratesByIsoCode;
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
      ORDER BY CreatedDate ASC, Id ASC
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
        ORDER BY CreatedDate ASC, Id ASC
        LIMIT 1
      ];
      if (pricebooks.isEmpty()) {
        throwError(
          'No active Price Book named "' + PRICEBOOK_NAME + '" was found.'
        );
      }
      Id pricebookId = pricebooks[0].Id;

      Opportunity opp = [
        SELECT Id, Pricebook2Id, CurrencyIsoCode, Type, Preceding_Amount__c
        FROM Opportunity
        WHERE Id = :opportunityId
        LIMIT 1
      ];
      Boolean isRenewal = opp.Type == RENEWAL_OPPORTUNITY_TYPE;
      if (isRenewal && opp.Preceding_Amount__c == null) {
        throwError(
          'This Renewal has no GRR Baseline (Preceding Amount). Fill it in on the ' +
            'Opportunity first - on a Renewal the product total is set to that amount.'
        );
      }
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

      // CurrencyIsoCode matters here: this org is multi-currency, so a product can have more
      // than one active PricebookEntry on the same price book - one per currency. Without this
      // filter, the query below could resolve to an entry in a different currency than the
      // Opportunity's own, which fails on insert with "pricebook entry currency code does not
      // match opportunity currency code".
      Map<String, Id> pricebookEntryIdByProductCode = new Map<String, Id>();
      for (PricebookEntry entry : [
        SELECT Id, Product2.ProductCode
        FROM PricebookEntry
        WHERE
          Pricebook2Id = :pricebookId
          AND Product2.ProductCode IN :productCodes
          AND CurrencyIsoCode = :opp.CurrencyIsoCode
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

      if (isRenewal) {
        matchLineTotalsTo(lineItemsToInsert, opp.Preceding_Amount__c);
        totalAmount = opp.Preceding_Amount__c;
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
      result.matchedPrecedingAmount = isRenewal;
      return result;
    } catch (AuraHandledException e) {
      throw e;
    } catch (Exception e) {
      throwError('Failed to sync products: ' + e.getMessage());
      return null;
    }
  }

  /**
   * Rewrites the lines so their TotalPrice values add up to exactly targetTotal. The target is
   * split in proportion to what the tool priced each line at, so the relative mix of products
   * is kept; if every line was priced at zero it is split evenly. Rounding pennies go to the
   * largest line. TotalPrice is set instead of UnitPrice so a line's Quantity (e.g. number of
   * pulses) is kept - Salesforce derives the unit price from it.
   */
  @TestVisible
  private static void matchLineTotalsTo(
    List<OpportunityLineItem> lines,
    Decimal targetTotal
  ) {
    if (lines.isEmpty()) {
      return;
    }
    List<Decimal> weights = new List<Decimal>();
    Decimal weightSum = 0;
    for (OpportunityLineItem line : lines) {
      Decimal quantity = line.Quantity == null ? 0 : line.Quantity;
      Decimal unitPrice = line.UnitPrice == null ? 0 : line.UnitPrice;
      Decimal weight = quantity * unitPrice;
      if (weight < 0) {
        weight = 0;
      }
      weights.add(weight);
      weightSum += weight;
    }

    Decimal allocated = 0;
    Integer largestIndex = 0;
    List<Decimal> shares = new List<Decimal>();
    for (Integer i = 0; i < lines.size(); i++) {
      Decimal share = weightSum > 0
        ? (targetTotal * weights[i] / weightSum).setScale(2, RoundingMode.HALF_UP)
        : (targetTotal / lines.size()).setScale(2, RoundingMode.HALF_UP);
      shares.add(share);
      allocated += share;
      if (share > shares[largestIndex]) {
        largestIndex = i;
      }
    }
    shares.set(largestIndex, shares[largestIndex] + (targetTotal - allocated));

    for (Integer i = 0; i < lines.size(); i++) {
      lines[i].UnitPrice = null;
      lines[i].TotalPrice = shares[i];
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
