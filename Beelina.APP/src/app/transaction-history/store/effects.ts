import { inject, Injectable } from '@angular/core';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, from, map, of, switchMap, take } from 'rxjs';
import { Store } from '@ngrx/store';

import * as TransactionDatesActions from './actions';
import {
  TransactionDateInformation,
  TransactionService,
} from 'src/app/_services/transaction.service';
import { TransactionStatusEnum } from 'src/app/_enum/transaction-status.enum';
import { PaymentStatusEnum } from 'src/app/_enum/payment-status.enum';
import { LocalOrdersDbService } from 'src/app/_services/local-db/local-orders-db.service';

import {
  endCursorSelector,
  fromDateSelector,
  sortOrderSelector,
  toDateSelector,
  paymentStatusSelector,
} from '../../transaction-history/store/selectors';
import { SortOrderOptionsEnum } from 'src/app/_enum/sort-order-options.enum';
import { AppStateInterface } from 'src/app/_interfaces/app-state.interface';
import { DateFormatter } from 'src/app/_helpers/formatters/date-formatter.helper';
import { NetworkService } from 'src/app/_services/network.service';

@Injectable()
export class TransactionDatesEffects {

  private actions$ = inject(Actions);
  private transactionService = inject(TransactionService);
  private localOrdersDbService = inject(LocalOrdersDbService);
  private networkService = inject(NetworkService);
  private store = inject(Store<AppStateInterface>);

  getTransactionDates$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionDatesActions.getTransactionDatesAction),
      switchMap((action: { transactionStatus: TransactionStatusEnum }) => {

        let cursor = null,
          limit = 100,
          sortOrder = SortOrderOptionsEnum.DESCENDING,
          fromDate = null,
          toDate = null,
          paymentStatus = PaymentStatusEnum.All;

        this.store
          .select(endCursorSelector)
          .pipe(take(1))
          .subscribe((currentCursor) => (cursor = currentCursor));

        this.store
          .select(sortOrderSelector)
          .pipe(take(1))
          .subscribe((currentSortOrder) => (sortOrder = currentSortOrder));

        this.store
          .select(fromDateSelector)
          .pipe(take(1))
          .subscribe((currentFromDate) => (fromDate = currentFromDate));

        this.store
          .select(toDateSelector)
          .pipe(take(1))
          .subscribe((currentToDate) => (toDate = currentToDate));

        this.store
          .select(paymentStatusSelector)
          .pipe(take(1))
          .subscribe((currentPaymentStatus) => (paymentStatus = currentPaymentStatus));

        if (!this.networkService.isOnline.value) {
          return from(this.localOrdersDbService.getMyLocalOrderDates(action.transactionStatus, limit, sortOrder, fromDate, toDate, paymentStatus)).pipe(
            map(
              (data: {
                endCursor: string;
                hasNextPage: boolean;
                transactionDates: Array<TransactionDateInformation>;
              }) => {
                return TransactionDatesActions.getTransactionDatesActionSuccess(
                  {
                    transactionDates: data.transactionDates,
                    endCursor: data.endCursor,
                    hasNextPage: data.hasNextPage,
                  }
                );
              }
            ));
        }

        return this.transactionService
          .getTransactioDates(action.transactionStatus, cursor, limit, sortOrder, fromDate, toDate, paymentStatus)
          .pipe(
            map(
              (data: {
                endCursor: string;
                hasNextPage: boolean;
                transactionDates: Array<TransactionDateInformation>;
              }) => {
                return data;
              }
            ),
            switchMap((resultFromServer) => {
              return from(this.localOrdersDbService.getMyLocalOrderDates(action.transactionStatus, limit, sortOrder, fromDate, toDate, paymentStatus)).pipe(
                map(
                  (data: {
                    endCursor: string;
                    hasNextPage: boolean;
                    transactionDates: Array<TransactionDateInformation>;
                  }) => {

                    const allTransactionDates = [
                      ...data.transactionDates,
                      ...resultFromServer.transactionDates.filter(
                        (transactionDate) =>
                          !data.transactionDates.some(
                            (t) => DateFormatter.format(t.transactionDate) === DateFormatter.format(transactionDate.transactionDate)
                          )
                      ),
                    ];

                    return TransactionDatesActions.getTransactionDatesActionSuccess(
                      {
                        transactionDates: allTransactionDates,
                        endCursor: data.endCursor,
                        hasNextPage: data.hasNextPage,
                      }
                    );
                  }
                ));
            }),
            catchError((error) =>
              of(
                TransactionDatesActions.getTransactionDatesActionError({
                  error: error.message,
                })
              )
            )
          );
      })
    )
  );
}
