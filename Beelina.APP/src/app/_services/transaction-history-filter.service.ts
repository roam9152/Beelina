import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';

import { BaseFilterAndSortService } from './base-filter-and-sort.service';
import { StorageService } from './storage.service';
import { AppStateInterface } from '../_interfaces/app-state.interface';
import { SortOrderOptionsEnum } from '../_enum/sort-order-options.enum';
import { PaymentStatusEnum } from '../_enum/payment-status.enum';

import { FilterAndSortComponent } from '../shared/ui/filter-and-sort/filter-and-sort.component';
import { TransactionDateInformation } from './transaction.service';

import * as TransactionDateStoreActions from '../transaction-history/store/actions';
import {
  fromDateSelector,
  sortOrderSelector,
  toDateSelector,
  paymentStatusSelector,
} from '../transaction-history/store/selectors';

@Injectable({
  providedIn: 'root',
})
export class TransactionHistoryFilterService extends BaseFilterAndSortService<TransactionDateInformation> {
  protected paymentStatusProp: string;
  protected _paymentStatus: PaymentStatusEnum;

  protected override _dialogRef: MatBottomSheetRef<
    FilterAndSortComponent,
    { dateFrom: string; dateTo: string; sortOrder: SortOrderOptionsEnum; paymentStatus: PaymentStatusEnum }
  >;

  constructor(
    protected override storageService: StorageService,
    protected override store: Store<AppStateInterface>
  ) {
    super(storageService, store);
  }

  setPropsWithPaymentStatus(
    dateFromProp: string,
    dateToProp: string,
    sortOrderProp: string,
    paymentStatusProp: string
  ) {
    this.paymentStatusProp = paymentStatusProp;
    
    const defaultPaymentStatus =
      this.storageService.getString(this.paymentStatusProp) ||
      PaymentStatusEnum.All;

    this.setProps(dateFromProp, dateToProp, sortOrderProp);
    
    this.setPropsSubscriptions(
      this.storageService.getString(this.sortOrderProp) || SortOrderOptionsEnum.DESCENDING,
      this.storageService.getString(this.dateFromProp),
      this.storageService.getString(this.dateToProp),
      defaultPaymentStatus
    );

    return this;
  }

  override setPropsSubscriptions(
    defaultSortOrder: string,
    defaultFromDate: string,
    defaultToDate: string,
    defaultPaymentStatus?: string
  ) {
    super.setPropsSubscriptions(defaultSortOrder, defaultFromDate, defaultToDate);

    this.subscription.add(
      this.store.select(paymentStatusSelector).subscribe((paymentStatus) => {
        this._paymentStatus = paymentStatus;
      })
    );

    this.dispatchFilter({
      sortOrder: <SortOrderOptionsEnum>defaultSortOrder,
      dateFrom: defaultFromDate === 'null' ? null : defaultFromDate,
      dateTo: defaultToDate === 'null' ? null : defaultToDate,
      paymentStatus: <PaymentStatusEnum>(defaultPaymentStatus || PaymentStatusEnum.All),
    });
  }

  override openFilter() {
    this._dialogRef = this._bottomSheet.open(FilterAndSortComponent, {
      data: {
        fromDate: this._fromDate,
        toDate: this._toDate,
        sortOrder: this._sortOrder,
        paymentStatus: this._paymentStatus,
      },
    });

    this._dialogRef
      .afterDismissed()
      .subscribe(
        (data: {
          dateFrom: string;
          dateTo: string;
          sortOrder: SortOrderOptionsEnum;
          paymentStatus: PaymentStatusEnum;
        }) => {
          if (!data) return;
          this.dispatchFilter(data);

          this.storageService.storeString(this.dateFromProp, data.dateFrom);
          this.storageService.storeString(this.dateToProp, data.dateTo);
          this.storageService.storeString(this.sortOrderProp, data.sortOrder);
          this.storageService.storeString(this.paymentStatusProp, data.paymentStatus);

          this.resetFilter();
          this.localOrdersDbService.reset();
          this._dataSource.fetchData();
        }
      );
  }

  override dispatchFilter(data: {
    dateFrom: string;
    dateTo: string;
    sortOrder: SortOrderOptionsEnum;
    paymentStatus?: PaymentStatusEnum;
  }) {
    this.store.dispatch(
      TransactionDateStoreActions.setSortAndfilterTransactionDatesAction({
        dateStart: data.dateFrom,
        dateEnd: data.dateTo,
        sortOrder: data.sortOrder,
        paymentStatus: data.paymentStatus || PaymentStatusEnum.All,
      })
    );
  }

  override get isFilterActive(): boolean {
    return (
      this._fromDate !== null ||
      this._toDate !== null ||
      this._sortOrder !== SortOrderOptionsEnum.DESCENDING ||
      this._paymentStatus !== PaymentStatusEnum.All
    );
  }
}