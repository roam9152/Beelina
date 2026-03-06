import { createSelector } from '@ngrx/store';

import { AppStateInterface } from '../../_interfaces/app-state.interface';

export const selectFeature = (state: AppStateInterface) =>
  state.transactionDates;

export const transactionDatesSelector = createSelector(
  selectFeature,
  (state) => state.transactionDates
);

export const endCursorSelector = createSelector(
  selectFeature,
  (state) => state.endCursor
);

export const hasNextPageSelector = createSelector(
  selectFeature,
  (state) => state.hasNextPage
);

export const isLoadingSelector = createSelector(
  selectFeature,
  (state) => state.isLoading
);

export const errorSelector = createSelector(
  selectFeature,
  (state) => state.error
);

export const filterKeywordSelector = createSelector(
  selectFeature,
  (state) => state.filterKeyword
);

export const sortOrderSelector = createSelector(
  selectFeature,
  (state) => state.sortOrder
);

export const fromDateSelector = createSelector(
  selectFeature,
  (state) => state.fromDate
);

export const toDateSelector = createSelector(
  selectFeature,
  (state) => state.toDate
);

export const paymentStatusSelector = createSelector(
  selectFeature,
  (state) => state.paymentStatus
);
