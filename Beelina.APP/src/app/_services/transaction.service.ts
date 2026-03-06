import { inject, Injectable } from '@angular/core';
import { ApolloQueryResult } from '@apollo/client/core';
import { Store } from '@ngrx/store';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { TranslateService } from '@ngx-translate/core';
import { Apollo, gql, MutationResult } from 'apollo-angular';
import { catchError, map, take } from 'rxjs';

import { Product } from '../_models/product';
import { OutletTypeHelper } from '../_helpers/outlet-type.helper';
import { ProductTransaction, ProductTransactionQuantityHistory, Transaction } from '../_models/transaction';

import { TransactionStatusEnum } from '../_enum/transaction-status.enum';
import { PaymentStatusEnum } from '../_enum/payment-status.enum';

import { DateFormatter } from '../_helpers/formatters/date-formatter.helper';
import { NumberFormatter } from '../_helpers/formatters/number-formatter.helper';
import { IProductTransactionInput } from '../_interfaces/inputs/iproduct-transaction.input';
import { ITransactionInput } from '../_interfaces/inputs/itransaction.input';
import { ITransactionOutput } from '../_interfaces/outputs/itransaction.output';

import { SortOrderOptionsEnum } from '../_enum/sort-order-options.enum';
import { AppStateInterface } from '../_interfaces/app-state.interface';
import { IBaseConnection } from '../_interfaces/connections/ibase.connection';

import {
  endCursorSelector as endCursorSelectorTopSellingProducts,
  fromDateSelector as fromDateSelectorTopSellingProducts,
  sortOrderSelector as sortOrderSelectorTopSellingProducts,
  toDateSelector as toDateSelectorTopSellingProducts,
} from '../product/top-products/store/selectors';

import { environment } from 'src/environments/environment';
import { OutletTypeEnum } from '../_enum/outlet-type.enum';
import { ISendInvoiceTransactionOutput } from '../_interfaces/outputs/isend-invoice-transaction.output';
import { ITransactionPayload } from '../_interfaces/payloads/itransaction.payload';
import { DateRange } from '../_models/date-range';
import { TransactionsFilter } from '../_models/filters/transactions.filter';
import { GeneralSettings } from '../_models/general-settings.model';
import { TransactionSalesPerSalesAgent } from '../_models/sales-per-agent';
import { SalesPerDateRange } from '../_models/sales-per-date-range';
import { User } from '../_models/user.model';
import { ProfitBreakdown } from '../_models/profit-breakdown.model';

const REGISTER_TRANSACTION_QUERY = gql`
  query ($transactionInput: TransactionInput!) {
    registerTransaction(transactionInput: $transactionInput) {
      id
    }
  }
`;

const REGISTER_TRANSACTIONS_QUERY = gql`
  query ($transactionInputs: [TransactionInput!]!) {
    registerTransactions(transactionInputs: $transactionInputs) {
      id
    }
  }
`;

const DELETE_TRANSACTION = gql`
mutation($transactionIds: [Int!]!) {
  deleteTransactions(input: { transactionIds: $transactionIds }) {
    boolean
  }
}
`;

const SET_TRANSACTION_STATUS = gql`
mutation($transactionIds: [Int!]!, $status: TransactionStatusEnum!, $markAsPaid: Boolean!) {
  setTransactionsStatus(input: { transactionIds: $transactionIds, status: $status, markAsPaid: $markAsPaid }) {
    boolean
  }
}
`;

const DELETE_TRANSACTIONS_BY_DATE = gql`
mutation($transactionStatus: TransactionStatusEnum!, $transactionDates: [String!]!) {
  deleteTransactionsByDate(input: { transactionStatus: $transactionStatus, transactionDates: $transactionDates }) {
    boolean
  }
}
`;

const GET_TRANSACTION_DATES = gql`
  query (
    $cursor: String
    $sortOrder: SortEnumType
    $transactionStatus: TransactionStatusEnum!
    $fromDate: String
    $toDate: String,
    $paymentStatus: PaymentStatusEnum,
    $limit: Int!
  ) {
    transactionDates(
      after: $cursor
      order: [{ transactionDate: $sortOrder }]
      transactionStatus: $transactionStatus
      fromDate: $fromDate
      toDate: $toDate,
      paymentStatus: $paymentStatus,
      first: $limit
    ) {
      edges {
        cursor
        node {
          transactionDate
          allTransactionsPaid
        }
      }
      nodes {
        transactionDate
        allTransactionsPaid
        numberOfUnPaidTransactions
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
    }
  }
`;

const GET_TRANSACTIONS_QUERY = gql`
  query(
  $filterKeyword: String,
  $cursor: String,
  $transactionsFilter: TransactionsFilterInput!) {
    transactions(
    filterKeyword: $filterKeyword,
    after: $cursor,
    transactionsFilter: $transactionsFilter
  ) {
      nodes {
        id,
        storeId,
        invoiceNo,
        createdBy,
        detailsUpdatedBy
        detailsDateUpdated
        orderItemsDateUpdated
        finalDateUpdated
        createdById,
        transactionDate,
        hasUnpaidProductTransaction,
        barangayName
        storeName
        status
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
      totalCount
    }
  }
`;

const GET_TRANSACTIONS_BY_SALES_AGENT_AND_INVOICE_QUERY = gql`
  query($invoiceSearchTerm: String, $salesAgentId: Int!, $first: Int, $after: String) {
  transactionsByInvoiceNo(
    invoiceSearchTerm: $invoiceSearchTerm,
    salesAgentId: $salesAgentId,
    first: $first,
    after: $after
  ) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      id,
      storeId
      invoiceNo
      createdBy
      detailsUpdatedBy
      detailsDateUpdated
      orderItemsDateUpdated
      finalDateUpdated
      status
      transactionDate,
      hasUnpaidProductTransaction,
      barangayName
      storeName
    }
  }
}
`;

const GET_APPROVED_TRANSACTIONS_BY_DATE = gql`
  query ($transactionDate: String!, $status: TransactionStatusEnum!) {
    transactionsByDate(transactionDate: $transactionDate, status: $status) {
      id
      invoiceNo
      storeId
      storeName
      transactionDate
      hasUnpaidProductTransaction
    }
  }
`;

const GET_TRANSACTION = gql`
  query ($transactionId: Int!) {
    transaction(transactionId: $transactionId) {
      transaction {
        id
        storeId
        invoiceNo
        discount
        transactionDate
        dueDate
        hasUnpaidProductTransaction
        status
        total
        balance
        modeOfPayment
        createdBy {
            id
            firstName
            lastName
        }
        store {
          id
          name
          address
          paymentMethod {
            id
            name
          }
          barangay {
            name
          }
        }
        productTransactions {
          id
          transactionId
          productId
          quantity
          price
          status
          currentQuantity
          product {
            id
            code
            name
            price
            productUnit {
                name
            }
          }
          productTransactionQuantityHistory {
              quantity
              dateCreated
          }
        }
      }
      badOrderAmount
    }
  }
`;

const UPDATE_MODE_OF_PAYMENT = gql`
  mutation ($transactionId: Int!, $modeOfPayment: Int!) {
    updateModeOfPayment(input: { transactionId: $transactionId, modeOfPayment: $modeOfPayment }) {
      transaction {
        id
      }
    }
  }
`;

const MARK_TRANSACTIONS_AS_PAID = gql`
  mutation($transactionIds: [Int!]!, $paid: Boolean!) {
    markTransactionsAsPaid(input: { transactionIds: $transactionIds, paid: $paid }) {
      transaction{
        id
      }
    }
  }
`;

const GET_TOP_SELLING_PRODUCTS = gql`
  query(
    $userId: Int!,
    $fromDate: String,
    $toDate: String
    $cursor: String
    $sortOrder: SortEnumType,
  ) {
    topSellingProducts(
        userId: $userId
        fromDate: $fromDate
        toDate: $toDate
        after: $cursor
        order: [{totalAmount : $sortOrder }]
    ) {
      nodes {
        id
        code
        name
        unitName
        count
        totalAmount
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
      totalCount
    }
  }
`;

const GET_TRANSACTION_SALES = gql`
  query ($userId: Int!, $fromDate: String!, $toDate: String!) {
    transactionSales(userId: $userId, fromDate: $fromDate, toDate: $toDate) {
      totalSalesAmount
      cashAmountOnHand
      chequeAmountOnHand
      totalAmountOnHand
      badOrderAmount
      accountReceivables
    }
  }
`;

const GET_TRANSACTION_SALES_PER_DATE_RANGE_QUERY = gql`
  query ($userId: Int!, $dateRanges: [DateRangeInput!]!) {
    transactionSalesPerDateRange(userId: $userId, dateRanges: $dateRanges) {
      fromDate
      toDate
      label
      totalSales
      cashAmountOnHand
      chequeAmountOnHand
      totalAmountOnHand
      badOrderAmount
      accountReceivables
    }
  }
`;

const GET_TRANSACTION_SALES_FOR_ALL_PER_DATE_RANGE_QUERY = gql`
  query ($fromDate: String!, $toDate: String!) {
    salesForAllSalesAgent(fromDate: $fromDate, toDate: $toDate) {
      id
      salesAgentName
      sales
    }
  }
`;

const GET_PROFIT_QUERY = gql`
  query ($userId: Int!, $fromDate: String!, $toDate: String!) {
    profit(userId: $userId, fromDate: $fromDate, toDate: $toDate)
  }
`;

const GET_PROFIT_BREAKDOWN_QUERY = gql`
  query ($userId: Int!, $fromDate: String!, $toDate: String!) {
    profitBreakdown(userId: $userId, fromDate: $fromDate, toDate: $toDate) {
      purchaseOrderDiscountProfit
      salesPriceProfit
      totalProfit
      purchaseOrderDiscountProfitPercentage
      salesPriceProfitPercentage
    }
  }
`;

const GET_CUSTOMER_SALES_PRODUCTS_QUERY = gql`
  query(
    $storeId: Int!
  ) {
  customerSaleProducts (
        storeId: $storeId
    ) {
        productId
        productCode
        productName
        unit
        totalSalesAmount
    }
  }
`;

const GET_INVOICE_DATA_QUERY = gql`
  query($transactionId: Int!) {
    generalSettings {
      companyName
      ownerName
      address
      invoiceFooterText
      invoiceFooterText1
      telephone
      faxTelephone
      tin
    }
    transaction(transactionId: $transactionId) {
        transaction {
          id
          storeId
          invoiceNo
          discount
          transactionDate
          dueDate
          hasUnpaidProductTransaction
          status
          total
          balance
          createdBy {
              id
              firstName
              lastName
          }
          store {
              id
              name
              address
              paymentMethod {
              name
              }
              barangay {
              name
              }
          }
          productTransactions {
              id
              transactionId
              productId
              quantity
              price
              status
              currentQuantity
              product {
                  id
                  code
                  name
                  price
                  productUnit {
                      name
                  }
              }
              productTransactionQuantityHistory {
                  quantity
                  dateCreated
              }
          }
        }
        badOrderAmount
    }
  }
`;

const GET_TOP_CUSTOMER_SALES_QUERY = gql`
  query(
    $storeId: Int!,
    $fromDate: String,
    $toDate: String,
    $cursor: String,
    $sortOrder: SortEnumType
  ) {
  topCustomerSales (
        storeId: $storeId
        fromDate: $fromDate
        toDate: $toDate
        after: $cursor
        order: { totalSalesAmount: $sortOrder }
    ) {
      nodes {
          storeId
          storeName
          outletType
          numberOfTransactions
          totalSalesAmount
        }
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
        totalCount
      }
  }
`;

const SEND_ORDER_RECEIPT_EMAIL_NOTIFICATION = gql`
  query($transactionId: Int!) {
    sendTransactionEmailReceipt(transactionId: $transactionId)
  }
`;

const SEND_INVOICE_TRANSACTION_QUERY = `
  mutation(
    $userId: Int!,
    $transactionId: Int!,
    $file: Upload!) {
      sendInvoiceTransaction(input: { userId: $userId, transactionId: $transactionId, file: $file }) {
        boolean
      }
  }
`;

export class TransactionInformation {
  public id: number;
  public invoiceNo: string;
  public createdBy: string;
  public detailsUpdatedBy: string;
  public detailsDateUpdated: Date;
  public orderItemsDateUpdated: Date;
  public finalDateUpdated: Date;
  public createdById: number;
  public storeId: number;
  public storeName: string;
  public barangayName: string;
  public transactionDate: Date;
  public hasUnpaidProductTransaction: boolean;
  public status: TransactionStatusEnum;
}

export class TransactionDetails {
  public transaction: Transaction;
  public badOrderAmount: number;
}

export class TransactionDateInformation {
  public transactionDate: Date;
  public allTransactionsPaid: boolean;
  public numberOfUnPaidTransactions: number;
  public isLocal: boolean;

  get transactionDateFormatted(): string {
    return DateFormatter.format(this.transactionDate, 'MMM DD, YYYY');
  }
}

export class TransactionSales {
  public totalSalesAmount: number;
  public cashAmountOnHand: number;
  public chequeAmountOnHand: number;
  public totalAmountOnHand: number;
  public badOrderAmount: number;
  public accountReceivables: number;
}

export class TransactionDto {
  public id: number = 0;
  public invoiceNo: string;
  public discount: number;
  public storeId: number;
  public modeOfPayment: number;
  public status: TransactionStatusEnum;
  public transactionDate: string;
  public dueDate: string;
  public paid: boolean;
  public productTransactions: Array<ProductTransaction>;
}

export interface IMarkTransactionAsPaidPayLoad {
  id: number;
  name: string;
}

export class TopSellingProduct {
  public id: number;
  public code: string;
  public unitName: string;
  public name: string;
  public count: number;
  public totalAmount: number;

  get totalAmountFormatted(): string {
    return NumberFormatter.formatCurrency(this.totalAmount);
  }
}

export class CustomerSale {
  public storeId: number;
  public storeName: string;
  public outletType: string;
  public numberOfTransactions: number;
  public totalSalesAmount: number;

  get totalSalesAmountFormatted(): string {
    return NumberFormatter.formatCurrency(this.totalSalesAmount);
  }
}

export class CustomerSaleProduct {
  public productId: number;
  public productCode: string;
  public productName: string;
  public unit: string;
  public totalSalesAmount: number;

  get totalSalesAmountFormatted(): string {
    return NumberFormatter.formatCurrency(this.totalSalesAmount);
  }
}

export class InvoiceData {
  public generalSettings: GeneralSettings;
  public transaction: TransactionDetails;

  constructor() {
    this.generalSettings = new GeneralSettings();
    this.transaction = new TransactionDetails();
  }
}

@Injectable({ providedIn: 'root' })
export class TransactionService {

  private apollo = inject(Apollo);
  private http = inject(HttpClient);
  private store = inject(Store<AppStateInterface>);
  private translateService = inject(TranslateService);

  registerTransaction(transaction: TransactionDto) {
    const transactionInput: ITransactionInput = {
      id: transaction.id,
      invoiceNo: transaction.invoiceNo,
      discount: transaction.discount,
      storeId: transaction.storeId,
      modeOfPayment: transaction.modeOfPayment,
      paid: transaction.paid,
      status: transaction.status,
      transactionDate: transaction.transactionDate,
      dueDate: transaction.dueDate,
      productTransactionInputs: transaction.productTransactions.map((p) => {
        const productTransaction: IProductTransactionInput = {
          id: (p.id <= 0 || transaction.id <= 0) ? 0 : p.id,
          productId: p.productId,
          quantity: p.quantity,
          price: p.price,
          currentQuantity: p.currentQuantity,
        };

        return productTransaction;
      }),
    };

    return this.apollo
      .watchQuery({
        query: REGISTER_TRANSACTION_QUERY,
        variables: {
          transactionInput,
        },
      }).valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{ registerTransaction: ITransactionPayload }>
          ) => {
            const output = result.data.registerTransaction;
            const payload = output.id;

            if (payload) {
              return payload;
            }

            return null;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  registerTransactions(transactions: Array<TransactionDto>) {
    const transactionInputs: Array<ITransactionInput> = transactions.map((transaction) => {
      return {
        id: transaction.id,
        invoiceNo: transaction.invoiceNo,
        discount: transaction.discount,
        storeId: transaction.storeId,
        modeOfPayment: transaction.modeOfPayment,
        paid: transaction.paid,
        status: transaction.status,
        transactionDate: transaction.transactionDate,
        dueDate: transaction.dueDate,
        productTransactionInputs: transaction.productTransactions.map((p) => {
          const productTransaction: IProductTransactionInput = {
            id: p.id,
            productId: p.productId,
            quantity: p.quantity,
            price: p.price,
            currentQuantity: p.currentQuantity,
          };

          return productTransaction;
        }),
      };
    });

    return this.apollo
      .watchQuery({
        query: REGISTER_TRANSACTIONS_QUERY,
        variables: {
          transactionInputs,
        },
      }).valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{ registerTransactions: ITransactionPayload }>
          ) => {
            const output = result.data.registerTransactions;
            const payload = output;

            if (payload) {
              return payload;
            }

            return null;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  deleteTransactions(transactionIds: Array<number>) {
    return this.apollo
      .mutate({
        mutation: DELETE_TRANSACTION,
        variables: {
          transactionIds,
        },
      })
      .pipe(
        map(
          (
            result: MutationResult<{ deleteTransactions: { boolean: boolean } }>
          ) => {
            const output = result.data.deleteTransactions;
            const payload = output.boolean;

            if (payload) {
              return payload;
            }

            return null;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  setTransactionsStatus(transactionIds: Array<number>, status: TransactionStatusEnum, markAsPaid: boolean = false) {
    return this.apollo
      .mutate({
        mutation: SET_TRANSACTION_STATUS,
        variables: {
          transactionIds,
          status,
          markAsPaid
        },
      })
      .pipe(
        map(
          (
            result: MutationResult<{ setTransactionsStatus: { boolean: boolean } }>
          ) => {
            const output = result.data.setTransactionsStatus;
            const payload = output.boolean;

            if (payload) {
              return payload;
            }

            throw new Error("Failed to set transactions status.");
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  deleteTransactionsByDate(transactionStatus: TransactionStatusEnum, transactionDates: Array<string>) {
    return this.apollo
      .mutate({
        mutation: DELETE_TRANSACTIONS_BY_DATE,
        variables: {
          transactionStatus,
          transactionDates
        },
      })
      .pipe(
        map(
          (
            result: MutationResult<{ deleteTransactionsByDate: { boolean: boolean } }>
          ) => {
            const output = result.data.deleteTransactionsByDate;
            const payload = output.boolean;

            if (payload) {
              return payload;
            }

            return null;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  getTransactionsByDate(
    transactionDate: string,
    status: TransactionStatusEnum
  ) {
    return this.apollo
      .watchQuery({
        query: GET_APPROVED_TRANSACTIONS_BY_DATE,
        variables: {
          transactionDate,
          status,
        },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transactionsByDate: Array<TransactionInformation>;
            }>
          ) => {
            return result.data.transactionsByDate.map((t) => {
              const transaction = new Transaction();
              transaction.id = t.id;
              transaction.invoiceNo = t.invoiceNo;
              transaction.storeId = t.storeId;
              transaction.store.name = t.storeName;
              transaction.hasUnpaidProductTransaction =
                t.hasUnpaidProductTransaction;
              transaction.isLocal = false;
              return transaction;
            });
          }
        )
      );
  }

  getTransactions(
    cursor: string,
    filterKeyword: string,
    transactionsFilter: TransactionsFilter
  ) {
    return this.apollo
      .watchQuery({
        query: GET_TRANSACTIONS_QUERY,
        variables: {
          filterKeyword,
          cursor,
          transactionsFilter
        },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transactions: IBaseConnection;
            }>
          ) => {

            const data = result.data.transactions;
            const endCursor = data.pageInfo.endCursor;
            const hasNextPage = data.pageInfo.hasNextPage;
            const totalCount = data.totalCount;
            const transactionsDto = <Array<TransactionInformation>>data.nodes;

            const transactions = transactionsDto.map((t) => {
              const transaction = new Transaction();
              transaction.id = t.id;
              transaction.invoiceNo = t.invoiceNo;
              transaction.storeId = t.storeId;
              transaction.createdBy = t.createdBy;
              transaction.detailsUpdatedBy = t.detailsUpdatedBy;
              transaction.detailsDateUpdated = t.detailsDateUpdated;
              transaction.orderItemsDateUpdated = t.orderItemsDateUpdated;
              transaction.finalDateUpdated = t.finalDateUpdated;
              transaction.createdById = t.createdById;
              transaction.status = t.status;
              transaction.transactionDate = t.transactionDate;
              transaction.store.name = t.storeName;
              transaction.barangay.name = t.barangayName;
              transaction.hasUnpaidProductTransaction =
                t.hasUnpaidProductTransaction;
              return transaction;
            });

            if (transactions) {
              return {
                endCursor,
                hasNextPage,
                transactions,
                totalCount
              };
            }

            return null;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  getTransactionsByInvoiceNo(
    salesAgentId: number,
    invoiceSearchTerm: string = "",
    cursor: string = null,
    limit: number = 50
  ) {
    return this.apollo
      .watchQuery({
        query: GET_TRANSACTIONS_BY_SALES_AGENT_AND_INVOICE_QUERY,
        variables: {
          salesAgentId,
          invoiceSearchTerm,
          first: limit,
          after: cursor
        },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transactionsByInvoiceNo: IBaseConnection;
            }>
          ) => {
            const data = result.data.transactionsByInvoiceNo;
            const endCursor = data.pageInfo.endCursor;
            const hasNextPage = data.pageInfo.hasNextPage;
            const totalCount = data.totalCount;
            const transactionsDto = <Array<TransactionInformation>>data.nodes;

            const transactions = transactionsDto.map((t) => {
              const transaction = new Transaction();
              transaction.id = t.id;
              transaction.invoiceNo = t.invoiceNo;
              transaction.storeId = t.storeId;
              transaction.createdBy = t.createdBy;
              transaction.detailsUpdatedBy = t.detailsUpdatedBy;
              transaction.detailsDateUpdated = t.detailsDateUpdated;
              transaction.orderItemsDateUpdated = t.orderItemsDateUpdated;
              transaction.finalDateUpdated = t.finalDateUpdated;
              transaction.status = t.status;
              transaction.transactionDate = t.transactionDate;
              transaction.store.name = t.storeName;
              transaction.barangay.name = t.barangayName;
              transaction.hasUnpaidProductTransaction =
                t.hasUnpaidProductTransaction;
              return transaction;
            });

            if (transactions) {
              return {
                endCursor,
                hasNextPage,
                transactions,
                totalCount
              };
            }

            return null;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  sendOrderReceiptEmailNotification(
    transactionId: number
  ) {
    return this.apollo
      .watchQuery({
        query: SEND_ORDER_RECEIPT_EMAIL_NOTIFICATION,
        variables: {
          transactionId
        },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              sendTransactionEmailReceipt: boolean;
            }>
          ) => {
            return result.data.sendTransactionEmailReceipt;
          }
        )
      );
  }

  getTransaction(transactionId: number) {
    return this.apollo
      .watchQuery({
        query: GET_TRANSACTION,
        variables: {
          transactionId,
        },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transaction: TransactionDetails;
            }>
          ) => {
            const transactionFromRepo = result.data.transaction;
            const transaction = new Transaction();
            transaction.id = transactionFromRepo.transaction.id;
            transaction.badOrderAmount = transactionFromRepo.badOrderAmount;
            transaction.invoiceNo = transactionFromRepo.transaction.invoiceNo;
            transaction.discount = transactionFromRepo.transaction.discount;
            transaction.transactionDate = transactionFromRepo.transaction.transactionDate;
            transaction.dueDate = transactionFromRepo.transaction.dueDate;
            transaction.storeId = transactionFromRepo.transaction.storeId;
            transaction.store = transactionFromRepo.transaction.store;
            transaction.modeOfPayment = transactionFromRepo.transaction.modeOfPayment;
            transaction.balance = transactionFromRepo.transaction.balance;
            transaction.total = transactionFromRepo.transaction.total;
            transaction.hasUnpaidProductTransaction =
              transactionFromRepo.transaction.hasUnpaidProductTransaction;
            transaction.status = transactionFromRepo.transaction.status;

            const createdBy = new User();
            const createdByFromRepo = <User>transactionFromRepo.transaction.createdBy;
            createdBy.id = createdByFromRepo.id;
            createdBy.firstName = createdByFromRepo.firstName;
            createdBy.lastName = createdByFromRepo.lastName;

            transaction.createdBy = createdBy;

            transaction.productTransactions =
              transactionFromRepo.transaction.productTransactions.map((pt) => {
                const productTransaction = new ProductTransaction();
                productTransaction.id = pt.id;
                productTransaction.quantity = pt.quantity;
                productTransaction.currentQuantity = pt.currentQuantity;
                productTransaction.price = pt.price;
                productTransaction.status = pt.status;
                productTransaction.productName = pt.product.name;
                productTransaction.productId = pt.product.id;
                productTransaction.code = pt.product.code;

                productTransaction.product = new Product();
                productTransaction.product.id = pt.product.id;
                productTransaction.product.code = pt.product.code;
                productTransaction.product.name = pt.product.name;
                productTransaction.product.price = pt.product.price;
                productTransaction.product.productUnit = pt.product.productUnit;

                productTransaction.productTransactionQuantityHistory = pt.productTransactionQuantityHistory.map((ptqh) => {
                  const productTransactionQuantityHistory = new ProductTransactionQuantityHistory();
                  productTransactionQuantityHistory.id = ptqh.id;
                  productTransactionQuantityHistory.quantity = ptqh.quantity;
                  return productTransactionQuantityHistory;
                });

                return productTransaction;
              });

            return transaction;
          }
        )
      );
  }

  getTransactioDates(transactionStatus: TransactionStatusEnum, cursor: string, limit: number, sortOrder: SortOrderOptionsEnum, fromDate: string, toDate: string, paymentStatus?: PaymentStatusEnum) {

    return this.apollo
      .watchQuery({
        query: GET_TRANSACTION_DATES,
        variables: {
          cursor,
          limit,
          sortOrder,
          transactionStatus,
          fromDate,
          toDate,
          paymentStatus,
        },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transactionDates: IBaseConnection;
            }>
          ) => {
            const data = result.data.transactionDates;
            const errors = result.errors;
            const endCursor = data.pageInfo.endCursor;
            const hasNextPage = data.pageInfo.hasNextPage;
            const transactionDates = <Array<TransactionDateInformation>>(
              data.nodes.map((t: TransactionDateInformation) => {
                const transactionHistoryDate = new TransactionDateInformation();
                transactionHistoryDate.transactionDate = t.transactionDate;
                transactionHistoryDate.numberOfUnPaidTransactions =
                  t.numberOfUnPaidTransactions;
                transactionHistoryDate.allTransactionsPaid =
                  t.allTransactionsPaid;
                transactionHistoryDate.isLocal = false;
                return transactionHistoryDate;
              })
            );

            // Apply client-side filtering for payment status if backend doesn't support it
            let filteredTransactionDates = transactionDates;
            if (paymentStatus && paymentStatus !== PaymentStatusEnum.All) {
              filteredTransactionDates = transactionDates.filter(td => {
                if (paymentStatus === PaymentStatusEnum.Paid) {
                  return td.allTransactionsPaid === true;
                } else if (paymentStatus === PaymentStatusEnum.Unpaid) {
                  return td.allTransactionsPaid === false;
                }
                return true;
              });
            }

            if (filteredTransactionDates) {
              return {
                endCursor,
                hasNextPage,
                transactionDates: filteredTransactionDates,
              };
            }

            if (errors && errors.length > 0) {
              throw new Error(errors[0].message);
            }

            return null;
          }
        )
      );
  }

  getTopSellingProducts(userId: number, useStore: boolean = true) {

    let cursor = null,
      sortOrder = SortOrderOptionsEnum.DESCENDING,
      fromDate = null,
      toDate = null;

    if (useStore) {
      this.store
        .select(endCursorSelectorTopSellingProducts)
        .pipe(take(1))
        .subscribe((currentCursor) => (cursor = currentCursor));

      this.store
        .select(sortOrderSelectorTopSellingProducts)
        .pipe(take(1))
        .subscribe((currentSortOrder) => (sortOrder = currentSortOrder));

      this.store
        .select(fromDateSelectorTopSellingProducts)
        .pipe(take(1))
        .subscribe((currentFromDate) => (fromDate = currentFromDate));

      this.store
        .select(toDateSelectorTopSellingProducts)
        .pipe(take(1))
        .subscribe((currentToDate) => (toDate = currentToDate));
    }

    return this.apollo
      .watchQuery({
        query: GET_TOP_SELLING_PRODUCTS,
        variables: {
          userId,
          fromDate,
          toDate,
          cursor,
          sortOrder
        }
      })
      .valueChanges.pipe(
        map((result: ApolloQueryResult<{ topSellingProducts: IBaseConnection }>) => {
          const data = result.data.topSellingProducts;
          const errors = result.errors;
          const endCursor = data.pageInfo.endCursor;
          const hasNextPage = data.pageInfo.hasNextPage;
          const totalCount = data.totalCount;
          const topProducts = <Array<TopSellingProduct>>data.nodes;

          const topSellingProducts: Array<TopSellingProduct> = topProducts.map((stockAudit: TopSellingProduct) => {
            const topProducts = new TopSellingProduct();
            topProducts.id = stockAudit.id;
            topProducts.code = stockAudit.code;
            topProducts.name = stockAudit.name;
            topProducts.unitName = stockAudit.unitName;
            topProducts.count = stockAudit.count;
            topProducts.totalAmount = stockAudit.totalAmount;
            return topProducts;
          });

          if (topSellingProducts) {
            return {
              endCursor,
              hasNextPage,
              totalCount,
              topSellingProducts,
            };
          }

          if (errors && errors.length > 0) {
            throw new Error(errors[0].message);
          }

          return null;
        })
      );
  }

  getTransactionSales(userId: number, fromDate: string = '', toDate: string = '') {

    return this.apollo
      .watchQuery({
        query: GET_TRANSACTION_SALES,
        variables: { userId, fromDate, toDate },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transactionSales: TransactionSales;
            }>
          ) => {
            return result.data.transactionSales;
          }
        )
      );
  }

  getProfit(userId: number, fromDate: string, toDate: string) {
    return this.apollo
      .watchQuery({
        query: GET_PROFIT_QUERY,
        variables: { userId, fromDate, toDate },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              profit: number;
            }>
          ) => {
            return result.data.profit;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  getProfitBreakdown(userId: number, fromDate: string, toDate: string) {
    return this.apollo
      .watchQuery({
        query: GET_PROFIT_BREAKDOWN_QUERY,
        variables: { userId, fromDate, toDate },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              profitBreakdown: ProfitBreakdown;
            }>
          ) => {
            return result.data.profitBreakdown;
          }
        ),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }

  getTransactionSalesPerDateRange(userId: number, dateRanges: Array<DateRange>) {
    return this.apollo
      .watchQuery({
        query: GET_TRANSACTION_SALES_PER_DATE_RANGE_QUERY,
        variables: { userId, dateRanges },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              transactionSalesPerDateRange: Array<SalesPerDateRange>;
            }>
          ) => {
            return result.data.transactionSalesPerDateRange;
          }
        )
      );
  }

  getTransactionSalesForAllPerDateRange(fromDate: string = '', toDate: string = '') {
    return this.apollo
      .watchQuery({
        query: GET_TRANSACTION_SALES_FOR_ALL_PER_DATE_RANGE_QUERY,
        variables: { fromDate, toDate },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              salesForAllSalesAgent: Array<TransactionSalesPerSalesAgent>;
            }>
          ) => {
            const data = result.data.salesForAllSalesAgent;
            const salesForAllSalesAgents = <Array<TransactionSalesPerSalesAgent>>(
              data.map((t: TransactionSalesPerSalesAgent) => {
                const transactionSalesPerSalesAgent = new TransactionSalesPerSalesAgent();
                transactionSalesPerSalesAgent.id = t.id;
                transactionSalesPerSalesAgent.salesAgentName = t.salesAgentName;
                transactionSalesPerSalesAgent.sales = t.sales;
                return transactionSalesPerSalesAgent;
              })
            )
            return salesForAllSalesAgents;
          }
        )
      );
  }

  getTopStoresSales(storeId: number = 0, fromDate: string = '', toDate: string = '', cursor: string = '', sortOrder: SortOrderOptionsEnum = SortOrderOptionsEnum.DESCENDING) {
    return this.apollo
      .watchQuery({
        query: GET_TOP_CUSTOMER_SALES_QUERY,
        variables: {
          storeId,
          fromDate,
          toDate,
          cursor,
          sortOrder
        },
      })
      .valueChanges.pipe(
        map(
        (
            result: ApolloQueryResult<{
              topCustomerSales: IBaseConnection;
            }>
          ) => {
            const data = result.data.topCustomerSales;
            const endCursor = data.pageInfo.endCursor;
            const hasNextPage = data.pageInfo.hasNextPage;
            const totalCount = data.totalCount;
            const customerSaleData = <Array<CustomerSale>>data.nodes;

            const customerSales: Array<CustomerSale> = customerSaleData.map((t: CustomerSale) => {
              const customerSale = new CustomerSale();
              customerSale.storeId = t.storeId;
              customerSale.storeName = t.storeName;
              customerSale.numberOfTransactions = t.numberOfTransactions;
              customerSale.outletType = OutletTypeHelper.getOutletTypeDisplayText(t.outletType, this.translateService);
              customerSale.totalSalesAmount = t.totalSalesAmount;
              return customerSale;
            });

            if (customerSales) {
              return {
                endCursor,
                hasNextPage,
                totalCount,
                topCustomerSales: customerSales,
              };
            }

            return {
              endCursor: null,
              hasNextPage: false,
              totalCount: 0,
              topCustomerSales: [],
            };
          }
        )
      );
  }

  getStoresSalesProducts(storeId: number) {
    return this.apollo
      .watchQuery({
        query: GET_CUSTOMER_SALES_PRODUCTS_QUERY,
        variables: { storeId },
      })
      .valueChanges.pipe(
        map(
          (
            result: ApolloQueryResult<{
              customerSaleProducts: Array<CustomerSaleProduct>;
            }>
          ) => {
            const data = result.data.customerSaleProducts;
            const customerSales = <Array<CustomerSaleProduct>>(
              data.map((t: CustomerSaleProduct) => {
                const customerSale = new CustomerSaleProduct();
                customerSale.productId = t.productId;
                customerSale.productCode = t.productCode;
                customerSale.productName = t.productName;
                customerSale.unit = t.unit;
                customerSale.totalSalesAmount = t.totalSalesAmount;
                return customerSale;
              })
            )
            return customerSales;
          }
        )
      );
  }

  getInvoiceData(transactionId: number) {
    return this.apollo
      .watchQuery({
        query: GET_INVOICE_DATA_QUERY,
        variables: { transactionId },
      })
      .valueChanges.pipe(
        map(
          (result: ApolloQueryResult<InvoiceData>) => {
            const resultData = result.data;

            const transactionFromRepo = resultData.transaction;
            const transaction = new Transaction();
            transaction.id = transactionFromRepo.transaction.id;
            transaction.badOrderAmount = transactionFromRepo.badOrderAmount;
            transaction.invoiceNo = transactionFromRepo.transaction.invoiceNo;
            transaction.discount = transactionFromRepo.transaction.discount;
            transaction.transactionDate = transactionFromRepo.transaction.transactionDate;
            transaction.dueDate = transactionFromRepo.transaction.dueDate;
            transaction.storeId = transactionFromRepo.transaction.storeId;
            transaction.store = transactionFromRepo.transaction.store;
            transaction.modeOfPayment = transactionFromRepo.transaction.modeOfPayment;
            transaction.balance = transactionFromRepo.transaction.balance;
            transaction.total = transactionFromRepo.transaction.total;
            transaction.hasUnpaidProductTransaction =
              transactionFromRepo.transaction.hasUnpaidProductTransaction;
            transaction.status = transactionFromRepo.transaction.status;

            const user = new User();
            user.firstName = (<User>transactionFromRepo.transaction.createdBy).firstName;
            user.lastName = (<User>transactionFromRepo.transaction.createdBy).lastName;
            transaction.createdBy = user;

            transaction.productTransactions =
              transactionFromRepo.transaction.productTransactions.map((pt) => {
                const productTransaction = new ProductTransaction();
                productTransaction.id = pt.id;
                productTransaction.quantity = pt.quantity;
                productTransaction.currentQuantity = pt.currentQuantity;
                productTransaction.price = pt.price;
                productTransaction.status = pt.status;
                productTransaction.productName = pt.product.name;
                productTransaction.productId = pt.product.id;
                productTransaction.code = pt.product.code;

                productTransaction.product = new Product();
                productTransaction.product.id = pt.product.id;
                productTransaction.product.code = pt.product.code;
                productTransaction.product.name = pt.product.name;
                productTransaction.product.price = pt.product.price;
                productTransaction.product.productUnit = pt.product.productUnit;

                return productTransaction;
              });

            const invoiceData = new InvoiceData();
            invoiceData.transaction.transaction = transaction;
            invoiceData.transaction.badOrderAmount = transaction.badOrderAmount;
            invoiceData.generalSettings = resultData.generalSettings;

            return invoiceData;
          }
        )
      );
  }

  updateModeOfPayment(transactionId: number, modeOfPayment: number) {
    return this.apollo
      .mutate({
        mutation: UPDATE_MODE_OF_PAYMENT,
        variables: {
          transactionId,
          modeOfPayment
        },
      })
      .pipe(
        map(
          (
            result: MutationResult<{
              updateModeOfPayment: ITransactionOutput;
            }>
          ) => {
            const output = result.data.updateModeOfPayment;
            const payload = output.transaction;
            const errors = output.errors;

            if (payload) {
              return payload;
            }

            if (errors && errors.length > 0) {
              throw new Error(errors[0].message);
            }

            return null;
          }
        )
      );
  }

  markTransactionsAsPaid(transactionIds: Array<number>, paid: boolean) {
    return this.apollo
      .mutate({
        mutation: MARK_TRANSACTIONS_AS_PAID,
        variables: {
          transactionIds,
          paid
        },
      })
      .pipe(
        map(
          (
            result: MutationResult<{
              markTransactionsAsPaid: ITransactionOutput;
            }>
          ) => {
            const output = result.data.markTransactionsAsPaid;
            const payload = output.transaction;
            const errors = output.errors;

            if (payload) {
              return payload;
            }

            if (errors && errors.length > 0) {
              throw new Error(errors[0].message);
            }

            return null;
          }
        )
      );
  }

  sendInvoiceTransaction(
    transactionId: number,
    userId: number,
    file: File) {

    var fd = new FormData();
    var operations = {
      query: SEND_INVOICE_TRANSACTION_QUERY,
      variables: {
        file: null,
        userId,
        transactionId
      }
    }
    var _map = {
      file: ["variables.file"]
    }
    fd.append('operations', JSON.stringify(operations))
    fd.append('map', JSON.stringify(_map))
    fd.append('file', file, file.name)

    const headers = new HttpHeaders().set('GraphQL-preflight', '1');

    return this.http.post<ISendInvoiceTransactionOutput>(environment.beelinaAPIEndPoint, fd, { headers })
      .pipe(
        map((result: ISendInvoiceTransactionOutput) => {
          const data = result.data.sendInvoiceTransaction.boolean;
          return data;
        }),
        catchError((error) => {
          throw new Error(error);
        })
      );
  }
}


