import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppVersionService {
  private _appVersion = new BehaviorSubject<string>('1.35.1');

  private translate = inject(TranslateService);

  get copyRightText(): string {
    return `${this.translate.instant(
      'SIDE_DRAWER_SECTION.FOOTER.COPYRIGHT'
    )} ${this.translate.instant(
      'SIDE_DRAWER_SECTION.FOOTER.ALL_RIGHTS_RESERVED'
    )}`;
  }

  get appVersionNumber(): string {
    return this._appVersion.value;
  }

  get appVersion(): string {
    return `${this.translate.instant('SIDE_DRAWER_SECTION.FOOTER.VERSION')} ${this._appVersion.value
      }`;
  }
}
