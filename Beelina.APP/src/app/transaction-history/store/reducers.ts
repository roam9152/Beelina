import { createReducer, on } from '@ngrx/store';

import { TransactionDateInformation } from 'src/app/_services/transaction.service';

import { ITransactionDateState } from '../types/transaction-dates-state.interface';
import * as TransactionDateActions from './actions';
import { SortOrderOptionsEnum } from 'src/app/_enum/sort-order-options.enum';
import { PaymentStatusEnum } from 'src/app/_enum/payment-status.enum';

export const initialState: ITransactionDateState = {
  isLoading: false,
  isUpdateLoading: false,
  transactionDates: new Array<TransactionDateInformation>(),
  hasNextPage: false,
  endCursor: null,
  filterKeyword: '',
  fromDate: null,
  toDate: null,
  sortOrder: SortOrderOptionsEnum.DESCENDING,
  paymentStatus: PaymentStatusEnum.All,
  error: null,
};

export const reducers = createReducer(
  initialState,
  on(TransactionDateActions.getTransactionDatesAction, (state, action) => ({
    ...state,
    isLoading: true,
  })),
  on(
    TransactionDateActions.getTransactionDatesActionSuccess,
    (state, action) =>
      <ITransactionDateState>{
        ...state,
        isLoading: false,
        endCursor: action.endCursor,
        transactionDates: state.transactionDates.concat(
          action.transactionDates
        ),
      }
  ),
  on(
    TransactionDateActions.getTransactionDatesActionError,
    (state, action) => ({
      ...state,
      error: action.error,
      isLoading: false,
    })
  ),
  on(
    TransactionDateActions.setTransactionDatesLoadingState,
    (state, action) => ({
      ...state,
      isLoading: action.state,
    })
  ),
  on(
    TransactionDateActions.setSortAndfilterTransactionDatesAction,
    (state, action) => ({
      ...state,
      sortOrder: action.sortOrder,
      fromDate: action.dateStart,
      toDate: action.dateEnd,
      paymentStatus: action.paymentStatus,
    })
  ),
  on(
    TransactionDateActions.resetTransactionDatesListState,
    (state, action) => ({
      ...state,
      transactionDates: initialState.transactionDates,
      endCursor: initialState.endCursor,
    })
  ),
  on(TransactionDateActions.resetTransactionDatesState, (state, action) => ({
    ...initialState,
  }))
);
