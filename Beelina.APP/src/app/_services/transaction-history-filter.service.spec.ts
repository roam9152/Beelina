import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

import { TransactionHistoryFilterService } from './transaction-history-filter.service';
import { StorageService } from './storage.service';
import { AppStateInterface } from '../_interfaces/app-state.interface';
import { PaymentStatusEnum } from '../_enum/payment-status.enum';
import { SortOrderOptionsEnum } from '../_enum/sort-order-options.enum';

describe('TransactionHistoryFilterService', () => {
  let service: TransactionHistoryFilterService;
  let mockStore: jasmine.SpyObj<Store<AppStateInterface>>;
  let mockStorageService: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    const storeSpy = jasmine.createSpyObj('Store', ['select', 'dispatch']);
    const storageSpy = jasmine.createSpyObj('StorageService', ['getString', 'storeString']);

    TestBed.configureTestingModule({
      providers: [
        TransactionHistoryFilterService,
        { provide: Store, useValue: storeSpy },
        { provide: StorageService, useValue: storageSpy }
      ]
    });
    
    service = TestBed.inject(TransactionHistoryFilterService);
    mockStore = TestBed.inject(Store) as jasmine.SpyObj<Store<AppStateInterface>>;
    mockStorageService = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default payment status as All', () => {
    mockStorageService.getString.and.returnValue(null);
    mockStore.select.and.returnValue(of(null));

    service.setPropsWithPaymentStatus('dateFrom', 'dateTo', 'sortOrder', 'paymentStatus');

    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({
        paymentStatus: PaymentStatusEnum.All
      })
    );
  });

  it('should include payment status in filter active check', () => {
    // Setup mock return values
    mockStorageService.getString.and.returnValue(null);
    mockStore.select.and.returnValue(of(PaymentStatusEnum.Paid));

    service['_fromDate'] = null;
    service['_toDate'] = null;
    service['_sortOrder'] = SortOrderOptionsEnum.DESCENDING;
    service['_paymentStatus'] = PaymentStatusEnum.Paid;

    expect(service.isFilterActive).toBeTruthy();
  });

  it('should not be active when all filters are at default values', () => {
    mockStorageService.getString.and.returnValue(null);
    mockStore.select.and.returnValue(of(PaymentStatusEnum.All));

    service['_fromDate'] = null;
    service['_toDate'] = null;
    service['_sortOrder'] = SortOrderOptionsEnum.DESCENDING;
    service['_paymentStatus'] = PaymentStatusEnum.All;

    expect(service.isFilterActive).toBeFalsy();
  });
});