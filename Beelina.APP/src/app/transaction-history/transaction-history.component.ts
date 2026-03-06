import { Component, inject, OnDestroy } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';

import * as TransactionDateStoreActions from '../transaction-history/store/actions';

import { DateFormatter } from '../_helpers/formatters/date-formatter.helper';
import { BaseComponent } from '../shared/components/base-component/base.component';

import { AppStateInterface } from '../_interfaces/app-state.interface';
import { TransactionDatesDataSource } from '../_models/datasources/transaction-dates.datasource';

import { isLoadingSelector } from '../transaction-history/store/selectors';

import { TransactionStatusEnum } from '../_enum/transaction-status.enum';
import { IFilterAndSortTransactions } from '../_interfaces/services/ifilter-and-sort-transactions.interface';
import { TransactionHistoryFilterService } from '../_services/transaction-history-filter.service';
import { TransactionDateInformation } from '../_services/transaction.service';

@Component({
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.scss'],
})
export class TransactionHistoryComponent
  extends BaseComponent
  implements OnDestroy, IFilterAndSortTransactions {

  private router = inject(Router);
  private store = inject(Store<AppStateInterface>);
  private bottomSheet = inject(MatBottomSheet);
  private filterAndSortTransactionsService = inject(TransactionHistoryFilterService);

  constructor() {
    super();

    // Assign the result of store.pipe(select(isLoadingSelector)) to this.$isLoading.
    this.$isLoading = this.store.pipe(select(isLoadingSelector));

    this.filterAndSortTransactionsService
      .setBottomSheet(this.bottomSheet)
      .setPropsWithPaymentStatus(
        'dateStart_transactionHistoryPage',
        'dateEnd_transactionHistoryPage',
        'sortOrder_transactionHistoryPage',
        'paymentStatus_transactionHistoryPage'
      )
      .setDataSource(
        new TransactionDatesDataSource(
          this.store,
          TransactionStatusEnum.CONFIRMED
        )
      );
  }

  ngOnDestroy() {
    this.store.dispatch(
      TransactionDateStoreActions.resetTransactionDatesState()
    );
    this.filterAndSortTransactionsService.destroy();
  }

  /**
   * Navigates to the transaction history page for the specified transaction date.
   * @param transactionDate - The date of the transaction.
   */
  goToTransactionDate(transactionDate: Date) {
    // Format the transaction date as a string
    const formattedDate = DateFormatter.format(transactionDate);

    // Construct the URL for the transaction history page
    const url = `transaction-history/transactions/${formattedDate}`;

    // Navigate to the transaction history page
    this.router.navigate([url]);
  }

  openFilter() {
    this.filterAndSortTransactionsService.openFilter();
  }

  get dataSource(): TransactionDatesDataSource {
    return <TransactionDatesDataSource>this.filterAndSortTransactionsService.dataSource;
  }

  get isFilterActive(): boolean {
    return this.filterAndSortTransactionsService.isFilterActive;
  }
}
