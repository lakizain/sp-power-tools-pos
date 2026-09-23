import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp, useFeatureToggles } from './context/SupabaseAppContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoadingSpinner } from './components/ui/LoadingComponents';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/layout/Header';
import { isSupabaseConfigured, getMissingSupabaseEnvMessage } from './lib/supabase';
import { AlertTriangle, Settings as SettingsIcon, ArrowRight } from 'lucide-react';

const POSTerminal = lazy(() => import('./components/pos/POSTerminal').then((module) => ({ default: module.POSTerminal })));
const TransactionsManager = lazy(() => import('./components/transactions/TransactionsManager').then((module) => ({ default: module.TransactionsManager })));
const InventoryManager = lazy(() => import('./components/inventory/InventoryManager').then((module) => ({ default: module.InventoryManager })));
const CustomerManager = lazy(() => import('./components/customers/CustomerManager').then((module) => ({ default: module.CustomerManager })));
const ReportsManager = lazy(() => import('./components/reports/ReportsManager').then((module) => ({ default: module.ReportsManager })));
const Settings = lazy(() => import('./components/settings/Settings').then((module) => ({ default: module.Settings })));
const PriceRanges = lazy(() => import('./components/settings/PriceRanges').then((module) => ({ default: module.PriceRanges })));
const DiscountManager = lazy(() => import('./components/discounts/DiscountManager').then((module) => ({ default: module.DiscountManager })));
const UserManager = lazy(() => import('./components/users/UserManager').then((module) => ({ default: module.UserManager })));
const SupplierManager = lazy(() => import('./components/suppliers/SupplierManager').then((module) => ({ default: module.SupplierManager })));
const ExpenseManager = lazy(() => import('./components/expenses/ExpenseManager').then((module) => ({ default: module.ExpenseManager })));
const ReturnsManager = lazy(() => import('./components/returns/ReturnsManager').then((module) => ({ default: module.ReturnsManager })));
const OutstandingPayments = lazy(() => import('./components/payments/OutstandingPayments').then((module) => ({ default: module.OutstandingPayments })));
const AlertManager = lazy(() => import('./components/alerts/AlertManager').then((module) => ({ default: module.AlertManager })));
const RentalsManager = lazy(() => import('./components/rentals/RentalsManager').then((module) => ({ default: module.RentalsManager })));

const withSuspense = (Component: ComponentType) => (
  <Suspense fallback={<div className="flex h-full min-h-[320px] items-center justify-center"><LoadingSpinner size="lg" text="Loading view..." /></div>}>
    <Component />
  </Suspense>
);

function MissingEnvScreen() {
  const msg = getMissingSupabaseEnvMessage();
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-large border border-white/50 p-8">
        <div className="flex items-start space-x-5">
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Required</h1>
            <p className="text-gray-600 mb-5">
              Supabase environment variables are not configured or still contain the sample values. Replace them with your real Supabase credentials before logging in.
            </p>

            <div className="space-y-4">
              <div className="rounded-2xl bg-red-50/80 border border-red-200/60 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">1</span>
                  <h3 className="font-semibold text-gray-900">Create .env.local</h3>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  In the project root, create a file named <span className="font-mono bg-white px-2 py-0.5 rounded border">.env.local</span>
                </p>
              </div>

              <div className="rounded-2xl bg-orange-50/80 border border-orange-200/60 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">2</span>
                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <SettingsIcon className="h-4 w-4" />
                    <span>Add your Supabase credentials</span>
                  </h3>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  Copy the values from Supabase Dashboard → <span className="font-semibold">Project Settings → API</span>
                </p>
                <div className="mt-3 ml-8 space-y-2">
                  <div className="bg-white rounded-xl p-3 border border-orange-100 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-bold text-orange-700">Key:</span> VITE_SUPABASE_URL</div>
                      <div><span className="font-bold text-orange-700">Value:</span> https://your-project.supabase.co</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-orange-100 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-bold text-orange-700">Key:</span> VITE_SUPABASE_ANON_KEY</div>
                      <div><span className="font-bold text-orange-700">Value:</span> (your anon public key)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/60 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">3</span>
                  <h3 className="font-semibold text-gray-900">Restart the app</h3>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  Save the file and restart Vite with <span className="font-mono bg-white px-2 py-0.5 rounded border">npm run dev</span>.
                </p>
                <div className="mt-3 ml-8 flex items-center space-x-2 text-xs text-emerald-700">
                  <ArrowRight className="h-3 w-3" />
                  <span>If deploying to Vercel, add the same keys there under Project Settings → Environment Variables.</span>
                </div>
              </div>
            </div>

            {msg && (
              <div className="mt-6 p-4 bg-gray-900 rounded-2xl overflow-auto">
                <p className="text-xs font-mono text-red-300 whitespace-pre-wrap">
                  {msg}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { state } = useApp();
  const features = useFeatureToggles();
  const [currentView, setCurrentView] = useState('pos');
  const userRole = state.currentUser?.role;

  useEffect(() => {
    if (!userRole) return;

    const isRestrictedView =
      (userRole === 'cashier' && currentView !== 'pos') ||
      ((currentView === 'transactions' || currentView === 'inventory' || currentView === 'customers' || currentView === 'reports') &&
        !(userRole === 'admin' || userRole === 'manager')) ||
      ((currentView === 'discounts' || currentView === 'suppliers' || currentView === 'expenses' || currentView === 'returns' ||
        currentView === 'rentals' || currentView === 'payments' || currentView === 'alerts') &&
        !(userRole === 'admin' || userRole === 'manager')) ||
      (currentView === 'users' && userRole !== 'admin');

    if (isRestrictedView) {
      setCurrentView('pos');
    }
  }, [currentView, userRole, features]);

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 dark:from-secondary-900 dark:to-secondary-800 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading S&P POWER TOOLS POS..." />
      </div>
    );
  }

  // Show login page if no user is authenticated
  if (!user || !state.currentUser) {
    return <LoginPage />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'pos':
        return withSuspense(POSTerminal);
      case 'transactions':
        if (userRole === 'admin' || userRole === 'manager') {
          return withSuspense(TransactionsManager);
        }
        return withSuspense(POSTerminal);
      case 'inventory':
        if (userRole === 'admin' || userRole === 'manager') {
          return withSuspense(InventoryManager);
        }
        return withSuspense(POSTerminal);
      case 'customers':
        if (userRole === 'admin' || userRole === 'manager') {
          return withSuspense(CustomerManager);
        }
        return withSuspense(POSTerminal);
      case 'reports':
        if (userRole === 'admin' || userRole === 'manager') {
          return withSuspense(ReportsManager);
        }
        return withSuspense(POSTerminal);
      case 'discounts':
        if ((userRole === 'admin' || userRole === 'manager') && features.productDiscount) {
          return withSuspense(DiscountManager);
        }
        return withSuspense(POSTerminal);
      case 'suppliers':
        if ((userRole === 'admin' || userRole === 'manager') && features.supplierManagement) {
          return withSuspense(SupplierManager);
        }
        return withSuspense(POSTerminal);
      case 'expenses':
        if ((userRole === 'admin' || userRole === 'manager') && features.expenseTracking) {
          return withSuspense(ExpenseManager);
        }
        return withSuspense(POSTerminal);
      case 'returns':
        if ((userRole === 'admin' || userRole === 'manager') && features.productReturns) {
          return withSuspense(ReturnsManager);
        }
        return withSuspense(POSTerminal);
      case 'rentals':
        if ((userRole === 'admin' || userRole === 'manager') && features.productRentals) {
          return withSuspense(RentalsManager);
        }
        return withSuspense(POSTerminal);
      case 'payments':
        if ((userRole === 'admin' || userRole === 'manager') && features.outstandingPayments) {
          return withSuspense(OutstandingPayments);
        }
        return withSuspense(POSTerminal);
      case 'alerts':
        if ((userRole === 'admin' || userRole === 'manager') && features.alertMonitoring) {
          return withSuspense(AlertManager);
        }
        return withSuspense(POSTerminal);
      case 'users':
        if (userRole === 'admin') {
          return withSuspense(UserManager);
        }
        return withSuspense(POSTerminal);
      case 'settings':
        return withSuspense(Settings);
      case 'price-ranges':
        if (userRole === 'admin' || userRole === 'manager') {
          return withSuspense(PriceRanges);
        }
        return withSuspense(POSTerminal);
      default:
        return withSuspense(POSTerminal);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 dark:from-secondary-900 dark:to-secondary-800 flex flex-col">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-hidden">
        {state.loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        ) : (
          <div className="animate-fade-in">
            {renderCurrentView()}
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  if (!isSupabaseConfigured) {
    return <MissingEnvScreen />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <CurrencyProvider>
            <AppContent />
          </CurrencyProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;