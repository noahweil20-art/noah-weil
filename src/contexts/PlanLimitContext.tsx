import * as React from 'react';
import { useUser } from './UserContext';

interface PlanLimitContextType {
  showPlanLimitModal: (item: string, details?: string) => void;
  closePlanLimitModal: () => void;
  checkLimit: (item: string, isAllowed: boolean, details?: string) => boolean;
  isOpen: boolean;
  item: string;
  details?: string;
  currentPlanName: string;
}

const PlanLimitContext = React.createContext<PlanLimitContextType | undefined>(undefined);

export function PlanLimitProvider({ 
  children,
  onNavigateToPlans
}: { 
  children: React.ReactNode;
  onNavigateToPlans?: () => void;
}) {
  const { plan, isSuperUser } = useUser();
  const [isOpen, setIsOpen] = React.useState(false);
  const [item, setItem] = React.useState('');
  const [details, setDetails] = React.useState<string | undefined>(undefined);

  const showPlanLimitModal = React.useCallback((restrictedItem: string, extraDetails?: string) => {
    setItem(restrictedItem);
    setDetails(extraDetails);
    setIsOpen(true);
  }, []);

  const closePlanLimitModal = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Helper that evaluates if an action is allowed.
   * If not allowed and user is not superUser, triggers the popup and returns false.
   */
  const checkLimit = React.useCallback((restrictedItem: string, isAllowed: boolean, extraDetails?: string): boolean => {
    if (isSuperUser) {
      return true;
    }
    if (!isAllowed) {
      showPlanLimitModal(restrictedItem, extraDetails);
      return false;
    }
    return true;
  }, [isSuperUser, showPlanLimitModal]);

  const currentPlanName = plan?.name || 'Plano Base';

  return (
    <PlanLimitContext.Provider value={{
      showPlanLimitModal,
      closePlanLimitModal,
      checkLimit,
      isOpen,
      item,
      details,
      currentPlanName
    }}>
      {children}
    </PlanLimitContext.Provider>
  );
}

export function usePlanLimit() {
  const context = React.useContext(PlanLimitContext);
  if (!context) {
    throw new Error('usePlanLimit must be used within a PlanLimitProvider');
  }
  return context;
}
