import { SortOrderOptionsEnum } from 'src/app/_enum/sort-order-options.enum';
import { PaymentStatusEnum } from 'src/app/_enum/payment-status.enum';
import { IBaseStateConnection } from 'src/app/_interfaces/states/ibase-connection.state';
import { IBaseState } from 'src/app/_interfaces/states/ibase.state';

import { TransactionDateInformation } from 'src/app/_services/transaction.service';

export interface ITransactionDateState
  extends IBaseState,
    IBaseStateConnection {
  transactionDates: Array<TransactionDateInformation>;
  fromDate: string;
  toDate: string;
  sortOrder: SortOrderOptionsEnum;
  paymentStatus: PaymentStatusEnum;
}
