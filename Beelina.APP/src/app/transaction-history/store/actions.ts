import { createAction, props } from '@ngrx/store';

import { SortOrderOptionsEnum } from 'src/app/_enum/sort-order-options.enum';
import { TransactionStatusEnum } from 'src/app/_enum/transaction-status.enum';
import { PaymentStatusEnum } from 'src/app/_enum/payment-status.enum';

import { TransactionDateInformation } from 'src/app/_services/transaction.service';

export const getTransactionDatesAction = createAction(
  '[Transaction Dates] Get Transaction Dates',
  props<{ transactionStatus: TransactionStatusEnum }>()
);

export const getTransactionDatesActionSuccess = createAction(
  '[Transaction Dates] Get Transaction Dates Success',
  props<{
    endCursor: string;
    hasNextPage: boolean;
    transactionDates: Array<TransactionDateInformation>;
  }>()
);

export const setSortAndfilterTransactionDatesAction = createAction(
  '[Transaction Dates] Sort and Filter Transaction Dates',
  props<{
    dateStart: string;
    dateEnd: string;
    sortOrder: SortOrderOptionsEnum;
    paymentStatus: PaymentStatusEnum;
  }>()
);

export const getTransactionDatesActionError = createAction(
  '[Transaction Dates] Get Transaction Dates Failed',
  props<{ error: string }>()
);

export const setTransactionDatesLoadingState = createAction(
  '[Transaction Dates] Set Transaction Dates Loading State',
  props<{ state: boolean }>()
);

export const resetTransactionDatesState = createAction(
  '[Transaction Dates] Reset Transaction Dates State'
);

export const resetTransactionDatesListState = createAction(
  '[Transaction Dates] Reset Transaction Dates List State'
);
