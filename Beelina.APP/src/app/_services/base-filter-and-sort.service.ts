import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { StorageService } from './storage.service';

import {
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { Store } from '@ngrx/store';

import { SortOrderOptionsEnum } from '../_enum/sort-order-options.enum';
import { PaymentStatusEnum } from '../_enum/payment-status.enum';
import { AppStateInterface } from '../_interfaces/app-state.interface';

import * as TransactionDateStoreActions from '../transaction-history/store/actions';
import {
  fromDateSelector,
  sortOrderSelector,
  toDateSelector,
} from '../transaction-history/store/selectors';

import { FilterAndSortComponent } from '../shared/ui/filter-and-sort/filter-and-sort.component';
import { BaseDataSource } from '../_models/datasources/base.datasource';

import { LocalOrdersDbService } from './local-db/local-orders-db.service';

@Injectable({
  providedIn: 'root',
})
export class BaseFilterAndSortService<T> {
  protected dateFromProp: string;
  protected dateToProp: string;
  protected sortOrderProp: string;

  protected _fromDate: string;
  protected _toDate: string;
  protected _sortOrder: SortOrderOptionsEnum;
  protected _dataSource: BaseDataSource<T>;

  protected subscription: Subscription = new Subscription();

  protected _dialogRef: MatBottomSheetRef<
    FilterAndSortComponent,
    { dateFrom: string; dateTo: string; sortOrder: SortOrderOptionsEnum }
  >;

  protected _bottomSheet: MatBottomSheet;

  protected localOrdersDbService = inject(LocalOrdersDbService);

  constructor(
    protected storageService: StorageService,
    protected store: Store<AppStateInterface>
  ) { }

  setProps(dateFromProp: string, dateToProp: string, sortOrderProp: string) {
    this.dateFromProp = dateFromProp;
    this.dateToProp = dateToProp;
    this.sortOrderProp = sortOrderProp;

    this.subscription = new Subscription();

    const defaultSortOrder =
      this.storageService.getString(this.sortOrderProp) ||
      SortOrderOptionsEnum.DESCENDING;
    const defaultFromDate = this.storageService.getString(this.dateFromProp);
    const defaultToDate = this.storageService.getString(this.dateToProp);

    this.setPropsSubscriptions(defaultSortOrder, defaultFromDate === 'null' ? null : defaultFromDate, defaultToDate === 'null' ? null : defaultToDate);

    return this;
  }

  // Overridable
  setPropsSubscriptions(defaultSortOrder: string, defaultFromDate: string, defaultToDate: string) {
    this.subscription = new Subscription();

    this.subscription.add(
      this.store.select(fromDateSelector).subscribe((fromDate) => {
        this._fromDate = fromDate;
      })
    );

    this.subscription.add(
      this.store.select(toDateSelector).subscribe((toDate) => {
        this._toDate = toDate;
      })
    );
    this.subscription.add(
      this.store.select(sortOrderSelector).subscribe((sortOrder) => {
        this._sortOrder = sortOrder;
      })
    );

    this.dispatchFilter({
      sortOrder: <SortOrderOptionsEnum>defaultSortOrder,
      dateFrom: defaultFromDate,
      dateTo: defaultToDate,
    });
  }

  setBottomSheet(bottomSheet: MatBottomSheet) {
    this._bottomSheet = bottomSheet;
    return this;
  }

  setDataSource(dataSource: BaseDataSource<T>) {
    this._dataSource = dataSource;
    return this;
  }

  openFilter() {
    this._dialogRef = this._bottomSheet.open(FilterAndSortComponent, {
      data: {
        fromDate: this._fromDate,
        toDate: this._toDate,
        sortOrder: this._sortOrder,
      },
    });

    this._dialogRef
      .afterDismissed()
      .subscribe(
        (data: {
          dateFrom: string;
          dateTo: string;
          sortOrder: SortOrderOptionsEnum;
        }) => {
          if (!data) return;
          this.dispatchFilter(data);

          this.storageService.storeString(this.dateFromProp, data.dateFrom);
          this.storageService.storeString(this.dateToProp, data.dateTo);
          this.storageService.storeString(this.sortOrderProp, data.sortOrder);

          this.resetFilter();
          this.localOrdersDbService.reset();
          this._dataSource.fetchData();
        }
      );
  }

  // Overriable
  dispatchFilter(data: {
    dateFrom: string;
    dateTo: string;
    sortOrder: SortOrderOptionsEnum;
  }) {
    this.store.dispatch(
      TransactionDateStoreActions.setSortAndfilterTransactionDatesAction({
        dateStart: data.dateFrom,
        dateEnd: data.dateTo,
        sortOrder: data.sortOrder,
        paymentStatus: PaymentStatusEnum.All, // Default value for backward compatibility
      })
    );
  }

  // Overriable
  resetFilter() {
    this.store.dispatch(
      TransactionDateStoreActions.resetTransactionDatesListState()
    );
  }

  destroy() {
    this.subscription.unsubscribe();
    this._dialogRef = null;
  }

  get dataSource(): BaseDataSource<T> {
    return this._dataSource;
  }

  get isFilterActive(): boolean {
    return (
      this._fromDate !== null ||
      this._toDate !== null ||
      this._sortOrder !== SortOrderOptionsEnum.DESCENDING
    );
  }
}
