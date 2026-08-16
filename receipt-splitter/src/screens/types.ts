import type { Dispatch } from 'react';
import type { Bill } from '../types';
import type { BillAction } from '../state/billReducer';
import type { Screen } from '../App';

export interface ScreenProps {
  bill: Bill;
  dispatch: Dispatch<BillAction>;
  onBack: () => void;
  onSettings: () => void;
  go: (screen: Screen) => void;
}
