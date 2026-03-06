import { Injectable, inject } from '@angular/core';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { SortOrderOptionsEnum } from 'src/app/_enum/sort-order-options.enum';
import { TransactionStatusEnum } from 'src/app/_enum/transaction-status.enum';
import { PaymentStatusEnum } from 'src/app/_enum/payment-status.enum';
import { DateFormatter } from 'src/app/_helpers/formatters/date-formatter.helper';

import { LocalProductTransaction } from 'src/app/_models/local-db/local-product-transaction.model';
import { LocalTransaction } from 'src/app/_models/local-db/local-transaction.model';
import { Product } from 'src/app/_models/product';
import { ProductTransaction, Transaction } from 'src/app/_models/transaction';
import { TransactionDateInformation, TransactionDto, TransactionService } from '../transaction.service';
import { User } from 'src/app/_models/user.model';

import { LocalBaseDbService } from './local-base-db.service';
import { LocalCustomerStoresDbService } from './local-customer-stores-db.service';
import { LocalProductsDbService } from './local-products-db.service';

@Injectable({
  providedIn: 'root'
})
export class LocalOrdersDbService extends LocalBaseDbService {

  private transactionService = inject(TransactionService);
  private localCustomerStoresDbService = inject(LocalCustomerStoresDbService);
  private localProductsDbService = inject(LocalProductsDbService);
  private pageNumber: number = 1;

  async getMyLocalOrders(status: TransactionStatusEnum, transactionId: Array<number> = [], transactioDates: Array<string> = []) {
    const customerUserId = await this.getCustomerUserId();
    const userId = this.authService.user.value.id;
    const localOrders = <Array<LocalTransaction>>await firstValueFrom(this.localDbService.getAll('transactions'));
    let myLocalOrders = localOrders.filter(c => c.customerUserId == customerUserId && c.createdById === userId);

    if (status !== TransactionStatusEnum.ALL) {
      myLocalOrders = myLocalOrders.filter(c => c.status == status);
    }

    if (transactionId.length > 0) {
      myLocalOrders = myLocalOrders.filter(c => transactionId.includes(c.id));
    }

    if (transactioDates.length > 0) {
      myLocalOrders = myLocalOrders.filter(c => transactioDates.includes(c.transactionDate));
    }

    const transactions = Promise.all(myLocalOrders.map(async (localOrder) => {
      const transaction = new Transaction();
      transaction.id = localOrder.id;
      transaction.modeOfPayment = localOrder.modeOfPayment;
      transaction.invoiceNo = localOrder.invoiceNo;
      transaction.transactionDate = DateFormatter.toDate(localOrder.transactionDate);
      transaction.dueDate = DateFormatter.toDate(localOrder.dueDate);
      transaction.status = localOrder.status;
      transaction.discount = localOrder.discount;
      transaction.hasUnpaidProductTransaction = localOrder.paid;
      transaction.isLocal = true;

      const store = await this.localCustomerStoresDbService.getMyLocalCustomerStore(localOrder.storeId);
      transaction.storeId = localOrder.storeId;
      transaction.store = store;

      const createdBy = new User();
      createdBy.id = userId;
      createdBy.firstName = this.authService.user.value.firstName;
      createdBy.lastName = this.authService.user.value.lastName;
      transaction.createdBy = createdBy;

      const productTransactions = <Array<LocalProductTransaction>>await firstValueFrom(this.localDbService.getAll('productTransactions'));
      const localProductTransactions = productTransactions.filter(c => c.customerUserId == customerUserId && c.transactionId == localOrder.id);

      transaction.productTransactions = await Promise.all(localProductTransactions.map(async (localProductTransaction) => {
        const productTransaction = new ProductTransaction();
        productTransaction.id = localProductTransaction.id;
        productTransaction.code = localProductTransaction.code;
        productTransaction.productId = localProductTransaction.productId;
        productTransaction.productName = localProductTransaction.productName;
        productTransaction.price = localProductTransaction.price;
        productTransaction.quantity = localProductTransaction.quantity;
        productTransaction.currentQuantity = localProductTransaction.currentQuantity;

        const productDetails = await this.localProductsDbService.getMyLocalProductById(localProductTransaction.productId);
        const product = new Product();
        product.id = productDetails.id;
        product.code = productDetails.code;
        product.name = productDetails.name;
        product.price = productDetails.price;
        product.productUnit = productDetails.productUnit;
        productTransaction.product = product;

        return productTransaction;
      }));

      transaction.total = localProductTransactions.reduce((a, b) => a + (b.price * b.quantity), 0);
      transaction.balance = transaction.netTotal;

      return transaction;
    }));

    return transactions;
  }

  async getLatestLocalTransactionNumber(): Promise<string | ''> {
    const customerUserId = await this.getCustomerUserId();
    const userId = this.authService.user.value.id;
    const localOrders = <Array<LocalTransaction>>await firstValueFrom(this.localDbService.getAll('transactions'));
    const myLocalOrders = localOrders.filter(c => c.customerUserId == customerUserId && c.createdById === userId);

    if (myLocalOrders.length === 0) {
      return '';
    }

    // Filter out empty or null invoice numbers and sort by invoice number descending
    const validInvoiceNumbers = myLocalOrders
      .filter(order => order.invoiceNo && order.invoiceNo.trim() !== '')
      .map(order => order.invoiceNo)
      .sort((a, b) => {
        // Extract numeric part for comparison
        const numA = this.extractNumericPart(a);
        const numB = this.extractNumericPart(b);
        return numB - numA; // Descending order
      });

    return validInvoiceNumbers.length > 0 ? validInvoiceNumbers[0] : '';
  }

  private extractNumericPart(code: string): number {
    const match = code.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async hasLocalOrders(status: TransactionStatusEnum) {
    const customerUserId = await this.getCustomerUserId();
    const localOrders = <Array<LocalTransaction>>await firstValueFrom(this.localDbService.getAll('transactions'));
    const localDraftOrders = localOrders.filter(c => c.customerUserId == customerUserId && c.status == status);
    return localDraftOrders.length > 0;
  }

  async saveLocalOrder(status: TransactionStatusEnum, transaction: TransactionDto) {
    const customerUserId = await this.getCustomerUserId();
    const userId = this.authService.user.value.id;
    const localTransaction = new LocalTransaction();
    localTransaction.customerUserId = customerUserId;
    localTransaction.createdById = userId;
    localTransaction.storeId = transaction.storeId;
    localTransaction.status = status;
    localTransaction.modeOfPayment = transaction.modeOfPayment;
    localTransaction.paid = false;
    localTransaction.invoiceNo = transaction.invoiceNo;
    localTransaction.discount = transaction.discount;
    localTransaction.transactionDate = transaction.transactionDate;
    localTransaction.dueDate = transaction.dueDate;

    if (transaction.id === 0) {
      let newId = 0;
      // Save draft order to local database
      return this.localDbService.add('transactions', localTransaction)
        .pipe(
          switchMap(async (res) => {
            newId = res.id;
            const localProductTransactions = transaction.productTransactions.map(productTransaction => {
              const localProductTransaction = new LocalProductTransaction();
              localProductTransaction.customerUserId = customerUserId;
              localProductTransaction.transactionId = res.id;
              localProductTransaction.code = productTransaction.code;
              localProductTransaction.productId = productTransaction.productId;
              localProductTransaction.productName = productTransaction.productName;
              localProductTransaction.price = productTransaction.price;
              localProductTransaction.quantity = productTransaction.quantity;
              localProductTransaction.currentQuantity = productTransaction.currentQuantity;
              return localProductTransaction;
            });
            return this.localDbService.bulkAdd('productTransactions', localProductTransactions);
          }),
          switchMap(() => {
            return of(newId);
          })
        )
    } else {
      localTransaction.id = transaction.id;
      return this.localDbService.update('transactions', localTransaction).pipe(
        switchMap(async (_) => {
          const productTransactions = <Array<LocalProductTransaction>>await firstValueFrom(this.localDbService.getAll('productTransactions'));
          const localProductTransactions = productTransactions.filter(c => c.customerUserId == customerUserId && c.transactionId == localTransaction.id);
          const localProductTransactionsIds = localProductTransactions.map(c => c.id);

          return this.localDbService.bulkDelete('productTransactions', localProductTransactionsIds);
        }),
        switchMap(async (_) => {
          const newLocalProductTransactions = transaction.productTransactions.map(productTransaction => {
            const localProductTransaction = new LocalProductTransaction();
            localProductTransaction.customerUserId = customerUserId;
            localProductTransaction.transactionId = localTransaction.id;
            localProductTransaction.code = productTransaction.code;
            localProductTransaction.productId = productTransaction.productId;
            localProductTransaction.productName = productTransaction.productName;
            localProductTransaction.price = productTransaction.price;
            localProductTransaction.quantity = productTransaction.quantity;
            localProductTransaction.currentQuantity = productTransaction.currentQuantity;
            return localProductTransaction;
          });

          return this.localDbService.bulkAdd('productTransactions', newLocalProductTransactions);
        }),
        switchMap(() => {
          return of(transaction.id);
        })
      )
    }
  }

  async deleteLocalOrders(transactionIds: Array<number> = []) {
    const customerUserId = await this.getCustomerUserId();
    const localProductTransactions = <LocalProductTransaction[]>await firstValueFrom(this.localDbService.getAll('productTransactions'));
    const localProductTransactionsIds = localProductTransactions.filter(c => c.customerUserId == customerUserId && transactionIds.includes(c.transactionId)).map(c => c.id);

    await firstValueFrom(this.localDbService.bulkDelete('transactions', transactionIds));
    await firstValueFrom(this.localDbService.bulkDelete('productTransactions', localProductTransactionsIds));
  }

  async saveLocalOrdersToServer(status: TransactionStatusEnum, transactionIds: Array<number>) {
    const localDraftOrders = await this.getMyLocalOrders(status, transactionIds);

    for (const order of localDraftOrders) {
      const transactionDto = new TransactionDto();
      transactionDto.id = 0;
      transactionDto.storeId = order.storeId;
      transactionDto.modeOfPayment = order.modeOfPayment;
      transactionDto.invoiceNo = order.invoiceNo;
      transactionDto.transactionDate = DateFormatter.format(
        order.transactionDate
      );
      transactionDto.dueDate = DateFormatter.format(
        order.dueDate
      );
      transactionDto.status = order.status;
      transactionDto.discount = order.discount;
      transactionDto.paid = false;
      transactionDto.productTransactions = order.productTransactions;

      try {
        // (1) Send transaction to server
        await firstValueFrom(this.transactionService.registerTransaction(transactionDto));

        // (2) Remove local product transactions
        const localProductTransactionsIds = order.productTransactions.map(c => c.id);
        await firstValueFrom(this.localDbService.bulkDelete('productTransactions', localProductTransactionsIds));

        // (3) Remove local transaction
        await firstValueFrom(this.localDbService.deleteByKey('transactions', order.id));

      } catch (error) {
        console.error(`Error saving local order ${order.id} to server: `, error.message);
      }
    }
  }

  async getMyLocalOrderDates(status: TransactionStatusEnum, limit: number, sortOrder: SortOrderOptionsEnum, fromDate: string, toDate: string, paymentStatus?: PaymentStatusEnum) {
    const customerUserId = await this.getCustomerUserId();
    const userId = this.authService.user.value.id;
    const localOrders = <Array<LocalTransaction>>await firstValueFrom(this.localDbService.getAll('transactions'));
    let localDraftOrders = localOrders.filter(c => c.customerUserId == customerUserId && c.createdById === userId);
    localDraftOrders = localDraftOrders.filter(c => c.status == status);

    const result: {
      endCursor: string;
      hasNextPage: boolean;
      transactionDates: Array<TransactionDateInformation>;
    } = {
      endCursor: '',
      hasNextPage: false,
      transactionDates: [],
    };

    let localOrderDates = [... new Set(localDraftOrders.map((item) => item.transactionDate))];

    // Dates are in descending order by default
    localOrderDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (sortOrder === SortOrderOptionsEnum.ASCENDING) {
      localOrderDates.reverse();
    }

    if (limit > 0) {
      const startIndex = (this.pageNumber - 1) * limit;
      const endIndex = startIndex + limit
      localOrderDates = localOrderDates.slice(startIndex, endIndex);
    }

    if (fromDate && toDate) {
      localOrderDates = localOrderDates.filter(date => {
        const dateObj = new Date(date);
        return dateObj >= new Date(fromDate) && dateObj <= new Date(toDate);
      });
    }

    let transactionDates = localOrderDates.map((orderDate) => {
      const transactionDateInformation = new TransactionDateInformation();
      transactionDateInformation.transactionDate = new Date(orderDate);
      
      // Calculate payment status for this date
      const ordersForDate = localDraftOrders.filter(order => 
        DateFormatter.format(new Date(order.transactionDate)) === DateFormatter.format(new Date(orderDate))
      );
      
      const unpaidOrders = ordersForDate.filter(order => !order.paid);
      transactionDateInformation.numberOfUnPaidTransactions = unpaidOrders.length;
      transactionDateInformation.allTransactionsPaid = unpaidOrders.length === 0;
      transactionDateInformation.isLocal = true;
      
      return transactionDateInformation;
    });

    // Apply payment status filtering if specified
    if (paymentStatus && paymentStatus !== PaymentStatusEnum.All) {
      transactionDates = transactionDates.filter(td => {
        if (paymentStatus === PaymentStatusEnum.Paid) {
          return td.allTransactionsPaid === true;
        } else if (paymentStatus === PaymentStatusEnum.Unpaid) {
          return td.allTransactionsPaid === false;
        }
        return true;
      });
    }

    result.transactionDates = transactionDates;
    this.pageNumber++;

    return result;
  }

  async deleteLocalOrdersByDate(status: TransactionStatusEnum, transactionDates: Array<string>) {
    const transationIds = (await this.getMyLocalOrders(status, [], transactionDates)).map(c => c.id);
    await this.deleteLocalOrders(transationIds);
  }

  reset() {
    this.pageNumber = 1;
  }
}
